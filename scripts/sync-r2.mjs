#!/usr/bin/env node
// R2 镜像对账同步（CI deploy 步骤用，本地可手动跑）：桶 nmail-dl 只保留最新 release 的
// 三平台资产，键=资产文件名（固定三件）→ 重复发版直接覆盖，旧版本自然消失，无需清理。
// 认证：wrangler 读 CLOUDFLARE_API_TOKEN（CI=secrets.CLOUDFLARE_R2_API_TOKEN，需 R2 编辑权限）
//       + CLOUDFLARE_ACCOUNT_ID；本地则用 wrangler login 的 OAuth。
// 注意：wrangler v4 的 r2 object 命令默认写本地模拟器，必须显式 --remote 才碰真桶（首次实跑踩过）。
// env: GITHUB_TOKEN（可选，CI 注入防 API 限流）
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REPO = 'pan-nie/Nmail'
const BUCKET = 'nmail-dl'
const FILES = ['nmail-windows-x64.exe', 'nmail-macos-arm64', 'nmail-linux-x64', 'nmail-macos-arm64.app.zip']

const headers = { 'User-Agent': 'nmail-site', Accept: 'application/vnd.github+json' }
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

const rel = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers }).then((r) => {
  if (!r.ok) throw new Error(`GitHub API ${r.status}`)
  return r.json()
})
const assets = (rel.assets ?? []).filter((a) => FILES.includes(a.name))
if (assets.length !== FILES.length) throw new Error(`最新 release 资产不全：${rel.tag_name} 仅 ${assets.length}/${FILES.length}`)
console.log(`sync-r2: ${rel.tag_name} → 桶 ${BUCKET}`)

// 跳过检查：桶内标记对象 _synced-tag 与最新 tag 相同 = 已同步过（每日 cron/重复部署不必重搬 77MB）
const MARKER = '_synced-tag'
const dir = mkdtempSync(join(tmpdir(), 'nmail-r2-'))
let syncedTag = ''
try {
  const markerFile = join(dir, MARKER)
  try {
    execFileSync('npx', ['wrangler', 'r2', 'object', 'get', `${BUCKET}/${MARKER}`, '--file', markerFile, '--remote'], { stdio: ['ignore', 'ignore', 'pipe'] })
    syncedTag = readFileSync(markerFile, 'utf8').trim()
  } catch {
    syncedTag = '' // 标记不存在 = 首次同步
  }
  if (syncedTag === rel.tag_name) {
    console.log(`sync-r2: R2 已是 ${syncedTag}，跳过`)
    process.exit(0)
  }

  for (const asset of assets) {
    const file = join(dir, asset.name)
    const res = await fetch(asset.browser_download_url, { headers })
    if (!res.ok) throw new Error(`下载失败 ${asset.name}: HTTP ${res.status}`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    console.log(`sync-r2: put ${asset.name}（${(asset.size / 1048576).toFixed(1)} MB）`)
    execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${asset.name}`, '--file', file, '--content-type', 'application/octet-stream', '--remote'], { stdio: 'inherit' })
  }
  // 全部成功才写标记；中途失败则标记保持旧值，下次部署自动重试
  writeFileSync(join(dir, MARKER), rel.tag_name)
  execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${MARKER}`, '--file', join(dir, MARKER), '--content-type', 'text/plain', '--remote'], { stdio: 'inherit' })
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log('sync-r2: 完成——R2 仅含最新版三平台资产（旧版已被覆盖）')
