'use strict'
// 公开读域 API（P2 批四自 server.js 本体拆出：health/colleges/stats/leaderboard/tags/home-bundle）
// 迁移原则：handler 体业务逻辑零改动；仍挂载于 server.js try 保护区原位，500 兜底不变。
// 语义说明：原 health 分支不限请求方法（任意方法均 200）；本表收窄为 GET
//（nginx 探活/监控/前端全部使用 GET，无其他方法调用方）。

// 权限唯一口径：与 lib/router.js 的 staffRoleOf 逐字一致（is_admin 与 role 双轨在此统一）
function staffRoleOf(user) {
  if (!user) return 'student'
  if (user.is_admin || user.role === 'admin') return 'admin'
  if (['editor', 'reviewer', 'reporter'].includes(user.role)) return user.role
  return 'student'
}

const routes = [
  // ───── 健康检查 ─────
  { method: 'GET', pattern: '/api/health', handler: async (ctx, { res }) => {
    const { sendJSON } = ctx
    sendJSON(res, 200, { ok: true, status: 'up', time: new Date().toISOString() })
  } },
  { method: 'GET', pattern: '/health', handler: async (ctx, { res }) => {
    const { sendJSON } = ctx
    sendJSON(res, 200, { ok: true, status: 'up', time: new Date().toISOString() })
  } },

  // ───── 学院列表 ─────
  { method: 'GET', pattern: '/api/colleges', handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    const rows = db.prepare('SELECT * FROM colleges').all()
    const countStmt = db.prepare("SELECT COUNT(*) c FROM materials WHERE college = ? AND status IN ('approved','published')")
    const data = rows.map(c => ({ ...c, material_count: countStmt.get(c.name).c }))
    sendJSON(res, 200, { ok: true, data })
  } },

  // ───── 全站统计（轻量） ─────
  { method: 'GET', pattern: '/api/stats', handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    const matCount = db.prepare("SELECT COUNT(*) c FROM materials WHERE status = 'published'").get().c
    const dlRow = db.prepare("SELECT COALESCE(SUM(downloads),0) s FROM materials WHERE status = 'published'").get()
    const collegeCount = db.prepare('SELECT COUNT(*) c FROM colleges').get().c
    sendJSON(res, 200, { ok: true, data: { materials: matCount, downloads: dlRow.s, colleges: collegeCount } })
  } },

  // ───── 贡献排行榜（近 7 天上传 TOP，为空回退全量；游客上传不计入） ─────
  { method: 'GET', pattern: '/api/stats/leaderboard', handler: async (ctx, { res, url }) => {
    const { db, sendJSON } = ctx
    const limit = Math.min(10, Math.max(1, parseInt(url.searchParams.get('limit')) || 5))
    const SQL_AGG = `SELECT MAX(author) AS author, COUNT(*) AS uploads, COALESCE(SUM(downloads),0) AS downloads
      FROM materials WHERE status IN ('approved','published') AND author_id IS NOT NULL AND %WHERE% AND created_at >= ?
      GROUP BY author_id ORDER BY uploads DESC, downloads DESC LIMIT ?`
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
    let rows = db.prepare(SQL_AGG.replace('%WHERE%', '1=1')).all(weekAgo, limit)
    let scope = 'weekly'
    if (!rows.length) { rows = db.prepare(SQL_AGG.replace('%WHERE%', '1=1')).all('1970-01-01', limit); scope = 'alltime' }
    sendJSON(res, 200, { ok: true, data: rows, scope })
  } },

  // ───── 标签库（预设 + 统计，P0-3 改为标签表 JOIN 计数） ─────
  { method: 'GET', pattern: '/api/tags', handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    const preset = ['校园','风景','活动','运动会','迎新晚会','毕业季','军训','社团','讲座','比赛','志愿服务','社会实践','课堂','实验','实训','校园建筑','图书馆','操场','食堂','宿舍','校园风光','航拍','夜景','延时摄影','Vlog','宣传片','空镜','转场','课件','论文','笔记','模板','报告','教案','策划案','脚本','配乐','音效','旁白','现场录音']
    const freq = {}
    db.prepare(`
      SELECT t.name AS tag, COUNT(m.id) AS cnt
      FROM tags t
      LEFT JOIN asset_tags at ON at.tag_id = t.id
      LEFT JOIN materials m ON m.id = at.material_id AND m.status IN ('approved','published')
      GROUP BY t.id
    `).all().forEach(r => { freq[r.tag] = r.cnt })
    preset.forEach(t => { if(!freq[t]) freq[t]=0 })
    const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).map(([tag,count])=>({tag,count}))
    sendJSON(res, 200, { ok: true, data: sorted })
  } },

  // ───── 首页聚合数据（P1 性能：一次请求替代 stats/tags/home-gallery/colleges/activities/leaderboard/类型计数 共 12 次调用） ─────
  { method: 'GET', pattern: '/api/home-bundle', handler: async (ctx, { req, res }) => {
    const { db, sendJSON, authUser } = ctx
    const user = authUser(req)
    const visSql = staffRoleOf(user) === 'admin' ? "status IN ('approved','published')" : "status = 'published'"
    const matCount = db.prepare(`SELECT COUNT(*) c FROM materials WHERE ${visSql}`).get().c
    const dlRow = db.prepare(`SELECT COALESCE(SUM(downloads),0) s FROM materials WHERE ${visSql}`).get()
    const collegeCount = db.prepare('SELECT COUNT(*) c FROM colleges').get().c
    const typeCounts = {}
    db.prepare(`SELECT type, COUNT(*) c FROM materials WHERE ${visSql} GROUP BY type`).all().forEach(r => { typeCounts[r.type] = r.c })
    const preset = ['校园','风景','活动','运动会','迎新晚会','毕业季','军训','社团','讲座','比赛','志愿服务','社会实践','课堂','实验','实训','校园建筑','图书馆','操场','食堂','宿舍','校园风光','航拍','夜景','延时摄影','Vlog','宣传片','空镜','转场','课件','论文','笔记','模板','报告','教案','策划案','脚本','配乐','音效','旁白','现场录音']
    const freq = {}
    db.prepare(`
      SELECT t.name AS tag, COUNT(m.id) AS cnt
      FROM tags t
      LEFT JOIN asset_tags at ON at.tag_id = t.id
      LEFT JOIN materials m ON m.id = at.material_id AND m.status IN ('approved','published')
      GROUP BY t.id
    `).all().forEach(r => { freq[r.tag] = r.cnt })
    preset.forEach(t => { if(!freq[t]) freq[t]=0 })
    const tags = Object.entries(freq).sort((a,b)=>b[1]-a[1]).map(([tag,count])=>({tag,count}))
    const cntStmt = db.prepare("SELECT COUNT(*) c FROM materials WHERE college = ? AND status IN ('approved','published')")
    const dlStmt = db.prepare("SELECT COALESCE(SUM(downloads),0) s FROM materials WHERE college = ? AND status IN ('approved','published')")
    const collegeData = db.prepare('SELECT * FROM colleges').all().map(c => ({ ...c, material_count: cntStmt.get(c.name).c, downloads: dlStmt.get(c.name).s }))
    const gallery = db.prepare('SELECT id,image,title,wide,tall,sort_order FROM home_gallery WHERE is_visible=1 ORDER BY sort_order, id').all()
    const SQL_AGG = `SELECT MAX(author) AS author, COUNT(*) AS uploads, COALESCE(SUM(downloads),0) AS downloads
      FROM materials WHERE status IN ('approved','published') AND author_id IS NOT NULL AND created_at >= ?
      GROUP BY author_id ORDER BY uploads DESC, downloads DESC LIMIT 5`
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
    let leaderboard = db.prepare(SQL_AGG).all(weekAgo)
    let leaderboardScope = 'weekly'
    if (!leaderboard.length) { leaderboard = db.prepare(SQL_AGG).all('1970-01-01'); leaderboardScope = 'alltime' }
    const myJoins = user ? db.prepare('SELECT activity_id, status FROM activity_joins WHERE user_id = ?').all(user.id) : []
    const joinMap = {}
    myJoins.forEach(j => { joinMap[j.activity_id] = j.status })
    const regStmt = db.prepare("SELECT COUNT(*) c FROM activity_joins WHERE activity_id = ? AND status = 'registered'")
    const activities = db.prepare('SELECT * FROM activities ORDER BY id DESC').all().map(a => ({ ...a, registered_count: regStmt.get(a.id).c, my_status: joinMap[a.id] || null }))
    const collections = db.prepare(`
      SELECT c.id, c.title, c.description, c.color, COUNT(ci.material_id) AS item_count
      FROM collections c LEFT JOIN collection_items ci ON ci.collection_id = c.id
      WHERE c.is_visible = 1 GROUP BY c.id ORDER BY item_count DESC, c.id DESC LIMIT 6
    `).all()
    sendJSON(res, 200, { ok: true, data: { stats: { materials: matCount, downloads: dlRow.s, colleges: collegeCount }, typeCounts, tags, colleges: collegeData, gallery, leaderboard, leaderboardScope, activities, collections } })
  } },
]

const dispatch = require('./router')(routes)

module.exports = async function routesPublic(ctx, req, res, p, method, url) {
  return dispatch(ctx, req, res, p, method, url)
}
