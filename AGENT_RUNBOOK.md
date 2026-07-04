# LuminaLink Agent Runbook

This file is for AI coding/operation agents that need to help a user operate the
LuminaLink desktop client.

`AGENTS.md` explains how to develop this project. This file explains how an
agent should assist with user-facing operations such as scanning, translating,
adding scan roots, checking newly installed skills/plugins, and exporting
migration data.

## Core Rule

Prefer safe local operations.

Agents may read LuminaLink configuration, indexes, logs, and source asset files
when the user asks for help. Agents must not expose raw secrets in chat, docs,
commits, or summaries.

Do not modify third-party skill/plugin/Agent source files unless the user
explicitly asks for editing that exact file.

## Operation Priority

When helping a user operate LuminaLink, use this priority order:

1. LuminaLink CLI commands, if available.
2. LuminaLink local API / IPC automation, if available.
3. Desktop UI automation, if the user explicitly wants the client operated.
4. Direct file/database inspection, only for diagnosis or recovery.

The app should eventually provide a CLI so agents do not need fragile UI clicks.

Proposed CLI shape:

```bash
luminalink status
luminalink scan
luminalink scan --root "<path>"
luminalink config list-roots
luminalink config add-root "<path>" --kind project_root
luminalink config set-translator --provider openai --model gpt-4.1-mini --api-key-source env:OPENAI_API_KEY
luminalink translate list --status pending
luminalink translate run --pending
luminalink translate run --asset "<asset-id>"
luminalink files add "<path>" --category "<name>"
luminalink files translate "<file-id>"
luminalink assets search "<keyword>"
luminalink assets show "<asset-id>"
luminalink migrate export "<output-file>"
luminalink migrate import "<input-file>"
luminalink doctor
```

Until these commands exist, treat them as the implementation contract for future
development, not as currently available commands.

## Important Local Paths

Use OS-specific app paths rather than hard-coded personal paths.

Windows defaults:

```text
Config:
%APPDATA%/LuminaLink/config.json

Index database:
%LOCALAPPDATA%/LuminaLink/luminalink.sqlite

Translation cache:
%LOCALAPPDATA%/LuminaLink/translation-cache.sqlite

Logs:
%LOCALAPPDATA%/LuminaLink/logs/
```

Common scan roots:

```text
%USERPROFILE%/.codex/skills
%USERPROFILE%/.codex/plugins/cache
%USERPROFILE%/.agents/skills
user-selected project roots
```

## Safe Reporting

When reporting results to the user, include:

- what operation was run
- how many assets were found or changed
- which scan roots were used
- which assets need translation
- which assets failed parsing
- whether any sensitive-content risk was detected
- next recommended action

Do not include raw values for:

- API keys
- tokens
- cookies
- private keys
- passwords

For secrets, report only the file path, purpose, and redacted hint when needed.

## Workflow: Help User Scan Assets

Use when the user says something like:

- "帮我扫描一下"
- "为什么我的 skill 没显示"
- "我刚装了插件，帮我刷新"
- "让 LuminaLink 重新读取我的 Agent 配置"

Steps:

1. Check whether LuminaLink CLI exists.
2. If CLI exists, run:

   ```bash
   luminalink status
   luminalink config list-roots
   luminalink scan
   ```

3. If the target directory is not in scan roots, add it only after confirming it
   is the intended directory:

   ```bash
   luminalink config add-root "<path>" --kind project_root
   luminalink scan --root "<path>"
   ```

4. If CLI does not exist, inspect config and logs directly or operate the UI.
5. Report new assets, removed assets, changed assets, and parse failures.

Expected behavior:

```text
new skill/plugin/Agent file
  -> scan root detects it
  -> parser creates or updates asset index
  -> untranslated English content enters translation queue
  -> UI shows it in Asset Library and Recent Added
```

## Workflow: Help User Translate Assets

Use when the user says something like:

- "帮我把未翻译的插件翻译一下"
- "这个 skill 是英文的，帮我翻译"
- "把新装的插件说明翻成中文"

Steps:

1. Check translation provider health:

   ```bash
   luminalink status
   luminalink translate list --status pending
   ```

2. If provider is not configured, explain options:

   - OpenAI Provider
   - local OpenAI-compatible Provider
   - manual translation
   - no translation

   If the user chooses OpenAI and already has `OPENAI_API_KEY` configured in
   their local shell, run:

   ```bash
   luminalink config set-translator --provider openai --model gpt-4.1-mini --api-key-source env:OPENAI_API_KEY
   ```

   For a local OpenAI-compatible endpoint, run:

   ```bash
   luminalink config set-translator --provider openai-compatible --model "<model>" --base-url "<base-url>"
   ```

3. Do not ask the user to paste raw API keys into chat.
4. If cloud translation will send file content to an external provider, confirm
   with the user unless they already enabled automatic translation in config.
5. Translate pending assets:

   ```bash
   luminalink translate run --pending
   ```

6. Report translated count, failed count, and skipped count.

Translation rules:

- Preserve commands, paths, file names, config keys, and code identifiers.
- Preserve important English product names when useful.
- Do not translate raw secret-looking values.
- Store translations only in the translation cache, not in original source files.

## Workflow: Help User Add A New Scan Root

Use when a skill/plugin/project is outside existing scan paths.

Steps:

1. Verify the directory exists.
2. Identify the likely root type:

   - `codex_skills`
   - `codex_plugins`
   - `agents_skills`
   - `project_root`
   - `docs_root`
   - `custom`

3. Prefer environment-relative paths where possible.
4. Add root:

   ```bash
   luminalink config add-root "<path>" --kind project_root
   ```

5. Run a scan for that root.
6. Confirm whether new assets appeared.

Do not add broad system roots such as `C:/`, `D:/`, or the full user profile
unless the user explicitly asks and accepts the slower scan.

## Workflow: Help User Find A Skill Or Plugin

Use when the user asks:

- "有没有能做 PPT 的 skill"
- "帮我找 GitHub PR 相关插件"
- "我装的某个插件在哪"

Steps:

1. Search assets:

   ```bash
   luminalink assets search "<keyword>"
   ```

2. Show concise results:

   - name
   - type
   - Chinese description if available
   - source path
   - translation status
   - last modified time

3. If no result appears, run scan or ask whether to add a scan root.

## Workflow: Help User Add And Translate A General File

Use when the user asks:

- "把这个 Agent.md 加到客户端里"
- "帮我把这个文件翻译后放到其他文件分类"
- "这个说明文件以后想在 LuminaLink 里直接看中文"

Steps:

1. Verify the file exists and is a supported text-like file.
2. Add it to LuminaLink with the requested category:

   ```bash
   luminalink files add "<path>" --category "其他文件"
   ```

3. If a translation already exists for the same content hash, report that the
   cached translation was reused.
4. If no translation exists, translate the file:

   ```bash
   luminalink files translate "<file-id>"
   ```

5. Report the category, translation status, and source path.

Rules:

- A file may belong to multiple categories.
- Translation should be keyed by content hash, not by category.
- Adding the same file to another category must not duplicate translation work.
- Do not modify the original file unless explicitly requested.
- If cloud translation is needed, follow the normal provider consent rules.

## Workflow: Help User Export Or Import Migration Data

Use when the user says:

- "我要换电脑"
- "帮我导出 LuminaLink 配置"
- "帮我在新电脑恢复"

Export steps:

```bash
luminalink migrate export "<output-file>"
```

Migration package may include:

- scan root templates
- non-sensitive provider config
- favorites
- tags
- translation cache
- UI preferences

Migration package must not include:

- raw API keys
- tokens
- cookies
- passwords
- private keys
- unrelated project source files

Import steps:

```bash
luminalink migrate import "<input-file>"
luminalink scan
```

After import, ask the user to reconfigure secrets locally if translation or API
features need credentials.

## Workflow: Diagnose Why New Asset Does Not Show

Checklist:

1. Is the file under an enabled scan root?
2. Is the file name or structure recognizable?
   - skill should have `SKILL.md` or supported metadata.
   - Agent instructions should use `AGENTS.md`, `Agent.md`, `AGENT.md`,
     `CLAUDE.md`, or `.cursorrules`.
3. Was the directory skipped by ignore rules?
4. Did parsing fail?
5. Is the asset filtered out by UI filters?
6. Is the local SQLite index stale?
7. Did file watcher miss the change?

Suggested recovery:

```bash
luminalink config list-roots
luminalink scan --root "<suspected-root>"
luminalink doctor
```

Then report the specific cause and fix.

## UI Operation Hints

If using desktop UI automation instead of CLI:

1. Open LuminaLink.
2. Go to `资产库`.
3. Click `重新扫描` or `扫描资产`.
4. Watch the scan log at the bottom.
5. Use filters for `未翻译`, `解析失败`, or asset type.
6. Open an asset detail panel.
7. Use `重新翻译` for one item or `翻译队列` for batch translation.
8. Use `设置 -> 扫描路径` to add missing roots.
9. Use `迁移备份` to export/import migration packages.

Prefer reading the UI result and reporting it back rather than making
unrequested configuration changes.

## Future Implementation Requirements

For LuminaLink developers, keep these agent-operation requirements in mind:

- Provide a stable CLI for scan, translate, search, config, migrate, and doctor.
- Provide machine-readable JSON output with a `--json` flag.
- Keep UI actions backed by the same service layer as CLI commands.
- Write operation logs to a predictable local logs directory.
- Make errors actionable: path missing, provider missing, parse failed, skipped by
  ignore rule, permission denied, translation failed.
- Avoid storing secrets in SQLite or migration packages.
