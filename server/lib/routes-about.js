'use strict'
// ═══ 关于我们 · 照片墙在线换图（2026-10-22）═══
// 权限模型：
//   读覆盖映射 = 公开（访客加载页面时应用）
//   上传替换 / 还原 = 仅管理员（路由 auth:'admin' + handler 内二次校验双保险）
// 安全：
//   魔数检测（detectFileType，拒绝改扩展名的非图片）、5MB 上限、
//   服务端生成文件名（不接受客户端文件名，杜绝路径穿越）、旧图自动清理
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const createDispatcher = require('./router')

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_EXT = ['jpg', 'png', 'webp']
const KEY_MAX_LEN = 60

// photo_key 白名单式校验：非空、长度受限、不含路径分隔符与控制字符
function isValidKey(k) {
  return typeof k === 'string' && k.length > 0 && k.length <= KEY_MAX_LEN && !/[/\\\u0000-\u001f]/.test(k)
}
function isAdminUser(user) {
  return !!(user && (user.is_admin || user.role === 'admin'))
}
function removeOwnedFile(imageUrl, uploadDir) {
  // 仅清理本功能自己写入 uploads/gallery/about_* 的文件
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/api/gallery/about_')) return
  try { fs.unlinkSync(path.join(uploadDir, 'gallery', imageUrl.slice('/api/gallery/'.length))) } catch {}
}

function buildRoutes() {
  return [
    // ───── 公开：读取照片覆盖映射 { 标题: 图片URL } ─────
    { method: 'GET', pattern: '/api/about/photos', auth: null, handler: async (ctx, { res }) => {
      const { db, sendJSON } = ctx
      const rows = db.prepare('SELECT photo_key, image FROM about_photo_overrides').all()
      const data = {}
      for (const r of rows) data[r.photo_key] = r.image
      sendJSON(res, 200, { ok: true, data })
    } },

    // ───── 管理员：上传替换某张照片 ─────
    { method: 'POST', pattern: '/api/about/photos/:key', auth: 'admin', handler: async (ctx, { req, res, params, user }) => {
      const { db, sendJSON, readBody, parseMultipartFiles, detectFileType, UPLOAD_DIR } = ctx
      // 双保险：路由层已校验，这里再校验一次身份（防路由配置被改）
      if (!isAdminUser(user)) { sendJSON(res, 403, { ok: false, message: '仅管理员可管理照片' }); return }
      let key = ''
      try { key = decodeURIComponent(String(params.key || '')) } catch { key = '' }
      if (!isValidKey(key)) { sendJSON(res, 400, { ok: false, message: '照片标识不合法' }); return }

      const contentType = req.headers['content-type'] || ''
      if (!contentType.includes('multipart/form-data')) { sendJSON(res, 400, { ok: false, message: '请使用 multipart/form-data 上传' }); return }
      const buf = await readBody(req, MAX_BYTES + 64 * 1024).catch(() => null)
      if (!buf) { sendJSON(res, 413, { ok: false, message: '文件过大（限制 5MB）' }); return }

      const parsed = parseMultipartFiles(buf, contentType)
      const imgFile = parsed.files.find((f) => f.field === 'image') || parsed.files[0]
      if (!imgFile || !imgFile.data || !imgFile.data.length) { sendJSON(res, 400, { ok: false, message: '请选择图片文件' }); return }
      if (imgFile.data.length > MAX_BYTES) { sendJSON(res, 400, { ok: false, message: '图片不能超过 5MB' }); return }

      const detected = detectFileType(imgFile.data) // 魔数检测，不信任扩展名
      if (!ALLOWED_EXT.includes(detected)) { sendJSON(res, 400, { ok: false, message: '仅支持 jpg / png / webp 图片' }); return }

      const dir = path.join(UPLOAD_DIR, 'gallery')
      fs.mkdirSync(dir, { recursive: true })
      const filename = `about_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${detected}`
      fs.writeFileSync(path.join(dir, filename), imgFile.data)
      const url = '/api/gallery/' + filename

      const old = db.prepare('SELECT image FROM about_photo_overrides WHERE photo_key = ?').get(key)
      db.prepare(`INSERT INTO about_photo_overrides (photo_key, image, updated_by, updated_at)
                  VALUES (?,?,?,datetime('now','localtime'))
                  ON CONFLICT(photo_key) DO UPDATE SET
                    image = excluded.image, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
        .run(key, url, (user && user.id) || '')
      if (old) removeOwnedFile(old.image, UPLOAD_DIR)

      sendJSON(res, 200, { ok: true, message: '照片已上线，所有访客可见', data: { key, url } })
    } },

    // ───── 管理员：还原为示例图 ─────
    { method: 'DELETE', pattern: '/api/about/photos/:key', auth: 'admin', handler: async (ctx, { res, params, user }) => {
      const { db, sendJSON, UPLOAD_DIR } = ctx
      if (!isAdminUser(user)) { sendJSON(res, 403, { ok: false, message: '仅管理员可管理照片' }); return }
      let key = ''
      try { key = decodeURIComponent(String(params.key || '')) } catch { key = '' }
      if (!isValidKey(key)) { sendJSON(res, 400, { ok: false, message: '照片标识不合法' }); return }

      const old = db.prepare('SELECT image FROM about_photo_overrides WHERE photo_key = ?').get(key)
      if (!old) { sendJSON(res, 404, { ok: false, message: '该照片当前没有替换图' }); return }
      db.prepare('DELETE FROM about_photo_overrides WHERE photo_key = ?').run(key)
      removeOwnedFile(old.image, UPLOAD_DIR)
      sendJSON(res, 200, { ok: true, message: '已还原为示例图' })
    } },
  ]
}

module.exports = createDispatcher(buildRoutes())
