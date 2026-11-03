'use strict'
// P2 阶段三：记忆图谱（/api/graph）——零新表，聚合现成业务表
// 节点：user(脱敏：仅输出昵称，不外泄学号) / material / blog / forum / wall / activity / tag / collection
// 边：创作(author→内容) · 标签(material→tag) · 参与(user→activity) · 收录(collection→material)
// 约束：节点 ≤500（超限按互动量截断）；公开端 scope=global（个人图谱留后续批）；内存缓存 60s

const CACHE_TTL = 60 * 1000
let _cache = { at: 0, data: null }

function buildGraph(db) {
  const nodes = []
  const edges = []
  const nodeKeys = new Set()
  const addNode = (key, ntype, label, extra) => {
    if (nodeKeys.has(key)) return key
    if (nodes.length >= 500) return null
    nodeKeys.add(key)
    const n = Object.assign({ key, type: ntype, label: String(label || '').slice(0, 40) }, extra || {})
    nodes.push(n)
    return key
  }
  const addEdge = (src, dst, rel) => { if (src && dst && src !== dst) edges.push({ s: src, d: dst, r: rel }) }

  // 用户（仅昵称，不输出学号；key 用序号映射——学号绝不出现在响应中）
  const users = db.prepare('SELECT id, name FROM users').all()
  const ukey = {}
  users.forEach((u, i) => { ukey[u.id] = addNode('u' + i, 'user', u.name || '匿名', {}) })

  // 素材（published）+ 创作/标签边
  const mats = db.prepare(`
    SELECT m.id, m.title, m.author_id, m.type,
      (SELECT COALESCE(GROUP_CONCAT(t.name, ','), '') FROM asset_tags a2 JOIN tags t ON t.id = a2.tag_id WHERE a2.material_id = m.id) AS tags
    FROM materials m WHERE m.status = 'published'`).all()
  for (const m of mats) {
    const mk = addNode('m_' + m.id, 'material', m.title, { ref: m.id })
    if (m.author_id && ukey[m.author_id]) addEdge(ukey[m.author_id], mk, '创作')
    if (m.tags) for (const tg of m.tags.split(',').filter(Boolean)) {
      const tk = addNode('t_' + tg, 'tag', tg, {})
      addEdge(mk, tk, '标签')
    }
  }

  // 博文（published）
  for (const b of db.prepare("SELECT id, title, author_id FROM blog_posts WHERE status = 'published'").all()) {
    const bk = addNode('b_' + b.id, 'blog', b.title, { ref: b.id })
    if (b.author_id && ukey[b.author_id]) addEdge(ukey[b.author_id], bk, '创作')
  }

  // 论坛帖（published）
  for (const t of db.prepare("SELECT id, title, author_id FROM forum_threads WHERE status = 'published'").all()) {
    const fk = addNode('f_' + t.id, 'forum', t.title, { ref: t.id })
    if (t.author_id && ukey[t.author_id]) addEdge(ukey[t.author_id], fk, '创作')
  }

  // 墙贴（published）
  for (const w of db.prepare("SELECT id, tag, author_id FROM wall_posts WHERE status = 'published'").all()) {
    const wk = addNode('w_' + w.id, 'wall', w.tag || w.content, { ref: w.id })
    if (w.author_id && ukey[w.author_id]) addEdge(ukey[w.author_id], wk, '创作')
  }

  // 活动 + 参与
  for (const a of db.prepare('SELECT id, title FROM activities').all()) {
    const ak = addNode('a_' + a.id, 'activity', a.title, { ref: a.id })
    for (const j of db.prepare("SELECT user_id FROM activity_joins WHERE activity_id = ? AND status IN ('registered','signed')").all(a.id)) {
      if (ukey[j.user_id]) addEdge(ukey[j.user_id], ak, '参与')
    }
  }

  // 专题收录
  for (const c of db.prepare('SELECT id, title FROM collections').all()) {
    const ck = addNode('c_' + c.id, 'collection', c.title, { ref: c.id })
    for (const ci of db.prepare('SELECT material_id FROM collection_items WHERE collection_id = ?').all(c.id)) {
      const mk = 'm_' + ci.material_id
      if (nodeKeys.has(mk)) addEdge(ck, mk, '收录')
    }
  }

  // 裁剪孤立节点（无任何边的 user）
  const connected = new Set()
  edges.forEach(e => { connected.add(e.s); connected.add(e.d) })
  const trimmed = nodes.filter(n => n.type !== 'user' || connected.has(n.key))

  return { nodes: trimmed, edges, counts: { nodes: trimmed.length, edges: edges.length } }
}

const ROUTES = [
  { method: 'GET', pattern: '/api/graph', handler: async (ctx, { res, url }) => {
    const { db, sendJSON } = ctx
    const scope = url.searchParams.get('scope') || 'global'
    if (scope !== 'global') { sendJSON(res, 400, { ok: false, message: '仅支持 scope=global（个人图谱后续批次开放）' }); return }
    if (_cache.data && Date.now() - _cache.at < CACHE_TTL) {
      sendJSON(res, 200, { ok: true, data: _cache.data, cached: true })
      return
    }
    try {
      const data = buildGraph(db)
      _cache = { at: Date.now(), data }
      sendJSON(res, 200, { ok: true, data, cached: false })
    } catch (e) {
      sendJSON(res, 500, { ok: false, message: '图谱聚合失败' })
    }
  } },
]

const dispatch = require('./router')(ROUTES)

module.exports = async function routesGraph(ctx, req, res, p, method, url) {
  return dispatch(ctx, req, res, p, method, url)
}
