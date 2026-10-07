# nmail-site 部署说明（docs/DEPLOY.md）

线上 **<https://nmail.whizzzest.com>**，托管 Cloudflare Workers 静态资产。
2026-09-12 由 Pages 迁到 Workers（CF 官方推荐新项目用 Workers，Pages 功能基本冻结；
且 Workers 自定义域名可在 wrangler.toml 声明，`wrangler deploy` 全自动建 DNS+证书，
Pages 只能 Dashboard 手点）。

## wrangler.toml 要点

| 配置 | 值 | 说明 |
|---|---|---|
| `name` | `nmail-site` | Worker 名 |
| `main` | `src/worker.ts` | Worker 入口：仅 `/dl/*` 进代码（`run_worker_first`），其余纯静态资产 |
| `[[r2_buckets]]` | `nmail-dl`（binding `DL_BUCKET`） | 最新版三平台安装包镜像（键=资产文件名，sync-r2.mjs 覆盖式同步） |
| `[assets].directory` | `./dist` | astro build 产物 |
| `not_found_handling` | `404-page` | 未命中返回 `/404.html`（404 状态码） |
| `html_handling` | `auto-trailing-slash` | `/download` 与 `/download/` 都命中 |
| `workers_dev` | `true` | 兜底入口 `nmail-site.<子域>.workers.dev`（大陆常不可直连，仅备用） |
| `routes.custom_domain` | `nmail.whizzzest.com` | 部署时自动建 CNAME+证书；要求 whizzzest.com 区域在同一 CF 账户下 |

## 日常发版

```bash
npm run build          # prebuild 同步主仓文档 + 构建期拉 Releases
npm run sync:r2        # 可选：手动同步最新 release 资产进 R2（CI 部署时会自动跑）
npx wrangler deploy    # 静态资产 + /dl Worker + 域名按 wrangler.toml 自动生效
```

## CI 自动部署（三个触发器）

`.github/workflows/deploy.yml`：Actions checkout → `npm ci` → `npm run build` → `sync-r2`（R2 镜像对账，continue-on-error）→ `wrangler-action@v3 deploy`。

| 触发器 | 覆盖什么 |
|---|---|
| `push: main` | 本仓库改动（页面/样式/同步脚本） |
| `workflow_dispatch` | 主仓发版联动：release.sh 末尾 `gh workflow run deploy.yml -R pan-nie/nmail-site`（本机 gh 登录态，零额外配置），发版后 1-2 分钟站点跟上 |
| `schedule: 0 1 * * *` | 每日兜底：主仓 docs/ 的提交最迟 24h 上站（sync-docs 从 raw main 拉），Releases 同理。注意仓库 60 天无活动 GitHub 会自动停用 schedule |

### Secrets（一次性配置）

需要仓库 Secrets（Settings → Secrets and variables → Actions，或本机 `gh secret set`）：

- `CLOUDFLARE_API_TOKEN`：CF dashboard → My Profile → API Tokens → Create Token，
  用 **Edit Cloudflare Workers** 模板并追加 **Zone · DNS · Edit** 权限（自定义域名自动建 DNS/证书需要）
- `CLOUDFLARE_ACCOUNT_ID`：见 wrangler.toml 同账户，`npx wrangler whoami` 可查
- `CLOUDFLARE_R2_API_TOKEN`：**仅 R2 编辑权限**的独立 token（`sync-r2.mjs` 用，与 deploy token 分离做最小授权）

```bash
gh secret set CLOUDFLARE_API_TOKEN -R pan-nie/nmail-site      # 粘贴 token
gh secret set CLOUDFLARE_ACCOUNT_ID -R pan-nie/nmail-site
gh secret set CLOUDFLARE_R2_API_TOKEN -R pan-nie/nmail-site   # R2 镜像同步用
```

构建期拉 GitHub Releases 用 **`GITHUB_TOKEN`**——Actions 自动注入，无需配置；
deploy.yml 的 build 步骤已 `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` 传给
releases.ts（匿名请求在 Actions 共享 IP 上必被限流，changelog 会退化为空态）。

wrangler 在 devDependencies 里锁版本——wrangler-action 的 npx 在无 TTY 的 CI 里
现下载会被取消（"no YES option"），本地有依赖则直接用。

## 与个人站同步（whizzzest.com）

- 内容源 `src/content/projects/*.md` → 构建产出 `/projects.json`；个人站构建时直接 fetch。
- 新项目照 nmail.md 格式加 md 即可。发版一条龙：主仓 `release.sh` 打 tag → 本仓库补一篇动态（`src/content/posts/`）→ 两站构建自动更新。

## 故障排查

- **changelog 空态 / 徽章显示旧版**：构建期 GitHub API 拉取失败（限流/离线）。CI 检查
  deploy.yml 是否注入 GITHUB_TOKEN；本地复现用 `npm run build` 看输出。
- **文档区缺篇**：sync-docs 来源全败时该篇跳过（warn 日志）；一篇都拉不到才构建失败。
  检查 `NMAIL_DOCS_DIR` / 仓库布局（本站应与主仓并列：`Nmail/nmail-site` + `Nmail/Nmail`）。
- **域名证书/DNS 异常**：custom_domain 由 `wrangler deploy` 全自动维护，重跑一次 deploy 即可。
- **`/dl` 变慢或仍跳 GitHub**：R2 未同步（sync-r2 失败或尚未跑）——worker 对未命中自动 302 GitHub 属预期降级，不算故障；查 Actions 同步步日志，或本机 `npm run sync:r2` 手动补（本地走 wrangler login 的 OAuth）。
