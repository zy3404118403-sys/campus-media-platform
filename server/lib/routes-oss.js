'use strict'
// ═══ OSS 直传与访问签名（2026-10-23）═══
// 目的：把 4K 大文件的存储与流量从服务器挪到 OSS。
//   ① GET  /api/oss/policy        登录用户取「直传凭证」，浏览器直接 POST 到 OSS（服务器不经手文件）
//   ② GET  /api/materials/:id/oss-url   取播放/下载的临时签名 URL（私有 Bucket 必须签名）
//   ③ POST /api/oss/commit        直传成功后回调登记 oss_key（前端只给 key，不让它伪造别的东西）
const createDispatcher = require('./router')
const { randomBytes } = require('crypto')

function ossKeyById(id, ext) {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `materials/${d.getFullYear()}${p(d.getMonth() + 1)}/${id}_${randomBytes(6).toString('hex')}${ext || ''}`
}

function buildRoutes(oss) {
  return [
    // ───── 直传凭证（按角色限额，与服务器流式上传保持一致）─────
    { method: 'GET', pattern: '/api/oss/policy', auth: 'user', handler: async (ctx, { res, user, url }) => {
      const { sendJSON } = ctx
      if (!oss.configured()) { sendJSON(res, 503, { ok: false, message: 'OSS 未配置' }); return }
      const LIMITS = { admin: 2048, editor: 1024, reviewer: 1024, reporter: 500, student: 200 }
      const role = user.is_admin ? 'admin' : (user.role || 'student')
      const limitMB = LIMITS[role] || 200
      const now = new Date()
      const fname = `materials/${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}/`
      const pol = oss.postPolicy({ prefix: fname, maxSize: limitMB * 1024 * 1024, expireSec: 3600 })
      sendJSON(res, 200, { ok: true, data: Object.assign({ limitMB, maxSizeMB: limitMB }, pol) })
    } },

    // ───── 播放/下载签名 URL ─────
    { method: 'GET', pattern: '/api/materials/:id(\\d+)/oss-url', auth: 'user', handler: async (ctx, { res, params, user, url }) => {
      const { db, sendJSON } = ctx
      if (!oss.configured()) { sendJSON(res, 503, { ok: false, message: 'OSS 未配置' }); return }
      const m = db.prepare('SELECT id,title,oss_key,status,author_id,original_name,filename FROM materials WHERE id = ?').get(Number(params.id))
      if (!m || !m.oss_key) { sendJSON(res, 404, { ok: false, message: '该素材没有存于 OSS 的文件' }); return }
      const isOwner = user && (user.is_admin || user.id === m.author_id)
      if (m.status !== 'published' && m.status !== 'approved' && !isOwner) { sendJSON(res, 404, { ok: false, message: '素材未公开' }); return }
      const isDownload = url.searchParams.get('dl') === '1'
      const signed = oss.signedUrl(m.oss_key, {
        expireSec: isDownload ? 900 : 3600,
        filename: isDownload ? (m.original_name || m.title || 'download') : '',
      })
      if (isDownload) { try { db.prepare('UPDATE materials SET downloads = downloads + 1 WHERE id = ?').run(m.id) } catch (e) {} }
      sendJSON(res, 200, { ok: true, data: { url: signed, expiresIn: isDownload ? 900 : 3600 } })
    } },

    // ───── 直传完成回调登记 ─────
    { method: 'POST', pattern: '/api/oss/commit', auth: 'user', handler: async (ctx, { req, res, user }) => {
      const { db, sendJSON, readBody } = ctx
      const body = await readBody(req, 32 * 1024).catch(() => Buffer.alloc(0))
      let p = {}
      try { p = JSON.parse(body.toString('utf8') || '{}') } catch (e) { p = {} }
      const ossKey = String(p.ossKey || '').trim()
      const title = String(p.title || '').trim().slice(0, 100)
      const type = String(p.type || '其他')
      const college = String(p.college || '')
      const description = String(p.description || '').trim().slice(0, 2000)
      const shotDate = String(p.shot_date || '')
      const tags = String(p.tags || '').split(/[,，\s]+/).filter(Boolean).slice(0, 6).join(',')
      const statusQ = String(p.status || 'pending_review')
      const originalName = String(p.name || '').slice(0, 200)
      const size = Math.max(0, Number(p.size) || 0)
      const mime = String(p.mime || '')

      if (!ossKey || ossKey.indexOf('materials/') !== 0) { sendJSON(res, 400, { ok: false, message: 'OSS 路径不合法' }); return }
      if (!title) { sendJSON(res, 400, { ok: false, message: '请填写素材标题' }); return }
      if (ossKey.indexOf('..') !== -1) { sendJSON(res, 400, { ok: false, message: 'OSS 路径不合法' }); return }

      const finalStatus = statusQ === 'draft' ? 'draft' : (['pending_review', 'approved', 'published'].includes(statusQ) ? statusQ : 'pending_review')
      let info
      try {
        info = db.prepare(
          'INSERT INTO materials (title,type,college,author,author_id,description,shot_date,tags,sub_type,status,filename,original_name,file_size,mime,width,height,duration,thumb_filename,drive_url,oss_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        ).run(title, type, college, user.name, user.id, description, shotDate, tags, '', finalStatus, null, originalName, size, mime, 0, 0, 0, null, '', ossKey)
        db.prepare('INSERT INTO material_status_logs (material_id,to_status,action,operator_id,operator_name,reason) VALUES (?,?,?,?,?,?)')
          .run(info.lastInsertRowid, finalStatus, 'upload', user.id, user.name, 'OSS 直传 ' + Math.round(size / 1048576) + 'MB')
      } catch (e) {
        sendJSON(res, 500, { ok: false, message: '登记失败：' + e.message }); return
      }
      sendJSON(res, 201, { ok: true, message: '上传成功（' + Math.round(size / 1048576) + 'MB）', data: { id: Number(info.lastInsertRowid), ossKey, size } })
    } },
    // ═══ 分片上传（10GB 长视频场景，2026-10-23）═══
    // ① 初始化：拿 uploadId（前端据此切片）
    { method: 'POST', pattern: '/api/oss/multipart/init', auth: 'user', handler: async (ctx, { req, res, user }) => {
      const { sendJSON, readBody } = ctx
      if (!oss.configured()) { sendJSON(res, 503, { ok: false, message: 'OSS 未配置' }); return }
      const body = await readBody(req, 32 * 1024).catch(() => Buffer.alloc(0))
      let p = {}
      try { p = JSON.parse(body.toString('utf8') || '{}') } catch (e) { p = {} }
      const size = Math.max(0, Number(p.size) || 0)
      const name = String(p.name || '').slice(0, 200)
      const mime = String(p.mime || 'application/octet-stream')

      // 角色限额（GB）
      const LIMITS_GB = { admin: 20, editor: 10, reviewer: 10, reporter: 5, student: 1 }
      const role = user.is_admin ? 'admin' : (user.role || 'student')
      const limitGB = LIMITS_GB[role] || 1
      if (size <= 0) { sendJSON(res, 400, { ok: false, message: '缺少文件大小' }); return }
      if (size > limitGB * 1024 * 1024 * 1024) {
        sendJSON(res, 413, { ok: false, message: '文件超过你的上限（' + limitGB + 'GB）', limitGB })
        return
      }

      // 分片策略：10MB/片；10GB=1000 片（OSS 上限 10000 片）
      const PART_SIZE = 10 * 1024 * 1024
      const total = Math.max(1, Math.ceil(size / PART_SIZE))
      if (total > 10000) { sendJSON(res, 400, { ok: false, message: '分片数超限（>10000），请拆分文件' }); return }

      const now = new Date()
      const folder = `materials/${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}/`
      const ext = (name.match(/\.[A-Za-z0-9]{2,5}$/) || [''])[0].toLowerCase()
      const key = folder + Date.now() + '_' + randomBytes(8).toString('hex') + ext

      const init = await oss.initiateMultipart(key, mime)
      if (!init.ok) { sendJSON(res, 502, { ok: false, message: 'OSS 初始化失败：' + (init.raw || init.status) }); return }
      sendJSON(res, 200, {
        ok: true,
        data: { key, uploadId: init.uploadId, partSize: PART_SIZE, totalParts: total, size, limitGB },
      })
    } },

    // ② 取某个分片的直传签名 URL
    { method: 'GET', pattern: '/api/oss/multipart/part-url', auth: 'user', handler: async (ctx, { res, url }) => {
      const { sendJSON } = ctx
      const key = String(url.searchParams.get('key') || '')
      const uploadId = String(url.searchParams.get('uploadId') || '')
      const partNumber = Number(url.searchParams.get('partNumber') || 0)
      if (!key || key.indexOf('materials/') !== 0 || !uploadId || partNumber < 1 || partNumber > 10000) {
        sendJSON(res, 400, { ok: false, message: '参数不合法' }); return
      }
      const signed = oss.signedPartUrl(key, uploadId, partNumber, 3600)
      sendJSON(res, 200, { ok: true, data: { url: signed, partNumber, expiresIn: 3600 } })
    } },

    // ③ 查询已上传分片（断点续传）
    { method: 'GET', pattern: '/api/oss/multipart/parts', auth: 'user', handler: async (ctx, { res, url }) => {
      const { sendJSON } = ctx
      const key = String(url.searchParams.get('key') || '')
      const uploadId = String(url.searchParams.get('uploadId') || '')
      if (!key || !uploadId) { sendJSON(res, 400, { ok: false, message: '参数不合法' }); return }
      const r = await oss.listParts(key, uploadId)
      sendJSON(res, r.ok ? 200 : 502, { ok: r.ok, data: { parts: r.parts }, message: r.ok ? '' : '查询失败' })
    } },

    // ④ 合并分片 + 登记入库
    { method: 'POST', pattern: '/api/oss/multipart/complete', auth: 'user', handler: async (ctx, { req, res, user }) => {
      const { db, sendJSON, readBody } = ctx
      const body = await readBody(req, 512 * 1024).catch(() => Buffer.alloc(0))
      let p = {}
      try { p = JSON.parse(body.toString('utf8') || '{}') } catch (e) { p = {} }
      const key = String(p.key || '')
      const uploadId = String(p.uploadId || '')
      const parts = Array.isArray(p.parts) ? p.parts : []
      const size = Math.max(0, Number(p.size) || 0)
      if (!key || key.indexOf('materials/') !== 0 || !uploadId || !parts.length) { sendJSON(res, 400, { ok: false, message: '参数不合法' }); return }

      const cmp = await oss.completeMultipart(key, uploadId, parts)
      if (!cmp.ok) { sendJSON(res, 502, { ok: false, message: 'OSS 合并失败：' + (cmp.raw || cmp.status) }); return }

      // 入库（与 commit 一致）
      const title = String(p.title || '').trim().slice(0, 100) || '未命名素材'
      const type = String(p.type || '视频')
      const college = String(p.college || '')
      const description = String(p.description || '').trim().slice(0, 2000)
      const shotDate = String(p.shot_date || '')
      const tags = String(p.tags || '').split(/[,，\s]+/).filter(Boolean).slice(0, 6).join(',')
      const statusQ = String(p.status || 'pending_review')
      const originalName = String(p.name || '').slice(0, 200)
      const mime = String(p.mime || '')
      const finalStatus = statusQ === 'draft' ? 'draft' : (['pending_review', 'approved', 'published'].includes(statusQ) ? statusQ : 'pending_review')
      let info
      try {
        info = db.prepare(
          'INSERT INTO materials (title,type,college,author,author_id,description,shot_date,tags,sub_type,status,filename,original_name,file_size,mime,width,height,duration,thumb_filename,drive_url,oss_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        ).run(title, type, college, user.name, user.id, description, shotDate, tags, '', finalStatus, null, originalName, size, mime, 0, 0, 0, null, '', key)
        db.prepare('INSERT INTO material_status_logs (material_id,to_status,action,operator_id,operator_name,reason) VALUES (?,?,?,?,?,?)')
          .run(info.lastInsertRowid, finalStatus, 'upload', user.id, user.name, 'OSS 分片直传 ' + parts.length + ' 片 / ' + Math.round(size / 1048576) + 'MB')
      } catch (e) {
        sendJSON(res, 500, { ok: false, message: '登记失败：' + e.message }); return
      }
      sendJSON(res, 201, { ok: true, message: '上传成功（' + (size / 1073741824).toFixed(2) + 'GB）', data: { id: Number(info.lastInsertRowid), ossKey: key, size } })
    } },

    // ⑤ 取消分片任务
    { method: 'POST', pattern: '/api/oss/multipart/abort', auth: 'user', handler: async (ctx, { req, res }) => {
      const { sendJSON, readBody } = ctx
      const body = await readBody(req, 16 * 1024).catch(() => Buffer.alloc(0))
      let p = {}
      try { p = JSON.parse(body.toString('utf8') || '{}') } catch (e) { p = {} }
      const key = String(p.key || '')
      const uploadId = String(p.uploadId || '')
      if (!key || !uploadId) { sendJSON(res, 400, { ok: false, message: '参数不合法' }); return }
      const r = await oss.abortMultipart(key, uploadId)
      sendJSON(res, r.ok ? 200 : 502, { ok: r.ok, message: r.ok ? '已取消' : '取消失败' })
    } },

  ]
}

module.exports = function (oss) { return createDispatcher(buildRoutes(oss)) }
