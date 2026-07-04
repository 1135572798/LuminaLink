# LuminaLink 公开发布指南

- 日期：2026-07-05
- 目标仓库：`https://github.com/1135572798/LuminaLink`
- 发布类型：开源公开仓库

## 当前本地状态

本地项目已经是 Git 仓库，并已推送到 GitHub 公开仓库：

```text
https://github.com/1135572798/LuminaLink
```

当前远端：

```text
origin  https://github.com/1135572798/LuminaLink.git
branch  main
visibility public
```

首次公开发布已完成。后续维护时只需要正常提交并推送：

```powershell
git status --short
git add <changed-files>
git commit -m "Describe the change"
git push
```

## 如果需要重新创建仓库

一般不需要重新创建仓库。只有在仓库被删除、换 owner，或要重建远端时才需要执行本节。

安装 GitHub CLI：

```powershell
winget install --id GitHub.cli
```

登录 GitHub：

```powershell
gh auth login
gh auth status
```

在项目根目录执行：

```powershell
cd <project-root>
git branch -M main
gh repo create 1135572798/LuminaLink --public --source . --remote origin --push
```

执行完成后检查：

```powershell
git remote -v
git status --short
```

预期结果：

- GitHub 上出现公开仓库 `1135572798/LuminaLink`。
- 本地 `origin` 指向 `https://github.com/1135572798/LuminaLink.git`。
- `main` 分支已经推送到远端。

## 手动创建仓库方式

如果不想安装 `gh`，可以先在 GitHub 网页创建公开仓库：

```text
Owner: 1135572798
Repository name: LuminaLink
Visibility: Public
不要勾选 README / .gitignore / License
```

创建完成后，在项目根目录执行：

```powershell
cd <project-root>
git branch -M main
git remote add origin https://github.com/1135572798/LuminaLink.git
git push -u origin main
```

如果网页创建时已经初始化了 README，推送前需要先同步远端历史，建议重新创建空仓库更简单。

## 换电脑使用流程

新电脑上安装：

- Git
- Node.js 24+
- pnpm 11+
- GitHub CLI，可选但推荐

克隆项目：

```powershell
git clone https://github.com/1135572798/LuminaLink.git
cd LuminaLink
pnpm install
```

如果 Electron 下载慢：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
pnpm rebuild electron
```

运行：

```powershell
pnpm dev
```

导入旧电脑迁移包：

```powershell
pnpm luminalink migrate import "<backup-path>\luminalink-migration.json"
pnpm luminalink scan
```

## 发布前检查清单

```powershell
pnpm build
pnpm luminalink doctor --json
pnpm luminalink scan --json
git status --short
```

不要提交以下内容：

- `.env`
- API key / token / cookie / 私钥
- `%APPDATA%/LuminaLink/config.json`
- `%LOCALAPPDATA%/LuminaLink/*.sqlite`
- `dist/`
- `node_modules/`

## Agent 协助说明

如果用户让 Codex 或其他 Agent 帮忙发布：

1. 先读取项目根目录 `AGENTS.md` 和 `AGENT_RUNBOOK.md`。
2. 检查 `git status --short`，确认没有无关改动。
3. 检查 `gh --version` 和 `gh auth status`。
4. 如果没有 `gh` 或没有登录，不要猜测 token，不要输出或保存密钥。
5. 目标仓库已存在时，只需要 `git push`。
6. 目标仓库不存在时，优先让用户安装并登录 `gh`，再执行 `gh repo create`。
7. 推送完成后回报远端地址、分支、提交 SHA 和验证命令结果。
