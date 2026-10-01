"""Pretend to be the ESP32 until the physical sensor is wired.

Examples:
  python mock_sensor.py --fill 75
  python mock_sensor.py --oscillate
"""

from __future__ import annotations

import argparse
import math
import time

import httpx

DEFAULT_URL = "http://127.0.0.1:8000/bins/real-1/update"


def print_ascii_bar(fill: float, dist_cm: float, status_msg: str) -> None:
    bar_width = 24
    pos = int((fill / 100.0) * bar_width)
    pos = max(0, min(bar_width, pos))
    bar = "=" * pos + (">" if pos < bar_width else "") + " " * (bar_width - pos - (1 if pos < bar_width else 0))
    tag = "[CRITICAL BUZZER]" if fill >= 90 else ("[URGENT PICKUP]" if fill >= 70 else "[NORMAL]")
    print(f"  [{bar}] {fill:5.1f}% | Dist: {dist_cm:4.1f}cm {tag:17s} -> {status_msg}")


def send(fill: float, url: str) -> None:
    fill = max(0.0, min(100.0, fill))
    dist_cm = max(0.0, (1.0 - fill / 100.0) * 50.0)
    try:
        r = httpx.post(url, json={"fill_percent": round(fill, 1)}, timeout=5.0)
        r.raise_for_status()
        print_ascii_bar(fill, dist_cm, f"HTTP {r.status_code} OK")
    except Exception as e:
        print_ascii_bar(fill, dist_cm, f"ERROR: {e}")


def main() -> None:
    p = argparse.ArgumentParser(description="Mock HC-SR04 POST for bin real-1")
    p.add_argument("--fill", type=float, help="Single fill percent to POST")
    p.add_argument("--oscillate", action="store_true", help="POST a slow sine wave every 5s")
    p.add_argument("--url", default=DEFAULT_URL)
    args = p.parse_args()

    if args.oscillate:
        t0 = time.time()
        while True:
            # 15–95% over ~2 minutes, like walking a board toward/away from the sensor.
            phase = (time.time() - t0) / 30.0
            fill = 55 + 40 * math.sin(phase)
            send(fill, args.url)
            time.sleep(5)
    elif args.fill is not None:
        send(args.fill, args.url)
    else:
        p.error("pass --fill N or --oscillate")


if __name__ == "__main__":
    main()
