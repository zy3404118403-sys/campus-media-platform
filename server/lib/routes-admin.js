'use strict'
// 画廊 CMS + 用户管理/通知/统计/日志/导出 API（P2 批七自 server.js 本体拆出：20 条 → 声明式路由表）
// 迁移原则：handler 体业务逻辑零改动；旧守卫 requireAuth/requireAdmin/requireStaff 收口到路由表闸门
//          （与路由表默认文案逐字一致）。路径参数 p.match()[1] 改 params.*。
// 宽段说明：原 PUT /api/admin/users/(.+)$ 贪婪匹配含斜杠（/users/x/role 会被吞致 404 用户不存在），
//          本表用 :uid([^/]+) 单段——正常路径行为等价，畸形多段路径统一回落 404 接口不存在（更严格）。

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
// 迁移适配：原 handler 在 server.js（根目录）用 __dirname 定位 public/uploads 与 data/campus.db，
// 本模块位于 lib/ 下，须回退一级到服务根目录
const ROOT = path.join(__dirname, '..')

// 权限唯一口径：与 lib/router.js 的 staffRoleOf 逐字一致（is_admin 与 role 双轨在此统一）
function staffRoleOf(user) {
  if (!user) return 'student'
  if (user.is_admin || user.role === 'admin') return 'admin'
  if (['editor', 'reviewer', 'reporter'].includes(user.role)) return user.role
  return 'student'
}
function isStaffRole(role) { return role === 'admin' || role === 'editor' || role === 'reviewer' }
// 可赋角色矩阵（P0 提权保护：按调用者级别收窄；未列出者 = 不可授予任何角色）
const ASSIGNABLE_ROLES = {
  admin: ['admin', 'editor', 'reviewer', 'reporter', 'student'],
  editor: ['reporter', 'student'],
}

const routes = [
  // ═══ 首页画廊 CMS ═══

  // ───── 公开列表 ─────
  { method: 'GET', pattern: '/api/home-gallery', handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    const rows = db.prepare('SELECT id,image,title,wide,tall,sort_order FROM home_gallery WHERE is_visible=1 ORDER BY sort_order, id').all()
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 管理列表(admin，含隐藏) ─────
  { method: 'GET', pattern: '/api/admin/home-gallery', auth: 'admin', handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    const rows = db.prepare('SELECT * FROM home_gallery ORDER BY sort_order, id').all()
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 新增(admin, multipart) ─────
  { method: 'POST', pattern: '/api/admin/home-gallery', auth: 'admin', handler: async (ctx, { req, res }) => {
    const { db, sendJSON, readBody, parseMultipartFiles, detectFileType, UPLOAD_DIR } = ctx
    const contentType = req.headers['content-type'] || ''
    if (!contentType.includes('multipart/form-data')) { sendJSON(res, 400, { ok: false, message: '请使用 multipart/form-data 上传' }); return }
    const buf = await readBody(req, 4 * 1024 * 1024).catch(() => null)
    if (!buf) { sendJSON(res, 413, { ok: false, message: '文件过大(限制2MB)' }); return }
    const { fields, files } = parseMultipartFiles(buf, contentType)
    const imgFile = files.find(f => f.field === 'image')
    if (!imgFile) { sendJSON(res, 400, { ok: false, message: '请选择图片文件' }); return }
    if (imgFile.data.length > 2 * 1024 * 1024) { sendJSON(res, 400, { ok: false, message: '图片不能超过 2MB' }); return }
    const detected = detectFileType(imgFile.data)
    if (!['jpg', 'png', 'webp'].includes(detected)) { sendJSON(res, 400, { ok: false, message: '仅支持 jpg/png/webp 格式' }); return }
    const title = (fields.title || '').toString('utf8').trim().slice(0, 30)
    if (!title) { sendJSON(res, 400, { ok: false, message: '请填写图片标题' }); return }
    const wide = fields.wide === '1' ? 1 : 0
    const tall = fields.tall === '1' ? 1 : 0
    const galDir = path.join(UPLOAD_DIR, 'gallery')
    fs.mkdirSync(galDir, { recursive: true })
    const filename = `gal_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${detected}`
    fs.writeFileSync(path.join(galDir, filename), imgFile.data)
    const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM home_gallery').get().m
    const info = db.prepare('INSERT INTO home_gallery (image,title,wide,tall,sort_order,is_visible) VALUES (?,?,?,?,?,1)')
      .run('/api/gallery/' + filename, title, wide, tall, maxSort + 1)
    sendJSON(res, 201, { ok: true, message: '画廊图片已添加', id: info.lastInsertRowid })
  } },

  // ───── 编辑(admin, multipart) ─────
  { method: 'PUT', pattern: '/api/admin/home-gallery/:id(\\d+)', auth: 'admin', handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON, readBody, parseMultipartFiles, detectFileType, UPLOAD_DIR } = ctx
    const gid = Number(params.id)
    const existing = db.prepare('SELECT * FROM home_gallery WHERE id = ?').get(gid)
    if (!existing) { sendJSON(res, 404, { ok: false, message: '画廊项不存在' }); return }
    const contentType = req.headers['content-type'] || ''
    let fields = { title: existing.title, wide: existing.wide ? '1' : '0', tall: existing.tall ? '1' : '0' }
    let imgFile = null
    if (contentType.includes('multipart/form-data')) {
      const buf = await readBody(req, 4 * 1024 * 1024).catch(() => null)
      if (!buf) { sendJSON(res, 413, { ok: false, message: '文件过大(限制2MB)' }); return }
      const parsed = parseMultipartFiles(buf, contentType)
      fields = parsed.fields
      imgFile = parsed.files.find(f => f.field === 'image') || null
      if (fields.title === undefined) fields.title = existing.title
      if (fields.wide === undefined) fields.wide = existing.wide ? '1' : '0'
      if (fields.tall === undefined) fields.tall = existing.tall ? '1' : '0'
    }
    const title = (fields.title || '').toString('utf8').trim().slice(0, 30) || existing.title
    const wide = fields.wide === '1' ? 1 : 0
    const tall = fields.tall === '1' ? 1 : 0
    let image = existing.image
    if (imgFile && imgFile.data.length > 0) {
      if (imgFile.data.length > 2 * 1024 * 1024) { sendJSON(res, 400, { ok: false, message: '图片不能超过 2MB' }); return }
      const detected = detectFileType(imgFile.data)
      if (!['jpg', 'png', 'webp'].includes(detected)) { sendJSON(res, 400, { ok: false, message: '仅支持 jpg/png/webp 格式' }); return }
      const galDir = path.join(UPLOAD_DIR, 'gallery')
      fs.mkdirSync(galDir, { recursive: true })
      const filename = `gal_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${detected}`
      fs.writeFileSync(path.join(galDir, filename), imgFile.data)
      image = '/api/gallery/' + filename
      // 删除旧上传文件（仅清理本服务管理的 uploads/gallery/ 文件）
      if (existing.image && existing.image.startsWith('/api/gallery/')) {
        try { fs.unlinkSync(path.join(galDir, existing.image.slice('/api/gallery/'.length))) } catch {}
      }
    }
    db.prepare('UPDATE home_gallery SET image=?, title=?, wide=?, tall=? WHERE id=?').run(image, title, wide, tall, gid)
    sendJSON(res, 200, { ok: true, message: '画廊项已更新' })
  } },

  // ───── 删除(admin) ─────
  { method: 'DELETE', pattern: '/api/admin/home-gallery/:id(\\d+)', auth: 'admin', handler: async (ctx, { res, params }) => {
    const { db, sendJSON, UPLOAD_DIR } = ctx
    const gid = Number(params.id)
    const existing = db.prepare('SELECT * FROM home_gallery WHERE id = ?').get(gid)
    if (!existing) { sendJSON(res, 404, { ok: false, message: '画廊项不存在' }); return }
    db.prepare('DELETE FROM home_gallery WHERE id = ?').run(gid)
    if (existing.image && existing.image.startsWith('/api/gallery/')) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, 'gallery', existing.image.slice('/api/gallery/'.length))) } catch {}
    }
    sendJSON(res, 200, { ok: true, message: '画廊项已删除' })
  } },

  // ───── 显示/隐藏切换(admin) ─────
  { method: 'POST', pattern: '/api/admin/home-gallery/:id(\\d+)/toggle', auth: 'admin', handler: async (ctx, { res, params }) => {
    const { db, sendJSON } = ctx
    const gid = Number(params.id)
    const existing = db.prepare('SELECT id, is_visible FROM home_gallery WHERE id = ?').get(gid)
    if (!existing) { sendJSON(res, 404, { ok: false, message: '画廊项不存在' }); return }
    db.prepare('UPDATE home_gallery SET is_visible = ? WHERE id = ?').run(existing.is_visible ? 0 : 1, gid)
    sendJSON(res, 200, { ok: true, message: existing.is_visible ? '已隐藏' : '已显示' })
  } },

  // ───── 批量排序(admin) ─────
  { method: 'POST', pattern: '/api/admin/home-gallery/reorder', auth: 'admin', handler: async (ctx, { req, res }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let items = []
    try { items = JSON.parse(body.toString('utf8')) } catch { items = [] }
    if (!Array.isArray(items) || !items.length) { sendJSON(res, 400, { ok: false, message: '参数错误' }); return }
    const upd = db.prepare('UPDATE home_gallery SET sort_order = ? WHERE id = ?')
    try {
      db.exec('BEGIN')
      items.forEach(it => { if (it && Number.isInteger(Number(it.id))) upd.run(Number(it.sort_order) || 0, Number(it.id)) })
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      sendJSON(res, 500, { ok: false, message: '排序失败: ' + e.message })
      return
    }
    sendJSON(res, 200, { ok: true, message: '排序已保存' })
  } },

  // ═══ 用户管理 / 通知 / 统计 / 日志 / 导出 ═══

  // ───── 用户列表(admin) ─────
  { method: 'GET', pattern: '/api/admin/users', auth: 'admin', handler: async (ctx, { req, res, url }) => {
    const { db, sendJSON, escapeLike } = ctx
    const q = (url.searchParams.get('q') || '').trim()
    const role = (url.searchParams.get('role') || '').trim()
    let where = []
    let args = []
    if (q) { where.push('(name LIKE ? OR id LIKE ? OR college LIKE ?)'); args.push('%' + escapeLike(q) + '%', '%' + escapeLike(q) + '%', '%' + escapeLike(q) + '%') }
    if (role === 'admin') { where.push('is_admin = 1') }
    else if (role === 'student') { where.push('is_admin = 0') }
    const whereClause = where.length ? ('WHERE ' + where.join(' AND ')) : ''
    const rows = db.prepare('SELECT id,name,college,grade,is_admin,role,is_locked,created_at,totp_enabled FROM users ' + whereClause + ' ORDER BY is_admin DESC, id').all(...args)
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 用户管理：角色/封禁(admin；业务「不能修改自己」校验留 handler) ─────
  { method: 'PUT', pattern: '/api/admin/users/:uid([^/]+)', auth: 'admin', handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody } = ctx
    const uid = params.uid
    const body = await readBody(req, 16 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(uid)
    if (!u) { sendJSON(res, 404, { ok: false, message: '用户不存在' }); return }
    // 不能修改自己
    if (uid === String(user.id)) { sendJSON(res, 400, { ok: false, message: '不能修改自己的角色或状态' }); return }
    // 更新字段
    if ('is_admin' in parsed) {
      const next = Number(parsed.is_admin) ? 1 : 0
      const wasAdmin = staffRoleOf(u) === 'admin'
      // 提权保护：与角色端点同口径——最后一名超管不能被动降级，否则后台永久失去入口
      if (wasAdmin && !next) {
        const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE is_admin = 1 OR role = 'admin'").get().c
        if (admins <= 1) { sendJSON(res, 400, { ok: false, message: '系统至少需保留一名超级管理员，不能降级最后一名超管' }); return }
      }
      // 双轨同步：置 1 → role=admin；置 0 且原 role=admin → 回落 student（其余角色保持不动）
      if (next) db.prepare("UPDATE users SET is_admin = 1, role = 'admin' WHERE id = ?").run(uid)
      else db.prepare("UPDATE users SET is_admin = 0, role = CASE WHEN role = 'admin' THEN 'student' ELSE role END WHERE id = ?").run(uid)
      console.log('[AUDIT] ADMIN-FLAG caller=' + user.id + ' target=' + u.id + ' ' + (Number(u.is_admin) ? 1 : 0) + '->' + next + ' at=' + new Date().toISOString())
    }
    if ('is_locked' in parsed) {
      db.prepare('UPDATE users SET is_locked = ? WHERE id = ?').run(Number(parsed.is_locked) ? 1 : 0, uid)
      // 封禁用户立即清除其会话
      if (parsed.is_locked) {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id)
      }
      console.log('[AUDIT] LOCK-SET caller=' + user.id + ' target=' + u.id + ' locked=' + (Number(parsed.is_locked) ? 1 : 0) + ' at=' + new Date().toISOString())
    }
    sendJSON(res, 200, { ok: true, message: '已更新' })
  } },

  // ───── 用户角色设置(admin/editor；行权收窄见 handler) ─────
  // 提权保护（P0）：
  //   1) 禁改自己（防自提权，也防止把自己降级导致失联）
  //   2) 禁把最后一名超管降级（防后台失去唯一管理员入口）
  //   3) 按调用者级别收窄可赋角色：admin → 五档全开；editor → 仅 reporter/student 且限本学院成员
  //   4) 一律写 [AUDIT] 审计日志（对齐 2FA 重置 :211 / 密码重置 :235 的写法）
  { method: 'POST', pattern: '/api/admin/users/:uid([^/]+)/role', auth: 'staff:editor', handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody } = ctx
    const callerRole = staffRoleOf(user)
    if (!isStaffRole(callerRole)) { sendJSON(res, 403, { ok: false, message: '无权限' }); return }
    let uid = ''
    try { uid = decodeURIComponent(String(params.uid || '')) } catch (e) { uid = String(params.uid || '') }
    const body = await readBody(req, 4 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString() || '{}') } catch { parsed = {} }
    const role = parsed.role
    if (!['student', 'reporter', 'reviewer', 'editor', 'admin'].includes(role)) { sendJSON(res, 400, { ok: false, message: '无效角色' }); return }
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(uid)
    if (!target) { sendJSON(res, 404, { ok: false, message: '用户不存在' }); return }
    // 1) 禁改自己
    if (target.id === user.id) { sendJSON(res, 400, { ok: false, message: '不能修改自己的角色' }); return }
    // 3) 可赋角色矩阵（editor 拿不到 admin/editor/reviewer 三档，从根上堵住横向/纵向提权）
    const assignable = ASSIGNABLE_ROLES[callerRole] || []
    if (!assignable.includes(role)) {
      sendJSON(res, 403, { ok: false, message: '当前账号无权授予该角色（' + callerRole + ' 可授予：' + assignable.join('/') + '）' }); return
    }
    const targetRole = staffRoleOf(target)
    // 学院边界：editor 只能管本学院成员；任一学院为空即拒绝（显式处理，不静默放行）
    if (callerRole === 'editor') {
      const callerCollege = String(user.college || '').trim()
      const targetCollege = String(target.college || '').trim()
      if (!callerCollege || !targetCollege || callerCollege !== targetCollege) {
        sendJSON(res, 403, { ok: false, message: '学院编辑只能调整本学院成员的角色' }); return
      }
      // 层级保护：editor 只能调整级别低于自己的账号，不得动 admin/editor/reviewer
      //（否则「editor 把本学院超管降成 student」＝越级处置上级，属提权面）
      if (!['student', 'reporter'].includes(targetRole)) {
        sendJSON(res, 403, { ok: false, message: '学院编辑只能调整学生/学生记者账号' }); return
      }
    }
    // 2) 超管数量守卫
    if (targetRole === 'admin' && role !== 'admin') {
      const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE is_admin = 1 OR role = 'admin'").get().c
      if (admins <= 1) { sendJSON(res, 400, { ok: false, message: '系统至少需保留一名超级管理员，不能降级最后一名超管' }); return }
    }
    db.prepare('UPDATE users SET role = ?, is_admin = ? WHERE id = ?').run(role, role === 'admin' ? 1 : 0, target.id)
    console.log('[AUDIT] ROLE-SET caller=' + user.id + '(' + callerRole + ') target=' + target.id + ' ' + targetRole + '->' + role + ' at=' + new Date().toISOString())
    sendJSON(res, 200, { ok: true, message: '已将 ' + (target.name || uid) + ' 的角色设为 ' + role })
  } },

  // ───── 2FA 管理员重置（推广保险：成员手机+备用码全丢时的恢复通道）─────
  // 安全面：admin-only；重置后目标账号退回密码单因素（安全降级事件），console 审计留痕；
  // 目标账号重新登录后可在安全设置重新绑定。不可重置自己（自己有密码+动态码可自助关闭）。
  { method: 'POST', pattern: '/api/admin/2fa/reset', auth: 'admin', handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req, 4 * 1024).catch(() => Buffer.alloc(0))
    const { userId } = JSON.parse(body.toString() || '{}')
    if (!userId || typeof userId !== 'string') { sendJSON(res, 400, { ok: false, message: '缺少目标用户 ID' }); return }
    const target = db.prepare('SELECT id, name, totp_enabled FROM users WHERE id = ?').get(userId)
    if (!target) { sendJSON(res, 404, { ok: false, message: '用户不存在' }); return }
    if (target.id === user.id) { sendJSON(res, 400, { ok: false, message: '不能重置自己的两步验证（请在安全设置自助关闭）' }); return }
    if (!target.totp_enabled) { sendJSON(res, 400, { ok: false, message: (target.name || target.id) + ' 尚未启用两步验证，无需重置' }); return }
    db.prepare("UPDATE users SET totp_secret = '', totp_enabled = 0, backup_codes = '[]' WHERE id = ?").run(target.id)
    console.log('[AUDIT] 2FA-RESET admin=' + user.id + ' target=' + target.id + ' at=' + new Date().toISOString())
    sendJSON(res, 200, { ok: true, message: '已重置 ' + (target.name || target.id) + ' 的两步验证，其下次登录仅需密码，请通知其重新绑定' })
  } },

  // ───── 重置用户密码（admin 专用，2026-10-23）─────
  // 设计：不接受管理员自定义明文（防弱密码），统一生成 12 位强随机临时密码；
  //      明文仅本次响应返回一次；重置后清除该用户全部会话（旧登录立即失效）；
  //      禁止重置自己（应走「账号设置」自助改密）；写审计日志。
  { method: 'POST', pattern: '/api/admin/users/:uid([^/]+)/reset-password', auth: 'admin', handler: async (ctx, { res, params, user }) => {
    const { db, sendJSON } = ctx
    const { hashPassword } = require(path.join(ROOT, 'db.js'))
    let uid = ''
    try { uid = decodeURIComponent(String(params.uid || '')) } catch (e) { uid = '' }
    if (!uid) { sendJSON(res, 400, { ok: false, message: '缺少目标用户' }); return }
    const target = db.prepare('SELECT id, name, is_admin, role FROM users WHERE id = ?').get(uid)
    if (!target) { sendJSON(res, 404, { ok: false, message: '用户不存在' }); return }
    if (target.id === user.id) { sendJSON(res, 400, { ok: false, message: '不能重置自己的密码，请在「账号设置」中修改' }); return }
    // 12 位强随机临时密码（去掉了易混淆字符 0/O/1/l/I）
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    const rnd = crypto.randomBytes(16)
    let temp = ''
    for (let i = 0; i < 12; i++) temp += alphabet[rnd[i] % alphabet.length]
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(temp), target.id)
    try { db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id) } catch (e) {}
    console.log('[AUDIT] PWD-RESET admin=' + user.id + ' target=' + target.id + ' at=' + new Date().toISOString())
    sendJSON(res, 200, {
      ok: true,
      message: '已重置 ' + (target.name || target.id) + ' 的密码（其旧登录已强制下线）',
      data: { userId: target.id, name: target.name || '', tempPassword: temp },
    })
  } },

  // ───── 消息(接收人) ─────
  { method: 'GET', pattern: '/api/me/notifications', auth: 'user', handler: async (ctx, { res, user }) => {
    const { db, sendJSON } = ctx
    const rows = db.prepare('SELECT * FROM notifications WHERE owner = ? ORDER BY id DESC LIMIT 100').all(user.id)
    const unread = rows.filter(n => !n.read).length
    sendJSON(res, 200, { ok: true, data: rows, unread })
  } },

  // ───── 标记消息已读 ─────
  { method: 'POST', pattern: '/api/notifications/read', auth: 'user', handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req, 16 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const nid = Number(parsed.id)
    if (nid) db.prepare('UPDATE notifications SET read=1 WHERE id=? AND owner=?').run(nid, user.id)
    else db.prepare('UPDATE notifications SET read=1 WHERE owner=?').run(user.id)
    sendJSON(res, 200, { ok: true })
  } },

  // ───── 管理员统计(editor/reviewer) ─────
  { method: 'GET', pattern: '/api/admin/stats', auth: 'staff:editor,reviewer', handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    // 最近 7 天素材上传趋势
    const uploadTrend = db.prepare(`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM materials
      WHERE created_at >= datetime('now', 'localtime', '-7 days')
      GROUP BY date(created_at) ORDER BY date
    `).all()
    // 最近 7 天下载趋势
    const dlTrend = db.prepare(`
      SELECT date(downloaded_at) as date, COUNT(*) as count
      FROM download_logs
      WHERE downloaded_at >= datetime('now', 'localtime', '-7 days')
      GROUP BY date(downloaded_at) ORDER BY date
    `).all()
    // 用户增长趋势
    const userTrend = db.prepare(`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= datetime('now', 'localtime', '-7 days')
      GROUP BY date(created_at) ORDER BY date
    `).all()
    sendJSON(res, 200, {
      ok: true,
      data: {
        materials: db.prepare('SELECT COUNT(*) c FROM materials').get().c,
        approved: db.prepare("SELECT COUNT(*) c FROM materials WHERE status='approved'").get().c,
        published: db.prepare("SELECT COUNT(*) c FROM materials WHERE status='published'").get().c,
        pending_review: db.prepare("SELECT COUNT(*) c FROM materials WHERE status='pending_review'").get().c,
        draft: db.prepare("SELECT COUNT(*) c FROM materials WHERE status='draft'").get().c,
        archived: db.prepare("SELECT COUNT(*) c FROM materials WHERE status='archived'").get().c,
        rejected: db.prepare("SELECT COUNT(*) c FROM materials WHERE status='rejected'").get().c,
        downloads: db.prepare('SELECT COALESCE(SUM(downloads),0) s FROM materials').get().s,
        users: db.prepare('SELECT COUNT(*) c FROM users WHERE is_admin=0').get().c,
        activities: db.prepare('SELECT COUNT(*) c FROM activities').get().c,
        recruits: db.prepare('SELECT COUNT(*) c FROM recruits').get().c,
        uploadTrend, dlTrend, userTrend,
        // ── 数据工作台扩展字段（P1：只加不删，向后兼容）──
        uploadTrend30: db.prepare(`SELECT date(created_at) as date, COUNT(*) as count FROM materials WHERE created_at >= datetime('now','localtime','-30 days') GROUP BY date(created_at) ORDER BY date`).all(),
        by_type: db.prepare("SELECT type, COUNT(*) c FROM materials WHERE status IN ('approved','published') GROUP BY type").all(),
        by_college_top: db.prepare("SELECT college, COUNT(*) c, COALESCE(SUM(downloads),0) d FROM materials WHERE status IN ('approved','published') GROUP BY college ORDER BY c DESC LIMIT 5").all(),
        hot: db.prepare("SELECT id, title, type, downloads FROM materials WHERE status IN ('approved','published') ORDER BY downloads DESC LIMIT 5").all(),
        uploads_prev7: db.prepare("SELECT COUNT(*) c FROM materials WHERE created_at >= datetime('now','localtime','-14 days') AND created_at < datetime('now','localtime','-7 days')").get().c,
        downloads_prev7: db.prepare("SELECT COUNT(*) c FROM download_logs WHERE downloaded_at >= datetime('now','localtime','-14 days') AND downloaded_at < datetime('now','localtime','-7 days')").get().c,
        users_prev7: db.prepare("SELECT COUNT(*) c FROM users WHERE created_at >= datetime('now','localtime','-14 days') AND created_at < datetime('now','localtime','-7 days')").get().c,
        active_users: (function () {
          try {
            return db.prepare(`
              SELECT a.author_id AS id, MAX(a.author) AS name,
                     SUM(a.uploads) AS uploads, SUM(a.dls) AS downloads
              FROM (
                SELECT m.author_id, m.author, COUNT(*) AS uploads, 0 AS dls
                FROM materials m
                WHERE m.author_id IS NOT NULL AND m.created_at >= datetime('now','localtime','-7 days')
                GROUP BY m.author_id
                UNION ALL
                SELECT m2.author_id, m2.author, 0 AS uploads, COUNT(*) AS dls
                FROM download_logs dl JOIN materials m2 ON m2.id = dl.material_id
                WHERE m2.author_id IS NOT NULL AND dl.downloaded_at >= datetime('now','localtime','-7 days')
                GROUP BY m2.author_id
              ) a
              GROUP BY a.author_id
              ORDER BY (SUM(a.uploads) + SUM(a.dls)) DESC
              LIMIT 5
            `).all()
          } catch (e) { return [] }
        })(),
        storage: (function () {
          try {
            let u = 0
            const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else u += fs.statSync(p).size } }
            walk(path.join(ROOT, 'public', 'uploads'))
            const _dbPath = fs.existsSync(path.join(ROOT, 'data', 'campus.db'))
              ? path.join(ROOT, 'data', 'campus.db')
              : path.join(ROOT, '..', '.seedance-data', 'data', 'campus.db')
            const dbst = fs.statSync(_dbPath)
            return { uploadsMB: Math.round(u / 1048576 * 10) / 10, dbMB: Math.round(dbst.size / 1048576 * 10) / 10, uptimeH: Math.round(process.uptime() / 360) / 10 }
          } catch (e) { return null }
        })(),
      },
    })
  } },

  // ───── 素材治理清单(editor/reviewer) ─────
  { method: 'GET', pattern: '/api/admin/governance', auth: 'staff:editor,reviewer', handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    const pubWhere = "status IN ('published','approved')"
    const noCover = db.prepare(`SELECT id, title, type, college FROM materials WHERE (thumb_filename IS NULL OR thumb_filename = '') AND ${pubWhere} ORDER BY downloads DESC, id DESC LIMIT 20`).all()
    const noCoverTotal = db.prepare(`SELECT COUNT(*) c FROM materials WHERE (thumb_filename IS NULL OR thumb_filename = '') AND ${pubWhere}`).get().c
    const noPoster = db.prepare("SELECT id, title FROM activities WHERE (poster IS NULL OR poster = '') ORDER BY id DESC LIMIT 20").all()
    const noPosterTotal = db.prepare("SELECT COUNT(*) c FROM activities WHERE (poster IS NULL OR poster = '')").get().c
    const noTags = db.prepare(`SELECT id, title FROM materials WHERE (tags IS NULL OR tags = '') AND ${pubWhere} ORDER BY id DESC LIMIT 20`).all()
    const noTagsTotal = db.prepare(`SELECT COUNT(*) c FROM materials WHERE (tags IS NULL OR tags = '') AND ${pubWhere}`).get().c
    sendJSON(res, 200, { ok: true, data: { noCover, noCoverTotal, noPoster, noPosterTotal, noTags, noTagsTotal } })
  } },

  // ───── 核心指标埋点(editor/reviewer) ─────
  { method: 'GET', pattern: '/api/admin/metrics', auth: 'staff:editor,reviewer', handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    let avgReviewHours = null
    try {
      const h = db.prepare(`SELECT AVG((julianday(l.created_at) - julianday(m.created_at)) * 24.0) h FROM material_status_logs l JOIN materials m ON m.id = l.material_id WHERE l.action = 'approve' AND l.created_at >= datetime('now','localtime','-30 days')`).get().h
      avgReviewHours = (h == null || isNaN(h)) ? null : Math.round(h * 10) / 10
    } catch (e) { avgReviewHours = null }
    const pubTotal = db.prepare("SELECT COUNT(*) c FROM materials WHERE status IN ('published','approved')").get().c
    const dlMaterials = db.prepare('SELECT COUNT(DISTINCT material_id) c FROM download_logs').get().c
    const dlRate = pubTotal ? Math.round(dlMaterials / pubTotal * 100) : 0
    let revisitRate = null
    try {
      const allIp = db.prepare(`SELECT COUNT(DISTINCT ip) c FROM access_logs WHERE created_at >= datetime('now','localtime','-7 days')`).get().c
      const repeatIp = db.prepare(`SELECT COUNT(*) c FROM (SELECT ip FROM access_logs WHERE created_at >= datetime('now','localtime','-7 days') GROUP BY ip HAVING COUNT(DISTINCT date(created_at)) >= 2)`).get().c
      revisitRate = allIp ? Math.round(repeatIp / allIp * 100) : null
    } catch (e) { revisitRate = null }
    const newUsers7 = db.prepare("SELECT COUNT(*) c FROM users WHERE created_at >= datetime('now','localtime','-7 days')").get().c
    const newMats7 = db.prepare("SELECT COUNT(*) c FROM materials WHERE created_at >= datetime('now','localtime','-7 days')").get().c
    sendJSON(res, 200, { ok: true, data: { avgReviewHours, dlRate, pubTotal, revisitRate, newUsers7, newMats7 } })
  } },

  // ───── 全局操作日志(admin) ─────
  { method: 'GET', pattern: '/api/admin/audit-logs', auth: 'admin', handler: async (ctx, { res, url }) => {
    const { db, sendJSON } = ctx
    const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500)
    const logs = db.prepare(`
      SELECT l.*, m.title AS material_title
      FROM material_status_logs l
      LEFT JOIN materials m ON l.material_id = m.id
      ORDER BY l.id DESC LIMIT ?
    `).all(limit)
    sendJSON(res, 200, { ok: true, data: logs })
  } },

  // ───── 访问日志列表(admin) ─────
  { method: 'GET', pattern: '/api/admin/access-logs', auth: 'admin', handler: async (ctx, { res, url }) => {
    const { db, sendJSON, escapeLike } = ctx
    const page = Math.max(1, Number(url.searchParams.get('page') || 1))
    const pageSize = Math.min(Number(url.searchParams.get('pageSize') || 50), 200)
    const offset = (page - 1) * pageSize
    const qRegion = url.searchParams.get('region') || ''
    const qIP = url.searchParams.get('ip') || ''
    const qDate = url.searchParams.get('date') || ''

    let where = []
    let args = []
    if (qRegion) { where.push('region LIKE ?'); args.push('%' + escapeLike(qRegion) + '%') }
    if (qIP) { where.push('ip LIKE ?'); args.push('%' + escapeLike(qIP) + '%') }
    if (qDate) { where.push("date(created_at)=date(?)"); args.push(qDate) }
    const whereClause = where.length ? ('WHERE ' + where.join(' AND ')) : ''

    const total = db.prepare('SELECT COUNT(*) c FROM access_logs ' + whereClause).get(...args).c
    const logs = db.prepare('SELECT * FROM access_logs ' + whereClause + ' ORDER BY id DESC LIMIT ? OFFSET ?').all(...args, pageSize, offset)
    sendJSON(res, 200, { ok: true, data: logs, total, page, pageSize })
  } },

  // ───── 访问日志统计(admin) ─────
  { method: 'GET', pattern: '/api/admin/access-logs/stats', auth: 'admin', handler: async (ctx, { res, url }) => {
    const { db, sendJSON } = ctx
    const days = Number(url.searchParams.get('days') || 30)

    // 区域统计
    const regionStats = db.prepare(`
      SELECT region, COUNT(*) as visits, COUNT(DISTINCT ip) as unique_ips
      FROM access_logs
      WHERE created_at >= datetime('now', 'localtime', ?)
      GROUP BY region
      ORDER BY visits DESC
    `).all('-' + days + ' days')

    // 总览统计
    const overview = db.prepare(`
      SELECT
        COUNT(*) as total_visits,
        COUNT(DISTINCT ip) as unique_ips,
        COUNT(DISTINCT user_id) as logged_in_users
      FROM access_logs
      WHERE created_at >= datetime('now', 'localtime', ?)
    `).get('-' + days + ' days')

    // 最近 7 天趋势
    const trend = db.prepare(`
      SELECT date(created_at) as date, COUNT(*) as visits, COUNT(DISTINCT ip) as unique_ips
      FROM access_logs
      WHERE created_at >= datetime('now', 'localtime', '-7 days')
      GROUP BY date(created_at)
      ORDER BY date DESC
    `).all()

    // 页面访问统计
    const pageStats = db.prepare(`
      SELECT path, COUNT(*) as visits
      FROM access_logs
      WHERE created_at >= datetime('now', 'localtime', ?)
      GROUP BY path
      ORDER BY visits DESC
      LIMIT 20
    `).all('-' + days + ' days')

    sendJSON(res, 200, { ok: true, data: { overview, regionStats, trend, pageStats } })
  } },

  // ───── 传播包导出(编辑及以上；行权 403 留 handler) ─────
  { method: 'GET', pattern: '/api/export/pack', auth: 'user', handler: async (ctx, { req, res, url, user }) => {
    const { db, sendJSON, buildZip, UPLOAD_DIR } = ctx
    if (!(user.is_admin || ['editor', 'reviewer'].includes(user.role || ''))) { sendJSON(res, 403, { ok: false, message: '传播包下载需要编辑及以上权限' }); return }
    const type = url.searchParams.get('type')
    const id = parseInt(url.searchParams.get('id'))
    if (!['collection', 'activity'].includes(type) || !id) { sendJSON(res, 400, { ok: false, message: '参数错误' }); return }
    let title = '', items = []
    const entries = []
    const used = new Set()
    if (type === 'collection') {
      const col = db.prepare('SELECT * FROM collections WHERE id = ? AND is_visible = 1').get(id)
      if (!col) { sendJSON(res, 404, { ok: false, message: '专题不存在' }); return }
      title = col.title
      items = db.prepare(`
        SELECT m.id, m.title, m.type, m.filename, m.author, m.college, m.description, m.downloads
        FROM collection_items ci JOIN materials m ON m.id = ci.material_id
        WHERE ci.collection_id = ? AND m.status IN ('approved','published') ORDER BY m.id
      `).all(id)
    } else {
      const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(id)
      if (!act) { sendJSON(res, 404, { ok: false, message: '活动不存在' }); return }
      title = act.title
      // 活动传播包：海报 + 报名名单 + 活动信息（素材与活动无外键关联，故打包活动自身资产）
      if (act.poster) {
        const pp = path.join(UPLOAD_DIR, 'posters', act.poster)
        if (fs.existsSync(pp)) entries.push({ name: '活动海报-' + act.poster, data: fs.readFileSync(pp) })
      }
      const joins = db.prepare(`
        SELECT COALESCE(u.name, j.user_id) AS user_name, j.user_id, j.status, j.registered_at AS created_at
        FROM activity_joins j LEFT JOIN users u ON u.id = j.user_id
        WHERE j.activity_id = ? ORDER BY j.registered_at DESC`).all(id)
      let actInfo = '活动名称：' + title + '\n时间：' + (act.date || '待定') + '\n地点：' + (act.location || '待定') + '\n状态：' + act.status + '\n报名人数：' + joins.length + '\n\n介绍：\n' + (act.description || '') + '\n\n—— 校园融媒工坊 · Campus Media Workshop'
      entries.push({ name: '活动信息.txt', data: Buffer.from(actInfo, 'utf8') })
      if (joins.length) {
        let csv = '\uFEFF姓名,学号,状态,报名时间\n'
        const csvSafe = (v) => String(v == null ? '' : v).replace(/^[=+-@]+/, "'")
        for (const j of joins) {
          csv += '"' + csvSafe(j.user_name) + '","' + csvSafe(j.user_id) + '","' + (j.status === 'signed' ? '已签到' : '已报名') + '","' + csvSafe(j.registered_at) + '"\n'
        }
        entries.push({ name: '报名名单.csv', data: Buffer.from(csv, 'utf8') })
      }
      const zip = buildZip(entries)
      const fname = encodeURIComponent('活动传播包-' + title + '.zip')
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': "attachment; filename*=UTF-8''" + fname,
        'Content-Length': zip.length
      })
      res.end(zip)
      return
    }
    let manifest = '传播包：' + title + '\n类型：' + (type === 'collection' ? '专题合集' : '活动素材') + '\n生成时间：' + new Date().toLocaleString('zh-CN') + '\n生成人：' + (user.name || user.id) + '\n素材数：' + items.length + '\n\n文件清单：\n'
    let idx = 0
    for (const m of items) {
      idx++
      const fp = m.filename && path.join(UPLOAD_DIR, m.filename)
      let line = idx + '. ' + m.title + '（' + m.type + ' · ' + (m.author || '佚名') + ' · 下载 ' + (m.downloads || 0) + '）'
      if (fp && fs.existsSync(fp)) {
        let name = m.type + '-' + idx + '-' + (m.filename || ('file' + idx))
        if (used.has(name)) name = name.replace(/(\.[^.]+)$/, '_' + Date.now() % 10000 + '$1')
        used.add(name)
        entries.push({ name: name, data: fs.readFileSync(fp) })
        line += ' → ' + name
      } else {
        line += ' → （文件缺失或为纯在线内容）'
      }
      if (m.description) line += '\n   简介：' + String(m.description).slice(0, 80)
      manifest += line + '\n'
    }
    manifest += '\n—— 校园融媒工坊 · Campus Media Workshop'
    entries.push({ name: '素材清单.txt', data: Buffer.from(manifest, 'utf8') })
    const zip = buildZip(entries)
    const fname = encodeURIComponent((type === 'collection' ? '专题传播包-' : '活动传播包-') + title + '.zip')
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': "attachment; filename*=UTF-8''" + fname,
      'Content-Length': zip.length
    })
    res.end(zip)
  } },

  // ───── CSV导出(admin) ─────
  { method: 'GET', pattern: '/api/export/:type(materials|users|recruits)', auth: 'admin', handler: async (ctx, { res, params }) => {
    const { db, sendJSON } = ctx
    const type = params.type
    let rows, headers, filename
    if (type === 'materials') {
      rows = db.prepare('SELECT id, title, type, college, author, author_id, status, original_name, file_size, tags, shot_date, created_at FROM materials ORDER BY id').all()
      headers = ['ID', '标题', '类型', '学院', '作者', '学号', '状态', '文件名', '大小(字节)', '标签', '拍摄时间', '创建时间']
      filename = 'materials.csv'
    } else if (type === 'users') {
      rows = db.prepare('SELECT id, name, college, grade, is_admin, is_locked, created_at FROM users ORDER BY id').all()
      headers = ['学号', '姓名', '学院', '年级', '是否管理员', '是否封禁', '注册时间']
      filename = 'users.csv'
    } else {
      rows = db.prepare('SELECT id, name, sid, grade, college, email, resume_name, created_at FROM recruits ORDER BY id').all()
      headers = ['ID', '姓名', '学号', '年级', '学院', '邮箱', '简历文件名', '提交时间']
      filename = 'recruits.csv'
    }
    // BOM for Excel UTF-8
    let csv = '﻿'
    csv += headers.map(h => `"${h}"`).join(',') + '\n'
    for (const r of rows) {
      csv += Object.values(r).map(v => v === null || v === undefined ? '""' : `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'
    }
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    })
    res.end(csv)
  } },
]

const dispatch = require('./router')(routes)

module.exports = async function routesAdmin(ctx, req, res, p, method, url) {
  return dispatch(ctx, req, res, p, method, url)
}
