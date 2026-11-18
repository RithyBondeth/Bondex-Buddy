#!/usr/bin/env python3
"""Sample explicit app/WebView PIDs without reading user activity or app content."""
import argparse
import json
import platform
import subprocess
import time


def snapshot(pids):
    if platform.system() == "Windows":
        ids = ",".join(str(pid) for pid in pids)
        command = (
            f"@(Get-Process -Id {ids} -ErrorAction Stop | "
            "Select-Object Id,CPU,WorkingSet64) | ConvertTo-Json -Compress"
        )
        raw = subprocess.check_output(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", command],
            text=True,
        )
        rows = json.loads(raw)
        if isinstance(rows, dict):
            rows = [rows]
        return {row["Id"]: (float(row["CPU"] or 0), row["WorkingSet64"]) for row in rows}
    result = {}
    for pid in pids:
        raw = subprocess.check_output(
            ["ps", "-p", str(pid), "-o", "cputime=,rss="], text=True
        ).strip()
        cpu, rss = raw.split()
        days = 0
        if "-" in cpu:
            day, cpu = cpu.split("-", 1)
            days = int(day)
        seconds = days * 86400.0
        multiplier = 1
        for component in reversed(cpu.split(":")):
            seconds += float(component) * multiplier
            multiplier *= 60
        result[pid] = (seconds, int(rss) * 1024)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pid", action="append", type=int, required=True)
    parser.add_argument("--seconds", type=float, default=10)
    parser.add_argument("--label", default="manual sample")
    args = parser.parse_args()
    if not 0.1 <= args.seconds <= 60 or any(pid <= 0 for pid in args.pid):
        parser.error("Use positive PIDs and a duration between 0.1 and 60 seconds")
    pids = sorted(set(args.pid))
    before = snapshot(pids)
    start = time.monotonic()
    time.sleep(args.seconds)
    after = snapshot(pids)
    elapsed = time.monotonic() - start
    cpu = sum(max(0, after[pid][0] - before[pid][0]) for pid in pids)
    print(json.dumps({
        "label": args.label,
        "pids": pids,
        "elapsed_seconds": round(elapsed, 3),
        "cpu_percent_of_one_core": round(cpu / elapsed * 100, 2),
        "summed_rss_mib": round(sum(after[pid][1] for pid in pids) / 1024 ** 2, 2),
        "scope": "Only the supplied PIDs. Include the app AND its WebView processes for an app-level sample. RSS may double-count shared pages.",
    }, indent=2))


if __name__ == "__main__":
    main()
