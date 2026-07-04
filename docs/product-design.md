# LuminaLink 产品设计文档

- 状态：设计稿阶段
- 日期：2026-07-04
- 目标平台：Windows 桌面优先，后续可扩展到 macOS / Linux
- 推荐技术栈：Electron + Vue 3 + TypeScript + SQLite

## 1. 产品定位

LuminaLink 是一个开源、中文优先的本机 AI 助手资产管理器，用来集中管理开发者电脑上的：

- AI skills
- 插件 / plugin
- 项目级 Agent 指令文件
- 本地项目说明文档
- 英文说明的中文翻译缓存

它不是一个聊天应用，也不是插件市场的简单列表页。它更像一个“本机 AI 工具资产台账 + 中文说明层 + 迁移助手”。

## 2. 设计原则

1. 开源可迁移  
   不把某一台电脑的绝对路径写死进应用逻辑。路径通过自动探测、首次启动向导和用户配置保存。

2. 中文优先，原文可查  
   默认展示中文说明，但保留英文原文，避免翻译误解触发规则、安装步骤或安全提示。

3. 只读优先  
   MVP 默认只扫描、索引、翻译和展示，不直接修改用户已安装的 skill、plugin 或 Agent 文件。

4. 本地优先  
   索引、翻译缓存、收藏、标签和扫描配置默认保存在本机。未来可以增加导入/导出迁移包。

5. 安全克制  
   不收集、不展示、不同步原始 token、cookie、API key、私钥等敏感值。界面中只显示红acted 提示和存储位置。

## 3. 目标用户

### 主要用户

有多个 AI 工具、插件、skills、Agent 配置和本地项目的开发者。

典型特征：

- 会使用 Codex、Copilot、Cursor、Claude Code 等工具。
- 有多个本地项目和项目级指令文件。
- 下载了很多英文插件，但希望日常用中文理解和检索。
- 换电脑时希望快速恢复自己的 AI 开发环境。

### 次要用户

- 开源工具爱好者
- AI 工作流整理者
- 需要给团队维护 Agent 配置规范的小团队开发者

## 4. 核心用户场景

### 场景 A：我想知道电脑上有哪些 skills 和插件

用户打开 LuminaLink 后，应用自动扫描常见目录，展示资产列表、来源、说明、状态和最近修改时间。

### 场景 B：插件说明是英文，我想默认看中文

用户点击“翻译全部”或单个资产的“翻译”，应用调用配置好的翻译 Provider，把结果写入本地缓存。之后默认展示中文。

### 场景 C：我想找到适合当前项目的 Agent / skill

用户搜索关键词，例如“GitHub PR”“PPT”“ComfyUI”“Stripe”，应用在名称、描述、触发规则和标签中检索，并显示相关资产。

### 场景 D：我换电脑了，希望快速恢复

用户在旧电脑导出 LuminaLink 迁移包，在新电脑安装应用后导入。迁移包包含非敏感配置、收藏、标签和翻译缓存，不包含 raw API key。

### 场景 E：我想整理项目里的 AGENTS.md

应用扫描项目目录，展示每个项目的 Agent 指令文件，标记文件名、路径、摘要和兼容性。后续版本可生成模板或检查规则冲突。

## 5. MVP 范围

MVP 只做稳定的资产索引和中文展示。

必须包含：

- 首次启动路径探测
- 扫描 skill / plugin / Agent 文件
- SQLite 本地索引
- 中文翻译缓存
- 搜索与筛选
- 资产详情面板
- 打开目录 / 打开文件
- 收藏和标签
- 基础设置页

暂不包含：

- 自动安装插件
- 自动更新插件
- 直接修改第三方 skill/plugin 文件
- 云同步
- 团队权限系统

## 6. 信息架构

主导航：

- 总览
- 资产库
- 翻译队列
- 项目 Agent
- 迁移与备份
- 设置

资产类型：

- Skill
- Plugin
- Agent 指令
- 项目文档
- Provider 配置

资产状态：

- 已索引
- 未翻译
- 已翻译
- 翻译已过期
- 解析失败
- 可能含敏感信息
- 来源缺失

## 7. 主界面布局

推荐桌面布局：

- 左侧：主导航和项目分组
- 顶部：全局搜索、扫描按钮、翻译状态
- 中间：资产列表或表格
- 右侧：资产详情抽屉
- 底部：扫描日志和任务状态，可折叠

主界面不做欢迎页。启动后直接进入“资产库”或“总览”。

## 8. 关键页面设计

### 8.1 总览页

作用：让用户快速理解当前电脑的 AI 资产状态。

模块：

- 资产数量统计
- 未翻译数量
- 最近新增资产
- 最近修改项目
- 潜在问题提醒
- 快捷操作：重新扫描、翻译未翻译、导出迁移包

### 8.2 资产库页

作用：日常使用的主页面。

模块：

- 类型筛选
- 标签筛选
- 搜索
- 资产表格 / 列表
- 详情面板
- 中文/原文切换
- 打开目录、打开文件、收藏、重新翻译

### 8.3 翻译队列页

作用：管理英文内容的翻译状态。

模块：

- 待翻译列表
- 翻译失败列表
- Provider 状态
- 批量翻译
- 重新翻译
- 原文 hash 变化提示

### 8.4 项目 Agent 页

作用：集中查看项目里的 Agent 指令文件。

模块：

- 项目列表
- `AGENTS.md` / `Agent.md` / `CLAUDE.md` / `.cursorrules` 检测
- 项目摘要
- 指令文件摘要
- 安全提示
- 打开项目、打开文件

### 8.5 迁移与备份页

作用：支持换电脑。

模块：

- 导出迁移包
- 导入迁移包
- 迁移包内容预览
- 敏感信息排除说明
- 新电脑首次扫描建议

### 8.6 设置页

作用：配置扫描路径、翻译 Provider、数据位置和 UI 偏好。

模块：

- 扫描路径管理
- 翻译 Provider 管理
- 数据库存储位置
- 语言与主题
- 隐私与敏感信息规则

## 9. 视觉方向

整体风格：安静、清晰、工程工具感。

设计关键词：

- 中文信息密度适中
- 表格和列表优先
- 少装饰、多结构
- 控件边界清楚
- 适合长时间盯着看

建议避免：

- 营销式大 hero
- 大面积单色渐变
- 装饰性卡片堆叠
- 过度圆角
- 用花哨插画代替真实功能区

建议色彩：

- 基础背景：接近白色或浅灰
- 主文字：高对比深灰
- 主强调色：偏青绿色或蓝绿色，用于扫描、健康状态和当前选中项
- 警示色：橙色或红色，仅用于风险和错误
- 辅助色：蓝色用于链接，紫色少量用于 AI/翻译标识

## 10. 数据模型草案

```ts
type AssetType = 'skill' | 'plugin' | 'agent_file' | 'project_doc' | 'provider';

type TranslationStatus = 'none' | 'translated' | 'stale' | 'failed';

interface Asset {
  id: string;
  type: AssetType;
  name: string;
  displayName: string;
  sourcePath: string;
  sourceRoot: string;
  originalDescription?: string;
  chineseDescription?: string;
  tags: string[];
  projectName?: string;
  version?: string;
  lastModifiedAt: string;
  translationStatus: TranslationStatus;
  favorite: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}
```

```ts
interface TranslationRecord {
  id: string;
  assetId: string;
  sourceHash: string;
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
}
```

```ts
interface ScanRoot {
  id: string;
  label: string;
  pathExpression: string;
  expandedPath: string;
  enabled: boolean;
  kind: 'codex_skills' | 'codex_plugins' | 'agents_skills' | 'project_root' | 'docs_root' | 'custom';
}
```

## 11. 本地存储设计

推荐位置：

- 配置：`%APPDATA%/LuminaLink/config.json`
- 索引数据库：`%LOCALAPPDATA%/LuminaLink/luminalink.sqlite`
- 翻译缓存：`%LOCALAPPDATA%/LuminaLink/translation-cache.sqlite`
- 导入导出：用户选择目录

仓库中只保留：

- 示例配置
- schema
- README
- 开发文档
- 测试数据

## 12. 翻译机制

翻译流程：

1. 读取资产原文。
2. 计算 source hash。
3. 查询本地翻译缓存。
4. 如果 hash 命中，直接展示中文。
5. 如果 hash 变化，标记为“翻译已过期”。
6. 用户确认后重新翻译。
7. 翻译失败时保留原文和失败原因。

Provider 接口：

```ts
interface TranslatorProvider {
  id: string;
  displayName: string;
  translate(input: TranslateInput): Promise<TranslateResult>;
  checkHealth(): Promise<ProviderHealth>;
}
```

首批 Provider：

- OpenAI
- 本地模型预留
- 手动翻译
- 无 Provider 模式

## 13. 扫描规则

默认扫描表达式：

```json
{
  "scanRoots": [
    "%USERPROFILE%/.codex/skills",
    "%USERPROFILE%/.codex/plugins/cache",
    "%USERPROFILE%/.agents/skills"
  ],
  "agentFileNames": [
    "AGENTS.md",
    "AGENT.md",
    "Agent.md",
    "CLAUDE.md",
    ".cursorrules"
  ]
}
```

扫描策略：

- 默认只读。
- 跳过 `node_modules`、`.git`、构建产物、大型媒体目录。
- 对 Markdown 解析失败要容错。
- 对疑似敏感内容只记录风险，不展示 raw value。

## 14. 开源发布策略

仓库应包含：

- `README.md`
- `AGENTS.md`
- `docs/product-design.md`
- `config/*.example.json`
- `.env.example`
- `.gitignore`
- Electron / Vue 源码

仓库不应包含：

- `.env`
- local config
- SQLite 数据库
- 翻译缓存
- API key
- 用户真实路径配置
- 用户项目私有资料

## 15. 迭代路线

### V0.1：资产索引

- 项目骨架
- 本地扫描
- 资产列表
- 详情面板
- SQLite 索引

### V0.2：中文翻译

- Provider 配置
- 翻译缓存
- 中文/原文切换
- 翻译队列

### V0.3：项目 Agent 管理

- 扫描项目根目录
- Agent 文件摘要
- 风险提示
- 项目分组

### V0.4：迁移包

- 导出非敏感配置
- 导入配置
- 翻译缓存迁移
- 新电脑向导

### V0.5：插件管理增强

- 插件来源识别
- 更新检查
- 安装流程草案
- 依赖检查

## 16. 成功标准

MVP 成功的判断：

- 新电脑安装后可以通过向导完成首次扫描。
- 用户能在 10 秒内找到某个 skill/plugin 的中文说明。
- 用户能清楚看到哪些说明已翻译、哪些已过期。
- 用户能打开原始文件和所在目录。
- 应用不会修改或破坏原始插件文件。
- 导出的迁移包不包含 raw secret。

## 17. UI 概念图

本阶段生成了三张桌面端 UI 概念图，说明见：

`docs/ui-concepts.md`

推荐第一版以“工程控制台”为主界面，吸收“资产知识库”的详情阅读结构，并将“迁移健康中心”作为后续迁移备份模块的设计基准。

## 18. 使用流程与数据流

用户进入软件、客户端扫描、翻译触发、Provider 选择和本地存储设计见：

`docs/user-flow-data-flow.md`

## 19. 实现目标清单

分阶段开发目标、通用文件翻译查看、CLI 自动化入口和最小闭环见：

`docs/implementation-checklist.md`
