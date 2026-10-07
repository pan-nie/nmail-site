# nmail-site — The Nmail Website

English ｜ [中文](README.zh-CN.md)

The static site behind the Nmail website, <https://nmail.whizzzest.com> (Astro 5; stage P8 of the main repo's REDESIGN_PLAN §10, kept as a standalone repo). Hosted with **Cloudflare Workers static assets** (migrated from Pages on 2026-09-12 — rationale in the deployment section below). Framework-free CSS and zero client-side JS (the copy buttons on the download page are the only exception); the version badge and changelog are pulled from GitHub Releases **at build time** (single source; offline builds fall back to local constants and never block the build).

## Local development

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # output in dist/
npm run preview
```

## Pages

| Path | Contents |
|------|----------|
| `/` | Hero + six feature cards + latest-version badge + three steps to get started |
| `/download/` | One-line install commands for PyPI / winget / Homebrew (copy buttons) + GitHub binaries + system requirements |
| `/features/` | User-facing feature page (grows release by release) |
| `/changelog/` | GitHub Releases rendered at build time (single source) |
| `/docs/` | **Documentation hub**: synced and rendered from the main repo's `docs/` whitelist at build time (see next section) |
| `/posts/` | Release notes / blog (`src/content/posts/*.md`) |
| `/projects.json` | **Shared project-feed source for the personal site whizzzest.com** (`src/content/projects/*.md`) |

## Serving docs (single source: the main repo's `docs/`)

`npm run build` runs `scripts/sync-docs.mjs` via prebuild: it copies **whitelisted** documents from the Nmail main repo's `docs/` into `src/content/docs/<slug>.md` and renders them at `/docs/<slug>`.

- Source priority: the `NMAIL_DOCS_DIR` env var → the local main repo (checked out side by side with this repo, i.e. `../Nmail/docs`) → GitHub raw main (CI fallback; the build only fails if not a single document can be fetched).
- **The whitelist is explicit** (the `MAP` in `sync-docs.mjs`): the main repo's `docs/` contains internal documents with credentials that are gitignored — **never turn this into a whole-directory copy**.
- During sync, relative `.md` links are rewritten to on-site routes (non-whitelisted files point to GitHub), and the `（docs/xxx.md）` path annotation is stripped from the first H1.
- Navigation metadata (titles / groups / order) lives in `src/config/docs.ts`; **the generated markdown is not committed** (gitignored) — edit documents in the main repo and the site picks them up automatically on the next build.

## Deployment (Cloudflare Workers static assets)

**Current state (2026-09-12)**: repo `github.com/pan-nie/nmail-site` (public). Live at **<https://nmail.whizzzest.com>** (custom domain — `wrangler.toml` declares `routes.custom_domain=true`, so deploy creates DNS + certificate automatically); fallback entry <https://nmail-site.nathanpenny.workers.dev> (note: workers.dev is often unreachable from mainland-China networks — the custom domain is the primary entry).

> Migrated from Pages to Workers on 2026-09-12: Cloudflare recommends Workers for new projects (Pages feature work is mostly frozen), and Workers lets you declare the custom domain in wrangler config so `wrangler deploy` is fully automatic — with Pages, domains can only be clicked into place in the Dashboard.

Routine deploys:

```bash
npm run build
npx wrangler deploy     # static assets + custom domain applied per wrangler.toml
```

CI (`.github/workflows/deploy.yml`) has three triggers: push to main / main-repo release hook (`release.sh` ends with `gh workflow run`; the site catches up 1–2 minutes after a release) / daily scheduled build (a safety net for main-repo docs & Releases changes). Required secrets: `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit + Zone DNS Edit) and `CLOUDFLARE_ACCOUNT_ID` — setup steps in [docs/DEPLOY.md](docs/DEPLOY.md). Build-time Release fetches use the `GITHUB_TOKEN` injected automatically by Actions; nothing else to configure.

## Developer docs

Repo-specific conventions and details live here (**developer docs, not shown on the site** — the site's `/docs` mirrors the main repo):

- [CLAUDE.md](CLAUDE.md) — working conventions: common commands, commit discipline, red lines
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — directory structure and data flow
- [docs/DEPLOY.md](docs/DEPLOY.md) — Workers deployment, domains, CI, troubleshooting
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — this repo's change log

## Syncing with the personal site (REDESIGN_PLAN §10.3)

- Project content source: `src/content/projects/` (one markdown per project: name/description/status/url/repo/order).
- The personal site fetches `https://nmail.whizzzest.com/projects.json` at build time to get the project list; other projects can join by adding a markdown file in the same format — Nmail is not special-cased.
- Full release pipeline: `release.sh` in the main repo tags the release → this repo gets a new post (`src/content/posts/`) → both sites rebuild automatically.

## Notes & TODOs

- The OG image currently reuses the app icon (`public/icon-512.png`); once there's a real app screenshot, drop it at `public/screenshot.png` and reference it in the homepage hero.
- Blog posts are written by hand, one per release; when Releases can't be fetched at build time, the changelog page shows a graceful fallback notice.
