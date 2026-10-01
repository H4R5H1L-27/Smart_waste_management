"""SQLite schema and helpers for the demo."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

def db_path() -> Path:
    return Path(os.environ.get("WASTE_DB_PATH", Path(__file__).resolve().parent / "waste.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS bins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    fill_percent REAL NOT NULL DEFAULT 0,
    last_updated TEXT NOT NULL,
    is_real INTEGER NOT NULL DEFAULT 0,
    traffic TEXT NOT NULL DEFAULT 'medium',
    last_collected_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS classifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    category TEXT NOT NULL,
    confidence REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS fill_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bin_id TEXT NOT NULL,
    fill_percent REAL NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (bin_id) REFERENCES bins(id)
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bin_id TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'mixed',
    confidence REAL NOT NULL DEFAULT 0.0,
    severity TEXT NOT NULL DEFAULT 'medium',
    description TEXT NOT NULL DEFAULT '',
    recommended_action TEXT NOT NULL DEFAULT '',
    recommended_steps TEXT NOT NULL DEFAULT '[]',
    lat REAL DEFAULT NULL,
    lng REAL DEFAULT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'submitted',
    verification_notes TEXT NOT NULL DEFAULT '',
    reviewed_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    title TEXT NOT NULL,
    reason TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT ''
);
"""

BIN_ALIAS_MAP = {
    "real-1": "gymd",
    "real": "gymd",
    "esp32": "gymd",
    "node-1": "gymd",
    "vit-node": "gymd",
    "vit-gymd": "gymd",
    "gymd": "gymd",
    "sim-1": "ab1",
    "sim-2": "ab2",
    "sim-3": "ab3",
    "sim-4": "ab4",
    "sim-5": "ab5",
    "sim-6": "hstlA",
    "sim-7": "hstlB",
    "sim-8": "hstlC",
    "sim-9": "hstlD",
    "sim-10": "hstlE",
}


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
        # Safe column migrations for existing databases
        for col_def in [
            ("bins", "traffic TEXT NOT NULL DEFAULT 'medium'"),
            ("bins", "last_collected_at TEXT NOT NULL DEFAULT ''"),
            ("bins", "device_status TEXT NOT NULL DEFAULT 'online'"),
            ("bins", "camera_label TEXT NOT NULL DEFAULT ''"),
            ("bins", "camera_confidence REAL NOT NULL DEFAULT 0.0"),
            ("reports", "category TEXT NOT NULL DEFAULT 'mixed'"),
            ("reports", "confidence REAL NOT NULL DEFAULT 0.0"),
            ("reports", "severity TEXT NOT NULL DEFAULT 'medium'"),
            ("reports", "description TEXT NOT NULL DEFAULT ''"),
            ("reports", "recommended_action TEXT NOT NULL DEFAULT ''"),
            ("reports", "recommended_steps TEXT NOT NULL DEFAULT '[]'"),
            ("reports", "lat REAL DEFAULT NULL"),
            ("reports", "lng REAL DEFAULT NULL"),
            ("reports", "image_url TEXT NOT NULL DEFAULT ''"),
            ("reports", "status TEXT NOT NULL DEFAULT 'submitted'"),
            ("reports", "verification_notes TEXT NOT NULL DEFAULT ''"),
            ("reports", "reviewed_at TEXT NOT NULL DEFAULT ''"),
        ]:
            table, col = col_def
            try:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col}")
            except sqlite3.OperationalError:
                pass


def _row_to_bin(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    return {
        "id": d["id"],
        "name": d["name"],
        "lat": float(d["lat"]),
        "lng": float(d["lng"]),
        "fill_percent": round(float(d["fill_percent"]), 1),
        "last_updated": d["last_updated"],
        "is_real": bool(d["is_real"]),
        "traffic": d.get("traffic", "medium"),
        "last_collected_at": d.get("last_collected_at", ""),
        "device_status": d.get("device_status", "online"),
        "camera_label": d.get("camera_label", ""),
        "camera_confidence": round(float(d.get("camera_confidence", 0.0)), 2),
    }


def upsert_bin(
    bin_id: str,
    name: str,
    lat: float,
    lng: float,
    fill_percent: float,
    is_real: bool,
    traffic: str = "medium",
    last_collected_at: str = "",
    device_status: str = "online",
    camera_label: str = "",
    camera_confidence: float = 0.0,
) -> None:
    now = utcnow()
    if not last_collected_at:
        last_collected_at = now
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO bins (id, name, lat, lng, fill_percent, last_updated, is_real, traffic, last_collected_at, device_status, camera_label, camera_confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                lat = excluded.lat,
                lng = excluded.lng,
                is_real = excluded.is_real,
                traffic = excluded.traffic,
                device_status = excluded.device_status,
                camera_label = excluded.camera_label,
                camera_confidence = excluded.camera_confidence
            """,
            (bin_id, name, lat, lng, fill_percent, now, int(is_real), traffic, last_collected_at, device_status, camera_label, camera_confidence),
        )


def list_bins() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM bins ORDER BY id").fetchall()
    return [_row_to_bin(r) for r in rows]


def get_bin(bin_id: str) -> dict[str, Any] | None:
    resolved = BIN_ALIAS_MAP.get(bin_id, bin_id)
    with connect() as conn:
        row = conn.execute("SELECT * FROM bins WHERE id = ?", (resolved,)).fetchone()
        if not row and resolved != bin_id:
            row = conn.execute("SELECT * FROM bins WHERE id = ?", (bin_id,)).fetchone()
    return _row_to_bin(row) if row else None


def update_fill(bin_id: str, fill_percent: float) -> bool:
    resolved = BIN_ALIAS_MAP.get(bin_id, bin_id)
    fill_percent = max(0.0, min(100.0, float(fill_percent)))
    now = utcnow()
    with connect() as conn:
        cur = conn.execute(
            "UPDATE bins SET fill_percent = ?, last_updated = ? WHERE id = ?",
            (fill_percent, now, resolved),
        )
        if cur.rowcount == 0:
            cur = conn.execute(
                "UPDATE bins SET fill_percent = ?, last_updated = ? WHERE id = ?",
                (fill_percent, now, bin_id),
            )
            if cur.rowcount == 0:
                return False
            resolved = bin_id
        conn.execute(
            "INSERT INTO fill_history (bin_id, fill_percent, timestamp) VALUES (?, ?, ?)",
            (resolved, fill_percent, now),
        )
    return True


def update_collection_time(bin_id: str, collected_at: str | None = None) -> bool:
    resolved = BIN_ALIAS_MAP.get(bin_id, bin_id)
    now = collected_at or utcnow()
    with connect() as conn:
        cur = conn.execute(
            "UPDATE bins SET last_collected_at = ?, last_updated = ? WHERE id = ?",
            (now, now, resolved),
        )
        return cur.rowcount > 0


def add_classification(category: str, confidence: float) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO classifications (timestamp, category, confidence) VALUES (?, ?, ?)",
            (utcnow(), category, float(confidence)),
        )


def category_counts() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT category, COUNT(*) AS count
            FROM classifications
            GROUP BY category
            ORDER BY count DESC, category
            """
        ).fetchall()
    return [{"category": r["category"], "count": r["count"]} for r in rows]


def _row_to_report(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    raw_steps = d.get("recommended_steps", "[]")
    steps: list[str] = []
    if raw_steps:
        try:
            parsed = json.loads(raw_steps)
            if isinstance(parsed, list):
                steps = [str(s) for s in parsed]
            elif isinstance(parsed, str):
                steps = [parsed]
        except Exception:
            steps = [s.strip() for s in raw_steps.splitlines() if s.strip()]
    d["recommended_steps"] = steps
    return d


def add_report(
    bin_id: str,
    message: str = "",
    category: str = "mixed",
    confidence: float = 0.85,
    severity: str = "medium",
    description: str = "",
    recommended_action: str = "",
    recommended_steps: list[str] | str = "[]",
    lat: float | None = None,
    lng: float | None = None,
    image_url: str = "",
    status: str = "submitted",
    verification_notes: str = "",
    reviewed_at: str = "",
) -> dict[str, Any]:
    resolved = BIN_ALIAS_MAP.get(bin_id, bin_id)
    now = utcnow()
    msg = message.strip() or description.strip() or f"Citizen waste report near {resolved}"
    if isinstance(recommended_steps, list):
        steps_json = json.dumps(recommended_steps)
        steps_list = [str(s) for s in recommended_steps]
    else:
        steps_json = str(recommended_steps or "[]")
        try:
            parsed = json.loads(steps_json)
            steps_list = [str(s) for s in parsed] if isinstance(parsed, list) else [steps_json]
        except Exception:
            steps_list = [steps_json] if steps_json else []

    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO reports (
                bin_id, message, timestamp, category, confidence,
                severity, description, recommended_action, recommended_steps, lat, lng, image_url,
                status, verification_notes, reviewed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                resolved,
                msg,
                now,
                category,
                float(confidence),
                severity,
                description,
                recommended_action,
                steps_json,
                lat,
                lng,
                image_url,
                status,
                verification_notes,
                reviewed_at,
            ),
        )
        report_id = cur.lastrowid
    return {
        "id": report_id,
        "bin_id": resolved,
        "message": msg,
        "timestamp": now,
        "category": category,
        "confidence": round(float(confidence), 2),
        "severity": severity,
        "description": description,
        "recommended_action": recommended_action,
        "recommended_steps": steps_list,
        "lat": lat,
        "lng": lng,
        "image_url": image_url,
        "status": status,
        "verification_notes": verification_notes,
        "reviewed_at": reviewed_at,
    }


def get_report(report_id: int) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT id, bin_id, message, timestamp, category, confidence,
                   severity, description, recommended_action, recommended_steps, lat, lng, image_url,
                   status, verification_notes, reviewed_at
            FROM reports
            WHERE id = ?
            """,
            (report_id,),
        ).fetchone()
    return _row_to_report(row) if row else None


def list_reports(limit: int = 50, status: str | None = None) -> list[dict[str, Any]]:
    with connect() as conn:
        if status:
            rows = conn.execute(
                """
                SELECT id, bin_id, message, timestamp, category, confidence,
                       severity, description, recommended_action, recommended_steps, lat, lng, image_url,
                       status, verification_notes, reviewed_at
                FROM reports
                WHERE status = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (status, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, bin_id, message, timestamp, category, confidence,
                       severity, description, recommended_action, recommended_steps, lat, lng, image_url,
                       status, verification_notes, reviewed_at
                FROM reports
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
    return [_row_to_report(r) for r in rows]


def update_report_status(
    report_id: int,
    status: str,
    verification_notes: str = "",
) -> dict[str, Any] | None:
    rep = get_report(report_id)
    if not rep:
        return None
    now = utcnow()
    with connect() as conn:
        conn.execute(
            """
            UPDATE reports
            SET status = ?, verification_notes = ?, reviewed_at = ?
            WHERE id = ?
            """,
            (status, verification_notes or rep.get("verification_notes", ""), now, report_id),
        )

        # Handoff logic:
        # Verified -> creates or keeps an open task
        if status == "verified":
            task_id = f"rep-{report_id}"
            title = f"Citizen Report #{report_id}: {rep.get('category', 'waste').title()}"
            reason = f"Verified citizen report ({rep.get('severity', 'medium').upper()}): {rep.get('description') or rep.get('message')}"
            lat = rep["lat"]
            lng = rep["lng"]
            if lat is None or lng is None:
                bin_info = get_bin(rep["bin_id"])
                if bin_info:
                    lat, lng = bin_info["lat"], bin_info["lng"]
                else:
                    lat, lng = 12.8400, 80.1525
            conn.execute(
                """
                INSERT INTO tasks (id, source_type, source_id, title, reason, lat, lng, severity, status, created_at)
                VALUES (?, 'report', ?, ?, ?, ?, ?, ?, 'open', ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    reason = excluded.reason,
                    status = CASE WHEN tasks.status = 'completed' THEN 'open' ELSE tasks.status END
                """,
                (task_id, str(report_id), title, reason, lat, lng, rep.get("severity", "medium"), now),
            )
        elif status == "rejected":
            # Rejected reports must NEVER produce or keep collection tasks!
            conn.execute(
                "DELETE FROM tasks WHERE source_type = 'report' AND source_id = ?",
                (str(report_id),),
            )
        elif status == "resolved":
            conn.execute(
                "UPDATE tasks SET status = 'completed', completed_at = ? WHERE source_type = 'report' AND source_id = ?",
                (now, str(report_id)),
            )

    return get_report(report_id)


def list_tasks(status: str | None = None) -> list[dict[str, Any]]:
    with connect() as conn:
        if status:
            rows = conn.execute(
                "SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC"
            ).fetchall()
    return [dict(r) for r in rows]


def get_task(task_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return dict(row) if row else None


def update_task_status(task_id: str, status: str) -> bool:
    with connect() as conn:
        cur = conn.execute(
            "UPDATE tasks SET status = ? WHERE id = ?",
            (status, task_id),
        )
        return cur.rowcount > 0


def complete_task(task_id: str) -> dict[str, Any] | None:
    task = get_task(task_id)
    if not task:
        return None
    now = utcnow()
    with connect() as conn:
        conn.execute(
            "UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?",
            (now, task_id),
        )

    # Sync back to originating record
    if task["source_type"] == "report":
        try:
            rep_id = int(task["source_id"])
            update_report_status(rep_id, "resolved", verification_notes="Resolved via collection route completion.")
        except ValueError:
            pass
    elif task["source_type"] == "bin":
        import random
        bin_id = task["source_id"]
        update_fill(bin_id, round(random.uniform(5.0, 15.0), 1))
        update_collection_time(bin_id, now)

    return get_task(task_id)


def sync_tasks_from_sources(threshold: float = 70.0) -> list[dict[str, Any]]:
    """Synchronizes collection tasks from qualifying high-fill bins and verified reports."""
    now = utcnow()
    bins = list_bins()
    with connect() as conn:
        # 1. Sync qualifying high-fill bins
        for b in bins:
            task_id = b["id"]
            fill = float(b["fill_percent"])
            if fill >= threshold:
                title = f"High-Fill Bin: {b['name']} ({fill:.0f}%)"
                reason = f"Ultrasonic fill level {fill:.0f}% exceeds {threshold:.0f}% collection threshold"
                sev = "high" if fill >= 85.0 else "medium"
                conn.execute(
                    """
                    INSERT INTO tasks (id, source_type, source_id, title, reason, lat, lng, severity, status, created_at)
                    VALUES (?, 'bin', ?, ?, ?, ?, ?, ?, 'open', ?)
                    ON CONFLICT(id) DO UPDATE SET
                        title = excluded.title,
                        reason = excluded.reason,
                        lat = excluded.lat,
                        lng = excluded.lng,
                        severity = excluded.severity
                    """,
                    (task_id, b["id"], title, reason, b["lat"], b["lng"], sev, now),
                )
            else:
                # If bin was emptied/dropped below threshold and task is still open, close or remove
                conn.execute(
                    "DELETE FROM tasks WHERE id = ? AND status = 'open'",
                    (task_id,),
                )

        # 2. Sync verified reports
        verified_reports = conn.execute(
            "SELECT * FROM reports WHERE status = 'verified'"
        ).fetchall()
        for r in verified_reports:
            rep_id = r["id"]
            task_id = f"rep-{rep_id}"
            title = f"Citizen Report #{rep_id}: {r['category'].title()}"
            reason = f"Verified citizen report ({r['severity'].upper()}): {r['description'] or r['message']}"
            lat = r["lat"]
            lng = r["lng"]
            if lat is None or lng is None:
                b_match = next((x for x in bins if x["id"] == r["bin_id"]), None)
                lat = b_match["lat"] if b_match else 12.8400
                lng = b_match["lng"] if b_match else 80.1525
            conn.execute(
                """
                INSERT INTO tasks (id, source_type, source_id, title, reason, lat, lng, severity, status, created_at)
                VALUES (?, 'report', ?, ?, ?, ?, ?, ?, 'open', ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    reason = excluded.reason,
                    lat = excluded.lat,
                    lng = excluded.lng
                """,
                (task_id, str(rep_id), title, reason, lat, lng, r["severity"], now),
            )

        # 3. Clean up tasks for rejected reports
        rejected_reports = conn.execute("SELECT id FROM reports WHERE status = 'rejected'").fetchall()
        for r in rejected_reports:
            conn.execute(
                "DELETE FROM tasks WHERE source_type = 'report' AND source_id = ?",
                (str(r["id"]),),
            )

    return list_tasks()


def update_telemetry(
    bin_id: str,
    fill_percent: float,
    device_status: str = "online",
    camera_label: str = "",
    camera_confidence: float = 0.0,
) -> bool:
    resolved = BIN_ALIAS_MAP.get(bin_id, bin_id)
    fill_percent = max(0.0, min(100.0, float(fill_percent)))
    now = utcnow()
    with connect() as conn:
        cur = conn.execute(
            """
            UPDATE bins
            SET fill_percent = ?, last_updated = ?, device_status = ?,
                camera_label = ?, camera_confidence = ?
            WHERE id = ? OR id = ?
            """,
            (fill_percent, now, device_status, camera_label, float(camera_confidence), resolved, bin_id),
        )
        if cur.rowcount == 0:
            return False
        conn.execute(
            "INSERT INTO fill_history (bin_id, fill_percent, timestamp) VALUES (?, ?, ?)",
            (resolved, fill_percent, now),
        )
    return True


def reset_demo_scenario() -> dict[str, Any]:
    """Resets to the repeatable, baseline Chennai scenario specified in the guide."""
    from simulate import SEED_BINS
    now = utcnow()
    with connect() as conn:
        # Clear reports and tasks
        conn.execute("DELETE FROM reports")
        conn.execute("DELETE FROM tasks")

    # Restore bins
    for b_id, name, lat, lng, is_real, fill, traffic in SEED_BINS:
        dev_status = "online"
        cam_label = "plastic" if is_real else ""
        cam_conf = 0.94 if is_real else 0.0
        upsert_bin(
            bin_id=b_id,
            name=name,
            lat=lat,
            lng=lng,
            fill_percent=fill,
            is_real=is_real,
            traffic=traffic,
            last_collected_at=now,
            device_status=dev_status,
            camera_label=cam_label,
            camera_confidence=cam_conf,
        )
        update_fill(b_id, fill)

    # Seed 3 predictable demo citizen reports:
    # 1. Submitted (Pending Review) - high severity pileup near AB1
    add_report(
        bin_id="ab1",
        message="Severe overflow of plastic bottles and food boxes outside AB1 entrance walkway.",
        category="plastic",
        confidence=0.92,
        severity="high",
        description="Overflowing beverage containers and disposable plastic trays.",
        recommended_action="Dispatch priority collection truck within 2 hours.",
        recommended_steps=[
            "Deploy 120L mobile recycling hopper to AB1 entrance walkway.",
            "Rake and gather dry plastic beverage bottles and packaging within 15m perimeter.",
            "Replace bin liner and sanitize high-contact lid surfaces."
        ],
        lat=12.8424,
        lng=80.1536,
        image_url="/samples/plastic.jpg",
        status="submitted",
    )

    # 2. Verified - organic mess waste near Hostel Block A (becomes Collection Task)
    add_report(
        bin_id="hstlA",
        message="Commercial food scraps and organic waste dump near dining hall rear gate.",
        category="organic",
        confidence=0.96,
        severity="high",
        description="Spoiled food scraps attracting pests in tropical midday temperature.",
        recommended_action="Clear organic waste immediately to prevent pest infestation.",
        recommended_steps=[
            "Dispatch rapid wet-waste collection cart to dining hall rear.",
            "Segregate compostable food scraps into sealed organic drum.",
            "Pressure-wash pavement with biodegradable deodorizing wash."
        ],
        lat=12.8388,
        lng=80.1558,
        image_url="/samples/organic.jpg",
        status="verified",
        verification_notes="Verified by Facilities Supervisor Ramanathan K. High priority.",
    )

    # 3. Rejected - dry leaf clutter under Gazebo (MUST NOT create a collection task)
    add_report(
        bin_id="gzbo",
        message="Dry garden leaves and fallen twigs scattered near gazebo benches.",
        category="trash",
        confidence=0.88,
        severity="low",
        description="Normal seasonal leaf litter.",
        recommended_action="Include in routine campus grounds sweep.",
        recommended_steps=[
            "Assign grounds crew to sweep leaf litter under gazebo.",
            "Deposit collected leaves into campus compost pit.",
            "Inspect nearby perimeter benches for stray litter."
        ],
        lat=12.8421,
        lng=80.1528,
        image_url="/samples/paper.jpg",
        status="rejected",
        verification_notes="Rejected for motorized truck route. Scheduled for manual grounds sweep.",
    )

    # Sync tasks
    sync_tasks_from_sources()

    return {
        "status": "ok",
        "scenario": "repeatable_chennai_baseline",
        "bins": list_bins(),
        "reports": list_reports(),
        "tasks": list_tasks(),
    }



def delete_report(report_id: int) -> bool:
    with connect() as conn:
        cur = conn.execute("DELETE FROM reports WHERE id = ?", (report_id,))
        return cur.rowcount > 0


def fill_history(bin_id: str, limit: int = 40) -> list[dict[str, Any]]:
    resolved = BIN_ALIAS_MAP.get(bin_id, bin_id)
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT fill_percent, timestamp FROM fill_history
            WHERE bin_id = ? OR bin_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (resolved, bin_id, limit),
        ).fetchall()
    return [dict(r) for r in reversed(rows)]


def seed_history_and_analytics() -> None:
    """Populate initial history and sample classifications if empty for cold-start demo."""
    from datetime import timedelta
    now_dt = datetime.now(timezone.utc).replace(microsecond=0)

    with connect() as conn:
        # 1. Seed fill history for bins that have < 3 samples
        bins = conn.execute("SELECT id, fill_percent FROM bins").fetchall()
        for b in bins:
            count = conn.execute(
                "SELECT COUNT(*) FROM fill_history WHERE bin_id = ?", (b["id"],)
            ).fetchone()[0]
            if count < 3:
                target_fill = float(b["fill_percent"])
                # Generate 4 history points leading up to target_fill with positive drift
                # e.g., 3 hrs ago, 2 hrs ago, 1 hr ago, and now
                increments = [14.0, 9.5, 4.8, 0.0]
                for idx, minus_hours in enumerate([3.0, 2.0, 1.0, 0.0]):
                    past_ts = (now_dt - timedelta(hours=minus_hours)).isoformat()
                    past_fill = max(5.0, round(target_fill - increments[idx], 1))
                    conn.execute(
                        "INSERT INTO fill_history (bin_id, fill_percent, timestamp) VALUES (?, ?, ?)",
                        (b["id"], past_fill, past_ts),
                    )

        # 2. Seed initial classifications if empty
        class_count = conn.execute("SELECT COUNT(*) FROM classifications").fetchone()[0]
        if class_count == 0:
            samples = [
                ("plastic", 0.94),
                ("plastic", 0.91),
                ("plastic", 0.88),
                ("plastic", 0.96),
                ("paper", 0.89),
                ("paper", 0.92),
                ("paper", 0.87),
                ("glass", 0.95),
                ("glass", 0.90),
                ("metal", 0.86),
                ("metal", 0.93),
                ("organic", 0.97),
                ("organic", 0.89),
                ("cardboard", 0.91),
            ]
            for cat, conf in samples:
                conn.execute(
                    "INSERT INTO classifications (timestamp, category, confidence) VALUES (?, ?, ?)",
                    (utcnow(), cat, conf),
                )

