'use strict'
// 创作任务 + 贡献值体系 API（阶段二收官 · P2 拆分至 lib/routes-tasks.js）
module.exports = async function routesTasks(ctx, req, res, p, method, url) {
  const { db, sendJSON, readBody, authUser } = ctx

  // ── 贡献值写入（UNIQUE(type,ref_id) 幂等，防重复加分） ──
  function addContribution(userId, userName, points, type, refId, note) {
    try {
      const r = db.prepare('INSERT OR IGNORE INTO contribution_logs (user_id,user_name,points,type,ref_id,note) VALUES (?,?,?,?,?,?)')
        .run(userId, userName || '', points, type, String(refId || ''), note || '')
      return r.changes > 0
    } catch (e) { console.warn('  ⚠ 贡献值写入失败:', e.message); return false }
  }

  // ── 站内通知（复用 notifications 表，action='task'，material_title 存可读消息） ──
  function notifyTask(userId, actor, text) {
    try {
      db.prepare("INSERT INTO notifications (owner, material_id, material_title, actor, action) VALUES (?, 0, ?, ?, 'task')")
        .run(userId, text, actor || '系统')
    } catch (e) { console.warn('  ⚠ 任务通知失败:', e.message) }
  }

  const TASK_CATEGORIES = ['news', 'video', 'photo', 'design', 'other']

  // ═══ 学生端 ═══

  // ───── 任务列表 ─────
  if (p === '/api/tasks' && method === 'GET') {
    const user = authUser(req)
    if (!user) { sendJSON(res, 401, { ok: false, message: '请先登录' }); return true }
    const rows = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM task_claims c WHERE c.task_id = t.id AND c.status IN ('claimed','submitted','approved')) AS active_claims,
        (SELECT COUNT(*) FROM task_claims c WHERE c.task_id = t.id AND c.status = 'approved') AS done_claims
      FROM tasks t
      ORDER BY CASE t.status WHEN 'open' THEN 0 ELSE 1 END, t.created_at DESC
    `).all()
    const myClaims = db.prepare('SELECT id, task_id, status, submitted_at, review_comment FROM task_claims WHERE user_id = ? ORDER BY id DESC').all(user.id)
    const myByTask = {}
    for (const c of myClaims) { if (!myByTask[c.task_id]) myByTask[c.task_id] = c }
    const data = rows.map(t => ({
      ...t,
      my_claim: myByTask[t.id] ? { id: myByTask[t.id].id, status: myByTask[t.id].status, review_comment: myByTask[t.id].review_comment } : null
    }))
    sendJSON(res, 200, { ok: true, data, total: data.length })
    return true
  }

  // ───── 领取任务 ─────
  if (p.match(/^\/api\/tasks\/\d+\/claim$/) && method === 'POST') {
    const user = authUser(req)
    if (!user) { sendJSON(res, 401, { ok: false, message: '请先登录' }); return true }
    const id = parseInt(p.split('/')[3])
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    if (!task) { sendJSON(res, 404, { ok: false, message: '任务不存在' }); return true }
    if (task.status !== 'open') { sendJSON(res, 400, { ok: false, message: '任务已关闭' }); return true }
    if (task.deadline && task.deadline < new Date().toISOString().slice(0, 16).replace('T', ' ')) {
      sendJSON(res, 400, { ok: false, message: '任务已过截止时间' }); return true
    }
    // 已有进行中的领取（claimed/submitted/approved）不可重复领取；被拒(rejected)可重新领取
    const existing = db.prepare("SELECT id, status FROM task_claims WHERE task_id = ? AND user_id = ? AND status IN ('claimed','submitted','approved')").get(id, user.id)
    if (existing) {
      sendJSON(res, 400, { ok: false, message: existing.status === 'claimed' ? '你已领取该任务，请提交成果' : existing.status === 'submitted' ? '成果已提交，等待审核' : '你已完成该任务' })
      return true
    }
    // 名额检查
    if (task.slots > 0) {
      const active = db.prepare("SELECT COUNT(*) c FROM task_claims WHERE task_id = ? AND status IN ('claimed','submitted','approved')").get(id).c
      if (active >= task.slots) { sendJSON(res, 400, { ok: false, message: '名额已满' }); return true }
    }
    const r = db.prepare("INSERT INTO task_claims (task_id, user_id, user_name, status) VALUES (?, ?, ?, 'claimed')").run(id, user.id, user.name)
    sendJSON(res, 200, { ok: true, data: { claim_id: r.lastInsertRowid }, message: '领取成功，完成后请提交成果' })
    return true
  }

  // ───── 提交任务成果 ─────
  if (p.match(/^\/api\/tasks\/\d+\/submit$/) && method === 'POST') {
    const user = authUser(req)
    if (!user) { sendJSON(res, 401, { ok: false, message: '请先登录' }); return true }
    const id = parseInt(p.split('/')[3])
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    if (!task) { sendJSON(res, 404, { ok: false, message: '任务不存在' }); return true }
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString('utf8')) } catch {}
    const note = String(parsed.note || '').trim()
    const articleId = parseInt(parsed.article_id) || null
    if (!note && !articleId) { sendJSON(res, 400, { ok: false, message: '请填写成果说明或关联文稿' }); return true }
    // 2026-10-25 修复：先查记录再分状态给准确提示（原来统一提示"请先领取任务"会误导）
    const anyClaim = db.prepare("SELECT * FROM task_claims WHERE task_id = ? AND user_id = ? ORDER BY id DESC").get(id, user.id)
    if (!anyClaim) { sendJSON(res, 400, { ok: false, message: '请先领取该任务' }); return true }
    if (anyClaim.status === 'submitted') { sendJSON(res, 400, { ok: false, message: '成果已提交，等待审核' }); return true }
    if (anyClaim.status === 'approved') { sendJSON(res, 400, { ok: false, message: '该任务你已完成，无需重复提交' }); return true }
    // claimed（首次提交）或 rejected（被打回后重新提交）才允许
    const claim = anyClaim
    db.prepare("UPDATE task_claims SET status = 'submitted', submission_note = ?, article_id = ?, submitted_at = datetime('now','localtime'), reviewed_by = '', review_comment = '', reviewed_at = NULL WHERE id = ?")
      .run(note, articleId, claim.id)
    sendJSON(res, 200, { ok: true, message: '成果已提交，等待审核' })
    return true
  }

  // ───── 我的任务 ─────
  if (p === '/api/my/tasks' && method === 'GET') {
    const user = authUser(req)
    if (!user) { sendJSON(res, 401, { ok: false, message: '请先登录' }); return true }
    const rows = db.prepare(`
      SELECT c.*, t.title AS task_title, t.points AS task_points, t.category AS task_category
      FROM task_claims c LEFT JOIN tasks t ON c.task_id = t.id
      WHERE c.user_id = ? ORDER BY c.id DESC
    `).all(user.id)
    sendJSON(res, 200, { ok: true, data: rows, total: rows.length })
    return true
  }

  // ───── 我的贡献值 + 流水 ─────
  if (p === '/api/contribution/me' && method === 'GET') {
    const user = authUser(req)
    if (!user) { sendJSON(res, 401, { ok: false, message: '请先登录' }); return true }
    const total = db.prepare('SELECT COALESCE(SUM(points),0) s FROM contribution_logs WHERE user_id = ?').get(user.id).s
    const logs = db.prepare('SELECT id, points, type, ref_id, note, created_at FROM contribution_logs WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(user.id)
    // 我的排名
    let rank = null
    const higher = db.prepare(`
      SELECT COUNT(*) c FROM (
        SELECT user_id, SUM(points) s FROM contribution_logs GROUP BY user_id HAVING SUM(points) > ?
      )
    `).get(total)
    if (higher) rank = higher.c + 1
    sendJSON(res, 200, { ok: true, data: { total, rank, logs } })
    return true
  }

  // ───── 贡献值排行榜 ─────
  if (p === '/api/contribution/rank' && method === 'GET') {
    const user = authUser(req)
    if (!user) { sendJSON(res, 401, { ok: false, message: '请先登录' }); return true }
    const rows = db.prepare(`
      SELECT l.user_id, MAX(l.user_name) AS user_name, SUM(l.points) AS total,
        MAX(u.college) AS college
      FROM contribution_logs l LEFT JOIN users u ON l.user_id = u.id
      GROUP BY l.user_id ORDER BY total DESC LIMIT 50
    `).all()
    rows.forEach((r, i) => { r.rank = i + 1 })
    sendJSON(res, 200, { ok: true, data: rows })
    return true
  }

  // ═══ 管理端 ═══

  // ───── 创建任务 ─────
  if (p === '/api/admin/tasks' && method === 'POST') {
    const user = authUser(req)
    if (!user || !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权限' }); return true }
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString('utf8')) } catch {}
    const title = String(parsed.title || '').trim()
    if (!title) { sendJSON(res, 400, { ok: false, message: '任务标题不能为空' }); return true }
    const points = Math.max(0, Math.min(500, parseInt(parsed.points) || 10))
    const slots = Math.max(0, Math.min(200, parseInt(parsed.slots) || 0))
    const category = TASK_CATEGORIES.includes(parsed.category) ? parsed.category : 'news'
    const deadline = String(parsed.deadline || '').slice(0, 16).replace('T', ' ')
    const r = db.prepare(`INSERT INTO tasks (title, description, category, points, slots, deadline, created_by, created_by_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(title, String(parsed.description || '').slice(0, 2000), category, points, slots, deadline, user.id, user.name)
    sendJSON(res, 200, { ok: true, data: { id: r.lastInsertRowid }, message: '任务已发布' })
    return true
  }

  // ───── 编辑任务 ─────
  if (p.match(/^\/api\/admin\/tasks\/\d+$/) && method === 'PUT') {
    const user = authUser(req)
    if (!user || !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权限' }); return true }
    const id = parseInt(p.split('/').pop())
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    if (!task) { sendJSON(res, 404, { ok: false, message: '任务不存在' }); return true }
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString('utf8')) } catch {}
    const updates = []
    const params = []
    if (parsed.title !== undefined) { updates.push('title = ?'); params.push(String(parsed.title).trim().slice(0, 200)) }
    if (parsed.description !== undefined) { updates.push('description = ?'); params.push(String(parsed.description).slice(0, 2000)) }
    if (parsed.category !== undefined && TASK_CATEGORIES.includes(parsed.category)) { updates.push('category = ?'); params.push(parsed.category) }
    if (parsed.points !== undefined) { updates.push('points = ?'); params.push(Math.max(0, Math.min(500, parseInt(parsed.points) || 0))) }
    if (parsed.slots !== undefined) { updates.push('slots = ?'); params.push(Math.max(0, Math.min(200, parseInt(parsed.slots) || 0))) }
    if (parsed.deadline !== undefined) { updates.push('deadline = ?'); params.push(String(parsed.deadline).slice(0, 16).replace('T', ' ')) }
    if (parsed.status !== undefined && ['open', 'closed'].includes(parsed.status)) { updates.push('status = ?'); params.push(parsed.status) }
    if (!updates.length) { sendJSON(res, 400, { ok: false, message: '没有需要更新的字段' }); return true }
    params.push(id)
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    sendJSON(res, 200, { ok: true, message: '任务已更新' })
    return true
  }

  // ───── 删除任务 ─────
  if (p.match(/^\/api\/admin\/tasks\/\d+$/) && method === 'DELETE') {
    const user = authUser(req)
    if (!user || !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权限' }); return true }
    const id = parseInt(p.split('/').pop())
    // 删除任务及其全部领取记录(已入账的贡献值流水无外键引用,自动保留)
    db.prepare('DELETE FROM task_claims WHERE task_id = ?').run(id)
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    sendJSON(res, 200, { ok: true, message: '任务已删除（已发放的贡献值流水保留）' })
    return true
  }

  // ───── 领取记录列表（审核视图） ─────
  if (p === '/api/admin/task-claims' && method === 'GET') {
    const user = authUser(req)
    if (!user || !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权限' }); return true }
    const sp = url.searchParams
    const status = sp.get('status') || ''
    const taskId = parseInt(sp.get('task_id')) || 0
    let where = ['1=1']
    const params = []
    if (status) { where.push('c.status = ?'); params.push(status) }
    if (taskId) { where.push('c.task_id = ?'); params.push(taskId) }
    const rows = db.prepare(`
      SELECT c.*, t.title AS task_title, t.points AS task_points
      FROM task_claims c LEFT JOIN tasks t ON c.task_id = t.id
      WHERE ${where.join(' AND ')}
      ORDER BY CASE c.status WHEN 'submitted' THEN 0 WHEN 'claimed' THEN 1 ELSE 2 END, c.id DESC
      LIMIT 200
    `).all(...params)
    sendJSON(res, 200, { ok: true, data: rows, total: rows.length })
    return true
  }

  // ───── 审核任务成果 ─────
  if (p.match(/^\/api\/admin\/task-claims\/\d+\/review$/) && method === 'POST') {
    const user = authUser(req)
    if (!user || !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权限' }); return true }
    const id = parseInt(p.split('/')[4])
    const claim = db.prepare('SELECT * FROM task_claims WHERE id = ?').get(id)
    if (!claim) { sendJSON(res, 404, { ok: false, message: '领取记录不存在' }); return true }
    if (claim.status !== 'submitted') { sendJSON(res, 400, { ok: false, message: '该记录当前不可审核' }); return true }
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString('utf8')) } catch {}
    const action = parsed.action
    const comment = String(parsed.comment || '').slice(0, 500)
    if (!['approve', 'reject'].includes(action)) { sendJSON(res, 400, { ok: false, message: '无效操作' }); return true }
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(claim.task_id)
    if (action === 'approve') {
      db.prepare("UPDATE task_claims SET status = 'approved', reviewed_by = ?, review_comment = ?, reviewed_at = datetime('now','localtime') WHERE id = ?")
        .run(user.name, comment, id)
      // 加贡献值（幂等：UNIQUE(task_approved, claim_id)）
      const points = task ? task.points : 0
      addContribution(claim.user_id, claim.user_name, points, 'task_approved', claim.id, '任务「' + (task ? task.title : '') + '」通过审核')
      notifyTask(claim.user_id, user.name, '你的任务「' + (task ? task.title : '') + '」成果已通过审核，贡献值 +' + points)
    } else {
      if (!comment.trim()) { sendJSON(res, 400, { ok: false, message: '打回时必须填写原因' }); return true }
      db.prepare("UPDATE task_claims SET status = 'rejected', reviewed_by = ?, review_comment = ?, reviewed_at = datetime('now','localtime') WHERE id = ?")
        .run(user.name, comment, id)
      notifyTask(claim.user_id, user.name, '任务「' + (task ? task.title : '') + '」成果被打回：' + comment)
    }
    sendJSON(res, 200, { ok: true, message: action === 'approve' ? '已通过并发放贡献值' : '已打回' })
    return true
  }

  // ───── 手动调整贡献值 ─────
  if (p === '/api/admin/contribution/adjust' && method === 'POST') {
    const user = authUser(req)
    if (!user || !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权限' }); return true }
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString('utf8')) } catch {}
    const targetId = String(parsed.user_id || '').trim()
    const points = parseInt(parsed.points)
    const note = String(parsed.note || '').slice(0, 200)
    if (!targetId) { sendJSON(res, 400, { ok: false, message: '请指定用户' }); return true }
    const target = db.prepare('SELECT id, name FROM users WHERE id = ?').get(targetId)
    if (!target) { sendJSON(res, 404, { ok: false, message: '用户不存在' }); return true }
    if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 200) { sendJSON(res, 400, { ok: false, message: '调整分值需为 -200~200 的非零整数' }); return true }
    if (!note.trim()) { sendJSON(res, 400, { ok: false, message: '请填写调整原因' }); return true }
    const refId = 'adj-' + Date.now()
    addContribution(target.id, target.name, points, 'adjust', refId, note + '（操作人：' + user.name + '）')
    notifyTask(target.id, user.name, '贡献值' + (points > 0 ? '+' : '') + points + '：' + note)
    sendJSON(res, 200, { ok: true, message: '已调整 ' + target.name + ' 的贡献值 ' + (points > 0 ? '+' : '') + points })
    return true
  }

  return false
}
