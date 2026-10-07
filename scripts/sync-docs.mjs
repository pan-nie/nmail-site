#!/usr/bin/env node
// 文档同步（npm prebuild）：把 Nmail 主仓 docs/ 里「可公开的白名单文档」拷到
// src/content/docs/<slug>.md，构建期渲染成 /docs/<slug>。
//
// 单一来源原则：文档本体永远在主仓维护；本站只做同步渲染，绝不手改生成文件。
// 安全约束：白名单显式列举——主仓 docs/ 里有含凭据、被 gitignore 的内部文档，
// 严禁整目录拷贝。
//
// 来源优先级：环境变量 NMAIL_DOCS_DIR → 本地同级仓库（开发机）→ GitHub raw main（CI）。
// 同步时把指向白名单内文档的相对链接改写为站内路由（/docs/<slug>）。

import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'src', 'content', 'docs')
const RAW_BASE = 'https://raw.githubusercontent.com/pan-nie/Nmail/main/docs'

// 白名单：file=主仓 docs/ 下的文件名；slug=站内路由（/docs/<slug>）
const MAP = [
  { file: 'INSTALL.md', slug: 'install' },
  { file: '使用指南.md', slug: 'guide' },
  { file: 'FAQ.md', slug: 'faq' },
  { file: '隐私与安全.md', slug: 'privacy' },
  { file: 'OAuth2 使用指南.md', slug: 'oauth' },
  { file: 'Agent接入指南.md', slug: 'agent' },
  { file: '对外API使用指南.md', slug: 'api' },
  { file: 'CHANGELOG.md', slug: 'changelog' },
  { file: 'ARCHITECTURE.md', slug: 'architecture' },
  { file: 'PRODUCT_PLAN.md', slug: 'plan' },
]
const FILE_TO_SLUG = new Map(MAP.map((m) => [m.file, m.slug]))
// 白名单外的仓库文件链接 → GitHub（如 INSTALL.md 引用 ../README.md）
const EXTRA_LINKS = new Map([
  ['README.md', 'https://github.com/pan-nie/Nmail/blob/main/README.md'],
  ['README.zh-CN.md', 'https://github.com/pan-nie/Nmail/blob/main/README.zh-CN.md'],
])

// 2026-09-12 起目录结构为 Nmail/nmail-site（官网）与 Nmail/Nmail（主仓）并列——首选 ../Nmail/docs；
// 旧结构（两者都在 Mail-managment 下）与其余常见摆法保留兜底，NMAIL_DOCS_DIR 永远最优先
const localCandidates = [
  process.env.NMAIL_DOCS_DIR,
  path.join(ROOT, '..', 'Nmail', 'docs'),
  path.join(ROOT, '..', 'Nmail', 'Nmail', 'docs'),
].filter(Boolean)

async function readLocal(file) {
  for (const dir of localCandidates) {
    const p = path.join(dir, file)
    if (existsSync(p)) return { text: await import('node:fs/promises').then((fs) => fs.readFile(p, 'utf8')), from: dir }
  }
  return null
}

async function readRemote(file) {
  const url = `${RAW_BASE}/${encodeURIComponent(file)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`GitHub raw ${res.status}`)
  return { text: await res.text(), from: 'GitHub raw main' }
}

/** 相对 .md 链接 → 站内 /docs/<slug>（白名单内）或 GitHub（白名单外）；http(s)/锚点/站内绝对路径不动 */
function rewriteLinks(text) {
  return text.replace(/\]\(([^):#]+?\.md)(#[^)]*)?\)/g, (full, rel, anchor = '') => {
    if (/^(https?:)?\/\//.test(rel) || rel.startsWith('/') || rel.startsWith('#')) return full
    const base = decodeURIComponent(rel.split('/').pop())
    if (FILE_TO_SLUG.has(base)) return `](/docs/${FILE_TO_SLUG.get(base)}${anchor})`
    if (EXTRA_LINKS.has(base)) return `](${EXTRA_LINKS.get(base)}${anchor})`
    return full
  })
}

/** 主仓文档 H1 惯例带「（docs/xxx.md）」路径注记——站上展示剥掉（只处理首个 H1） */
function stripTitleAnnotation(text) {
  return text.replace(/^(# [^\n(（]*?)（docs\/[^）]+）/, '$1')
}

await mkdir(OUT, { recursive: true })
let ok = 0
for (const { file, slug } of MAP) {
  let src = null
  try {
    src = await readLocal(file)
  } catch { /* fall through */ }
  if (!src) {
    try {
      src = await readRemote(file)
    } catch (err) {
      console.warn(`⚠ 文档同步跳过 ${file}（本地无、GitHub 拉取失败：${err.message}）`)
      continue
    }
  }
  await writeFile(path.join(OUT, `${slug}.md`), stripTitleAnnotation(rewriteLinks(src.text)), 'utf8')
  console.log(`✓ docs/${slug}.md ← ${file} (${path.basename(src.from)})`)
  ok++
}
if (ok === 0) {
  console.error('✗ 一篇文档都没同步到：本地找不到主仓 docs/ 且 GitHub 拉取失败，构建中止。')
  process.exit(1)
}
console.log(`文档同步完成：${ok}/${MAP.length} 篇`)
