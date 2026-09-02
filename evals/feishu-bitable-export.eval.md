# Feishu Bitable Export Skill evaluation

The live end-to-end case is intentionally supplied at verification time through a user-authorized public view URL; no source URL, table ID, record, or response fixture is embedded in this skill package.

## Binary checks

1. `npm ci` completes from `package-lock.json`.
2. `npm run export -- --help` exits successfully.
3. A successful live export creates exactly one XLSX output and prints row and column counts.
4. `npm run check-workbook -- <output.xlsx>` reports one sheet, a frozen header, an autofilter, and zero Excel error values.
5. An invalid URL, incomplete source response, count mismatch, or existing output without `--force` exits non-zero and does not publish a new workbook.

```json
{
  "skill": "feishu-bitable-export",
  "criteria": [
    {"id": "install-lockfile", "text": "npm ci installs locked dependencies", "type": "command", "cmd": "test -f package-lock.json"},
    {"id": "entrypoint-help", "text": "The export entrypoint has a help command", "type": "command", "cmd": "node scripts/export-bitable.mjs --help >/dev/null"},
    {"id": "workbook-checker", "text": "The XLSX checker has a help command", "type": "command", "cmd": "node scripts/check-workbook.mjs --help >/dev/null"}
  ],
  "golden": [
    {"id": "public-view", "input": "golden/public-view/input.json", "expected": null, "expected_status": "pending-first-green", "split": "val"},
    {"id": "authorized-view", "input": "golden/authorized-view/input.json", "expected": null, "expected_status": "pending-first-green", "split": "val"},
    {"id": "invalid-url", "input": "golden/invalid-url/input.json", "expected": null, "expected_status": "pending-first-green", "split": "test"}
  ]
}
```
