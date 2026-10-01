"""Tests for verified/rejected report task handoffs, telemetry, and demo reset."""

def test_demo_reset_repeatable_scenario(client):
    res = client.post("/demo/reset")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert len(data["bins"]) >= 100
    assert len(data["reports"]) == 3
    # High-fill bins (>=70%) + 1 verified report = total open tasks
    high_bins = [b for b in data["bins"] if float(b["fill_percent"]) >= 70.0]
    assert len(data["tasks"]) == len(high_bins) + 1

    # Check that report 1 is submitted, report 2 is verified, report 3 is rejected
    reports = client.get("/reports").json()
    rep_map = {r["bin_id"]: r for r in reports}
    assert rep_map["ab1"]["status"] == "submitted"
    assert rep_map["hstlA"]["status"] == "verified"
    assert rep_map["gzbo"]["status"] == "rejected"

    # Tasks should only include qualifying high-fill bins and verified report
    tasks = client.get("/tasks?status=open").json()
    task_sources = [t["source_type"] for t in tasks]
    assert "report" in task_sources
    assert "bin" in task_sources
    # Verify rejected report gzbo is NOT in tasks
    assert not any(t.get("source_id") == str(rep_map["gzbo"]["id"]) for t in tasks)


def test_verified_report_creates_task_and_reject_deletes(client):
    client.post("/demo/reset")
    # Submit a new report
    r = client.post("/reports", json={"bin_id": "mga", "message": "Fallen trash bags behind auditorium"})
    rep_id = r.json()["id"]
    assert r.json()["status"] == "submitted"

    # Tasks before verification should not contain this report
    tasks_before = client.get("/tasks?status=open").json()
    assert not any(t["source_id"] == str(rep_id) for t in tasks_before)

    # Verify report
    verify_res = client.patch(f"/reports/{rep_id}/status", json={
        "status": "verified",
        "verification_notes": "Confirmed on CCTV. Scheduled for truck."
    })
    assert verify_res.status_code == 200
    assert verify_res.json()["report"]["status"] == "verified"

    # Now task must exist!
    tasks_after = client.get("/tasks?status=open").json()
    rep_task = next((t for t in tasks_after if t["source_id"] == str(rep_id)), None)
    assert rep_task is not None
    assert rep_task["source_type"] == "report"

    # Now reject the report
    reject_res = client.patch(f"/reports/{rep_id}/status", json={
        "status": "rejected",
        "verification_notes": "Duplicate entry."
    })
    assert reject_res.status_code == 200
    assert reject_res.json()["report"]["status"] == "rejected"

    # Task must now be removed from open tasks!
    tasks_rejected = client.get("/tasks?status=open").json()
    assert not any(t["source_id"] == str(rep_id) for t in tasks_rejected)


def test_complete_task_resolves_report_and_resets_bin(client):
    client.post("/demo/reset")
    tasks = client.get("/tasks?status=open").json()

    # Find a report task
    rep_task = next(t for t in tasks if t["source_type"] == "report")
    rep_id = int(rep_task["source_id"])

    # Complete report task
    complete_res = client.post(f"/tasks/{rep_task['id']}/complete")
    assert complete_res.status_code == 200
    assert complete_res.json()["task"]["status"] == "completed"

    # Check report status is resolved
    rep = client.get(f"/reports/{rep_id}").json()
    assert rep["status"] == "resolved"

    # Find a bin task
    bin_task = next(t for t in tasks if t["source_type"] == "bin")
    bin_id = bin_task["source_id"]

    # Complete bin task
    complete_bin_res = client.post(f"/tasks/{bin_task['id']}/complete")
    assert complete_bin_res.status_code == 200

    # Bin fill should now be low (<20%)
    b = client.get(f"/bins/{bin_id}").json()
    assert b["fill_percent"] <= 20.0


def test_device_telemetry_update(client):
    res = client.post("/device/telemetry", json={
        "bin_id": "gymd",
        "fill_percent": 88.5,
        "device_status": "online",
        "camera_label": "cardboard",
        "camera_confidence": 0.95
    })
    assert res.status_code == 200
    bin_data = res.json()["bin"]
    assert bin_data["fill_percent"] == 88.5
    assert bin_data["device_status"] == "online"
    assert bin_data["camera_label"] == "cardboard"
    assert bin_data["camera_confidence"] == 0.95
