# LuminaLink

LuminaLink 是一个中文优先的开源桌面工具，用来管理本机 AI 开发资产：

- Codex / Agent skills
- 插件和插件说明
- 项目级 `AGENTS.md`、`Agent.md`、`CLAUDE.md` 等 Agent 指令文件
- 任意 Markdown / 文本说明文件
- 英文说明的中文翻译缓存
- 换电脑时可迁移的非敏感配置

它的定位不是聊天应用，而是“本机 AI 工具资产库 + 中文阅读层 + 迁移助手”。

## 当前状态

当前版本是 V0.1 MVP：

- 已有 Electron + Vue 3 + TypeScript 桌面客户端
- 已有本地配置文件
- 已有 SQLite 文件索引和翻译缓存
- 已有 CLI 自动化入口
- 已能扫描本机 skill/plugin/Agent 文件
- 已能把任意文本文件加入“其他文件”分类
- 已能配置 OpenAI / OpenAI-compatible 翻译 Provider
- 已有中文优先的资产库 UI
- 已有 Windows 安装包和免安装版打包脚本
- 已有 Codex 协助页，会生成本机 Agent 操作手册和配置 helper

暂未完成：

- 插件安装/更新
- 云同步
- 稳定发布版本

## 普通用户下载

普通用户不需要下载源码压缩包。请在 GitHub Releases 下载 Windows 程序：

```text
LuminaLink-Setup-0.1.1-x64.exe       安装版
LuminaLink-Portable-0.1.1-x64.exe    免安装版
```

Release 页面：

```text
https://github.com/1135572798/LuminaLink/releases
```

## 安装开发环境

要求：

- Node.js 24+
- pnpm 11+
- Windows 优先

安装依赖：

```bash
pnpm install
```

如果 Electron 二进制下载慢，可以临时使用镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
pnpm rebuild electron
```

## 运行客户端

开发模式：

```bash
pnpm dev
```

构建：

```bash
pnpm build
```

生成 Windows 安装包和免安装版：

```bash
pnpm dist:win
```

构建产物：

```text
dist/main
dist/renderer
release/0.1.0
```

## 本机数据位置

LuminaLink 不把用户本机配置和缓存写入仓库。

Windows 默认位置：

```text
配置文件:
%APPDATA%/LuminaLink/config.json

资产索引:
%LOCALAPPDATA%/LuminaLink/luminalink.sqlite

翻译缓存:
%LOCALAPPDATA%/LuminaLink/translation-cache.sqlite

日志目录:
%LOCALAPPDATA%/LuminaLink/logs/
```

## 用户使用流程

第一次打开：

```text
打开 LuminaLink
-> 自动创建本机配置
-> 自动生成 Codex 可读取的 Agent 操作手册
-> 自动检测默认扫描目录
-> 用户可以添加项目目录或单个文件
-> 点击“扫描资产”
-> 资产进入资产库
-> 未翻译英文内容进入翻译队列
```

日常使用：

```text
打开客户端
-> 资产库显示上次索引
-> 后台或手动重新扫描
-> 搜索 skill/plugin/Agent/文件
-> 点击资产查看中文说明、原文和元数据
-> 需要时触发翻译
```

## 默认扫描范围

默认扫描：

```text
%USERPROFILE%/.codex/skills
%USERPROFILE%/.codex/plugins/cache
%USERPROFILE%/.agents/skills
```

支持的 Agent 指令文件：

```text
AGENTS.md
AGENT.md
Agent.md
CLAUDE.md
.cursorrules
```

支持手动添加的通用文件：

```text
.md
.txt
.json
.yaml
.yml
```

## 翻译功能

默认不自动联网翻译。用户需要主动配置 Provider 并点击翻译。

支持：

- OpenAI
- OpenAI-compatible，本地模型服务也可以走这个接口
- Noop，不翻译，只显示原文

配置 OpenAI：

```powershell
$env:OPENAI_API_KEY='你的 key'
pnpm luminalink config set-translator --provider openai --model gpt-4.1-mini --api-key-source env:OPENAI_API_KEY
```

配置本地 OpenAI-compatible 服务：

```bash
pnpm luminalink config set-translator \
  --provider openai-compatible \
  --model qwen2.5:7b \
  --base-url http://localhost:11434/v1
```

注意：

- 不要把 API key 写入仓库。
- 不要把 API key 粘贴进聊天记录或文档。
- 迁移包不会导出 raw API key / token / cookie / 私钥。

## CLI 用法

LuminaLink 提供 CLI，方便 Codex 或其他 Agent 在用户授权下操作客户端能力。

查看状态：

```bash
pnpm luminalink status --json
```

环境检查：

```bash
pnpm luminalink doctor --json
```

扫描资产：

```bash
pnpm luminalink scan --json
```

搜索资产：

```bash
pnpm luminalink assets search "github" --json
```

添加扫描目录：

```bash
pnpm luminalink config add-root "D:/Projects" --kind project_root
```

添加单个文件到“其他文件”分类：

```bash
pnpm luminalink files add "D:/Projects/MyApp/Agent.md" --category "其他文件"
```

查看待翻译资产：

```bash
pnpm luminalink translate list --json
```

翻译单个资产：

```bash
pnpm luminalink translate run --asset "<asset-id>"
```

翻译前 10 个待翻译资产：

```bash
pnpm luminalink translate run --limit 10
```

导出迁移包：

```bash
pnpm luminalink migrate export "D:/backup/luminalink-migration.json"
```

导入迁移包：

```bash
pnpm luminalink migrate import "D:/backup/luminalink-migration.json"
pnpm luminalink scan
```

## 通用文件翻译查看

这是 LuminaLink 的关键功能之一。

例如用户在项目中创建了一个 `Agent.md`：

```text
用户添加 Agent.md
-> 选择分类：其他文件 / Agent 配置 / 项目文档
-> LuminaLink 计算文件内容 hash
-> 如果已有译文，直接复用
-> 如果没有译文，加入翻译队列
-> 翻译完成后写入 translation-cache.sqlite
-> 后续客户端中直接查看中文
```

同一个文件可以加入多个分类，但只翻译一次。

## Agent 操作手册

如果用户不会操作客户端，可以让 Codex 读取：

```text
%APPDATA%/LuminaLink/AGENT_RUNBOOK.md
```

这个文件规定了 Agent 如何安全地帮用户：

- 扫描资产
- 添加扫描目录
- 添加文件
- 翻译未翻译资产
- 搜索 skill/plugin
- 导出/导入迁移包
- 诊断为什么新文件没显示

客户端里的 `Codex 协助` 页面会显示手册路径，并提供一段可直接复制给 Codex 的提示词。

## 开发文档

主要文档：

- `docs/product-design.md`
- `docs/user-flow-data-flow.md`
- `docs/implementation-checklist.md`
- `docs/ui-concepts.md`
- `docs/publish-guide.md`

## 开源发布

目标公开仓库：

```text
https://github.com/1135572798/LuminaLink
```

当前仓库已公开发布。完整发布、换电脑使用和维护步骤见：

```text
docs/publish-guide.md
```

## 隐私与安全

LuminaLink 默认本地优先。

- 扫描只读，不修改第三方 skill/plugin 原始文件。
- 翻译结果写入本地缓存，不覆盖原文件。
- 默认不自动联网翻译。
- 敏感内容只做风险提示，不保存 raw secret。
- 迁移包不包含 raw API key / token / cookie / 私钥。

## License

MIT
