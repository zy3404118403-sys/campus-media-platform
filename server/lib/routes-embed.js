'use strict'
// P3c 阶段三：嵌入 Widget（/embed/material/:id）——供校园其他网站 iframe 引用已发布素材卡片
// 安全面：仅暴露 published 素材；输出经 escapeHtml 转义（标题/作者/日期全转义）；
//         响应刻意不含 X-Frame-Options（允许跨站嵌入，Widget 无敏感操作无登录态，点击劫持风险可忽略）；
//         不设 Cookie（匿名只读），nosniff，缓存 5 分钟。
// 无依赖：内联 CSS 深浅色自适应（prefers-color-scheme），320px 起自适应宽度。

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const TYPE_LABEL = { 图片: '图片', 视频: '视频', 文档: '文档', 音频: '音频' }

function cardHtml(m, baseUrl) {
  const thumb = m.thumb_filename ? baseUrl + '/uploads/thumbs/' + encodeURIComponent(m.thumb_filename) : ''
  const typeLabel = TYPE_LABEL[m.type] || m.type
  const detail = baseUrl + '/material.html?id=' + m.id
  const media = thumb
    ? '<img src="' + escapeHtml(thumb) + '" alt="' + escapeHtml(m.title) + '" loading="lazy">'
    : '<div class="ph">' + escapeHtml(typeLabel) + '</div>'
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>${escapeHtml(m.title)}</title>
<style>
:root{--bg:#ffffff;--ink:#1a2333;--sub:#5b6b85;--line:#e3e8f2;--accent:#3459e6}
@media (prefers-color-scheme: dark){:root{--bg:#151a23;--ink:#e8edf4;--sub:#8a93a5;--line:rgba(255,255,255,.1)}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Segoe UI","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--ink);padding:0}
.card{display:flex;gap:10px;padding:12px;border:1px solid var(--line);border-radius:10px;max-width:420px}
.thumb{width:96px;height:72px;flex:none;border-radius:8px;overflow:hidden;background:rgba(127,150,255,.12);display:flex;align-items:center;justify-content:center}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ph{font-size:13px;color:var(--sub);font-weight:600}
.body{min-width:0;display:flex;flex-direction:column;gap:4px}
.badge{align-self:flex-start;font-size:10.5px;font-weight:600;color:var(--accent);background:rgba(52,89,230,.12);padding:1px 7px;border-radius:9px}
.title{font-size:13.5px;font-weight:600;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.meta{font-size:11px;color:var(--sub)}
.actions{margin-top:auto}
.actions a{display:inline-block;font-size:11.5px;color:var(--accent);text-decoration:none;border:1px solid var(--accent);border-radius:6px;padding:2px 10px}
</style>
</head>
<body>
<div class="card">
  <div class="thumb">${media}</div>
  <div class="body">
    <span class="badge">${escapeHtml(typeLabel)}</span>
    <div class="title">${escapeHtml(m.title)}</div>
    <div class="meta">${escapeHtml(m.author || '佚名')} · ${escapeHtml((m.created_at || '').slice(0, 10))} · 下载 ${Number(m.downloads) || 0}</div>
    <div class="actions"><a href="${escapeHtml(detail)}" target="_blank" rel="noopener">查看详情</a></div>
  </div>
</div>
</body>
</html>`
}

const ROUTES = [
  { method: 'GET', pattern: '/embed/material/:id(\\d+)', handler: async (ctx, { res, params, url }) => {
    const { db } = ctx
    const id = parseInt(params.id, 10)
    const m = db.prepare("SELECT id, title, type, author, created_at, downloads, thumb_filename FROM materials WHERE id = ? AND status = 'published'").get(id)
    if (!m) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' })
      res.end('<!DOCTYPE html><html lang="zh-CN"><body style="font-family:sans-serif;color:#888;display:flex;align-items:center;justify-content:center;min-height:120px"><div>素材不存在或未发布</div></body></html>')
      return
    }
    // baseUrl：嵌入页可能任意域，详情链接必须回平台绝对地址——用 X-Forwarded-Host/Proto（nginx 反代）回退请求头 host
    let host = (url.searchParams.get('_h') || '').trim()
    if (!host || /[<>"'\\s]/.test(host)) host = 'your-domain.example'
    const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
    const html = cardHtml(m, proto + '://' + host)
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      // 刻意不含 X-Frame-Options / frame-ancestors：本路径供第三方 iframe 嵌入（只读卡片，无敏感操作）
    })
    res.end(html)
  } },
]

const dispatch = require('./router')(ROUTES)

module.exports = async function routesEmbed(ctx, req, res, p, method, url) {
  return dispatch(ctx, req, res, p, method, url)
}
