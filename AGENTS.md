# Feishu Bitable Export

## Purpose

Export exactly one user-authorized Feishu Bitable view to a local XLSX file from a direct `/base/` URL or a `/wiki/` URL that currently displays that same view.

## Activate when

The user requests an Excel export of a read-only Feishu Bitable, including a Wiki-embedded Bitable link containing `table` and `view`.

## Use

1. Require one complete `https://*.feishu.cn/base/...?...table=...&view=...` or `https://*.feishu.cn/wiki/...?...table=...&view=...` URL.
2. Run `npm ci`, then `npm run setup-browser` once per fresh environment.
3. Run `npm run export -- "<URL>" --output "<file.xlsx>"`.
4. Use `--headless --no-prompt` only for anonymously accessible views. If sign-in is needed, let the user sign in only in the new isolated browser window.
5. Images are embedded when readable; attachments, video, and audio are downloaded to a same-name `.media` folder. Use `--include-media no` only when the user does not want media.
6. Run `npm run check-workbook -- "<file.xlsx>"` after export.

## Boundaries

- Wiki scope is only the Bitable currently displayed by the provided link. Do not follow ordinary Wiki links, discover unrelated tables, or recurse into child pages.
- Do not use persistent profiles, cookies, `storage-state`, extensions, DOM copying, clipboard automation, or permission bypasses.
- Do not export a view whose records, pagination, or field structure cannot be verified.
- Do not overwrite output without explicit `--force` approval.
- Keep source payloads, cookies, browser traces, screenshots, and user records out of logs and the skill package.
