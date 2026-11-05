'use strict'
// ═══ P2 阶段二 · F-1 免登录公开分享链接 ═══
// 声明式路由表第一个住户（走 lib/router.js 分发）
// 权限模型：
//   创建/撤销 = 素材 owner 或管理员；访问 = 仅凭 token（免登录）
//   素材 status 必须 approved/published 才可创建；素材事后下架(状态变更)分享自动失效
// 隐私：公开面不返回 author_id 学号，仅展示作者署名
const { randomBytes } = require('crypto')
const createDispatcher = require('./router')

const SHAREABLE = ['approved', 'published']
const TYPE_LABELS = { photo: '照片', video: '视频', audio: '音频', design: '设计', doc: '文档', other: '其他' }

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function nowLocal() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
function fmtSize(n) {
  if (!n) return ''
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB'
  return (n / 1073741824).toFixed(2) + ' GB'
}
function isToken(s) { return /^[a-f0-9]{64}$/i.test(String(s || '')) }

// 联表取分享 + 有效性判定（撤销/过期/素材下架均判无效）
function getValidShare(db, token) {
  if (!isToken(token)) return null
  const sh = db.prepare(`
    SELECT s.*, m.title, m.type, m.description, m.author, m.status AS mat_status,
           m.filename, m.original_name, m.file_size, m.mime, m.thumb_filename,
           m.created_at AS mat_created_at
    FROM material_shares s JOIN materials m ON m.id = s.material_id
    WHERE s.token = ?
  `).get(token)
  if (!sh || sh.revoked) return null
  if (sh.expires_at && sh.expires_at < nowLocal()) return null
  if (!SHAREABLE.includes(sh.mat_status)) return null
  return sh
}

function shareHtml(sh, opts) {
  const { err } = opts || {}
  const t = TYPE_LABELS[sh.type] || sh.type || '素材'
  const previewUrl = `/api/share/${sh.token}/preview`
  const fileUrl = `/api/share/${sh.token}/file`
  const ogDesc = (sh.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || `${t}分享 · 校园融媒工坊`
  const isImg = /^image\//.test(sh.mime || '') || sh.type === 'photo'
  const head =
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta property="og:site_name" content="校园融媒工坊">'
    + '<meta property="og:type" content="article">'
    + `<meta property="og:title" content="${esc(sh.title)}">`
    + `<meta property="og:description" content="${esc(ogDesc)}">`
    + `<meta property="og:image" content="${esc(previewUrl)}">`
    + `<meta property="og:url" content="${esc('/s/' + sh.token)}">`
    + '<meta name="twitter:card" content="summary_large_image">'

  if (err) {
    return '<!DOCTYPE html><html lang="zh"><head>' + head + `<title>链接已失效 · 校园融媒工坊</title></head>`
      + '<body><div class="card err"><div class="big">🔗</div><h1>链接已失效</h1>'
      + `<p>${esc(err)}</p><p class="foot">校园融媒工坊</p></div></body></html>`
  }

  let mediaHtml
  if (sh.thumb_filename || isImg) {
    mediaHtml = `<img class="media" src="${esc(previewUrl)}" alt="${esc(sh.title)}" loading="eager">`
  } else {
    mediaHtml = `<div class="media file-ph"><div class="ficon">📁</div><div class="fname">${esc(sh.original_name || sh.title)}</div></div>`
  }

  return '<!DOCTYPE html><html lang="zh"><head>' + head + `<title>${esc(sh.title)} · 校园融媒工坊</title><style>`
    + '*{margin:0;padding:0;box-sizing:border-box}'
    + 'body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(160deg,#eef2ff 0%,#f8fafc 55%,#ecfdf5 100%)}'
    + '@media (prefers-color-scheme:dark){body{background:linear-gradient(160deg,#0f172a 0%,#111827 55%,#052e1f 100%)}}'
    + '.card{width:min(460px,94vw);background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,.12)}'
    + '@media (prefers-color-scheme:dark){.card{background:#1e293b;box-shadow:0 12px 40px rgba(0,0,0,.5)}}'
    + '.media{width:100%;max-height:300px;object-fit:cover;display:block;background:#f1f5f9}'
    + '.media.file-ph{max-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:32px 16px}'
    + '.ficon{font-size:40px}.fname{font-size:13px;color:#64748b;word-break:break-all;text-align:center;max-width:90%}'
    + '.body{padding:20px 22px 22px}'
    + '.badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:1px;color:#4f46e5;background:rgba(79,70,229,.1);border:1px solid rgba(79,70,229,.25);padding:3px 10px;border-radius:99px;margin-bottom:10px}'
    + 'h1{font-size:19px;line-height:1.4;color:#0f172a;margin-bottom:8px}'
    + '@media (prefers-color-scheme:dark){h1{color:#f1f5f9}}'
    + '.desc{font-size:13.5px;line-height:1.65;color:#64748b;margin-bottom:14px;word-break:break-word}'
    + '@media (prefers-color-scheme:dark){.desc{color:#94a3b8}}'
    + '.meta{font-size:12px;color:#94a3b8;margin-bottom:18px;display:flex;gap:14px;flex-wrap:wrap}'
    + '.dl{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px 0;border:0;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:15px;font-weight:700;text-decoration:none;cursor:pointer}'
    + '.dl:active{transform:scale(.98)}'
    + '.dl.no{background:#e2e8f0;color:#94a3b8;pointer-events:none}'
    + '@media (prefers-color-scheme:dark){.dl.no{background:#334155;color:#64748b}}'
    + '.foot{margin-top:16px;text-align:center;font-size:11px;color:#cbd5e1}'
    + '</style></head><body><div class="card">'
    + mediaHtml
    + '<div class="body">'
    + `<span class="badge">${esc(t)}</span>`
    + `<h1>${esc(sh.title)}</h1>`
    + (sh.description ? `<div class="desc">${esc(sh.description)}</div>` : '')
    + `<div class="meta"><span>by ${esc(sh.author || '校园用户')}</span><span>${esc(String(sh.mat_created_at || '').slice(0, 10))}</span>${sh.file_size ? `<span>${esc(fmtSize(sh.file_size))}</span>` : ''}</div>`
    + (sh.filename
      ? `<a class="dl" href="${esc(fileUrl)}" download>⬇ 下载素材</a>`
      : '<span class="dl no">该素材暂无文件</span>')
    + '<div class="foot">校园融媒工坊 · 免登录分享</div>'
    + '</div></div></body></html>'
}

function buildRoutes() {
  return [
    // ── 创建分享（owner/admin；同一人同一素材复用有效链接，防 token 扩散）──
    { method: 'POST', pattern: '/api/materials/:id/share', auth: 'user', handler: async (ctx, a) => {
      const { db, sendJSON } = ctx
      const id = Number(a.params.id)
      const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(id)
      if (!m) return sendJSON(a.res, 404, { ok: false, message: '素材不存在' })
      const isAdmin = a.user.is_admin || a.user.role === 'admin'
      const isOwner = m.author_id && m.author_id === a.user.id
      if (!isAdmin && !isOwner) return sendJSON(a.res, 403, { ok: false, message: '仅素材所有者或管理员可分享' })
      if (!SHAREABLE.includes(m.status)) return sendJSON(a.res, 400, { ok: false, message: '该素材当前状态不可分享（需已过审或已发布）' })
      const existing = db.prepare(
        "SELECT token FROM material_shares WHERE material_id = ? AND created_by = ? AND revoked = 0 AND (expires_at = '' OR expires_at IS NULL OR expires_at > ?)"
      ).get(id, a.user.id, nowLocal())
      if (existing) return sendJSON(a.res, 200, { ok: true, data: { token: existing.token, url: '/s/' + existing.token, reused: true } })
      const token = randomBytes(32).toString('hex')
      db.prepare('INSERT INTO material_shares (token, material_id, created_by, created_by_name) VALUES (?,?,?,?)')
        .run(token, id, a.user.id, a.user.name || '')
      sendJSON(a.res, 201, { ok: true, data: { token, url: '/s/' + token, reused: false } })
    } },

    // ── 分享信息（公开 JSON，供扩展/调试）──
    { method: 'GET', pattern: '/api/share/:token', auth: null, handler: async (ctx, a) => {
      const { db, sendJSON } = ctx
      const sh = getValidShare(db, a.params.token)
      if (!sh) return sendJSON(a.res, 404, { ok: false, message: '分享链接不存在或已失效' })
      // 隐私：不返回 author_id / created_by 等内部字段
      sendJSON(a.res, 200, { ok: true, data: {
        title: sh.title, type: sh.type, description: sh.description, author: sh.author || '校园用户',
        file_size: sh.file_size || 0, has_file: !!sh.filename,
        thumb: (sh.thumb_filename || /^image\//.test(sh.mime || '')) ? `/api/share/${sh.token}/preview` : null,
        mat_created_at: sh.mat_created_at,
      } })
    } },

    // ── 内联预览（og:image 与分享页共用；优先缩略图，图片类素材回退原文件）──
    { method: 'GET', pattern: '/api/share/:token/preview', auth: null, handler: async (ctx, a) => {
      const { db, sendJSON, THUMB_DIR, UPLOAD_DIR } = ctx
      const sh = getValidShare(db, a.params.token)
      if (!sh) return sendJSON(a.res, 404, { ok: false, message: '分享链接不存在或已失效' })
      const IMG_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' }
      let fp = null, mime = 'image/jpeg'
      if (sh.thumb_filename) {
        const tp = require('path').join(THUMB_DIR, sh.thumb_filename)
        if (require('fs').existsSync(tp)) { fp = tp; mime = IMG_MIME[require('path').extname(tp).toLowerCase()] || 'image/jpeg' }
      }
      if (!fp && (/^image\//.test(sh.mime || '') || sh.type === 'photo') && sh.filename) {
        const op = require('path').join(UPLOAD_DIR, sh.filename)
        if (require('fs').existsSync(op)) { fp = op; mime = sh.mime || 'image/jpeg' }
      }
      if (!fp) return sendJSON(a.res, 404, { ok: false, message: 'no preview' })
      a.res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' })
      require('fs').createReadStream(fp).pipe(a.res)
    } },

    // ── 文件下载（token 门控；主站下载数与分享下载数各计一份）──
    { method: 'GET', pattern: '/api/share/:token/file', auth: null, handler: async (ctx, a) => {
      const { db, sendJSON, UPLOAD_DIR, getClientIP } = ctx
      const sh = getValidShare(db, a.params.token)
      if (!sh) return sendJSON(a.res, 404, { ok: false, message: '分享链接不存在或已失效' })
      if (!sh.filename) return sendJSON(a.res, 404, { ok: false, message: '该素材没有关联文件' })
      const fp = require('path').join(UPLOAD_DIR, sh.filename)
      if (!require('fs').existsSync(fp)) return sendJSON(a.res, 404, { ok: false, message: '文件已丢失' })
      db.prepare('UPDATE materials SET downloads = downloads + 1 WHERE id = ?').run(sh.material_id)
      db.prepare('UPDATE material_shares SET download_count = download_count + 1 WHERE token = ?').run(sh.token)
      try { db.prepare('INSERT INTO download_logs (material_id, ip, user_id) VALUES (?,?,NULL)').run(sh.material_id, getClientIP ? getClientIP(a.req) : '') } catch {}
      const dlName = encodeURIComponent(sh.original_name || sh.title)
      a.res.writeHead(200, {
        'Content-Type': sh.mime || 'application/octet-stream',
        'Content-Length': require('fs').statSync(fp).size,
        'Content-Disposition': `attachment; filename*=UTF-8''${dlName}`,
      })
      require('fs').createReadStream(fp).pipe(a.res)
    } },

    // ── 撤销分享（创建者或管理员）──
    { method: 'POST', pattern: '/api/shares/:token/revoke', auth: 'user', handler: async (ctx, a) => {
      const { db, sendJSON } = ctx
      const sh = db.prepare('SELECT * FROM material_shares WHERE token = ?').get(a.params.token)
      if (!sh) return sendJSON(a.res, 404, { ok: false, message: '分享链接不存在' })
      const isAdmin = a.user.is_admin || a.user.role === 'admin'
      if (!isAdmin && sh.created_by !== a.user.id) return sendJSON(a.res, 403, { ok: false, message: '仅创建者或管理员可撤销' })
      db.prepare('UPDATE material_shares SET revoked = 1 WHERE token = ?').run(sh.token)
      sendJSON(a.res, 200, { ok: true, message: '分享链接已撤销' })
    } },

    // ── 免登录分享页（服务端渲染，含 OG 标签供微信/QQ 抓取）──
    { method: 'GET', pattern: '/s/:token', auth: null, handler: async (ctx, a) => {
      const { db } = ctx
      const sh = getValidShare(db, a.params.token)
      if (sh) {
        db.prepare('UPDATE material_shares SET view_count = view_count + 1 WHERE token = ?').run(sh.token)
        a.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
        a.res.end(shareHtml(sh))
      } else {
        a.res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
        a.res.end(shareHtml({ token: a.params.token || '' }, { err: '链接可能已过期、被撤销，或素材已下架' }))
      }
    } },
  ]
}

module.exports = createDispatcher(buildRoutes())
