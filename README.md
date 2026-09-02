# Feishu Bitable Export Skill

[中文](#中文) | [English](#english)

---

<a id="中文"></a>

## 中文

将你有合法访问权限的飞书多维表格**指定视图**导出为完整的本地 Excel（`.xlsx`）工作簿。

### 在全新环境安装

```bash
cd feishu-bitable-export
npm ci
npm run setup-browser
```

**前提条件：**Node.js 20+、可访问 npm、可下载 Playwright 浏览器，并能访问用户提供的 `*.feishu.cn` 多维表格视图。Linux 系统可能需要按 Playwright 官方文档安装浏览器系统依赖。

### 导出

```bash
npm run export -- "https://<组织>.feishu.cn/base/<BASE>?table=<TABLE>&view=<VIEW>" --output "./export.xlsx"
```

若视图允许匿名访问，可无头运行：

```bash
npm run export -- "<完整视图 URL>" --headless --no-prompt --output "./export.xlsx"
```

若飞书跳转至登录页，或数据请求无权限，请不要使用 `--headless`。程序会打开新的临时浏览器窗口；请在其中登录、确认目标视图可见，再回到终端按回车。会话仅保存在内存中，导出结束后即丢弃。

### 校验工作簿

```bash
npm run check-workbook -- "./export.xlsx"
```

导出器仅在数据通过校验后才发布工作簿。未筛选视图要求去重后的记录数与源元数据一致；筛选视图无法证明完整性、响应格式异常、分页停滞或记录数不符时，会拒绝生成 Excel。

### 安全与隐私

- 不复用日常浏览器 Profile、Cookie、存储状态、扩展程序或已打开的标签页。
- 不绕过访问控制；只读取当前页面会话中可访问的数据。
- 不在输出目录保存原始响应、Cookie、浏览器追踪、截图或源数据。
- 除非显式添加 `--force`，不会覆盖已有工作簿。

### 作为 Agent Skill 安装

将目录放入所用智能体的原生技能目录，或运行附带的 `install.sh`。调用名称为 `/feishu-bitable-export`。

Claude Code 可将本地目录作为插件市场添加后通过插件界面安装。CodeBuddy 可将该目录复制或链接至 `~/.codebuddy/skills/feishu-bitable-export`。

### 已验证的代表性运行

本包已在 `npm ci` 后使用新的内存 Playwright Chromium 会话，对用户提供的匿名可访问视图完成验证；未使用登录状态或持久化浏览器 Profile。生成的工作簿通过了本包校验器：单工作表、冻结首行、自动筛选、超链接保留且无 Excel 错误值。包内不会保留来源 URL、标识、记录数或源数据。

### 已知边界

一次仅导出一个选定视图；不修改飞书数据，不导出附件、评论或历史记录，不使用飞书开放平台凭据。若授权页面未提供可验证的完整记录集，工具会停止而不会导出。

### 验证报告

[VERIFICATION.md](VERIFICATION.md) 记录最近一次构建时的质量闸门与评估证据。

---

<a id="english"></a>

## English

Export one Feishu Bitable **view** that you are legitimately allowed to access into a complete local Excel (`.xlsx`) workbook.

### Install in a clean environment

```bash
cd feishu-bitable-export
npm ci
npm run setup-browser
```

**Requirements:** Node.js 20+, npm registry access, Playwright browser download access, and network access to the supplied `*.feishu.cn` Bitable view. Linux hosts may also require browser system libraries documented by Playwright.

### Export

```bash
npm run export -- "https://<tenant>.feishu.cn/base/<BASE>?table=<TABLE>&view=<VIEW>" --output "./export.xlsx"
```

For an anonymously readable view, run headlessly:

```bash
npm run export -- "<complete view URL>" --headless --no-prompt --output "./export.xlsx"
```

If Feishu redirects to sign-in or rejects the data request, omit `--headless`. A new temporary browser window opens; sign in there, confirm the requested view, and then press Enter in the terminal. The session remains in memory and is discarded when export ends.

### Validate the workbook

```bash
npm run check-workbook -- "./export.xlsx"
```

The exporter publishes a workbook only after validating the data response. An unfiltered view requires the de-duplicated record count to match source metadata. The exporter rejects filtered views whose completeness cannot be proven, malformed responses, stalled pagination, and mismatched record counts.

### Safety and privacy

- It never reuses your ordinary browser profile, cookies, storage state, extensions, or open tabs.
- It does not bypass access controls and reads only data available to the current page session.
- It does not store raw responses, cookies, browser traces, screenshots, or source data beside the output.
- Existing workbooks are never overwritten unless you explicitly add `--force`.

### Install as an agent skill

Place this folder in your agent's native skills directory, or run the included `install.sh`. Invoke it as `/feishu-bitable-export`.

For Claude Code, add the local folder as a plugin marketplace and install it through the plugin UI. For CodeBuddy, copy or link it under `~/.codebuddy/skills/feishu-bitable-export`.

### Tested representative run

This package was verified after `npm ci` in a new in-memory Playwright Chromium session against a user-provided anonymously readable view, without a login or persistent browser profile. The generated workbook passed the bundled checker for a single worksheet with a frozen header, autofilter, preserved hyperlinks, and zero Excel error values. Source URLs, identifiers, record counts, and source records are not retained in this package.

### Known boundaries

The package exports one selected view at a time. It does not modify Feishu data, export attachments/comments/history, use Feishu Open Platform credentials, or extract data when the authorized web page does not expose a verifiable completed record set.

### Verification

[VERIFICATION.md](VERIFICATION.md) records the latest generation-time gate and evaluation evidence.
