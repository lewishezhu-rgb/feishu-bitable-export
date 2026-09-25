# Feishu Bitable Export

[中文](#中文) | [English](#english)

---

<a id="中文"></a>

## 中文

将你有合法查看权限的飞书多维表格**当前视图**导出为 Excel（`.xlsx`）。现在也支持带 `table` 和 `view` 参数的 Wiki 链接：只导出这个 Wiki 链接当前页面实际显示的对应多维表格，不扫描其他表格、不跟随普通 Wiki 链接、不递归子页面。

### 全新环境安装

```bash
cd feishu-bitable-export
npm ci
npm run setup-browser
```

要求：Node.js 20+、npm、Playwright Chromium 下载权限，以及对目标 `*.feishu.cn` 页面和数据的网络访问。需要登录时必须有可见桌面浏览器窗口。

### 支持的链接

直接多维表格视图：

```bash
npm run export -- "https://<组织>.feishu.cn/base/<BASE>?table=<TABLE>&view=<VIEW>" --output "./export.xlsx"
```

当前页面显示多维表格的 Wiki 链接：

```bash
npm run export -- "https://<组织>.feishu.cn/wiki/<NODE>?table=<TABLE>&view=<VIEW>" --output "./export.xlsx"
```

Wiki 规则：链接打开后如果当前页面没有实际显示多维表格，会明确停止；如果页面暴露多个候选多维表格且无法判断与 `table/view` 的对应关系，也会停止。请在页面中点击“打开多维表格”后复制完整 `/base/` 链接重试。

匿名可读视图可以无头运行：

```bash
npm run export -- "<完整链接>" --headless --no-prompt --include-media no --output "./export.xlsx"
```

需要登录时不要使用 `--headless`：程序会打开新的隔离浏览器，请只在该窗口中手动登录并确认目标视图，再回终端按回车。

### 图片、附件和媒体

默认尝试下载字段中的可读取媒体：

- 图片尽量嵌入 Excel 对应单元格位置，并尽量使用源尺寸；
- 附件、视频和音频保存到与 Excel 同名的 `.media` 文件夹；
- 单元格保留可见名称和可访问链接；
- 无法读取的媒体不阻断其他数据导出，单元格会保留说明和原链接（如可得）。

如不需要下载媒体：

```bash
npm run export -- "<完整链接>" --include-media no --output "./export.xlsx"
```

### 完整性与校验

导出器只在完整性检查通过后写出 Excel：

- 仅导出当前视图的可见字段，按视图顺序排列；
- 初始记录不足时自动读取后续分页并按记录 ID 去重；
- 未筛选视图要求去重记录数等于源元数据记录数；
- 真正有筛选值的视图必须提供可验证的服务端完成信号，否则停止；
- HTTP/业务错误、数据结构异常、分页重复、分页无进展或数量不符时不生成文件；
- 单选/多选映射为显示文本，链接保留为 Excel 超链接，公式样式文本进行安全转义。

校验生成的工作簿：

```bash
npm run check-workbook -- "./export.xlsx"
```

### 覆盖与隐私

已有同名文件默认不覆盖；确认覆盖时显式添加 `--force`。不复用日常浏览器 Profile、Cookie、storage state、扩展程序或已打开标签页，不绕过登录/访问控制，也不保存原始响应、账号、登录状态、截图或表格数据。

### 作为 Agent Skill 安装

将目录放入智能体原生技能目录，或运行附带的 `install.sh`。调用名称为 `/feishu-bitable-export`。

CodeBuddy 可将目录复制或链接到：

```text
~/.codebuddy/skills/feishu-bitable-export
```

---

<a id="english"></a>

## English

Export the current view of a Feishu Bitable that you are legitimately allowed to read into an Excel (`.xlsx`) workbook. The skill also accepts a Wiki URL containing `table` and `view`: it exports only the Bitable view actually displayed by that current Wiki page, never unrelated tables, ordinary Wiki links, or recursive child pages.

### Install in a clean environment

```bash
cd feishu-bitable-export
npm ci
npm run setup-browser
```

Requirements: Node.js 20+, npm, Playwright Chromium download access, and network access to the target `*.feishu.cn` page and data. Manual sign-in requires a visible desktop browser.

### Supported links

Direct Bitable view:

```bash
npm run export -- "https://<tenant>.feishu.cn/base/<BASE>?table=<TABLE>&view=<VIEW>" --output "./export.xlsx"
```

Wiki page currently displaying a Bitable:

```bash
npm run export -- "https://<tenant>.feishu.cn/wiki/<NODE>?table=<TABLE>&view=<VIEW>" --output "./export.xlsx"
```

If the Wiki page does not actually expose a Bitable, or exposes multiple candidate Bases that cannot be matched safely to `table/view`, the exporter stops. Open the Bitable itself and copy its complete `/base/` URL instead.

For anonymously readable views:

```bash
npm run export -- "<complete URL>" --headless --no-prompt --include-media no --output "./export.xlsx"
```

For a sign-in page, omit `--headless`, sign in only in the new isolated browser, confirm the requested view, and continue in the terminal.

### Images, attachments, and media

Readable field media is downloaded by default. Images are placed into the corresponding worksheet cells when possible; attachments, video, and audio are written to a same-name `.media` directory and remain linked from their cells. Unreadable media does not silently disappear: the cell keeps a note and visible URL when available. Use `--include-media no` to disable media downloads.

### Completeness and validation

The exporter uses visible fields in view order, merges and de-duplicates subsequent record pages, requires unfiltered record counts to match source metadata, and requires explicit server completion evidence for genuinely filtered views. HTTP/business errors, malformed data, repeated or stalled pagination, and count mismatches stop before workbook publication.

```bash
npm run check-workbook -- "./export.xlsx"
```

### Privacy and installation

Existing files are never overwritten unless `--force` is explicit. The tool does not reuse ordinary browser profiles, cookies, storage state, extensions, or open tabs; it does not bypass permissions or persist raw responses, accounts, login state, screenshots, or table data. Install it into the native skill directory and invoke it as `/feishu-bitable-export`.
