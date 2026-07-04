# LuminaLink 实现目标清单

- 日期：2026-07-05
- 状态：实施前目标清单
- 范围：桌面客户端、扫描、翻译、通用文件翻译查看、Agent 自动化入口

## 1. 总体实现路线

LuminaLink 第一阶段不要一口气做成完整插件市场。先做一个稳定的本机资产索引器和中文阅读器。

推荐阶段：

```text
V0.1 项目骨架与本地存储
V0.2 扫描器与资产库
V0.3 翻译缓存与翻译队列
V0.4 通用文件翻译查看
V0.5 Agent/CLI 自动化入口
V0.6 迁移备份
V0.7 插件安装与更新
```

## 2. V0.1 项目骨架与本地存储

目标：先把可运行桌面程序和本地数据层搭起来。

任务清单：

- [ ] 初始化 Electron + Vue 3 + TypeScript + Vite 项目。
- [ ] 建立主进程、渲染进程、preload IPC 边界。
- [ ] 建立应用目录解析工具：
  - [ ] `%APPDATA%/LuminaLink`
  - [ ] `%LOCALAPPDATA%/LuminaLink`
  - [ ] 日志目录
  - [ ] 数据库目录
- [ ] 创建本机配置文件：
  - [ ] `%APPDATA%/LuminaLink/config.json`
- [ ] 创建本机索引数据库：
  - [ ] `%LOCALAPPDATA%/LuminaLink/luminalink.sqlite`
- [ ] 创建翻译缓存数据库：
  - [ ] `%LOCALAPPDATA%/LuminaLink/translation-cache.sqlite`
- [ ] 设计并实现数据库迁移机制。
- [ ] 增加基础日志系统。
- [ ] 增加错误上报区域，先写本地日志，不做云上报。

验收标准：

- [ ] 启动应用后能创建配置目录和数据库。
- [ ] 重启应用能读取上次配置。
- [ ] 本地数据库不会进入 Git。

## 3. V0.2 扫描器与资产库

目标：扫描本机 skill/plugin/Agent 文件，并展示在资产库。

任务清单：

- [ ] 实现 `ScanRootService`。
- [ ] 实现环境变量展开：
  - [ ] `%USERPROFILE%`
  - [ ] `%APPDATA%`
  - [ ] `%LOCALAPPDATA%`
- [ ] 实现默认扫描根：
  - [ ] `%USERPROFILE%/.codex/skills`
  - [ ] `%USERPROFILE%/.codex/plugins/cache`
  - [ ] `%USERPROFILE%/.agents/skills`
- [ ] 实现扫描器：
  - [ ] `SkillScanner`
  - [ ] `PluginScanner`
  - [ ] `AgentFileScanner`
  - [ ] `ProjectDocScanner`
  - [ ] `GenericFileScanner`
- [ ] 实现忽略规则：
  - [ ] `.git`
  - [ ] `node_modules`
  - [ ] `dist`
  - [ ] `build`
  - [ ] `out`
  - [ ] `release`
  - [ ] `.venv`
  - [ ] `target`
- [ ] 实现增量扫描：
  - [ ] 新增文件
  - [ ] 修改文件
  - [ ] 删除文件
- [ ] 实现文件监听。
- [ ] 实现手动重新扫描按钮。
- [ ] 实现资产库 UI：
  - [ ] 左侧导航
  - [ ] 顶部搜索
  - [ ] 中间资产列表
  - [ ] 右侧详情面板
  - [ ] 底部扫描日志

验收标准：

- [ ] 新增 skill/plugin/Agent 文件后，重新扫描能显示。
- [ ] 应用打开时能展示上次索引，不必等待扫描完成。
- [ ] 解析失败能进入失败列表，不静默丢弃。

## 4. V0.3 翻译缓存与翻译队列

目标：英文说明只翻译一次，后续优先读取缓存。

任务清单：

- [ ] 实现 `TranslatorProvider` 接口。
- [ ] 实现 Provider：
  - [ ] `NoopTranslator`
  - [ ] `ManualTranslator`
  - [ ] `OpenAITranslator`
  - [ ] `OpenAICompatibleTranslator`
- [ ] 实现 Provider 健康检查。
- [ ] 实现翻译队列：
  - [ ] 待翻译
  - [ ] 翻译中
  - [ ] 已翻译
  - [ ] 已过期
  - [ ] 失败
- [ ] 实现 source hash 匹配。
- [ ] 实现翻译缓存命中。
- [ ] 实现单个资产翻译。
- [ ] 实现批量翻译未翻译资产。
- [ ] 实现中文 / 原文 / 对照视图。
- [ ] 实现“扫描后自动翻译”开关，默认关闭。

验收标准：

- [ ] 未配置 Provider 时，资产库仍可正常使用。
- [ ] 已翻译内容重启后仍可查看。
- [ ] 原文变化后，旧翻译标记为“已过期”。
- [ ] 翻译结果不写回原始 skill/plugin 文件。

## 5. V0.4 通用文件翻译查看

目标：用户可以把任意 Markdown / 文本文件加入 LuminaLink，翻译一次，之后在客户端归类查看。

典型例子：

```text
用户或 Codex 在某个项目下创建 Agent.md
  -> 用户在 LuminaLink 中添加这个文件
  -> 选择类别：其他文件 / Agent 配置 / 自定义分类
  -> LuminaLink 计算文件 hash
  -> 如果没有译文，进入翻译队列
  -> 翻译完成后写入缓存
  -> 后续在客户端直接查看中文译文
  -> 同一文件加入其他类别时，不重复翻译
```

任务清单：

- [ ] 新增资产类型：
  - [ ] `generic_file`
  - [ ] `markdown_doc`
  - [ ] `text_doc`
- [ ] 新增“其他文件”导航或分类。
- [ ] 实现“添加文件”操作。
- [ ] 支持文件格式：
  - [ ] `.md`
  - [ ] `.txt`
  - [ ] `.json`
  - [ ] `.yaml`
  - [ ] `.yml`
- [ ] 支持用户选择分类：
  - [ ] Agent 配置
  - [ ] 项目文档
  - [ ] 插件说明
  - [ ] 其他文件
  - [ ] 自定义分类
- [ ] 一个文件支持加入多个分类。
- [ ] 翻译缓存按内容 hash 命中，而不是按分类重复翻译。
- [ ] 长文档按标题或段落分块翻译。
- [ ] 只重翻变化的分块。
- [ ] 支持查看模式：
  - [ ] 中文
  - [ ] 原文
  - [ ] 中英对照
- [ ] 支持打开源文件。
- [ ] 支持打开所在目录。
- [ ] 支持从文件详情页修改分类。
- [ ] 支持从 Agent 操作手册通过 CLI 添加文件。

验收标准：

- [ ] 同一个 `Agent.md` 加入两个分类，只产生一份翻译缓存。
- [ ] 文件内容不变时，重新添加不重复翻译。
- [ ] 文件内容变化后，标记“已过期”。
- [ ] 用户能在客户端中按分类找到这个文件。
- [ ] 删除分类关系不会删除原始文件，也不会删除翻译缓存。

## 6. V0.5 Agent/CLI 自动化入口

目标：用户不会操作客户端时，可以让 Codex 读取 `AGENT_RUNBOOK.md` 后通过 CLI 操作 LuminaLink。

任务清单：

- [ ] 实现 CLI 入口：
  - [ ] `luminalink status`
  - [ ] `luminalink scan`
  - [ ] `luminalink config list-roots`
  - [ ] `luminalink config add-root "<path>" --kind project_root`
  - [ ] `luminalink assets search "<keyword>"`
  - [ ] `luminalink assets show "<asset-id>"`
  - [ ] `luminalink translate list --status pending`
  - [ ] `luminalink translate run --pending`
  - [ ] `luminalink files add "<path>" --category "<name>"`
  - [ ] `luminalink files translate "<file-id>"`
  - [ ] `luminalink migrate export "<output-file>"`
  - [ ] `luminalink migrate import "<input-file>"`
  - [ ] `luminalink doctor`
- [ ] 每个 CLI 命令支持 `--json`。
- [ ] CLI 与 UI 使用同一套 service 层。
- [ ] `doctor` 能检查：
  - [ ] 配置文件是否存在
  - [ ] 数据库是否可读写
  - [ ] 扫描根是否存在
  - [ ] Provider 是否配置
  - [ ] 最近扫描错误
  - [ ] 最近翻译错误
- [ ] 更新 `AGENT_RUNBOOK.md` 中的实际命令。

验收标准：

- [ ] Codex 可以通过 CLI 完成扫描、搜索、添加文件、翻译和导出。
- [ ] CLI 不输出 raw secret。
- [ ] CLI 返回可机器解析的 JSON。

## 7. V0.6 迁移备份

目标：换电脑时可以迁移非敏感配置和翻译缓存。

任务清单：

- [ ] 实现迁移包导出。
- [ ] 实现迁移包导入。
- [ ] 迁移包包含：
  - [ ] 扫描根模板
  - [ ] 收藏
  - [ ] 标签
  - [ ] 分类
  - [ ] 通用文件记录
  - [ ] 翻译缓存
  - [ ] UI 偏好
- [ ] 迁移包排除：
  - [ ] raw API key
  - [ ] token
  - [ ] cookie
  - [ ] 私钥
  - [ ] 密码
  - [ ] 原始项目源码
- [ ] 新电脑导入后重新检查路径可用性。

验收标准：

- [ ] 新电脑导入后能看到收藏、标签、分类和历史翻译。
- [ ] 路径不存在时显示“需要重新定位”。
- [ ] 迁移包扫描不包含 raw secret。

## 8. V0.7 插件安装与更新

目标：在资产查看稳定后，再做安装和更新能力。

任务清单：

- [ ] 识别插件来源。
- [ ] 检查插件版本。
- [ ] 展示更新提示。
- [ ] 设计安装流程。
- [ ] 设计启用/禁用流程。
- [ ] 安装前展示权限和影响范围。
- [ ] 安装后自动扫描新增资产。

验收标准：

- [ ] 插件安装不会破坏现有扫描索引。
- [ ] 安装后新插件能自动出现在资产库。
- [ ] 用户能看到更新来源和变更说明。

## 9. 数据库目标模型

第一版核心表：

```sql
assets
asset_metadata
source_files
categories
asset_categories
scan_roots
scan_runs
scan_events
tags
asset_tags
favorites
risk_findings
```

翻译缓存表：

```sql
translation_units
translation_records
translation_jobs
translator_providers
```

关键设计：

- `source_files` 表示真实文件。
- `assets` 表示 LuminaLink 里的可展示资产。
- `categories` 表示用户分类。
- `asset_categories` 允许一个资产属于多个分类。
- `translation_units` 按文档分块。
- `translation_records` 以 `source_hash + target_lang + provider + scope` 命中。

这样同一个文件被加入多个分类时，只需要翻译一次。

## 10. 推荐先做的最小闭环

如果从明天开始写代码，最小闭环建议是：

```text
Electron 项目启动
  -> 创建 config.json
  -> 创建 SQLite
  -> 添加一个扫描目录
  -> 扫描 AGENTS.md / Agent.md / SKILL.md
  -> 显示资产列表
  -> 点击文件详情
  -> 手动触发翻译
  -> 缓存译文
  -> 重启后仍能查看中文
```

这个闭环跑通后，再扩展插件扫描、文件监听、CLI 和迁移包。

