# LuminaLink 使用流程与数据流设计

- 日期：2026-07-05
- 状态：设计稿
- 适用阶段：V0.1 到 V0.2

## 1. 总体流程

LuminaLink 的核心流程是：

```text
启动应用
  -> 读取本机配置
  -> 如果首次启动，进入初始化向导
  -> 展示已有本地索引
  -> 后台扫描本机资产
  -> 更新 SQLite 索引
  -> 生成待翻译队列
  -> 用户查看资产库
  -> 用户按需翻译或批量翻译
  -> 翻译结果写入本地缓存
  -> UI 默认展示中文，保留原文切换
```

第一版应该坚持“先本地扫描，再按需翻译”。不要在用户还没有配置 Provider 或同意之前自动把文件内容发给第三方翻译服务。

## 2. 用户第一次进入软件

### 2.1 首次启动判断

客户端启动后先检查：

```text
%APPDATA%/LuminaLink/config.json
```

如果不存在，就认为是首次启动。

### 2.2 初始化向导

首次启动向导建议分 4 步：

1. 欢迎与隐私说明  
   告诉用户：软件默认只读扫描本机文件，不修改原始 skill/plugin/Agent 文件。

2. 自动探测路径  
   应用自动检测常见目录：

   ```text
   %USERPROFILE%/.codex/skills
   %USERPROFILE%/.codex/plugins/cache
   %USERPROFILE%/.agents/skills
   ```

3. 添加项目根目录  
   用户可以添加自己的项目目录，例如：

   ```text
   D:/Projects
   E:/ProjectsH5
   %USERPROFILE%/Documents
   ```

4. 配置翻译方式  
   用户可以选择：

   - 暂不配置，只显示原文和待翻译状态
   - OpenAI 翻译
   - 本地模型翻译，预留 Ollama / LM Studio 等方式
   - 手动翻译

完成后写入本机配置，并创建本地数据库。

## 3. 用户日常进入软件

非首次启动时：

1. Electron 主进程启动。
2. 加载 `%APPDATA%/LuminaLink/config.json`。
3. 打开 `%LOCALAPPDATA%/LuminaLink/luminalink.sqlite`。
4. 先把上一次索引结果展示出来，让用户马上能搜索和查看。
5. 后台启动增量扫描。
6. 如果发现新增、删除、修改的资产，再更新 UI。

这样用户不需要每次等全量扫描结束才能使用。

## 4. 客户端怎么扫描

### 4.1 扫描输入

扫描器从配置读取 `scanRoots`：

```json
{
  "scanRoots": [
    {
      "label": "Codex Skills",
      "pathExpression": "%USERPROFILE%/.codex/skills",
      "kind": "codex_skills",
      "enabled": true
    },
    {
      "label": "Codex Plugins",
      "pathExpression": "%USERPROFILE%/.codex/plugins/cache",
      "kind": "codex_plugins",
      "enabled": true
    },
    {
      "label": "User Agent Skills",
      "pathExpression": "%USERPROFILE%/.agents/skills",
      "kind": "agents_skills",
      "enabled": true
    }
  ]
}
```

启动扫描前先展开环境变量，例如 `%USERPROFILE%`、`%APPDATA%`、`%LOCALAPPDATA%`。

### 4.1.1 后续新增 skill / plugin 怎么出现

用户后续添加 skill 或 plugin 后，不需要在 LuminaLink 里手动创建资产。只要它位于已配置的扫描根目录下，就会通过以下机制出现在资产库里：

```text
用户安装或复制新 skill/plugin
  -> 文件落到某个 scanRoot 下
  -> LuminaLink 检测到新增或在下次扫描中发现
  -> 对新增目录做局部解析
  -> 写入 assets / metadata / scan_events
  -> UI 收到资产变更事件
  -> 新资产出现在资产库和“最近新增”
  -> 如果是英文说明，进入翻译队列
```

推荐实现四层发现机制：

1. 启动增量扫描  
   每次打开应用时，对所有启用的 `scanRoots` 做增量扫描，发现新增、删除和修改。

2. 运行时文件监听  
   应用打开期间监听已配置目录的文件变化。发现 `SKILL.md`、插件 manifest、Agent 指令文件等新增或变更时，只重新扫描受影响的目录。

3. 手动重新扫描  
   UI 提供“重新扫描”按钮，用户安装插件后可以立即刷新。

4. 定时轻量扫描  
   可选每隔一段时间检查一次根目录修改时间，用于弥补文件监听遗漏。

如果新 skill/plugin 不在任何 `scanRoot` 下，它不会自动出现。用户需要在设置里添加扫描目录，或者把该目录作为项目根目录加入 LuminaLink。

### 4.2 扫描器分类

第一版建议拆成几个 scanner：

- `SkillScanner`  
  扫描 `SKILL.md`，读取 frontmatter、标题、描述、触发场景、引用资源。

- `PluginScanner`  
  扫描插件目录，识别插件名称、版本、包含的 skills、MCP/app 能力。

- `AgentFileScanner`  
  在项目根目录里查找 `AGENTS.md`、`Agent.md`、`AGENT.md`、`CLAUDE.md`、`.cursorrules`。

- `ProjectDocScanner`  
  可选扫描用户添加的文档目录，将项目说明文档加入索引。

### 4.3 扫描策略

扫描是只读的。

默认跳过：

```text
.git
node_modules
dist
build
out
release
.venv
target
大体积媒体目录
```

每个被识别的资产会计算：

- `sourcePath`
- `sourceRoot`
- `assetType`
- `name`
- `description`
- `contentHash`
- `lastModifiedAt`
- `size`
- `parserVersion`
- `riskLevel`

如果文件内容变化，`contentHash` 会变化，资产被标记为需要重新解析，关联翻译也可能变成 `stale`。

### 4.4 敏感信息检查

扫描器可以检查疑似敏感内容，但不要保存原始值。

例如只记录：

```text
发现疑似 API key，文件路径：xxx，行号：12，类型：OpenAI-like token
```

不要保存：

```text
sk-xxxxxxxxxxxxxxxx
```

## 5. 什么时候翻译

推荐翻译触发规则：

### 5.1 默认行为

默认不自动联网翻译。

扫描完成后，如果发现英文说明或英文文档摘要，先进入“翻译队列”，状态为：

```text
未翻译
```

用户可以：

- 打开单个资产，点击“重新翻译”
- 在翻译队列点击“翻译选中”
- 在总览页点击“翻译未翻译”
- 在设置里开启“扫描后自动翻译”

### 5.2 自动翻译开关

如果用户开启自动翻译：

1. 扫描发现新增资产。
2. 判断文本语言是否主要为英文。
3. 检查翻译缓存是否已有命中。
4. 没有命中就加入后台翻译任务。
5. 翻译完成后更新 UI。

建议默认只翻译：

- skill/plugin 的标题和描述
- README 或 SKILL 文档的摘要
- frontmatter 中的 description
- 触发场景和使用说明摘要

不要默认整篇翻译所有文件，除非用户手动选择。

### 5.3 重新翻译

当原文 hash 变化：

```text
旧 sourceHash != 新 sourceHash
```

翻译状态改为：

```text
已过期
```

UI 继续展示旧中文，但提示“原文已更新，建议重新翻译”。

## 6. 用什么翻译

翻译能力应该做成 Provider 插件式接口。

### 6.1 Provider 优先级

推荐第一版支持：

1. OpenAI Provider  
   质量最好，适合默认推荐。但必须由用户自己配置 API key。

2. Local Model Provider  
   预留 Ollama / LM Studio / 本地 OpenAI-compatible endpoint。

3. Manual Provider  
   用户手工编辑中文译文。

4. Noop Provider  
   不翻译，只显示原文。

### 6.2 OpenAI Provider

配置项示例：

```json
{
  "provider": "openai",
  "model": "gpt-4.1-mini",
  "targetLang": "zh-CN",
  "apiKeySource": "env:OPENAI_API_KEY"
}
```

注意：

- 不把 API key 明文写入仓库。
- UI 里只显示 `已配置` 或红acted 提示。
- 允许用户选择环境变量、系统凭据或本地 `.env`。

### 6.3 本地模型 Provider

配置项示例：

```json
{
  "provider": "openai-compatible",
  "baseUrl": "http://localhost:11434/v1",
  "model": "qwen2.5:7b",
  "targetLang": "zh-CN"
}
```

优点：

- 隐私更好。
- 不消耗云端 API。

缺点：

- 翻译质量和速度取决于本地模型。
- 新电脑需要用户自己安装本地模型服务。

### 6.4 翻译提示词原则

翻译不是文学翻译，而是开发工具说明翻译。

要求：

- 保留命令、路径、文件名、函数名、配置键。
- 保留英文专有名词，必要时加中文解释。
- 不翻译 token、密钥、代码块中的关键字。
- 不扩写没有依据的功能。
- 输出短、清楚、适合 UI 展示。

## 7. 里面存储是什么样子的

LuminaLink 分三层存储。

### 7.1 仓库内存储

仓库里只放可以开源的东西：

```text
AGENTS.md
README.md
docs/
config/*.example.json
.env.example
src/
tests/
```

不放：

```text
.env
local config
SQLite 数据库
翻译缓存
API key
用户真实项目路径配置
```

### 7.2 本机配置

本机配置放：

```text
%APPDATA%/LuminaLink/config.json
```

保存：

- 扫描路径
- 项目根目录
- UI 语言
- 主题
- Provider 类型
- Provider 的非敏感配置
- 是否开启自动翻译
- 是否允许扫描项目文档

示例：

```json
{
  "version": 1,
  "language": "zh-CN",
  "theme": "system",
  "autoTranslate": false,
  "scanRoots": [
    {
      "id": "codex-skills",
      "label": "Codex Skills",
      "pathExpression": "%USERPROFILE%/.codex/skills",
      "kind": "codex_skills",
      "enabled": true
    }
  ],
  "translator": {
    "provider": "openai",
    "model": "gpt-4.1-mini",
    "apiKeySource": "env:OPENAI_API_KEY"
  }
}
```

### 7.3 本机数据库

本机数据库放：

```text
%LOCALAPPDATA%/LuminaLink/luminalink.sqlite
```

核心表建议：

```sql
assets
asset_metadata
scan_roots
scan_runs
scan_events
tags
asset_tags
favorites
risk_findings
```

翻译缓存可以单独放：

```text
%LOCALAPPDATA%/LuminaLink/translation-cache.sqlite
```

核心表建议：

```sql
translation_records
translation_jobs
translator_providers
```

### 7.4 为什么索引和翻译缓存分开

建议分开有三个好处：

1. 资产索引可以随时重建。
2. 翻译缓存更有价值，迁移时可以单独导出。
3. 用户删除索引不会丢失已翻译内容。

### 7.5 通用文件翻译查看

除了 skill、plugin 和 Agent 指令文件，LuminaLink 还应该支持用户手动加入任意说明文件，例如 `Agent.md`、`README.md`、`.txt`、`.yaml`。

这个功能不应该为每个分类重复翻译，而是按文件内容 hash 复用翻译。

推荐流程：

```text
用户添加文件
  -> 选择分类：其他文件 / Agent 配置 / 项目文档 / 自定义分类
  -> 读取文件并计算 contentHash
  -> 查询 translation-cache.sqlite
  -> 如果命中，直接显示已有中文译文
  -> 如果未命中，进入翻译队列
  -> 翻译完成后写入缓存
  -> 同一文件加入其他分类时复用译文
```

推荐数据关系：

```text
source_files       真实文件
assets             客户端中的资产
categories         用户分类
asset_categories   资产和分类的多对多关系
translation_units  长文档分块
translation_records 翻译缓存
```

关键规则：

- 一个文件可以属于多个分类。
- 翻译缓存按 `sourceHash + targetLang + scope` 命中。
- 删除分类关系不删除原始文件。
- 删除分类关系也不删除翻译缓存。
- 原文内容变化后，旧译文标记为“已过期”。

## 8. 界面里的完整使用路径

### 8.1 首次使用

```text
安装 LuminaLink
  -> 打开应用
  -> 初始化向导
  -> 自动检测本机 AI 工具目录
  -> 添加项目根目录
  -> 选择翻译方式
  -> 开始首次扫描
  -> 进入资产库
```

### 8.2 日常查找 skill/plugin

```text
打开应用
  -> 资产库显示上次索引
  -> 后台增量扫描
  -> 用户搜索关键词
  -> 点击资产
  -> 右侧查看中文说明
  -> 需要时切换原文
  -> 打开文件或目录
```

### 8.3 翻译一个英文插件

```text
资产库中看到“未翻译”
  -> 点击资产
  -> 点击“重新翻译”
  -> 进入翻译任务
  -> Provider 翻译
  -> 写入 translation-cache.sqlite
  -> UI 更新为中文说明
```

### 8.4 换电脑迁移

```text
旧电脑
  -> 迁移备份
  -> 导出迁移包
  -> 排除 raw API key / token

新电脑
  -> 安装 LuminaLink
  -> 导入迁移包
  -> 重新检测本机路径
  -> 用户确认扫描根目录
  -> 重建资产索引
  -> 复用翻译缓存、收藏、标签
```

### 8.5 后续安装新 skill/plugin

```text
用户通过 Codex / GitHub / 手动复制安装新 skill 或 plugin
  -> LuminaLink 文件监听发现新增
  -> 状态栏提示“发现 1 个新资产”
  -> 新资产进入资产库
  -> 如果未翻译，显示“未翻译”
  -> 用户可以直接查看原文，或点击“翻译”
```

界面表现建议：

- 资产库顶部显示“发现新资产”提示，可点击查看。
- 总览页显示“最近新增”。
- 新资产默认按最后发现时间排序靠前。
- 翻译队列自动出现新增英文资产。
- 如果解析失败，进入“解析失败”筛选，不要静默丢弃。

### 8.6 添加其他文件并翻译查看

```text
用户点击“添加文件”
  -> 选择 Agent.md
  -> 选择分类：其他文件
  -> LuminaLink 计算 hash
  -> 文件进入资产库
  -> 用户点击“翻译”
  -> 翻译结果写入缓存
  -> 后续可在“其他文件”中直接查看中文
  -> 如果用户再把它加入“Agent 配置”，直接复用同一份译文
```

界面表现建议：

- 资产详情页提供“加入分类”。
- 分类选择支持多选。
- 文件详情页显示“此译文已被 2 个分类复用”。
- 如果文件内容变化，显示“原文已更新，译文可能过期”。

## 9. 推荐 MVP 行为

第一版建议定死这几个产品行为：

- 扫描默认只读。
- 初次扫描不自动联网。
- 未配置 Provider 时仍可完整使用资产库。
- 翻译结果只写本地缓存，不改原始文件。
- UI 默认展示中文，中文不存在时展示原文。
- 敏感信息只做风险提示，不保存 raw value。
- 删除数据库后可以重新扫描恢复索引。
- 迁移包默认不包含 API key、token、cookie、私钥。

## 10. 给 Agent 操作客户端的说明文件

项目根目录提供：

```text
AGENT_RUNBOOK.md
```

这个文件用于用户不会操作客户端、转而让 Codex 或其他 Agent 帮忙时读取。它不替代客户端功能，而是规定 Agent 应该怎样安全地调用 LuminaLink：

- 帮用户扫描本机资产。
- 检查为什么新 skill/plugin 没显示。
- 添加扫描目录。
- 翻译未翻译资产。
- 搜索某类 skill/plugin。
- 导出或导入迁移包。
- 诊断 Provider、索引和扫描问题。

推荐客户端后续提供稳定 CLI，让 Agent 优先通过命令操作，而不是依赖脆弱的 UI 点击：

```bash
luminalink status
luminalink scan
luminalink config list-roots
luminalink config add-root "<path>" --kind project_root
luminalink translate list --status pending
luminalink translate run --pending
luminalink assets search "<keyword>"
luminalink migrate export "<output-file>"
luminalink doctor
```

如果涉及云端翻译，Agent 必须遵守用户配置和隐私规则：不要要求用户在聊天里粘贴 raw API key；不要在未经允许时把文件内容发给外部 Provider。
