# LuminaLink 操作流程与用途

- 日期：2026-07-05
- 适用版本：V0.1 MVP

## 用途

LuminaLink 用来把本机分散的 AI 相关资产集中管理：

- 查找本机安装了哪些 skill。
- 查看插件说明和来源路径。
- 统一管理项目内 `AGENTS.md`、`Agent.md` 等 Agent 指令。
- 把英文说明翻译成中文并缓存。
- 把任意 Markdown / 文本文件加入客户端，后续直接查看中文。
- 换电脑时导出非敏感配置和翻译缓存。

## 桌面客户端流程

1. 启动客户端。
2. 点击 `扫描资产`。
3. 在资产库中搜索或筛选。
4. 点击资产查看右侧详情。
5. 切换 `中文说明` / `原文` / `元数据`。
6. 需要中文时点击 `翻译此项`。
7. 要加入额外文件时点击 `添加文件`。
8. 要加入项目目录时点击 `添加目录`。
9. 在设置页配置翻译 Provider。

## CLI 流程

常用命令：

```bash
pnpm luminalink status --json
pnpm luminalink doctor --json
pnpm luminalink scan --json
pnpm luminalink assets search "github" --json
pnpm luminalink files add "D:/Projects/MyApp/Agent.md" --category "其他文件"
pnpm luminalink translate list --json
```

配置翻译：

```bash
pnpm luminalink config set-translator --provider openai --model gpt-4.1-mini --api-key-source env:OPENAI_API_KEY
```

本地模型：

```bash
pnpm luminalink config set-translator --provider openai-compatible --model qwen2.5:7b --base-url http://localhost:11434/v1
```

## Agent 协助流程

当用户直接让 Codex 帮忙操作时：

1. Codex 读取 `AGENT_RUNBOOK.md`。
2. 优先使用 CLI。
3. 扫描或添加目录。
4. 检查待翻译队列。
5. 如需云端翻译，先确认 Provider 和隐私边界。
6. 输出结果摘要，不输出 raw secret。

## 存储边界

仓库只保存开源代码和文档。

用户本机配置和缓存保存在：

```text
%APPDATA%/LuminaLink/config.json
%LOCALAPPDATA%/LuminaLink/luminalink.sqlite
%LOCALAPPDATA%/LuminaLink/translation-cache.sqlite
```

## 当前限制

- 还没有安装包，需要用 `pnpm dev` 启动。
- 还没有插件安装/更新能力。
- 运行时文件监听尚未完成，新增文件后可以手动点击扫描。
- 翻译需要用户配置 Provider。
