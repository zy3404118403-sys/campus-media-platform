'use strict'
// 校园社区 API v3.1（P2 路由表化：28 条 if 链 → 声明式路由表）
// 迁移原则：handler 体业务逻辑零改动；仅 auth 检查收口到路由表闸门、
//          路径参数 p.split('/') 手工解析改 params.*、401/403 文案原样保留。

// 隐私脱敏：公开响应一律不外泄 author_id（学号）；匿名内容连 author_name 一并隐藏
// （管理端/本人数据接口不走此函数，不受影响）
function maskIdentity(rows) {
  const one = (o) => {
    if (!o || typeof o !== 'object') return o
    if ('author_id' in o) delete o.author_id
    if (o.is_anonymous && 'author_name' in o) o.author_name = '匿名同学'
    return o
  }
  return Array.isArray(rows) ? rows.map(one) : one(rows)
}

// 管理端点角色闸门：还原原 staffRole 语义（admin/editor/reviewer 可过，reporter 与学生被拒）
// unauthAction:'forbid'：未登录返回 403 '无权限'（原 if 链 staffRole(null)==='student' 语义）
const STAFF = 'staff:admin,editor,reviewer'
const MSG_401 = '请先登录'
const MSG_403 = '无权限'
const USER = { auth: 'user', unauthorizedMessage: MSG_401 }
const ADMIN_GUARD = { auth: STAFF, unauthorizedMessage: MSG_401, forbiddenMessage: MSG_403, unauthAction: 'forbid' }

const routes = [
  // ───── 博客：博文列表 ─────
  { method: 'GET', pattern: '/api/blog/posts', handler: async (ctx, { req, res, url }) => {
    const { db, sendJSON } = ctx
    const sp = url.searchParams
    const category = sp.get('category') || ''
    const search = sp.get('q') || ''
    const page = Math.max(1, parseInt(sp.get('page')) || 1)
    const limit = Math.min(50, parseInt(sp.get('limit')) || 10)
    let where = "status = 'published'"
    let params = []
    if (category) { where += ' AND category = ?'; params.push(category) }
    if (search) { where += ' AND (title LIKE ? OR content LIKE ?)'; params.push('%' + search + '%', '%' + search + '%') }
    const total = db.prepare(`SELECT COUNT(*) c FROM blog_posts WHERE ${where}`).get(...params).c
    const rows = db.prepare(`SELECT id,author_id,author_name,title,summary,category,tags,cover_image,views,likes,comments,created_at FROM blog_posts WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit)
    sendJSON(res, 200, { ok: true, data: maskIdentity(rows), total, page, limit })
  } },

  // ───── 博客：发布博文 ─────
  { method: 'POST', pattern: '/api/blog/posts', ...USER, handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody, sensitiveFilter } = ctx
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { title, content, summary, category, tags, cover_image } = JSON.parse(body.toString() || '{}')
    if (!title || !content) { sendJSON(res, 400, { ok: false, message: '标题和内容不能为空' }); return }
    if (sensitiveFilter.hasAny(title + content)) { sendJSON(res, 400, { ok: false, message: '内容包含敏感词，请修改后重试' }); return }
    // 封面自动提取：未显式指定封面时，取正文首个 <img> 作为封面
    let cover = cover_image || ''
    if (!cover) {
      const m = String(content).match(/<img[^>]*src=["']([^"']+)["']/i)
      if (m) cover = m[1]
    }
    const result = db.prepare('INSERT INTO blog_posts (author_id,author_name,title,content,summary,category,tags,cover_image,status) VALUES (?,?,?,?,?,?,?,?,?)').run(user.id, user.name, title, content, summary || content.slice(0, 200), category || 'campus', JSON.stringify(tags || []), cover, 'pending')
    sendJSON(res, 200, { ok: true, id: result.lastInsertRowid, message: '博文已提交，等待审核' })
  } },

  // ───── 博客：博文详情 ─────
  { method: 'GET', pattern: '/api/blog/posts/:id(\\d+)', handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id, 10)
    const post = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id)
    if (!post || post.status !== 'published') { sendJSON(res, 404, { ok: false, message: '博文不存在' }); return }
    db.prepare('UPDATE blog_posts SET views = views + 1 WHERE id = ?').run(id)
    const comments = db.prepare("SELECT * FROM blog_comments WHERE post_id = ? AND status = 'approved' ORDER BY id DESC").all(id)
    sendJSON(res, 200, { ok: true, data: maskIdentity({ ...post, views: post.views + 1 }), comments: maskIdentity(comments) })
  } },

  // ───── 博客：点赞 ─────
  { method: 'POST', pattern: '/api/blog/posts/:id(\\d+)/like', ...USER, handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id, 10)
    const exist = db.prepare('SELECT 1 FROM blog_likes WHERE post_id = ? AND user_id = ?').get(id, user.id)
    if (exist) {
      db.prepare('DELETE FROM blog_likes WHERE post_id = ? AND user_id = ?').run(id, user.id)
      db.prepare('UPDATE blog_posts SET likes = MAX(0, likes - 1) WHERE id = ?').run(id)
      sendJSON(res, 200, { ok: true, liked: false })
    } else {
      db.prepare('INSERT INTO blog_likes (post_id, user_id) VALUES (?,?)').run(id, user.id)
      db.prepare('UPDATE blog_posts SET likes = likes + 1 WHERE id = ?').run(id)
      sendJSON(res, 200, { ok: true, liked: true })
    }
  } },

  // ───── 博客：评论 ─────
  { method: 'POST', pattern: '/api/blog/posts/:id(\\d+)/comment', ...USER, handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody, sensitiveFilter } = ctx
    const id = parseInt(params.id, 10)
    const post = db.prepare('SELECT author_id, title FROM blog_posts WHERE id = ?').get(id)
    if (!post) { sendJSON(res, 404, { ok: false, message: '博文不存在' }); return }
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { content } = JSON.parse(body.toString() || '{}')
    if (!content || !content.trim()) { sendJSON(res, 400, { ok: false, message: '评论内容不能为空' }); return }
    if (sensitiveFilter.hasAny(content.trim())) { sendJSON(res, 400, { ok: false, message: '评论包含敏感词，请修改后重试' }); return }
    db.prepare('INSERT INTO blog_comments (post_id,author_id,author_name,content,status) VALUES (?,?,?,?,?)').run(id, user.id, user.name, content.trim(), 'approved')
    db.prepare('UPDATE blog_posts SET comments = comments + 1 WHERE id = ?').run(id)
    try { if (post.author_id !== user.id) db.prepare('INSERT INTO community_notifications (user_id,type,actor_id,actor_name,target_type,target_id,target_title) VALUES (?,?,?,?,?,?,?)').run(post.author_id, 'blog_comment', user.id, user.name, 'blog', id, post.title) } catch (e) {}
    sendJSON(res, 200, { ok: true, message: '评论成功', data: { author_name: user.name } })
  } },

  // ───── 关注/取消关注 ─────
  { method: 'POST', pattern: '/api/follow', ...USER, handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { targetId, type } = JSON.parse(body.toString() || '{}')
    if (!targetId || user.id === targetId) { sendJSON(res, 400, { ok: false, message: '无效的关注目标' }); return }
    const exist = db.prepare('SELECT 1 FROM user_follows WHERE follower_id = ? AND followee_id = ? AND type = ?').get(user.id, targetId, type || 'user')
    if (exist) {
      db.prepare('DELETE FROM user_follows WHERE follower_id = ? AND followee_id = ? AND type = ?').run(user.id, targetId, type || 'user')
      sendJSON(res, 200, { ok: true, following: false })
    } else {
      db.prepare('INSERT INTO user_follows (follower_id,followee_id,type) VALUES (?,?,?)').run(user.id, targetId, type || 'user')
      sendJSON(res, 200, { ok: true, following: true })
    }
  } },

  // ───── 全站搜索 ─────
  { method: 'GET', pattern: '/api/search', handler: async (ctx, { res, url }) => {
    const { db, sendJSON } = ctx
    const q = url.searchParams.get('q') || ''
    const type = url.searchParams.get('type') || 'all'
    if (!q.trim()) { sendJSON(res, 200, { ok: true, data: [] }); return }
    const kw = '%' + q.trim() + '%'
    const results = []
    if (type === 'all' || type === 'blog') {
      try {
        const blogs = db.prepare('SELECT id, title, summary, content, author_name FROM blog_posts WHERE status = ? AND (title LIKE ? OR content LIKE ?) ORDER BY id DESC LIMIT 20').all('published', kw, kw)
        blogs.forEach(b => results.push({ type: 'blog', id: b.id, title: b.title, content: b.summary || (b.content || '').slice(0, 200) }))
      } catch (e) {}
    }
    if (type === 'all' || type === 'forum') {
      try {
        const threads = db.prepare("SELECT id, title, content FROM forum_threads WHERE status = 'published' AND (title LIKE ? OR content LIKE ?) ORDER BY id DESC LIMIT 20").all(kw, kw)
        threads.forEach(t => results.push({ type: 'forum', id: t.id, title: t.title, content: t.content }))
      } catch (e) {}
    }
    if (type === 'all' || type === 'wall') {
      try {
        const walls = db.prepare('SELECT id, content, tag FROM wall_posts WHERE status = ? AND content LIKE ? ORDER BY id DESC LIMIT 20').all('published', kw)
        walls.forEach(w => results.push({ type: 'wall', id: w.id, title: w.tag, content: w.content }))
      } catch (e) {}
    }
    sendJSON(res, 200, { ok: true, data: results })
  } },

  // ───── 论坛：版块列表 ─────
  { method: 'GET', pattern: '/api/forum/boards', handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    const boards = db.prepare('SELECT * FROM forum_boards ORDER BY sort_order ASC').all()
    sendJSON(res, 200, { ok: true, data: boards })
  } },

  // ───── 论坛：版块帖子列表 ─────
  { method: 'GET', pattern: '/api/forum/boards/:id(\\d+)/threads', handler: async (ctx, { res, params, url }) => {
    const { db, sendJSON } = ctx
    const boardId = parseInt(params.id, 10)
    const sp = url.searchParams
    const search = sp.get('q') || ''
    const sort = sp.get('sort') || 'latest'
    const page = Math.max(1, parseInt(sp.get('page')) || 1)
    const limit = Math.min(50, parseInt(sp.get('limit')) || 20)
    let where = "board_id = ? AND status = 'published'"
    let paramsQ = [boardId]
    if (search) { where += ' AND (title LIKE ? OR content LIKE ?)'; paramsQ.push('%' + search + '%', '%' + search + '%') }
    const total = db.prepare(`SELECT COUNT(*) c FROM forum_threads WHERE ${where}`).get(...paramsQ).c
    let orderBy = 'is_pinned DESC, id DESC'
    if (sort === 'reply') orderBy = 'is_pinned DESC, COALESCE(last_reply_at, created_at) DESC, id DESC'
    else if (sort === 'hot') orderBy = 'is_pinned DESC, (views + replies * 3) DESC, id DESC'
    const rows = db.prepare(`SELECT * FROM forum_threads WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...paramsQ, limit, (page - 1) * limit)
    sendJSON(res, 200, { ok: true, data: maskIdentity(rows), total, page, limit })
  } },

  // ───── 论坛：发帖 ─────
  { method: 'POST', pattern: '/api/forum/threads', ...USER, handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody, sensitiveFilter } = ctx
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { boardId, title, content, isAnonymous, poll } = JSON.parse(body.toString() || '{}')
    if (!boardId || !title || !content) { sendJSON(res, 400, { ok: false, message: '版块、标题和内容不能为空' }); return }
    const board = db.prepare('SELECT * FROM forum_boards WHERE id = ?').get(boardId)
    if (!board) { sendJSON(res, 404, { ok: false, message: '版块不存在' }); return }
    if (sensitiveFilter.hasAny(content)) { sendJSON(res, 400, { ok: false, message: '内容包含敏感词，请修改后重试' }); return }
    let pollData = null
    if (poll && typeof poll === 'object') {
      const q = (poll.question || '').toString().trim()
      const opts = Array.isArray(poll.options) ? poll.options.map((o) => (o || '').toString().trim()).filter(Boolean) : []
      if (!q) { sendJSON(res, 400, { ok: false, message: '投票问题不能为空' }); return }
      if (q.length > 100) { sendJSON(res, 400, { ok: false, message: '投票问题不能超过100字' }); return }
      if (opts.length < 2) { sendJSON(res, 400, { ok: false, message: '投票至少需要2个选项' }); return }
      if (opts.length > 10) { sendJSON(res, 400, { ok: false, message: '投票选项最多10个' }); return }
      if (opts.some((o) => o.length > 50)) { sendJSON(res, 400, { ok: false, message: '投票选项不能超过50字' }); return }
      if (sensitiveFilter.hasAny(q + ' ' + opts.join(' '))) { sendJSON(res, 400, { ok: false, message: '投票内容包含敏感词，请修改后重试' }); return }
      pollData = { question: q, options: opts, allowMultiple: !!poll.allowMultiple }
    }
    const anon = isAnonymous && board.is_anonymous ? 1 : 0
    const result = db.prepare('INSERT INTO forum_threads (board_id,author_id,author_name,title,content,is_anonymous,status) VALUES (?,?,?,?,?,?,?)').run(boardId, user.id, user.name, title, content, anon, 'pending')
    if (pollData) {
      db.prepare('INSERT INTO forum_polls (thread_id,question,options,allow_multiple,created_by) VALUES (?,?,?,?,?)')
        .run(result.lastInsertRowid, pollData.question, JSON.stringify(pollData.options), pollData.allowMultiple ? 1 : 0, user.id)
    }
    db.prepare('UPDATE forum_boards SET post_count = post_count + 1 WHERE id = ?').run(boardId)
    sendJSON(res, 200, { ok: true, id: result.lastInsertRowid, message: '帖子已提交，等待审核' })
  } },

  // ───── 论坛：帖子详情 ─────
  { method: 'GET', pattern: '/api/forum/threads/:id(\\d+)', handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON, authUser, buildPollData } = ctx
    const id = parseInt(params.id, 10)
    const thread = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id)
    if (!thread || thread.status !== 'published') { sendJSON(res, 404, { ok: false, message: '帖子不存在' }); return }
    db.prepare('UPDATE forum_threads SET views = views + 1 WHERE id = ?').run(id)
    const replies = db.prepare("SELECT * FROM forum_replies WHERE thread_id = ? AND status = 'approved' ORDER BY id ASC").all(id)
    const pollRow = db.prepare('SELECT * FROM forum_polls WHERE thread_id = ?').get(id)
    const poll = pollRow ? buildPollData(pollRow, authUser(req)) : null
    sendJSON(res, 200, { ok: true, data: maskIdentity({ ...thread, views: thread.views + 1, poll }), replies: maskIdentity(replies) })
  } },

  // ───── 论坛：投票（原 requireAuth 语义 = 纯 authUser+401，文案保留原样） ─────
  { method: 'POST', pattern: '/api/forum/threads/:id(\\d+)/poll/vote', auth: 'user', unauthorizedMessage: '未登录或登录已过期', handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody, buildPollData } = ctx
    const id = parseInt(params.id, 10)
    const thread = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id)
    if (!thread || thread.status !== 'published') { sendJSON(res, 404, { ok: false, message: '帖子不存在' }); return }
    const pollRow = db.prepare('SELECT * FROM forum_polls WHERE thread_id = ?').get(id)
    if (!pollRow) { sendJSON(res, 404, { ok: false, message: '该帖子没有投票' }); return }
    const body = await readBody(req, 16 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString() || '{}') } catch { parsed = {} }
    let idxs = Array.isArray(parsed.optionIndexes)
      ? [...new Set(parsed.optionIndexes.map(Number).filter((n) => Number.isInteger(n)))]
      : []
    const optCount = JSON.parse(pollRow.options).length
    if (!idxs.length || idxs.some((i) => i < 0 || i >= optCount)) { sendJSON(res, 400, { ok: false, message: '无效的投票选项' }); return }
    if (!pollRow.allow_multiple && idxs.length > 1) { sendJSON(res, 400, { ok: false, message: '该投票为单选，只能选择一项' }); return }
    const existing = db.prepare('SELECT option_index FROM forum_poll_votes WHERE thread_id = ? AND user_id = ?').all(id, user.id)
    if (existing.length) { sendJSON(res, 200, { ok: true, already: true, message: '你已经投过票了', poll: buildPollData(pollRow, user) }); return }
    const ins = db.prepare('INSERT INTO forum_poll_votes (thread_id,user_id,option_index) VALUES (?,?,?)')
    for (const i of idxs) ins.run(id, user.id, i)
    sendJSON(res, 200, { ok: true, message: '投票成功', poll: buildPollData(pollRow, user) })
  } },

  // ───── 论坛：回复帖子 ─────
  { method: 'POST', pattern: '/api/forum/threads/:id(\\d+)/replies', ...USER, handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody, sensitiveFilter } = ctx
    const id = parseInt(params.id, 10)
    const thread = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id)
    if (!thread) { sendJSON(res, 404, { ok: false, message: '帖子不存在' }); return }
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { content, parentReplyId, isAnonymous } = JSON.parse(body.toString() || '{}')
    if (!content || !content.trim()) { sendJSON(res, 400, { ok: false, message: '回复内容不能为空' }); return }
    if (sensitiveFilter.hasAny(content.trim())) { sendJSON(res, 400, { ok: false, message: '回复包含敏感词，请修改后重试' }); return }
    const board = db.prepare('SELECT * FROM forum_boards WHERE id = ?').get(thread.board_id)
    const anon = isAnonymous && board && board.is_anonymous ? 1 : 0
    db.prepare('INSERT INTO forum_replies (thread_id,author_id,author_name,content,parent_reply_id,is_anonymous,status) VALUES (?,?,?,?,?,?,?)').run(id, user.id, user.name, content.trim(), parentReplyId || null, anon, 'approved')
    db.prepare("UPDATE forum_threads SET replies = replies + 1, last_reply_at = datetime('now','localtime') WHERE id = ?").run(id)
    try { if (thread.author_id !== user.id) db.prepare('INSERT INTO community_notifications (user_id,type,actor_id,actor_name,target_type,target_id,target_title) VALUES (?,?,?,?,?,?,?)').run(thread.author_id, 'forum_reply', user.id, user.name, 'forum', id, thread.title) } catch (e) {}
    sendJSON(res, 200, { ok: true, message: '回复成功', data: { id: db.prepare('SELECT last_insert_rowid() as id').get().id, author_name: anon ? '匿名' : user.name, is_anonymous: anon } })
  } },

  // ───── 校园墙：瀑布流 ─────
  { method: 'GET', pattern: '/api/wall/posts', handler: async (ctx, { res, url }) => {
    const { db, sendJSON } = ctx
    const sp = url.searchParams
    const tag = sp.get('tag') || ''
    const sort = sp.get('sort') || 'latest'
    const page = Math.max(1, parseInt(sp.get('page')) || 1)
    const limit = Math.min(50, parseInt(sp.get('limit')) || 20)
    let where = "status = 'published'"
    let params = []
    if (tag) { where += ' AND tag = ?'; params.push(tag) }
    let orderBy = 'id DESC'
    if (sort === 'hot') orderBy = 'likes DESC, id DESC'
    const total = db.prepare(`SELECT COUNT(*) c FROM wall_posts WHERE ${where}`).get(...params).c
    const rows = db.prepare(`SELECT * FROM wall_posts WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit)
    sendJSON(res, 200, { ok: true, data: maskIdentity(rows), total, page, limit })
  } },

  // ───── 校园墙：发布墙贴 ─────
  { method: 'POST', pattern: '/api/wall/posts', ...USER, handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody, sensitiveFilter } = ctx
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { content, images, isAnonymous, tag, emotion } = JSON.parse(body.toString() || '{}')
    if (!content || !content.trim()) { sendJSON(res, 400, { ok: false, message: '内容不能为空' }); return }
    if (content.length > 200) { sendJSON(res, 400, { ok: false, message: '墙贴内容不能超过200字' }); return }
    if (sensitiveFilter.hasAny(content.trim())) { sendJSON(res, 400, { ok: false, message: '内容包含敏感词，请修改后重试' }); return }
    const result = db.prepare('INSERT INTO wall_posts (author_id,author_name,content,images,is_anonymous,tag,emotion,status) VALUES (?,?,?,?,?,?,?,?)').run(user.id, user.name, content.trim(), JSON.stringify(images || []), isAnonymous ? 1 : 0, tag || '分享', emotion || '', 'pending')
    sendJSON(res, 200, { ok: true, id: result.lastInsertRowid, message: '墙贴已提交，等待审核' })
  } },

  // ───── 校园墙：点赞 ─────
  { method: 'POST', pattern: '/api/wall/posts/:id(\\d+)/like', ...USER, handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id, 10)
    const exist = db.prepare('SELECT 1 FROM wall_likes WHERE post_id = ? AND user_id = ?').get(id, user.id)
    if (exist) {
      db.prepare('DELETE FROM wall_likes WHERE post_id = ? AND user_id = ?').run(id, user.id)
      db.prepare('UPDATE wall_posts SET likes = MAX(0, likes - 1) WHERE id = ?').run(id)
      sendJSON(res, 200, { ok: true, liked: false })
    } else {
      db.prepare('INSERT INTO wall_likes (post_id, user_id) VALUES (?,?)').run(id, user.id)
      db.prepare('UPDATE wall_posts SET likes = likes + 1 WHERE id = ?').run(id)
      sendJSON(res, 200, { ok: true, liked: true })
    }
  } },

  // ───── 校园墙：评论列表 ─────
  { method: 'GET', pattern: '/api/wall/posts/:id(\\d+)/comments', handler: async (ctx, { res, params }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id, 10)
    const rows = db.prepare("SELECT id, author_id, author_name, content, is_anonymous, created_at FROM wall_comments WHERE post_id = ? AND status = 'approved' ORDER BY id DESC").all(id)
    sendJSON(res, 200, { ok: true, data: maskIdentity(rows) })
  } },

  // ───── 校园墙：发表评论 ─────
  { method: 'POST', pattern: '/api/wall/posts/:id(\\d+)/comments', ...USER, handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody, sensitiveFilter } = ctx
    const id = parseInt(params.id, 10)
    const post = db.prepare('SELECT id FROM wall_posts WHERE id = ?').get(id)
    if (!post) { sendJSON(res, 404, { ok: false, message: '墙贴不存在或已删除' }); return }
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { content, isAnonymous } = JSON.parse(body.toString() || '{}')
    if (!content || !content.trim()) { sendJSON(res, 400, { ok: false, message: '评论内容不能为空' }); return }
    if (content.length > 200) { sendJSON(res, 400, { ok: false, message: '评论不能超过200字' }); return }
    if (sensitiveFilter.hasAny(content.trim())) { sendJSON(res, 400, { ok: false, message: '评论包含敏感词，请修改后重试' }); return }
    const name = isAnonymous ? '匿名同学' : user.name
    db.prepare('INSERT INTO wall_comments (post_id,author_id,author_name,content,is_anonymous,status) VALUES (?,?,?,?,?,?)').run(id, user.id, name, content.trim(), isAnonymous ? 1 : 0, 'approved')
    db.prepare('UPDATE wall_posts SET comments = comments + 1 WHERE id = ?').run(id)
    sendJSON(res, 200, { ok: true, message: '评论已发布' })
  } },

  // ───── 举报内容 ─────
  { method: 'POST', pattern: '/api/report', ...USER, handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { targetType, targetId, reason } = JSON.parse(body.toString() || '{}')
    if (!targetType || !targetId) { sendJSON(res, 400, { ok: false, message: '缺少举报目标' }); return }
    const validTypes = ['blog', 'thread', 'reply', 'wall']
    if (!validTypes.includes(targetType)) { sendJSON(res, 400, { ok: false, message: '无效的举报类型' }); return }
    db.prepare('INSERT INTO content_reports (reporter_id,reporter_name,target_type,target_id,reason,status) VALUES (?,?,?,?,?,?)').run(user.id, user.name, targetType, targetId, reason || '', 'pending')
    sendJSON(res, 200, { ok: true, message: '举报已提交，管理员将尽快处理' })
  } },

  // ───── 管理员：举报队列 ─────
  { method: 'GET', pattern: '/api/admin/reports', ...ADMIN_GUARD, handler: async (ctx, { res, url }) => {
    const { db, sendJSON } = ctx
    const sp = url.searchParams
    const status = sp.get('status') || 'pending'
    const rows = db.prepare('SELECT * FROM content_reports WHERE status = ? ORDER BY id DESC').all(status)
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 管理员：处理举报 ─────
  { method: 'POST', pattern: '/api/admin/reports/:id(\\d+)', ...ADMIN_GUARD, handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody } = ctx
    const id = parseInt(params.id, 10)
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { action } = JSON.parse(body.toString() || '{}')
    if (!['handled', 'dismissed'].includes(action)) { sendJSON(res, 400, { ok: false, message: '无效操作' }); return }
    db.prepare('UPDATE content_reports SET status = ?, handled_by = ? WHERE id = ?').run(action, user.id, id)
    sendJSON(res, 200, { ok: true, message: '举报已处理' })
  } },

  // ───── 管理员：UGC审核队列 ─────
  { method: 'GET', pattern: '/api/admin/ugc-review', ...ADMIN_GUARD, handler: async (ctx, { res, url }) => {
    const { db, sendJSON } = ctx
    const sp = url.searchParams
    const type = sp.get('type') || 'all'
    let data = {}
    if (type === 'all' || type === 'blog') data.blog = db.prepare("SELECT id,author_name,title,created_at FROM blog_posts WHERE status = 'pending' ORDER BY id DESC").all()
    if (type === 'all' || type === 'thread') data.threads = db.prepare("SELECT id,author_name,title,board_id,created_at FROM forum_threads WHERE status = 'pending' ORDER BY id DESC").all()
    if (type === 'all' || type === 'wall') data.wall = db.prepare("SELECT id,author_name,content,images,tag,created_at FROM wall_posts WHERE status = 'pending' ORDER BY id DESC").all()
    if (type === 'all' || type === 'comment') data.comments = db.prepare("SELECT id,author_name,content,post_id,created_at FROM blog_comments WHERE status = 'pending' ORDER BY id DESC").all()
    sendJSON(res, 200, { ok: true, data })
  } },

  // ───── 管理员：审核UGC内容 ─────
  { method: 'POST', pattern: '/api/admin/ugc-review', ...ADMIN_GUARD, handler: async (ctx, { req, res }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { type, id, action } = JSON.parse(body.toString() || '{}')
    if (!type || !id || !action) { sendJSON(res, 400, { ok: false, message: '缺少参数' }); return }
    if (!['approve', 'reject'].includes(action)) { sendJSON(res, 400, { ok: false, message: '无效操作' }); return }
    const tableMap = { blog: 'blog_posts', thread: 'forum_threads', wall: 'wall_posts', comment: 'blog_comments' }
    const table = tableMap[type]
    if (!table) { sendJSON(res, 400, { ok: false, message: '无效类型' }); return }
    const newStatus = action === 'approve' ? (type === 'comment' ? 'approved' : 'published') : 'rejected'
    db.prepare(`UPDATE ${table} SET status = ? WHERE id = ?`).run(newStatus, id)
    sendJSON(res, 200, { ok: true, message: action === 'approve' ? '已通过' : '已拒绝' })
  } },

  // ───── 管理员：论坛管理（置顶/删除） ─────
  { method: 'POST', pattern: '/api/admin/forum/threads/:id(\\d+)', ...ADMIN_GUARD, handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON, readBody } = ctx
    const id = parseInt(params.id, 10)
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { action } = JSON.parse(body.toString() || '{}')
    if (action === 'pin') { db.prepare('UPDATE forum_threads SET is_pinned = 1 WHERE id = ?').run(id); sendJSON(res, 200, { ok: true, message: '已置顶' }); return }
    if (action === 'unpin') { db.prepare('UPDATE forum_threads SET is_pinned = 0 WHERE id = ?').run(id); sendJSON(res, 200, { ok: true, message: '已取消置顶' }); return }
    if (action === 'delete') { db.prepare('UPDATE forum_threads SET status = ? WHERE id = ?').run('deleted', id); sendJSON(res, 200, { ok: true, message: '已删除' }); return }
    sendJSON(res, 400, { ok: false, message: '无效操作' })
  } },

  // ───── 管理员：校园墙管理（精选/删除） ─────
  { method: 'POST', pattern: '/api/admin/wall/posts/:id(\\d+)', ...ADMIN_GUARD, handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON, readBody } = ctx
    const id = parseInt(params.id, 10)
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { action } = JSON.parse(body.toString() || '{}')
    if (action === 'feature') { db.prepare('UPDATE wall_posts SET is_featured = 1 WHERE id = ?').run(id); sendJSON(res, 200, { ok: true, message: '已设为精选' }); return }
    if (action === 'unfeature') { db.prepare('UPDATE wall_posts SET is_featured = 0 WHERE id = ?').run(id); sendJSON(res, 200, { ok: true, message: '已取消精选' }); return }
    if (action === 'delete') { db.prepare('UPDATE wall_posts SET status = ? WHERE id = ?').run('deleted', id); sendJSON(res, 200, { ok: true, message: '已删除' }); return }
    sendJSON(res, 400, { ok: false, message: '无效操作' })
  } },

  // ───── 管理员：全部论坛帖子 ─────
  { method: 'GET', pattern: '/api/admin/forum/threads', ...ADMIN_GUARD, handler: async (ctx, { res, url }) => {
    const { db, sendJSON } = ctx
    const sp = url.searchParams
    const page = Math.max(1, parseInt(sp.get('page')) || 1)
    const limit = Math.min(100, parseInt(sp.get('limit')) || 50)
    const total = db.prepare("SELECT COUNT(*) c FROM forum_threads WHERE status != 'deleted'").get().c
    const rows = db.prepare("SELECT t.*, b.name AS board_name FROM forum_threads t LEFT JOIN forum_boards b ON t.board_id = b.id WHERE t.status != 'deleted' ORDER BY t.is_pinned DESC, t.id DESC LIMIT ? OFFSET ?").all(limit, (page - 1) * limit)
    sendJSON(res, 200, { ok: true, data: rows, total, page, limit })
  } },

  // ───── 管理员：社区通知列表 ─────
  { method: 'GET', pattern: '/api/admin/notifications', ...ADMIN_GUARD, handler: async (ctx, { res, url }) => {
    const { db, sendJSON } = ctx
    const sp = url.searchParams
    const page = Math.max(1, parseInt(sp.get('page')) || 1)
    const limit = Math.min(100, parseInt(sp.get('limit')) || 50)
    const total = db.prepare('SELECT COUNT(*) c FROM community_notifications').get().c
    const rows = db.prepare('SELECT n.*, u.name AS recipient_name FROM community_notifications n LEFT JOIN users u ON n.user_id = u.id ORDER BY n.id DESC LIMIT ? OFFSET ?').all(limit, (page - 1) * limit)
    sendJSON(res, 200, { ok: true, data: rows, total, page, limit })
  } },

  // ───── 管理员：删除社区通知 ─────
  { method: 'DELETE', pattern: '/api/admin/notifications/:id(\\d+)', ...ADMIN_GUARD, handler: async (ctx, { res, params }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id, 10)
    db.prepare('DELETE FROM community_notifications WHERE id = ?').run(id)
    sendJSON(res, 200, { ok: true, message: '通知已删除' })
  } },
]

const dispatch = require('./router')(routes)

module.exports = async function routesCommunity(ctx, req, res, p, method, url) {
  return dispatch(ctx, req, res, p, method, url)
}
