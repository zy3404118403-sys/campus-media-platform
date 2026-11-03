'use strict'
// 个人中心域 API（P2 批八收官自 server.js 本体拆出：17 条 → 声明式路由表）
// 迁移原则：handler 体业务逻辑零改动；auth 收口到路由表闸门。
// auth 要点：本域原 if 链 401 文案为「请先登录」（非 requireAuth 的「未登录或登录已过期」），
//          统一声明 USER_P = { auth:'user', unauthorizedMessage:'请先登录' }。
//          blog/forum/wall 编辑删除的业务级 403（无权操作）留 handler。
// 机械适配：路径参数原 handler 用 decodeURIComponent(p.split('/').pop()) 二次解码——
//          路由表分发器已统一 decodeURIComponent，直接用 params.*（避免二次解码对含 % 值 throw）。
// 挂载顺序：在 routesCommunity 之后（blog/forum/wall 的 GET/POST 由社区域处理，
//          本模块仅承接其未覆盖的 PUT/DELETE——方法不同天然无冲突）。

const fs = require('fs')
const path = require('path')

// 本域 401 文案（原 if 链逐字）
const USER_P = { auth: 'user', unauthorizedMessage: '请先登录' }

const routes = [
  // ───── 个人中心：用户资料 + 统计 ─────
  { method: 'GET', pattern: '/api/user/profile', ...USER_P, handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON } = ctx
    const blogCount = db.prepare('SELECT COUNT(*) as c FROM blog_posts WHERE author_id = ?').get(user.id)
    const forumCount = db.prepare('SELECT COUNT(*) as c FROM forum_threads WHERE author_id = ?').get(user.id)
    const wallCount = db.prepare('SELECT COUNT(*) as c FROM wall_posts WHERE author_id = ?').get(user.id)
    const commentCount = db.prepare('SELECT COUNT(*) as c FROM blog_comments WHERE author_id = ?').get(user.id)
    const replyCount = db.prepare('SELECT COUNT(*) as c FROM forum_replies WHERE author_id = ?').get(user.id)
    const likeCount = db.prepare('SELECT COUNT(*) as c FROM blog_likes WHERE user_id = ?').get(user.id)
    const followCount = db.prepare('SELECT COUNT(*) as c FROM user_follows WHERE follower_id = ?').get(user.id)
    const unreadNotif = db.prepare('SELECT COUNT(*) as c FROM community_notifications WHERE user_id = ? AND is_read = 0').get(user.id)
    sendJSON(res, 200, { ok: true, data: { user: { id: user.id, name: user.name }, stats: { blog: blogCount.c, forum: forumCount.c, wall: wallCount.c, comments: commentCount.c, replies: replyCount.c, likes: likeCount.c, follows: followCount.c, unreadNotifications: unreadNotif.c } } })
  } },

  // ───── 个人中心：我的发布 ─────
  { method: 'GET', pattern: '/api/user/my-posts', ...USER_P, handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON } = ctx
    const sp = new URL(req.url, 'http://localhost').searchParams
    const type = sp.get('type') || 'blog'
    let rows = []
    if (type === 'blog') {
      rows = db.prepare('SELECT id, title, content, summary, category, views, likes, comments, status, created_at FROM blog_posts WHERE author_id = ? ORDER BY id DESC LIMIT 50').all(user.id)
    } else if (type === 'forum') {
      rows = db.prepare('SELECT id, title, content, views, replies, status, created_at FROM forum_threads WHERE author_id = ? ORDER BY id DESC LIMIT 50').all(user.id)
    } else if (type === 'wall') {
      rows = db.prepare('SELECT id, content, tag, likes, status, created_at FROM wall_posts WHERE author_id = ? ORDER BY id DESC LIMIT 50').all(user.id)
    }
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 社区通知：列表 ─────
  { method: 'GET', pattern: '/api/community/notifications', ...USER_P, handler: async (ctx, { res, user }) => {
    const { db, sendJSON } = ctx
    const rows = db.prepare('SELECT * FROM community_notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(user.id)
    const unread = db.prepare('SELECT COUNT(*) as c FROM community_notifications WHERE user_id = ? AND is_read = 0').get(user.id)
    sendJSON(res, 200, { ok: true, data: rows, unread: unread.c })
  } },

  // ───── 社区通知：全部已读 ─────
  { method: 'POST', pattern: '/api/community/notifications/read-all', ...USER_P, handler: async (ctx, { res, user }) => {
    const { db, sendJSON } = ctx
    db.prepare('UPDATE community_notifications SET is_read = 1 WHERE user_id = ?').run(user.id)
    sendJSON(res, 200, { ok: true, message: '全部已读' })
  } },

  // ───── 站内私信：会话列表 ─────
  { method: 'GET', pattern: '/api/messages/conversations', ...USER_P, handler: async (ctx, { res, user }) => {
    const { db, sendJSON } = ctx
    const rows = db.prepare(`
      SELECT m.*,
             CASE WHEN m.from_id = ? THEN m.to_id ELSE m.from_id END AS partner_id,
             (SELECT name FROM users WHERE id = CASE WHEN m.from_id = ? THEN m.to_id ELSE m.from_id END) AS partner_name,
             (SELECT avatar FROM users WHERE id = CASE WHEN m.from_id = ? THEN m.to_id ELSE m.from_id END) AS partner_avatar
      FROM private_messages m
      WHERE m.id IN (
        SELECT MAX(id) FROM private_messages
        WHERE from_id = ? OR to_id = ?
        GROUP BY CASE WHEN from_id = ? THEN to_id ELSE from_id END
      )
      ORDER BY m.created_at DESC
    `).all(user.id, user.id, user.id, user.id, user.id, user.id)
    const unreadByPartner = {}
    db.prepare('SELECT from_id, COUNT(*) as c FROM private_messages WHERE to_id = ? AND is_read = 0 GROUP BY from_id').all(user.id).forEach(r => { unreadByPartner[r.from_id] = r.c })
    rows.forEach(r => { r.unread = unreadByPartner[r.partner_id] || 0 })
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 站内私信：未读数 ─────
  { method: 'GET', pattern: '/api/messages/unread-count', ...USER_P, handler: async (ctx, { res, user }) => {
    const { db, sendJSON } = ctx
    const row = db.prepare('SELECT COUNT(*) as c FROM private_messages WHERE to_id = ? AND is_read = 0').get(user.id)
    sendJSON(res, 200, { ok: true, count: row.c })
  } },

  // ───── 站内私信：获取聊天记录 ─────
  { method: 'GET', pattern: '/api/messages/chat/:partner([^/]+)', ...USER_P, handler: async (ctx, { res, params, user }) => {
    const { db, sendJSON } = ctx
    const partnerId = params.partner
    if (!partnerId) { sendJSON(res, 400, { ok: false, message: '缺少对方ID' }); return }
    const partner = db.prepare('SELECT id, name, avatar FROM users WHERE id = ?').get(partnerId)
    if (!partner) { sendJSON(res, 404, { ok: false, message: '用户不存在' }); return }
    const rows = db.prepare(`
      SELECT * FROM private_messages
      WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
      ORDER BY created_at ASC LIMIT 200
    `).all(user.id, partnerId, partnerId, user.id)
    sendJSON(res, 200, { ok: true, data: rows, partner })
  } },

  // ───── 站内私信：发送消息 ─────
  { method: 'POST', pattern: '/api/messages/send', ...USER_P, handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody, sensitiveFilter } = ctx
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const { toId, content } = parsed
    const toIdStr = String(toId || '').trim()
    const contentStr = String(content || '').trim()
    if (!toIdStr || !contentStr) { sendJSON(res, 400, { ok: false, message: '缺少接收人或内容' }); return }
    if (toIdStr === user.id) { sendJSON(res, 400, { ok: false, message: '不能给自己发私信' }); return }
    if (contentStr.length > 1000) { sendJSON(res, 400, { ok: false, message: '消息不能超过1000字' }); return }
    const recipient = db.prepare('SELECT id FROM users WHERE id = ?').get(toIdStr)
    if (!recipient) { sendJSON(res, 404, { ok: false, message: '接收人不存在' }); return }
    if (sensitiveFilter.hasAny(contentStr)) { sendJSON(res, 400, { ok: false, message: '消息包含敏感词，请修改后重试' }); return }
    const info = db.prepare('INSERT INTO private_messages (from_id, to_id, content) VALUES (?, ?, ?)').run(user.id, toIdStr, contentStr)
    sendJSON(res, 200, { ok: true, message: '发送成功', data: { id: info.lastInsertRowid, from_id: user.id, to_id: toIdStr, content: contentStr, created_at: new Date().toISOString() } })
  } },

  // ───── 站内私信：标记已读 ─────
  { method: 'POST', pattern: '/api/messages/read/:partner([^/]+)', ...USER_P, handler: async (ctx, { res, params, user }) => {
    const { db, sendJSON } = ctx
    const partnerId = params.partner
    db.prepare('UPDATE private_messages SET is_read = 1 WHERE to_id = ? AND from_id = ? AND is_read = 0').run(user.id, partnerId)
    sendJSON(res, 200, { ok: true, message: '已读' })
  } },

  // ───── 图片上传（base64 → 文件，墙贴/博文共用） ─────
  { method: 'POST', pattern: '/api/wall/upload-image', ...USER_P, handler: (ctx, o) => uploadImage(ctx, o, 'wall') },
  { method: 'POST', pattern: '/api/blog/upload-image', ...USER_P, handler: (ctx, o) => uploadImage(ctx, o, 'blog') },

  // ───── 个人中心：编辑博文（业务 403 留 handler；编辑后回 pending 重审） ─────
  { method: 'PUT', pattern: '/api/blog/posts/:id(\\d+)', ...USER_P, handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody, sensitiveFilter } = ctx
    const id = parseInt(params.id)
    const post = db.prepare('SELECT author_id, status FROM blog_posts WHERE id = ?').get(id)
    if (!post) { sendJSON(res, 404, { ok: false, message: '博文不存在' }); return }
    if (post.author_id !== user.id && !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权操作' }); return }
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { title, content, summary, category } = JSON.parse(body.toString() || '{}')
    if (!title || !content) { sendJSON(res, 400, { ok: false, message: '标题和内容不能为空' }); return }
    if (sensitiveFilter.hasAny(title + content)) { sendJSON(res, 400, { ok: false, message: '内容包含敏感词，请修改后重试' }); return }
    // 封面自动提取：编辑后旧封面可能失效，正文有图且旧封面为空时回填
    let cover = ''
    const mCover = String(content).match(/<img[^>]*src=["']([^"']+)["']/i)
    if (mCover) cover = mCover[1]
    else cover = db.prepare('SELECT cover_image FROM blog_posts WHERE id = ?').get(id).cover_image || ''
    db.prepare('UPDATE blog_posts SET title = ?, content = ?, summary = ?, category = ?, cover_image = ?, status = ? WHERE id = ?').run(title, content, summary || content.slice(0, 200), category || 'campus', cover, 'pending', id)
    sendJSON(res, 200, { ok: true, message: '博文已更新，等待重新审核' })
  } },

  // ───── 个人中心：删除博文 ─────
  { method: 'DELETE', pattern: '/api/blog/posts/:id(\\d+)', ...USER_P, handler: async (ctx, { res, params, user }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id)
    const post = db.prepare('SELECT author_id FROM blog_posts WHERE id = ?').get(id)
    if (!post) { sendJSON(res, 404, { ok: false, message: '博文不存在' }); return }
    if (post.author_id !== user.id && !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权操作' }); return }
    // 先删子表再删主表:blog_comments 有 FK 引用 blog_posts,node:sqlite 默认强制外键
    db.prepare('DELETE FROM blog_comments WHERE post_id = ?').run(id)
    db.prepare('DELETE FROM blog_likes WHERE post_id = ?').run(id)
    db.prepare('DELETE FROM blog_posts WHERE id = ?').run(id)
    sendJSON(res, 200, { ok: true, message: '博文已删除' })
  } },

  // ───── 个人中心：编辑帖子 ─────
  { method: 'PUT', pattern: '/api/forum/threads/:id(\\d+)', ...USER_P, handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody, sensitiveFilter } = ctx
    const id = parseInt(params.id)
    const thread = db.prepare('SELECT author_id, status FROM forum_threads WHERE id = ?').get(id)
    if (!thread) { sendJSON(res, 404, { ok: false, message: '帖子不存在' }); return }
    if (thread.author_id !== user.id && !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权操作' }); return }
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { title, content } = JSON.parse(body.toString() || '{}')
    if (!title || !content) { sendJSON(res, 400, { ok: false, message: '标题和内容不能为空' }); return }
    if (sensitiveFilter.hasAny(title + content)) { sendJSON(res, 400, { ok: false, message: '内容包含敏感词，请修改后重试' }); return }
    db.prepare('UPDATE forum_threads SET title = ?, content = ?, status = ? WHERE id = ?').run(title, content, 'pending', id)
    sendJSON(res, 200, { ok: true, message: '帖子已更新，等待重新审核' })
  } },

  // ───── 个人中心：删除帖子 ─────
  { method: 'DELETE', pattern: '/api/forum/threads/:id(\\d+)', ...USER_P, handler: async (ctx, { res, params, user }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id)
    const thread = db.prepare('SELECT author_id, board_id FROM forum_threads WHERE id = ?').get(id)
    if (!thread) { sendJSON(res, 404, { ok: false, message: '帖子不存在' }); return }
    if (thread.author_id !== user.id && !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权操作' }); return }
    // 先删子表再删主表:forum_replies 有 FK 引用 forum_threads,node:sqlite 默认强制外键
    db.prepare('DELETE FROM forum_replies WHERE thread_id = ?').run(id)
    db.prepare('DELETE FROM forum_poll_votes WHERE thread_id = ?').run(id)
    db.prepare('DELETE FROM forum_polls WHERE thread_id = ?').run(id)
    db.prepare('DELETE FROM forum_threads WHERE id = ?').run(id)
    db.prepare('UPDATE forum_boards SET post_count = MAX(0, post_count - 1) WHERE id = ?').run(thread.board_id)
    sendJSON(res, 200, { ok: true, message: '帖子已删除' })
  } },

  // ───── 个人中心：编辑墙贴 ─────
  { method: 'PUT', pattern: '/api/wall/posts/:id(\\d+)', ...USER_P, handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody, sensitiveFilter } = ctx
    const id = parseInt(params.id)
    const wp = db.prepare('SELECT author_id FROM wall_posts WHERE id = ?').get(id)
    if (!wp) { sendJSON(res, 404, { ok: false, message: '墙贴不存在' }); return }
    if (wp.author_id !== user.id && !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权操作' }); return }
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { content, tag } = JSON.parse(body.toString() || '{}')
    if (!content || !content.trim()) { sendJSON(res, 400, { ok: false, message: '内容不能为空' }); return }
    if (content.length > 200) { sendJSON(res, 400, { ok: false, message: '墙贴内容不能超过200字' }); return }
    if (sensitiveFilter.hasAny(content.trim())) { sendJSON(res, 400, { ok: false, message: '内容包含敏感词，请修改后重试' }); return }
    db.prepare('UPDATE wall_posts SET content = ?, tag = ?, status = ? WHERE id = ?').run(content.trim(), tag || '分享', 'pending', id)
    sendJSON(res, 200, { ok: true, message: '墙贴已更新，等待重新审核' })
  } },

  // ───── 个人中心：删除墙贴 ─────
  { method: 'DELETE', pattern: '/api/wall/posts/:id(\\d+)', ...USER_P, handler: async (ctx, { res, params, user }) => {
    const { db, sendJSON } = ctx
    const id = parseInt(params.id)
    const wp = db.prepare('SELECT author_id FROM wall_posts WHERE id = ?').get(id)
    if (!wp) { sendJSON(res, 404, { ok: false, message: '墙贴不存在' }); return }
    if (wp.author_id !== user.id && !user.is_admin) { sendJSON(res, 403, { ok: false, message: '无权操作' }); return }
    db.prepare('DELETE FROM wall_posts WHERE id = ?').run(id)
    db.prepare('DELETE FROM wall_likes WHERE post_id = ?').run(id)
    sendJSON(res, 200, { ok: true, message: '墙贴已删除' })
  } },
]

// base64 图片上传 handler（墙贴/博文两条路由共用；写入 public/uploads）
function uploadImage(ctx, { req, res }, kind) {
  const { sendJSON, readBody, PUBLIC_DIR } = ctx
  return (async () => {
    const body = await readBody(req).catch(() => Buffer.alloc(0))
    const { image } = JSON.parse(body.toString() || '{}')
    if (!image || !image.startsWith('data:image/')) { sendJSON(res, 400, { ok: false, message: '无效的图片数据' }); return }
    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) { sendJSON(res, 400, { ok: false, message: '图片格式错误' }); return }
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
    if (!['jpg', 'png', 'gif', 'webp'].includes(ext)) { sendJSON(res, 400, { ok: false, message: '仅支持 jpg/png/gif/webp 格式' }); return }
    const buffer = Buffer.from(matches[2], 'base64')
    if (buffer.length > 8 * 1024 * 1024) { sendJSON(res, 400, { ok: false, message: '图片不能超过8MB' }); return }
    const uploadsDir = path.join(PUBLIC_DIR, 'uploads')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
    const filename = kind + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext
    fs.writeFileSync(path.join(uploadsDir, filename), buffer)
    sendJSON(res, 200, { ok: true, url: '/uploads/' + filename })
  })()
}

const dispatch = require('./router')(routes)

module.exports = async function routesUser(ctx, req, res, p, method, url) {
  return dispatch(ctx, req, res, p, method, url)
}
