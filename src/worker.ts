// /dl/* 下载路由：R2 镜像桶（nmail-dl）直读最新版三平台安装包，键=资产文件名。
// CI 部署时 scripts/sync-r2.mjs 把 GitHub 最新 release 资产覆盖式镜像进桶（桶内永远只有最新版）。
// R2 未命中（首次部署前/同步失败）→ 302 兜底 GitHub 最新版直链，页面永不出现死链。
// 其余请求不会进本 Worker：wrangler.toml run_worker_first 仅拦 /dl/*，静态资产照走免费资产管线。
interface R2Like {
  get(key: string, opts?: { range?: Headers }): Promise<{
    body: ReadableStream
    size: number
    httpEtag: string
    range?: { offset?: number; length?: number }
  } | null>
}
interface Env {
  DL_BUCKET: R2Like
  ASSETS: { fetch(request: Request): Promise<Response> }
}

// 资产白名单：把 /dl 收紧为「三个固定资产名」，防止被当成任意文件代理
const ASSET_NAMES = new Set(['nmail-windows-x64.exe', 'nmail-macos-arm64', 'nmail-linux-x64', 'nmail-macos-arm64.app.zip'])
const GITHUB_LATEST = 'https://github.com/pan-nie/Nmail/releases/latest/download/'

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    const name = url.pathname.slice('/dl/'.length)
    if (url.pathname.startsWith('/dl/') && ASSET_NAMES.has(name)) {
      // Range 支持：断点续传/下载管理器必需；R2 原生解析 Range 头，不支持的形态（多段 Range）回退全量
      let obj = await env.DL_BUCKET.get(name, { range: request.headers }).catch(() => null)
      if (!obj) obj = await env.DL_BUCKET.get(name)
      if (obj) {
        const headers = new Headers({
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${name}"`,
          ETag: obj.httpEtag,
          'Accept-Ranges': 'bytes',
        })
        const r = obj.range
        if (request.headers.has('range') && r && (r.offset != null || r.length != null)) {
          const offset = r.offset ?? obj.size - (r.length ?? 0)
          const end = r.length != null ? offset + r.length - 1 : obj.size - 1
          headers.set('Content-Range', `bytes ${offset}-${end}/${obj.size}`)
          headers.set('Content-Length', String(end - offset + 1))
          return new Response(obj.body, { status: 206, headers })
        }
        headers.set('Content-Length', String(obj.size))
        return new Response(obj.body, { status: 200, headers })
      }
      return Response.redirect(GITHUB_LATEST + name, 302)
    }
    return env.ASSETS.fetch(request)
  },
}
