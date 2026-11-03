'use strict'
// OG 分享卡片注入（P2 自 server.js 拆出）
module.exports = function initOG(db) {
function _ogEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function _ogText(s, n) {
  return String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 150)
}
function injectOGTags(html, p, req) {
  try {
    const u = new URL(req.url, 'http://localhost')
    // Nginx 反代时 req.headers.host 是上游 127.0.0.1:3000，需回退公网地址
    let host = (req.headers['x-forwarded-host'] || '').split(',')[0].trim()
    if (!host || /^(127\.|localhost|\[::1\])/i.test(host)) host = 'your-domain.example'
    // 协议感知：nginx 443 传 X-Forwarded-Proto；未传（HTTP 直连/本地）默认 http
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https' ? 'https' : 'http'
    const base = `${proto}://${host}`
    let title = null, desc = null
    let image = `${base}/og-image.jpg`
    const view = u.searchParams.get('view')
    const id = parseInt(u.searchParams.get('id') || '0', 10)
    if (p === '/community.html' && id > 0) {
      if (view === 'blog') {
        const post = db.prepare("SELECT title, summary, content, cover_image FROM blog_posts WHERE id = ? AND status = 'published'").get(id)
        if (post) {
          title = post.title
          desc = _ogText(post.summary || post.content, 120)
          if (post.cover_image) image = /^https?:\/\//i.test(post.cover_image) ? post.cover_image : base + post.cover_image
        }
      } else if (view === 'thread') {
        const th = db.prepare("SELECT title, content FROM forum_threads WHERE id = ? AND status = 'published'").get(id)
        if (th) { title = th.title; desc = _ogText(th.content, 120) }
      }
    }
    if (p === '/material.html' && id > 0) {
      const mat = db.prepare("SELECT title, description, status, thumb_filename FROM materials WHERE id = ?").get(id)
      if (mat && (mat.status === 'published' || mat.status === 'approved')) {
        title = mat.title
        desc = _ogText(mat.description, 120) || mat.title
        if (mat.thumb_filename) image = `${base}/api/thumbs/${encodeURIComponent(mat.thumb_filename)}`
      }
    }
    if (!title) {
      const m = html.match(/<title>([^<]*)<\/title>/i)
      title = m ? m[1].trim() : '校融媒体素材共建平台'
    }
    if (!desc) {
      const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
      desc = m ? m[1] : '校园素材资源库 · 博客 / 论坛 / 校园墙 · 社区共建'
    }
    const tags = [
      '<meta property="og:site_name" content="校融媒体素材共建平台">',
      '<meta property="og:type" content="website">',
      `<meta property="og:title" content="${_ogEsc(title)}">`,
      `<meta property="og:description" content="${_ogEsc(desc)}">`,
      `<meta property="og:image" content="${_ogEsc(image)}">`,
      `<meta property="og:url" content="${_ogEsc(base + p + (u.search || ''))}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<link rel="canonical" href="${_ogEsc(base + p)}">`,
    ].join('\n  ')
    // 清除页面内既有的 og:/twitter:/canonical 标签(部分页面有硬编码旧地址),保证单一来源
    html = html.replace(/<meta\s+(?:property|name)=["'](?:og:[a-z_:]+|twitter:[a-z_]+)["'][^>]*>\s*/gi, '')
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
    return /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, m => m + '\n  ' + tags + '\n')
      : html
  } catch { return html }
}
  return { injectOGTags }
}
