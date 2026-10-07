# nmail-site — Nmail 官网

[English](README.md) ｜ 中文

Nmail 官网 <https://nmail.whizzzest.com> 的静态站点（Astro 5，对应主仓 REDESIGN_PLAN §10 的
P8 阶段，独立仓库）。托管用 **Cloudflare Workers 静态资产**（2026-09-12 由 Pages 迁入 Workers，
理由见下方部署节）。零框架 CSS、零客户端 JS（下载页复制按钮除外）；版本徽章与更新日志在
**构建期**从 GitHub Releases 拉取（单一来源，离线构建自动回退本地常量，不阻塞出站）。

## 本地开发

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # 产物 dist/
npm run preview
```

## 页面

| 路径 | 内容 |
|------|------|
| `/` | Hero + 六特性卡 + 最新版本徽章 + 三步开始 |
| `/download/` | PyPI / winget / Homebrew 一键命令（复制按钮）+ GitHub 二进制 + 系统要求 |
| `/features/` | 用户视角功能页（随版本迭代补充） |
| `/changelog/` | 构建期渲染 GitHub Releases（单源） |
| `/docs/` | **文档中心**：构建期从主仓 `docs/` 白名单同步渲染（见下节） |
| `/posts/` | 版本动态/博客（`src/content/posts/*.md`） |
| `/projects.json` | **与个人站 whizzzest.com 共享的项目区块内容源**（`src/content/projects/*.md`） |

## 文档上站（单一来源：主仓 docs/）

`npm run build` 的 prebuild 会跑 `scripts/sync-docs.mjs`：把 Nmail 主仓
`docs/` 里**白名单内**的文档同步到 `src/content/docs/<slug>.md` 并渲染为 `/docs/<slug>`。

- 来源优先级：环境变量 `NMAIL_DOCS_DIR` → 本地主仓（与主仓并列检出，即 `../Nmail/docs`）→ GitHub raw main（CI 兜底，一篇都拉不到才构建失败）。
- **白名单显式列举**（`sync-docs.mjs` 的 `MAP`）：主仓 docs/ 有含凭据、被 gitignore 的内部文档，**严禁改成整目录拷贝**。
- 同步时自动：相对 `.md` 链接改写为站内路由（白名单外指到 GitHub）、剥掉 H1 的「（docs/xxx.md）」路径注记。
- 导航元数据（标题/分组/顺序）在 `src/config/docs.ts`；**生成的 md 不入库**（.gitignore）——改文档去主仓改，站上构建自动跟上。

## 部署（Cloudflare Workers 静态资产）

**当前状态（2026-09-12）**：仓库 `github.com/pan-nie/nmail-site`（public）。
线上 **<https://nmail.whizzzest.com>**（自定义域，`wrangler.toml` 声明 `routes.custom_domain=true`，
部署时自动建 DNS+证书）；兜底入口 <https://nmail-site.nathanpenny.workers.dev>（注：workers.dev
在大陆网络常不可直连，主入口用自定义域即可）。

> 2026-09-12 由 Pages 迁到 Workers：CF 官方推荐新项目用 Workers（Pages 功能基本冻结），
> 且 Workers 的自定义域名能在 wrangler 配置里声明、`wrangler deploy` 全自动——Pages 只能 Dashboard 手点。

日常发版：

```bash
npm run build
npx wrangler deploy     # 静态资产 + 自定义域名按 wrangler.toml 自动生效
```

CI（`.github/workflows/deploy.yml`）三个触发器：push main / 主仓发版联动
（release.sh 末尾 `gh workflow run`，发版后 1-2 分钟站点跟上）/ 每日定时构建
（兜底主仓 docs 与 Releases 变更）。需要 Secrets：`CLOUDFLARE_API_TOKEN`
（Workers Scripts Edit + Zone DNS Edit）与 `CLOUDFLARE_ACCOUNT_ID`，配置步骤见
[docs/DEPLOY.md](docs/DEPLOY.md)；构建期拉 Releases 用 Actions 自动注入的
`GITHUB_TOKEN`，无需额外配置。

## 开发文档

仓库自身约定与细节看这几份（**开发文档，不出现在站上**；站上 /docs 是主仓文档镜像）：

- [CLAUDE.md](CLAUDE.md) — 工作规范：常用命令、提交纪律、红线
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 目录结构与数据流
- [docs/DEPLOY.md](docs/DEPLOY.md) — Workers 部署、域名、CI、故障排查
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — 本仓库变更记录

## 与个人站同步（REDESIGN_PLAN §10.3）

- 项目内容源：`src/content/projects/`（每个项目一个 md：name/description/status/url/repo/order）。
- 个人站构建时 `fetch('https://nmail.whizzzest.com/projects.json')` 即得项目列表；其他项目同格式加 md 即可，Nmail 不是特例。
- 发版一条龙：Nmail 主仓 `release.sh` 打 tag → 本仓库补一篇动态（`src/content/posts/`）→ 两站构建自动更新。

## 备注与后续

- OG 图暂用应用图标（`public/icon-512.png`）；有了应用截图后放 `public/screenshot.png` 并在首页 hero 引用。
- 博客按发布节奏手写；构建期拉不到 Releases 时 changelog 页有优雅回退提示。
