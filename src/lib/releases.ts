// GitHub Releases 拉取（构建期）：单一来源=仓库 Releases；离线/限流时回退本地常量，
// 保证 `astro build` 任何环境都能出站（REDESIGN_PLAN §10.2）。
const REPO_API = 'https://api.github.com/repos/pan-nie/Nmail/releases'
export const FALLBACK_VERSION = '0.4.0'
export const REPO_URL = 'https://github.com/pan-nie/Nmail'

export interface Release {
  tag_name: string
  name: string | null
  published_at: string | null
  body: string | null
  html_url: string
  assets?: { name: string; size: number }[]
}

async function getJson(url: string): Promise<unknown> {
  // CI（Actions 共享出口 IP）匿名配额 60 次/时常被耗尽 → 403 走回退分支；
  // 有 GITHUB_TOKEN 时带上认证（Actions 自动注入，配额升到 5000/时），本地无 token 行为不变。
  const token = process.env.GITHUB_TOKEN
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'nmail-site',
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  return res.json()
}

/** 清理发布说明：GitHub 生成的「**Full Changelog**: …」行在已有 Release 被再次
 * 更新（资产分批上传/失败重跑）时会被 API 重复追加（v0.4.3 曾连排 5 遍），且
 * 卡片头部本就有「在 GitHub 查看」链接，站点统一整行剔除并压掉多余空行。 */
function cleanBody(body: string | null): string | null {
  if (!body) return body
  return body
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('**Full Changelog**'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function fetchLatestRelease(): Promise<Release | null> {
  try {
    const list = (await getJson(`${REPO_API}?per_page=1`)) as Release[]
    return list[0] ? { ...list[0], body: cleanBody(list[0].body) } : null
  } catch {
    return null
  }
}

export async function fetchReleases(perPage = 10): Promise<Release[]> {
  try {
    return (((await getJson(`${REPO_API}?per_page=${perPage}`)) as Release[]) ?? []).map(
      (r) => ({ ...r, body: cleanBody(r.body) }),
    )
  } catch {
    return []
  }
}

/** tag_name（v0.4.0）→ 显示版本号（0.4.0） */
export function versionOf(tag: string | undefined | null): string {
  return (tag ?? FALLBACK_VERSION).replace(/^v/, '')
}
