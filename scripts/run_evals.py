#!/usr/bin/env python3
"""Run local, non-sensitive checks for the Bitable and current-view Wiki exporter."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    if sys.argv[1:] not in ([], ["--validate"]):
        print("Usage: python3 scripts/run_evals.py [--validate]", file=sys.stderr)
        return 2
    required = [
        ROOT / "evals" / "feishu-bitable-export.eval.md",
        ROOT / "scripts" / "export-bitable.mjs",
        ROOT / "scripts" / "check-workbook.mjs",
    ]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.exists()]
    if missing:
        print(json.dumps({"status": "INVALID", "missing": missing}, ensure_ascii=False))
        return 1
    if sys.argv[1:] == ["--validate"]:
        print(json.dumps({"status": "VALID", "note": "Live tests use user-authorized links and retain no source data."}, ensure_ascii=False))
        return 0
    return subprocess.run(["npm", "run", "export", "--", "--help"], cwd=ROOT, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
