'use strict'
// 融媒体文稿系统 API v2（P2 批四路由表化：26 条 if 链 → 声明式路由表）
// 迁移原则：handler 体业务逻辑零改动；仅 auth 检查收口到路由表闸门、
//          路径参数 p.split('/') 手工解析改 params.*、401/403 文案原样保留。
// 宽匹配语义说明：原 detail/更新/删除用 startsWith 宽匹配 + 子串排除法，本表用
//   「子路由精确条目在前 + 宽条目单段 :id（自定义负向断言排除保留字）」等价还原；
//   原宽匹配会把未知多段子路径误吞进 handler（如 DELETE /api/articles/5/xyz 等同删 5），
//   属宽容匹配怪癖，本表不再保留——此类路径回落全局 404「接口不存在」（更严格更安全）。
//   非数字单段 id 保留原语义：宽条目命中后 parseInt NaN → 404「文稿不存在」。

// ───── 富文本净化：白名单标签 + 剥离事件属性与危险协议（防存储型 XSS） ─────
function sanitizeRichText(html) {
  let s = String(html || '')
  // 移除整个危险标签及其内容
  s = s.replace(/<(script|style|iframe|object|embed|form|link|meta)\b[\s\S]*?<\/\1>/gi, '')
  s = s.replace(/<(script|style|iframe|object|embed|form|link|meta)\b[^>]*\/?>/gi, '')
  // 移除所有事件属性 on*
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  // 危险协议
  s = s.replace(/(href|src)\s*=\s*("|')?\s*(javascript|vbscript|data):[^"'>\s]*("|')?/gi, '$1="#"')
  // 仅保留白名单标签，其余标签剥壳留内容
  const ALLOWED = ['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'IMG', 'A', 'SPAN', 'DIV']
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (m, tag) => {
    return ALLOWED.includes(tag.toUpperCase()) ? m : ''
  })
  // img 仅保留 src（http/https），a 仅保留 href（http/https）
  s = s.replace(/<img\b[^>]*>/gi, (m) => {
    const src = (m.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[2] || (m.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[3] || ''
    if (!/^https?:\/\//i.test(src)) return ''
    return '<img src="' + src.replace(/"/g, '&quot;') + '">'
  })
  s = s.replace(/<a\b[^>]*>/gi, (m) => {
    const href = (m.match(/\shref\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[2] || (m.match(/\shref\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[3] || ''
    if (!/^https?:\/\//i.test(href)) return '<a>'
    return '<a href="' + href.replace(/"/g, '&quot;') + '">'
  })
  return s
}

// ───── 文稿审核核心（单条与批量共用：状态机推进 + 审核记录 + 通知作者） ─────
// 返回 { ok, message, newStatus? }；ok:false 时 message 决定单条端点的 HTTP 状态码映射
function applyArticleReview(db, admin, id, action, comment, annotations) {
  if (!['approve', 'reject', 'return'].includes(action)) return { ok: false, message: '无效操作' }
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id)
  if (!article) return { ok: false, message: '文稿不存在' }
  let newStatus = article.status
  let stage = ''
  if (article.status === 'pending_l1') stage = 'first_review'
  else if (article.status === 'pending_l2') stage = 'second_review'
  else if (article.status === 'pending_l3') stage = 'third_review'
  else return { ok: false, message: '当前状态不可审核' }
  if (action === 'reject') {
    newStatus = 'rejected'
  } else if (action === 'return') {
    newStatus = 'draft'
  } else if (action === 'approve') {
    // 根据审核等级推进
    if (article.review_level === 1) { newStatus = 'published_ready' }
    else if (article.review_level === 2) {
      newStatus = article.status === 'pending_l1' ? 'pending_l2' : 'published_ready'
    } else if (article.review_level === 3) {
      if (article.status === 'pending_l1') newStatus = 'pending_l2'
      else if (article.status === 'pending_l2') newStatus = 'pending_l3'
      else newStatus = 'published_ready'
    }
  }
  db.prepare("UPDATE articles SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(newStatus, id)
  db.prepare(`INSERT INTO article_reviews (article_id, reviewer_id, reviewer_name, review_stage, action, comment, annotations)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, admin.id, admin.name, stage, action, comment || '', JSON.stringify(annotations || []))
  // 通知作者
  db.prepare(`INSERT INTO notifications (owner, material_id, material_title, actor, action) VALUES (?, ?, ?, ?, 'review')`)
    .run(article.author_id, id, article.title, admin.name)
  return { ok: true, message: action === 'approve' ? '审核通过' : action === 'reject' ? '已拒绝' : '已退回', newStatus: newStatus }
}

// auth 常量（401/403 文案与原 if 链逐字一致）
const USER = { auth: 'user', unauthorizedMessage: '请先登录' }// 形态 A：未登录与无权限同文案 403（原 `!user || !user.is_admin` → 403「无权限」）
const ADMIN_FORBID = { auth: 'admin', unauthorizedMessage: '无权限', forbiddenMessage: '无权限', unauthAction: 'forbid' }
// 形态 B：未登录 401「请先登录」、已登录非管理员 403 专属文案（原两段检查）
const ADMIN_MSG = (msg) => ({ auth: 'admin', unauthorizedMessage: '请先登录', forbiddenMessage: msg })
// 形态 C：未登录也是 403 专属文案（原 `!user || !user.is_admin` → 403 专属文案）
const ADMIN_FORBID_MSG = (msg) => ({ auth: 'admin', unauthorizedMessage: msg, forbiddenMessage: msg, unauthAction: 'forbid' })

const routes = [
  // ───── 敏感词库管理（管理员）：列表 ─────
  { method: 'GET', pattern: '/api/admin/sensitive-words', ...ADMIN_FORBID, handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    const rows = db.prepare('SELECT * FROM sensitive_words ORDER BY level, word').all()
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 敏感词库管理（管理员）：新增 ─────
  { method: 'POST', pattern: '/api/admin/sensitive-words', ...ADMIN_FORBID, handler: async (ctx, { req, res }) => {
    const { db, sendJSON, readBody, reloadFilter } = ctx
    const body = await readBody(req, 256 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const words = Array.isArray(parsed.words) ? parsed.words : [parsed]
    let added = 0, skipped = 0, lastId = null
    const ins = db.prepare('INSERT OR IGNORE INTO sensitive_words (word,level,category,replacement) VALUES (?,?,?,?)')
    for (const w of words) {
      if (!w.word || !w.word.trim()) { skipped++; continue }
      const r = ins.run(w.word.trim(), w.level || 'medium', w.category || '', w.replacement || '')
      if (r.changes > 0) { added++; lastId = r.lastInsertRowid }
      else skipped++
    }
    if (added > 0) reloadFilter()
    sendJSON(res, 200, { ok: true, data: { id: lastId, added, skipped }, message: `已添加 ${added} 条敏感词${skipped > 0 ? `，跳过 ${skipped} 条重复` : ''}` })
  } },

  // ───── 敏感词库管理（管理员）：删除 ─────
  { method: 'DELETE', pattern: '/api/admin/sensitive-words/:id', ...ADMIN_FORBID, handler: async (ctx, { res, params }) => {
    const { db, sendJSON, reloadFilter } = ctx
    const id = parseInt(params.id)
    db.prepare('DELETE FROM sensitive_words WHERE id = ?').run(id)
    reloadFilter()
    sendJSON(res, 200, { ok: true, message: '敏感词已删除' })
  } },

  // ───── 敏感词检测 ─────
  { method: 'POST', pattern: '/api/articles/check-sensitive', ...USER, handler: async (ctx, { req, res }) => {
    const { sendJSON, readBody, sensitiveFilter } = ctx
    const body = await readBody(req, 2 * 1024 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const text = parsed.text || ''
    const hits = sensitiveFilter.detect(text)
    sendJSON(res, 200, { ok: true, data: { hits, count: hits.length, hasHigh: hits.some(h => h.level === 'high') } })
  } },

  // ───── 文稿统计（精确条目须在宽 :id 详情之前） ─────
  { method: 'GET', pattern: '/api/articles/stats', ...USER, handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM articles GROUP BY status').all()
    const total = db.prepare('SELECT COUNT(*) as c FROM articles').get().c
    const pending = db.prepare("SELECT COUNT(*) as c FROM articles WHERE status IN ('pending_l1','pending_l2','pending_l3')").get().c
    const published = db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'published'").get().c
    sendJSON(res, 200, { ok: true, data: { byStatus, total, pending, published } })
  } },

  // ───── 文稿版本列表 ─────
  { method: 'GET', pattern: '/api/articles/:id(\\d+)/versions', ...USER, handler: async (ctx, { res, params }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id)
    const rows = db.prepare('SELECT id, title, summary, saved_by, created_at, LENGTH(content) AS chars FROM article_versions WHERE article_id = ? ORDER BY id DESC LIMIT 30').all(id)
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 审核历史 ─────
  { method: 'GET', pattern: '/api/articles/:id(\\d+)/reviews', ...USER, handler: async (ctx, { res, params, user }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id)
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id)
    if (!article) { sendJSON(res, 404, { ok: false, message: '文稿不存在' }); return }
    if (!user.is_admin && article.author_id !== user.id) { sendJSON(res, 403, { ok: false, message: '无权查看' }); return }
    const reviews = db.prepare('SELECT * FROM article_reviews WHERE article_id = ? ORDER BY created_at ASC').all(id)
    sendJSON(res, 200, { ok: true, data: reviews })
  } },

  // ───── 发布日志 ─────
  { method: 'GET', pattern: '/api/articles/:id(\\d+)/publish-logs', ...USER, handler: async (ctx, { res, params }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id)
    const logs = db.prepare('SELECT * FROM publish_logs WHERE article_id = ? ORDER BY published_at DESC').all(id)
    sendJSON(res, 200, { ok: true, data: logs })
  } },

  // ───── 版本回滚（恢复到当前草稿） ─────
  { method: 'POST', pattern: '/api/articles/:id(\\d+)/restore', ...USER, handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody } = ctx
    const id = parseInt(params.id)
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id)
    if (!article) { sendJSON(res, 404, { ok: false, message: '文稿不存在' }); return }
    if (article.author_id !== user.id && !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权操作' }); return }
    if (!['draft', 'rejected'].includes(article.status)) { sendJSON(res, 400, { ok: false, message: '当前状态不可恢复' }); return }
    const body = await readBody(req, 4 * 1024).catch(() => Buffer.alloc(0))
    let parsed; try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const ver = db.prepare('SELECT * FROM article_versions WHERE id = ? AND article_id = ?').get(parsed.version_id, id)
    if (!ver) { sendJSON(res, 404, { ok: false, message: '版本不存在' }); return }
    db.prepare("UPDATE articles SET title = ?, content = ?, summary = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(ver.title, ver.content, ver.summary, id)
    sendJSON(res, 200, { ok: true, message: '已恢复到版本 ' + ver.created_at })
  } },

  // ───── 提交审核 ─────
  { method: 'POST', pattern: '/api/articles/:id(\\d+)/submit', ...USER, handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody } = ctx
    const id = parseInt(params.id)
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id)
    if (!article) { sendJSON(res, 404, { ok: false, message: '文稿不存在' }); return }
    if (article.author_id !== user.id) { sendJSON(res, 403, { ok: false, message: '无权操作' }); return }
    if (!['draft', 'rejected'].includes(article.status)) { sendJSON(res, 400, { ok: false, message: '当前状态不可提交审核' }); return }
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString('utf8')) } catch {}
    const reviewLevel = Math.min(3, Math.max(1, parseInt(parsed.review_level) || article.review_level || 1))
    const newStatus = 'pending_l1'
    db.prepare("UPDATE articles SET status = ?, review_level = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(newStatus, reviewLevel, id)
    // 记录日志
    db.prepare(`INSERT INTO article_reviews (article_id, reviewer_id, reviewer_name, review_stage, action, comment)
      VALUES (?, ?, ?, 'submit', 'submit', ?)`).run(id, user.id, user.name, '提交审核')
    sendJSON(res, 200, { ok: true, message: `已提交${reviewLevel}级审核` })
  } },

  // ───── 审核操作（未登录 401 / 学生 403 专属文案；核心逻辑抽 applyArticleReview 供批量复用） ─────
  { method: 'POST', pattern: '/api/articles/:id(\\d+)/review', ...ADMIN_MSG('仅管理员可审核'), handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody } = ctx
    const id = parseInt(params.id)
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id)
    if (!article) { sendJSON(res, 404, { ok: false, message: '文稿不存在' }); return }
    const body = await readBody(req, 2 * 1024 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString('utf8')) } catch {}
    const { action, comment, annotations } = parsed
    const r = applyArticleReview(db, user, id, action, comment, annotations)
    if (!r.ok) {
      const code = r.message === '文稿不存在' ? 404 : (r.message === '无效操作' || r.message === '当前状态不可审核' ? 400 : 400)
      sendJSON(res, code, { ok: false, message: r.message }); return
    }
    sendJSON(res, 200, { ok: true, message: r.message, newStatus: r.newStatus })
  } },

  // ───── 批量审核（批九新增：文稿审核队列批量处理；循环复用单条状态机，逐条收集结果） ─────
  { method: 'POST', pattern: '/api/articles/batch-review', ...ADMIN_MSG('仅管理员可审核'), handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req, 256 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString('utf8')) } catch {}
    const ids = Array.isArray(parsed.ids) ? parsed.ids.map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 50) : []
    const action = parsed.action
    const comment = (parsed.comment || '').trim()
    if (!ids.length || !['approve', 'reject', 'return'].includes(action)) { sendJSON(res, 400, { ok: false, message: '参数错误' }); return }
    const results = []
    let ok = 0, fail = 0
    for (const id of ids) {
      try {
        const r = applyArticleReview(db, user, id, action, comment, [])
        results.push(Object.assign({ id: id }, r))
        if (r.ok) ok++; else fail++
      } catch (e) { results.push({ id: id, ok: false, message: e.message }); fail++ }
    }
    sendJSON(res, 200, { ok: true, message: `批量审核完成：${ok} 成功 ${fail} 失败`, data: { results: results, ok: ok, fail: fail } })
  } },

  // ───── 发布并推送（未登录也是 403 专属文案） ─────
  { method: 'POST', pattern: '/api/articles/:id(\\d+)/publish', ...ADMIN_FORBID_MSG('仅管理员可发布'), handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON, readBody, publishArticle } = ctx
    const id = parseInt(params.id)
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id)
    if (!article) { sendJSON(res, 404, { ok: false, message: '文稿不存在' }); return }
    if (article.status !== 'published_ready') { sendJSON(res, 400, { ok: false, message: '文稿未通过终审' }); return }
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString('utf8')) } catch {}
    const targets = parsed.targets || ['website']
    const result = await publishArticle(id, targets)
    // 阶段二:发布成功自动发放贡献值(+10,UNIQUE 约束幂等,重复发布不重复加分)
    try {
      if (!result || result.ok !== false) {
        db.prepare("INSERT OR IGNORE INTO contribution_logs (user_id,user_name,points,type,ref_id,note) VALUES (?,?,?,?,?,?)")
          .run(article.author_id, article.author_name || '', 10, 'article_published', String(id), '文稿「' + article.title + '」发布奖励')
      }
    } catch (e) { console.warn('  ⚠ 发布贡献值发放失败:', e.message) }
    sendJSON(res, 200, { ok: true, ...result })
  } },

  // ───── 下架（未登录也是 403 专属文案） ─────
  { method: 'POST', pattern: '/api/articles/:id(\\d+)/unpublish', ...ADMIN_FORBID_MSG('仅管理员可下架'), handler: async (ctx, { res, params }) => {
    const { sendJSON, unpublishArticle } = ctx
    const id = parseInt(params.id)
    const result = await unpublishArticle(id)
    sendJSON(res, 200, { ok: true, ...result })
  } },

  // ───── 文稿详情（宽匹配：负向断言排除保留字，还原原子串排除语义） ─────
  { method: 'GET', pattern: '/api/articles/:id((?!check-sensitive$|stats$|reviews|versions|publish-logs)[^/]+)', ...USER, handler: async (ctx, { res, params, user }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id)
    if (isNaN(id)) { sendJSON(res, 404, { ok: false, message: '文稿不存在' }); return }
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id)
    if (!article) { sendJSON(res, 404, { ok: false, message: '文稿不存在' }); return }
    // 非管理员只能看自己的
    if (!user.is_admin && article.author_id !== user.id) {
      sendJSON(res, 403, { ok: false, message: '无权查看' }); return
    }
    sendJSON(res, 200, { ok: true, data: article })
  } },

  // ───── 更新文稿（宽匹配：负向断言排除 review/submit/publish 族保留字） ─────
  { method: 'PUT', pattern: '/api/articles/:id((?!review|submit|publish|unpublish)[^/]+)', ...USER, handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody } = ctx
    const id = parseInt(params.id)
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id)
    if (!article) { sendJSON(res, 404, { ok: false, message: '文稿不存在' }); return }
    if (article.author_id !== user.id && !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权操作' }); return }
    const body = await readBody(req, 5 * 1024 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const { title, content, summary, cover_image, category, review_level, scheduled_at, silent } = parsed
    // 状态检查：草稿/被退回可编辑；已过审(published_ready)仅允许设置/取消定时
    const onlySchedule = scheduled_at !== undefined && ['title', 'content', 'summary', 'cover_image', 'category', 'review_level', 'silent'].every(k => parsed[k] === undefined)
    if (!['draft', 'rejected'].includes(article.status) && !(onlySchedule && ['published_ready', 'scheduled'].includes(article.status))) {
      sendJSON(res, 400, { ok: false, message: '当前状态不可编辑' }); return
    }
    // 版本快照：距上次快照超过 5 分钟（或从未快照）时，把修改前的内容存一版
    if (title !== undefined || content !== undefined) {
      const lastVer = db.prepare('SELECT MAX(created_at) AS t FROM article_versions WHERE article_id = ?').get(id)
      const stale = !lastVer.t || (Date.now() - new Date(lastVer.t.replace(' ', 'T') + '+08:00').getTime() > 5 * 60 * 1000)
      if (stale) {
        db.prepare('INSERT INTO article_versions (article_id, title, content, summary, saved_by) VALUES (?,?,?,?,?)')
          .run(id, article.title, article.content, article.summary, user.id)
      }
    }
    const updates = []
    const args = []
    if (title !== undefined) { updates.push('title = ?'); args.push(title.trim()) }
    if (content !== undefined) { updates.push('content = ?'); args.push(sanitizeRichText(content)) }
    if (summary !== undefined) { updates.push('summary = ?'); args.push(summary) }
    if (cover_image !== undefined) { updates.push('cover_image = ?'); args.push(cover_image) }
    if (category !== undefined) { updates.push('category = ?'); args.push(category) }
    if (review_level !== undefined) { updates.push('review_level = ?'); args.push(review_level) }
    if (scheduled_at !== undefined && ['published_ready', 'scheduled'].includes(article.status)) {
      updates.push('scheduled_at = ?'); args.push(scheduled_at || '')
      if (scheduled_at) { updates.push("status = 'scheduled'") }
      else if (article.status === 'scheduled') { updates.push("status = 'published_ready'") }
    }
    updates.push("updated_at = datetime('now','localtime')")
    args.push(id)
    db.prepare(`UPDATE articles SET ${updates.join(', ')} WHERE id = ?`).run(...args)
    sendJSON(res, 200, { ok: true, message: silent ? '已自动保存' : '文稿已保存', savedAt: new Date().toTimeString().slice(0, 5) })
  } },

  // ───── 删除文稿（宽匹配：负向断言排除 reviews/publish-logs 子路径） ─────
  { method: 'DELETE', pattern: '/api/articles/:id((?!reviews|publish-logs)[^/]+)', ...USER, handler: async (ctx, { res, params, user }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id)
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id)
    if (!article) { sendJSON(res, 404, { ok: false, message: '文稿不存在' }); return }
    if (article.author_id !== user.id && !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权操作' }); return }
    if (article.status === 'published') { sendJSON(res, 400, { ok: false, message: '已发布的文稿不可删除，请先下架' }); return }
    // 先删子表再删主表:article_reviews/publish_logs/article_versions 有 FK 引用 articles,node:sqlite 默认强制外键
    // （article_versions 清理为批四顺带修复的存量缺陷：原实现漏删版本快照，"编辑后删除"必触发 FK 约束 500）
    db.prepare('DELETE FROM article_reviews WHERE article_id = ?').run(id)
    db.prepare('DELETE FROM publish_logs WHERE article_id = ?').run(id)
    db.prepare('DELETE FROM article_versions WHERE article_id = ?').run(id)
    db.prepare('DELETE FROM articles WHERE id = ?').run(id)
    sendJSON(res, 200, { ok: true, message: '文稿已删除' })
  } },

  // ───── 文稿列表 ─────
  { method: 'GET', pattern: '/api/articles', ...USER, handler: async (ctx, { req, res, url, user }) => {
    const { db, sendJSON, escapeLike } = ctx
    const sp = url.searchParams
    const status = sp.get('status') || ''
    const category = sp.get('category') || ''
    const authorId = sp.get('author_id') || ''
    const mine = sp.get('mine') === '1'
    const q = sp.get('q') || ''
    const page = Math.max(1, parseInt(sp.get('page') || '1'))
    const pageSize = Math.min(50, parseInt(sp.get('pageSize') || '20'))
    let where = []
    let args = []
    // 非管理员只能看自己的文稿（列表）；mine=1 时管理员也只看自己的
    if (!user.is_admin || mine) {
      where.push('author_id = ?')
      args.push(user.id)
    } else if (authorId) {
      where.push('author_id = ?')
      args.push(authorId)
    }
    if (status) { where.push('status = ?'); args.push(status) }
    if (category) { where.push('category = ?'); args.push(category) }
    if (q) { where.push('(title LIKE ? OR summary LIKE ?)'); args.push('%' + escapeLike(q) + '%', '%' + escapeLike(q) + '%') }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const total = db.prepare(`SELECT COUNT(*) c FROM articles ${whereClause}`).get(...args).c
    const rows = db.prepare(`SELECT * FROM articles ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...args, pageSize, (page - 1) * pageSize)
    sendJSON(res, 200, { ok: true, data: rows, total, page, pageSize })
  } },

  // ───── 创建文稿 ─────
  { method: 'POST', pattern: '/api/articles', ...USER, handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody, sensitiveFilter } = ctx
    const body = await readBody(req, 5 * 1024 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const { title, content, summary, category, cover_image } = parsed
    if (!title || !title.trim()) { sendJSON(res, 400, { ok: false, message: '标题不能为空' }); return }
    // 敏感词检查
    const fullText = (title || '') + ' ' + (content || '') + ' ' + (summary || '')
    const hits = sensitiveFilter.detect(fullText)
    if (hits.some(h => h.level === 'high')) {
      sendJSON(res, 400, { ok: false, message: '内容包含高级敏感词，无法创建', hits: hits.filter(h => h.level === 'high') })
      return
    }
    const result = db.prepare(`
      INSERT INTO articles (title, content, summary, cover_image, author_id, author_name, category, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')
    `).run(title.trim(), sanitizeRichText(content), summary || '', cover_image || '', user.id, user.name, category || 'news')
    sendJSON(res, 200, { ok: true, data: { id: result.lastInsertRowid }, message: '文稿草稿已创建' })
  } },

  // ───── 待审队列（未登录 401 / 学生 403 专属文案） ─────
  { method: 'GET', pattern: '/api/review-queue', ...ADMIN_MSG('仅管理员可查看'), handler: async (ctx, { res, url }) => {
    const { db, sendJSON } = ctx
    const sp = url.searchParams
    const status = sp.get('status') || ''
    let where = "WHERE a.status IN ('pending_l1','pending_l2','pending_l3')"
    let args = []
    if (status) { where = 'WHERE a.status = ?'; args = [status] }
    const rows = db.prepare(`
      SELECT a.*, u.name as author_name FROM articles a
      LEFT JOIN users u ON a.author_id = u.id
      ${where} ORDER BY a.updated_at ASC
    `).all(...args)
    sendJSON(res, 200, { ok: true, data: rows, total: rows.length })
  } },

  // ───── 审核统计 ─────
  { method: 'GET', pattern: '/api/admin/review-stats', ...ADMIN_FORBID, handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    const byStatus = db.prepare("SELECT status, COUNT(*) c FROM articles GROUP BY status").all()
    const total = db.prepare('SELECT COUNT(*) c FROM articles').get().c
    const approved = db.prepare("SELECT COUNT(*) c FROM article_reviews WHERE action = 'approve'").get().c
    const rejected = db.prepare("SELECT COUNT(*) c FROM article_reviews WHERE action = 'reject'").get().c
    const published = db.prepare("SELECT COUNT(*) c FROM articles WHERE status = 'published'").get().c
    // 社区 UGC 统计
    const blogPending = db.prepare("SELECT COUNT(*) c FROM blog_posts WHERE status = 'pending'").get().c
    const blogPublished = db.prepare("SELECT COUNT(*) c FROM blog_posts WHERE status = 'published'").get().c
    const forumPending = db.prepare("SELECT COUNT(*) c FROM forum_threads WHERE status = 'pending'").get().c
    const forumPublished = db.prepare("SELECT COUNT(*) c FROM forum_threads WHERE status = 'published'").get().c
    const wallPending = db.prepare("SELECT COUNT(*) c FROM wall_posts WHERE status = 'pending'").get().c
    const wallPublished = db.prepare("SELECT COUNT(*) c FROM wall_posts WHERE status = 'published'").get().c
    const blogCommentPending = db.prepare("SELECT COUNT(*) c FROM blog_comments WHERE status = 'pending'").get().c
    const forumReplyPending = db.prepare("SELECT COUNT(*) c FROM forum_replies WHERE status = 'pending'").get().c
    const communityPending = blogPending + forumPending + wallPending + blogCommentPending + forumReplyPending
    const communityPublished = blogPublished + forumPublished + wallPublished
    sendJSON(res, 200, { ok: true, data: {
      byStatus, total, approved, rejected, published,
      community: {
        blogPending, blogPublished,
        forumPending, forumPublished,
        wallPending, wallPublished,
        blogCommentPending, forumReplyPending,
        communityPending, communityPublished
      }
    } })
  } },

  // ───── 新媒体矩阵：账号列表 ─────
  { method: 'GET', pattern: '/api/media-accounts', ...USER, handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    const rows = db.prepare('SELECT * FROM media_accounts ORDER BY platform, registered_at DESC').all()
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 新媒体矩阵：新增账号 ─────
  { method: 'POST', pattern: '/api/admin/media-accounts', ...ADMIN_FORBID, handler: async (ctx, { req, res }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString('utf8')) } catch {}
    const { platform, account_name, account_id, owner_id, owner_name, department, qr_code } = parsed
    if (!platform || !account_name) { sendJSON(res, 400, { ok: false, message: '平台和账号名称不能为空' }); return }
    const result = db.prepare(`INSERT INTO media_accounts (platform, account_name, account_id, owner_id, owner_name, department, qr_code)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(platform, account_name, account_id || '', owner_id || '', owner_name || '', department || '', qr_code || '')
    sendJSON(res, 200, { ok: true, data: { id: result.lastInsertRowid }, message: '账号备案已添加' })
  } },

  // ───── 新媒体矩阵：编辑账号 ─────
  { method: 'PUT', pattern: '/api/admin/media-accounts/:id(\\d+)', ...ADMIN_FORBID, handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON, readBody } = ctx
    const id = parseInt(params.id)
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString('utf8')) } catch {}
    const { platform, account_name, account_id, owner_name, department, qr_code, status } = parsed
    db.prepare(`UPDATE media_accounts SET platform=?, account_name=?, account_id=?, owner_name=?, department=?, qr_code=?, status=? WHERE id=?`)
      .run(platform || '', account_name || '', account_id || '', owner_name || '', department || '', qr_code || '', status || 'active', id)
    sendJSON(res, 200, { ok: true, message: '账号信息已更新' })
  } },

  // ───── 新媒体矩阵：删除账号 ─────
  { method: 'DELETE', pattern: '/api/admin/media-accounts/:id(\\d+)', ...ADMIN_FORBID, handler: async (ctx, { res, params }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id)
    db.prepare('DELETE FROM media_accounts WHERE id = ?').run(id)
    sendJSON(res, 200, { ok: true, message: '账号备案已删除' })
  } },

  // ───── 敏感词库：列表 ─────
  { method: 'GET', pattern: '/api/sensitive-words', ...USER, handler: async (ctx, { res, url }) => {
    const { db, sendJSON } = ctx
    const sp = url.searchParams
    const level = sp.get('level') || ''
    const search = sp.get('q') || ''
    let where = '1=1'
    let args = []
    if (level) { where += ' AND level = ?'; args.push(level) }
    if (search) { where += ' AND word LIKE ?'; args.push('%' + search + '%') }
    const rows = db.prepare(`SELECT * FROM sensitive_words WHERE ${where} ORDER BY CASE level WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, word`).all(...args)
    sendJSON(res, 200, { ok: true, data: rows, total: rows.length })
  } },

  // ───── 敏感词库：批量导入 ─────
  { method: 'POST', pattern: '/api/admin/sensitive-words/import', ...ADMIN_FORBID, handler: async (ctx, { req, res }) => {
    const { db, sendJSON, readBody, reloadFilter } = ctx
    const body = await readBody(req, 1 * 1024 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString('utf8')) } catch {}
    const text = parsed.text || ''
    const defaultLevel = parsed.level || 'medium'
    const lines = text.split(/[\n,，;；]/).map(s => s.trim()).filter(Boolean)
    let added = 0, skipped = 0
    const ins = db.prepare('INSERT OR IGNORE INTO sensitive_words (word,level,category,replacement) VALUES (?,?,?,?)')
    for (const line of lines) {
      const r = ins.run(line, defaultLevel, '', '')
      if (r.changes > 0) added++
      else skipped++
    }
    if (added > 0) reloadFilter()
    sendJSON(res, 200, { ok: true, message: `批量导入完成：新增 ${added} 条，跳过 ${skipped} 条重复` })
  } },
]

const dispatch = require('./router')(routes)

module.exports = async function routesArticles(ctx, req, res, p, method, url) {
  const { db } = ctx
  // ───── 定时发布惰性流转：到点的 scheduled 文稿自动转 published（原样保留，每次请求先执行） ─────
  try {
    const due = db.prepare("SELECT id, publish_targets FROM articles WHERE status = 'scheduled' AND scheduled_at != '' AND scheduled_at <= datetime('now','localtime')").all()
    if (due.length) {
      const insertLog = db.prepare('INSERT INTO publish_logs (article_id, platform, status, error_msg) VALUES (?, ?, ?, ?)')
      for (const a of due) {
        let targets = []
        try { targets = JSON.parse(a.publish_targets || '[]') } catch (e) {}
        if (!Array.isArray(targets) || !targets.length) targets = ['website']
        for (const platform of targets) {
          insertLog.run(a.id, platform, 'pending', '定时发布自动流转（待手动推送到平台）')
        }
        db.prepare("UPDATE articles SET status = 'published', published_at = datetime('now','localtime') WHERE id = ?").run(a.id)
      }
      console.log('  ⏰ 定时发布流转: ' + due.length + ' 篇文稿已自动发布并记录推送日志')
    }
  } catch (e) { console.warn('  ⚠ 定时发布流转异常:', e.message) }
  return dispatch(ctx, req, res, p, method, url)
}
