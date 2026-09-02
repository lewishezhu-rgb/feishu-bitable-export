#!/usr/bin/env python3
"""Validate the bundled evaluation contract without contacting Feishu."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "evals" / "feishu-bitable-export.eval.md"


def main() -> int:
    if sys.argv[1:] not in ([], ["--validate"]):
        print("Usage: python3 scripts/run_evals.py [--validate]", file=sys.stderr)
        return 2
    text = SPEC.read_text(encoding="utf-8")
    required = ["install-lockfile", "entrypoint-help", "workbook-checker", "public-view", "authorized-view", "invalid-url"]
    missing = [item for item in required if item not in text]
    if missing:
        print(json.dumps({"status": "INVALID", "missing": missing}, ensure_ascii=False))
        return 1
    print(json.dumps({"status": "VALID", "note": "Live Feishu export is verified separately with a user-provided URL so no source data is packaged."}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
