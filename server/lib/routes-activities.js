'use strict'
// 活动域 + 招新域 API（P2 批五自 server.js 本体拆出：16 条 if 链 → 声明式路由表）
// 迁移原则：handler 体业务逻辑零改动；旧式守卫 requireAuth/requireAdmin/requireStaff
//          收口到路由表闸门——三者语义与路由表默认值逐字一致：
//          requireAuth    → auth:'user'       （401「未登录或登录已过期」默认文案）
//          requireAdmin   → auth:'admin'      （403「需要管理员权限」默认文案）
//          requireStaff(['editor']) → auth:'staff:editor'（403「权限不足（需要：editor）」默认文案）
//          路径参数 p.match()[1] 手工解析改 params.*。
// 存量死代码说明：server.js 原 L2444-2461 存在第二份「活动详情 GET」（registered_count 计入
//          signed + 多 signed_count 字段），被前段 L1587 同 pattern 先命中遮蔽，从未生效；
//          本表按现网行为收录 L1587 版，死版随迁移删除（若需启用签到计数增强版另行小批）。

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const routes = [
  // ───── 活动列表（含报名人数和当前用户报名状态） ─────
  { method: 'GET', pattern: '/api/activities', handler: async (ctx, { req, res }) => {
    const { db, sendJSON, authUser } = ctx
    const rows = db.prepare('SELECT * FROM activities ORDER BY id DESC').all()
    const user = authUser(req)
    const myJoins = user ? db.prepare('SELECT activity_id, status FROM activity_joins WHERE user_id = ?').all(user.id) : []
    const joinMap = {}
    myJoins.forEach(j => { joinMap[j.activity_id] = j.status })
    const enriched = rows.map(a => {
      const count = db.prepare("SELECT COUNT(*) c FROM activity_joins WHERE activity_id = ? AND status = 'registered'").get(a.id).c
      const item = { ...a, registered_count: count, my_status: joinMap[a.id] || null }
      delete item.sign_in_code
      return item
    })
    sendJSON(res, 200, { ok: true, data: enriched })
  } },

  // ───── 活动发布(editor/admin) ─────
  { method: 'POST', pattern: '/api/activities', auth: 'staff:editor', handler: async (ctx, { req, res }) => {
    const { db, sendJSON, readBody, parseMultipartFiles } = ctx
    const raw = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    const content = req.headers['content-type'] || ''
    let title, description, date, status, capacity, location, regDeadline
    if (content.includes('multipart/form-data')) {
      const parts = parseMultipartFiles(raw, content)
      const fields = parts.fields
      title = fields.title ? fields.title.toString('utf8').trim() : ''
      description = fields.description ? fields.description.toString('utf8').trim() : ''
      date = fields.date ? fields.date.toString('utf8').trim() : ''
      status = fields.status ? fields.status.toString('utf8').trim() : ''
      capacity = fields.capacity ? parseInt(fields.capacity.toString('utf8')) || 0 : 0
      location = fields.location ? fields.location.toString('utf8').trim() : ''
      regDeadline = fields.reg_deadline ? fields.reg_deadline.toString('utf8').trim() : ''
    } else {
      let parsed
      try { parsed = JSON.parse(raw.toString('utf8')) } catch { parsed = {} }
      title = (parsed.title || '').trim()
      description = (parsed.description || '').trim()
      date = (parsed.date || '').trim()
      status = (parsed.status || '').trim()
      capacity = parseInt(parsed.capacity) || 0
      location = (parsed.location || '').trim()
      regDeadline = (parsed.reg_deadline || '').trim()
    }
    if (!title || !date) { sendJSON(res, 400, { ok: false, message: '请填写完整活动信息' }); return }
    // date 格式验证: YYYY-MM-DD 或 YYYY/MM/DD
    if (!/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(date) || isNaN(Date.parse(date))) {
      sendJSON(res, 400, { ok: false, message: '日期格式不正确' }); return
    }
    // status 白名单验证（兼容前端 'ended' 映射为后端 'completed'）
    const validStatuses = ['upcoming', 'ongoing', 'completed', 'cancelled', 'ended']
    const statusMap = { ended: 'completed' } // 前端遗留 'ended' → 后端 'completed'
    const actStatus = statusMap[status] || status || 'upcoming'
    if (status && !validStatuses.includes(status)) {
      sendJSON(res, 400, { ok: false, message: '活动状态无效' }); return
    }
    const info = db.prepare('INSERT INTO activities (title,description,date,status,icon,color,capacity,location,reg_deadline) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(title, description || '暂无描述', date, actStatus, '📢', 'linear-gradient(135deg, #667eea, #764ba2)', capacity || 0, location || '', regDeadline || '')
    sendJSON(res, 201, { ok: true, message: '活动已发布', id: info.lastInsertRowid })
  } },

  // ───── 活动编辑(admin, multipart) ─────
  { method: 'PUT', pattern: '/api/activities/:id(\\d+)', auth: 'admin', handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON, readBody, parseMultipartFiles, UPLOAD_DIR } = ctx
    const raw = await readBody(req, 1024 * 1024).catch(() => Buffer.alloc(0))
    const content = req.headers['content-type'] || ''
    const parts = parseMultipartFiles(raw, content)
    const fields = parts.fields
    const aid = Number(params.id)
    const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(aid)
    if (!existing) { sendJSON(res, 404, { ok: false, message: '活动不存在' }); return }
    const title = fields.title ? fields.title.toString('utf8').trim() : existing.title
    const description = fields.description ? fields.description.toString('utf8').trim() : existing.description
    const date = fields.date ? fields.date.toString('utf8').trim() : existing.date
    const status = fields.status ? fields.status.toString('utf8').trim() : existing.status
    if (!title || !date) { sendJSON(res, 400, { ok: false, message: '请填写完整活动信息' }); return }
    if (!/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(date) || isNaN(Date.parse(date))) {
      sendJSON(res, 400, { ok: false, message: '日期格式不正确' }); return
    }
    const validStatuses = ['upcoming', 'ongoing', 'completed', 'cancelled', 'ended']
    const statusMap = { ended: 'completed' } // 前端遗留 'ended' → 后端 'completed'
    const actStatus = statusMap[status] || status || existing.status
    if (status && !validStatuses.includes(status)) {
      sendJSON(res, 400, { ok: false, message: '活动状态无效' }); return
    }
    // 处理海报上传
    let posterName = existing.poster || ''
    const posterFiles = parts.files.filter(f => f.field === 'poster')
    if (posterFiles.length > 0) {
      const posterFile = posterFiles[0]
      if (posterFile.data.length > 4 * 1024 * 1024) { sendJSON(res, 400, { ok: false, message: '海报文件不能超过 4MB' }); return }
      const posterDir = path.join(UPLOAD_DIR, 'posters')
      fs.mkdirSync(posterDir, { recursive: true })
      const ext = path.extname(posterFile.originalName || '.jpg') || '.jpg'
      const detected = detectFileType(posterFile.data)
      if (!['jpg', 'png', 'gif', 'webp'].includes(detected)) { sendJSON(res, 400, { ok: false, message: '海报格式不支持，仅允许 jpg/png/gif/webp' }); return }
      posterName = 'poster_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex') + '.' + detected
      fs.writeFileSync(path.join(posterDir, posterName), posterFile.data)
      // 删除旧海报
      if (existing.poster) { try { fs.unlinkSync(path.join(posterDir, existing.poster)) } catch {} }
    }
    db.prepare('UPDATE activities SET title=?, description=?, date=?, status=?, poster=? WHERE id=?')
      .run(title, description, date, actStatus, posterName, aid)
    sendJSON(res, 200, { ok: true, message: '活动已更新' })
  } },

  // ───── 活动删除(editor/admin) ─────
  { method: 'DELETE', pattern: '/api/activities', auth: 'staff:editor', handler: async (ctx, { req, res }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const aid = Number(parsed.id)
    if (!aid) { sendJSON(res, 400, { ok: false, message: '缺少 id' }); return }
    const info = db.prepare('DELETE FROM activities WHERE id = ?').run(aid)
    if (info.changes === 0) { sendJSON(res, 404, { ok: false, message: '活动不存在' }); return }
    db.prepare('DELETE FROM activity_joins WHERE activity_id = ?').run(aid)
    sendJSON(res, 200, { ok: true, message: '已删除活动' })
  } },

  // ───── 活动报名 ─────
  { method: 'POST', pattern: '/api/activities/join', auth: 'user', handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req, 16 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const aid = Number(parsed.activity_id)
    if (!aid) { sendJSON(res, 400, { ok: false, message: '缺少 activity_id' }); return }
    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(aid)
    if (!activity) { sendJSON(res, 404, { ok: false, message: '活动不存在' }); return }
    if (activity.status === 'completed' || activity.status === 'ended') { sendJSON(res, 400, { ok: false, message: '活动已结束' }); return }
    if (activity.status === 'cancelled') { sendJSON(res, 400, { ok: false, message: '活动已取消' }); return }
    // 报名截止时间检查
    if (activity.reg_deadline) {
      const deadline = new Date(activity.reg_deadline)
      if (!isNaN(deadline.getTime()) && Date.now() > deadline.getTime()) {
        sendJSON(res, 400, { ok: false, message: '报名已截止' }); return
      }
    }
    const existing = db.prepare('SELECT * FROM activity_joins WHERE activity_id=? AND user_id=?').get(aid, user.id)
    if (existing) {
      if (existing.status === 'registered') { sendJSON(res, 200, { ok: true, already: true, message: '已报名过该活动' }); return }
      // 之前取消过，重新报名
      db.prepare("UPDATE activity_joins SET status='registered', registered_at=datetime('now','localtime') WHERE activity_id=? AND user_id=?").run(aid, user.id)
      sendJSON(res, 200, { ok: true, message: '报名成功' }); return
    }
    // 容量检查
    if (activity.capacity > 0) {
      const count = db.prepare("SELECT COUNT(*) c FROM activity_joins WHERE activity_id=? AND status='registered'").get(aid).c
      if (count >= activity.capacity) { sendJSON(res, 400, { ok: false, message: '报名名额已满' }); return }
    }
    db.prepare("INSERT INTO activity_joins (activity_id,user_id,status,registered_at) VALUES (?,?,'registered',datetime('now','localtime'))").run(aid, user.id)
    sendJSON(res, 200, { ok: true, message: '报名成功' })
  } },

  // ───── 取消报名 ─────
  { method: 'POST', pattern: '/api/activities/cancel', auth: 'user', handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req, 16 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const aid = Number(parsed.activity_id)
    if (!aid) { sendJSON(res, 400, { ok: false, message: '缺少 activity_id' }); return }
    const existing = db.prepare('SELECT * FROM activity_joins WHERE activity_id=? AND user_id=?').get(aid, user.id)
    if (!existing) { sendJSON(res, 404, { ok: false, message: '未报名该活动' }); return }
    if (existing.status === 'cancelled') { sendJSON(res, 200, { ok: true, already: true, message: '已取消报名' }); return }
    db.prepare("UPDATE activity_joins SET status='cancelled' WHERE activity_id=? AND user_id=?").run(aid, user.id)
    sendJSON(res, 200, { ok: true, message: '已取消报名' })
  } },

  // ───── 活动详情（含报名人数和当前用户状态；原 L1587 现网生效版） ─────
  { method: 'GET', pattern: '/api/activities/:id(\\d+)', handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON, authUser } = ctx
    const aid = Number(params.id)
    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(aid)
    if (!activity) { sendJSON(res, 404, { ok: false, message: '活动不存在' }); return }
    const count = db.prepare("SELECT COUNT(*) c FROM activity_joins WHERE activity_id=? AND status='registered'").get(aid).c
    const user = authUser(req)
    const myJoin = user ? db.prepare('SELECT status FROM activity_joins WHERE activity_id=? AND user_id=?').get(aid, user.id) : null
    sendJSON(res, 200, { ok: true, data: { ...activity, registered_count: count, my_status: myJoin ? myJoin.status : null } })
  } },

  // ───── 活动报名名单(admin) ─────
  { method: 'GET', pattern: '/api/activities/:id(\\d+)/participants', auth: 'admin', handler: async (ctx, { res, params }) => {
    const { db, sendJSON } = ctx
    const aid = Number(params.id)
    const activity = db.prepare('SELECT id, title FROM activities WHERE id = ?').get(aid)
    if (!activity) { sendJSON(res, 404, { ok: false, message: '活动不存在' }); return }
    const rows = db.prepare(`
      SELECT j.status, j.registered_at, u.id as student_id, u.name, u.college, u.grade
      FROM activity_joins j
      JOIN users u ON j.user_id = u.id
      WHERE j.activity_id = ?
      ORDER BY j.registered_at DESC
    `).all(aid)
    sendJSON(res, 200, { ok: true, activity: activity, data: rows })
  } },

  // ───── 我的报名（含报名状态） ─────
  { method: 'GET', pattern: '/api/me/activities', auth: 'user', handler: async (ctx, { res, user }) => {
    const { db, sendJSON } = ctx
    const rows = db.prepare(
      'SELECT a.*, j.status as join_status, j.registered_at FROM activities a JOIN activity_joins j ON a.id = j.activity_id WHERE j.user_id = ? ORDER BY j.registered_at DESC'
    ).all(user.id)
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 活动签到(登录+已报名+签到码) ─────
  { method: 'POST', pattern: '/api/activities/:id(\\d+)/signin', auth: 'user', handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody } = ctx
    const aid = parseInt(params.id)
    const a = db.prepare('SELECT * FROM activities WHERE id = ?').get(aid)
    if (!a) { sendJSON(res, 404, { ok: false, message: '活动不存在' }); return }
    const body = await readBody(req, 4 * 1024).catch(() => Buffer.alloc(0))
    const { code } = JSON.parse(body.toString() || '{}')
    if (!a.sign_in_code || String(code || '').trim().toUpperCase() !== String(a.sign_in_code).toUpperCase()) { sendJSON(res, 400, { ok: false, message: '签到码不正确' }); return }
    const join = db.prepare('SELECT status FROM activity_joins WHERE activity_id = ? AND user_id = ?').get(aid, user.id)
    if (!join) { sendJSON(res, 400, { ok: false, message: '你还未报名该活动' }); return }
    if (join.status === 'signed') { sendJSON(res, 200, { ok: true, message: '你已签到过，无需重复签到' }); return }
    db.prepare("UPDATE activity_joins SET status = 'signed' WHERE activity_id = ? AND user_id = ?").run(aid, user.id)
    sendJSON(res, 200, { ok: true, message: '签到成功！' })
  } },

  // ───── 活动签到码生成/重置(admin) ─────
  { method: 'POST', pattern: '/api/admin/activities/:id(\\d+)/signcode', auth: 'admin', handler: async (ctx, { res, params }) => {
    const { db, sendJSON } = ctx
    const aid = parseInt(params.id)
    const a = db.prepare('SELECT id FROM activities WHERE id = ?').get(aid)
    if (!a) { sendJSON(res, 404, { ok: false, message: '活动不存在' }); return }
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    db.prepare('UPDATE activities SET sign_in_code = ? WHERE id = ?').run(code, aid)
    sendJSON(res, 200, { ok: true, code, message: '签到码已生成' })
  } },

  // ───── 活动报名名单(admin，管理端版) ─────
  { method: 'GET', pattern: '/api/admin/activities/:id(\\d+)/joins', auth: 'admin', handler: async (ctx, { res, params }) => {
    const { db, sendJSON } = ctx
    const aid = parseInt(params.id)
    const rows = db.prepare("SELECT j.user_id, u.name AS user_name, j.status, j.registered_at AS created_at FROM activity_joins j LEFT JOIN users u ON u.id = j.user_id WHERE j.activity_id = ? ORDER BY j.registered_at DESC, u.id").all(aid)
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 招新申请（公开，可匿名投递） ─────
  { method: 'POST', pattern: '/api/recruit', handler: async (ctx, { req, res }) => {
    const { db, sendJSON, readBody, parseMultipart, validateUploadedFile, sanitizeOriginalName, UPLOAD_DIR } = ctx
    const body = await readBody(req, 64 * 1024).catch((e) => {
      sendJSON(res, 413, { ok: false, message: '文件过大' })
      return null
    })
    if (!body) return
    const contentType = req.headers['content-type'] || ''
    let fields, file
    if (contentType.includes('multipart/form-data')) {
      const parsed = parseMultipart(body, contentType)
      fields = parsed.fields
      file = parsed.file
    } else {
      try { fields = JSON.parse(body.toString('utf8')) } catch { fields = {} }
    }
    const name = (fields.name || '').trim()
    const sid = (fields.sid || '').trim()
    const email = (fields.email || '').trim()
    if (!name || !sid || !email) { sendJSON(res, 400, { ok: false, message: '请填写姓名、学号和邮箱' }); return }
    let resumeName = '', resumeFile = null
    if (file) {
      // 文件类型校验
      const resumeChk = validateUploadedFile(file, 'resume')
      if (!resumeChk.ok) { sendJSON(res, 400, { ok: false, message: '简历: ' + resumeChk.message }); return }
      resumeName = sanitizeOriginalName(file.originalName)
      resumeFile = `resume_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${resumeChk.detected}`
      fs.writeFileSync(path.join(UPLOAD_DIR, resumeFile), file.data)
    }
    const info = db.prepare('INSERT INTO recruits (name,sid,grade,college,email,resume_name,resume_file) VALUES (?,?,?,?,?,?,?)')
      .run(name, sid, fields.grade || '', fields.college || '', email, resumeName, resumeFile)
    sendJSON(res, 201, { ok: true, message: '申请已提交', id: info.lastInsertRowid })
  } },

  // ───── 招新列表(admin) ─────
  { method: 'GET', pattern: '/api/recruits', auth: 'admin', handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    const rows = db.prepare('SELECT * FROM recruits ORDER BY id DESC').all()
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 简历下载(admin) ─────
  { method: 'GET', pattern: '/api/recruits/:id(\\d+)/resume', auth: 'admin', handler: async (ctx, { res, params }) => {
    const { db, sendJSON, UPLOAD_DIR } = ctx
    const r = db.prepare('SELECT * FROM recruits WHERE id = ?').get(Number(params.id))
    if (!r) { sendJSON(res, 404, { ok: false, message: '记录不存在' }); return }
    if (!r.resume_file || !r.resume_name) { sendJSON(res, 404, { ok: false, message: '未上传简历' }); return }
    const fp = path.join(UPLOAD_DIR, r.resume_file)
    if (!fs.existsSync(fp)) { sendJSON(res, 404, { ok: false, message: '简历文件已丢失' }); return }
    const ext = path.extname(r.resume_name) || '.pdf'
    const mimeMap = { '.pdf': 'application/pdf', '.zip': 'application/zip', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    res.writeHead(200, {
      'Content-Type': mimeMap[ext] || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(r.resume_name)}`,
      'Cache-Control': 'no-cache'
    })
    fs.createReadStream(fp).pipe(res)
  } },

  // ───── 删除招新记录(admin) ─────
  { method: 'DELETE', pattern: '/api/recruits/:id(\\d+)', auth: 'admin', handler: async (ctx, { res, params }) => {
    const { db, sendJSON, UPLOAD_DIR } = ctx
    const r = db.prepare('SELECT * FROM recruits WHERE id = ?').get(Number(params.id))
    if (!r) { sendJSON(res, 404, { ok: false, message: '记录不存在' }); return }
    // 清理简历文件
    if (r.resume_file) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, r.resume_file)) } catch {}
    }
    db.prepare('DELETE FROM recruits WHERE id = ?').run(Number(params.id))
    sendJSON(res, 200, { ok: true, message: '记录已删除' })
  } },
]

const dispatch = require('./router')(routes)

module.exports = async function routesActivities(ctx, req, res, p, method, url) {
  return dispatch(ctx, req, res, p, method, url)
}
