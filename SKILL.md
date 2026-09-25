---
name: feishu-bitable-export
description: >-
  Export one user-authorized Feishu Bitable view to XLSX from a direct /base link or a
  Wiki link that currently displays that same Bitable view. Use when users ask to export
  a read-only Feishu Bitable or Wiki-embedded Bitable without copy permission. Runs an
  isolated Playwright browser, keeps completeness checks, and can download field media.
license: MIT
activation: /feishu-bitable-export
provenance:
  maintainer: workspace-owner
  version: 1.1.0
  created: 2026-09-24
  source_references:
    - Original feishu-bitable-export main package
    - User-confirmed Wiki current-view scope
metadata:
  author: workspace-owner
  version: 1.1.0
  created: 2026-09-24
  last_reviewed: 2026-09-24
  review_interval_days: 90
  dependencies: [Node.js 20+, npm, Playwright Chromium]
compatibility: >-
  Requires terminal access and a graphical session only when the user must manually sign
  in to Feishu. Public Bitable views may run headlessly.
---

# /feishu-bitable-export

Export the one Bitable view currently displayed by a user-provided Feishu `/base/` or Wiki `/wiki/` link into XLSX.

## Use

1. Accept one complete Feishu HTTPS link containing `table` and `view`.
2. Run `npm ci`, then `npm run setup-browser` in a fresh environment.
3. Run `npm run export -- "<URL>" --output "./export.xlsx"`.
4. For a Wiki link, export only the Bitable view that the current link displays. Do not scan unrelated tables, follow ordinary Wiki links, or recurse into directories.
5. If Feishu requests authentication, open a new visible isolated browser, let the user sign in there, confirm the displayed view, then continue at the terminal prompt. Never use normal browser profiles, cookies, storage state, extensions, or open tabs.
6. By default, download readable image/attachment/media values. Images are embedded into the XLSX when possible; attachments, video, and audio are stored in a same-name `.media` folder and remain linked from their cells. Use `--include-media no` to disable this.
7. Run `npm run check-workbook -- "./export.xlsx"` after export.

## Completeness and safety

- Export only visible fields in the current Bitable view order.
- Unfiltered views require unique exported record count to match source metadata. Real filtered views require a provider completion signal; otherwise fail closed.
- Stop before writing XLSX on login/permission errors, malformed page data, repeated pagination, no progress, or count mismatch.
- Preserve readable links and escape formula-like text before writing Excel cells.
- On unreadable media, retain the cell text/link and add a visible cell note instead of silently dropping it.
- Never overwrite an existing XLSX without explicit `--force` approval.

## Gotchas

- A Wiki URL is supported only when it directly displays the specified Bitable via its `table` and `view` parameters. A Wiki page containing no displayed Bitable stops with a clear error.
- A view can render publicly but still reject its data request; use user-mediated sign-in in the temporary browser. Do not reuse a personal browser session.
- The skill uses only the data exposed to the current authorized web page; it does not bypass permissions or persist raw responses, credentials, cookies, screenshots, or source records.
