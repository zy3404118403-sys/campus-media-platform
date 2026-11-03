'use strict'
// 专题系统 API（P2 批七自 server.js 本体拆出：7 条 → 声明式路由表）
// 迁移原则：handler 体业务逻辑零改动；旧守卫收口到路由表闸门（默认文案逐字一致）。
// ctx 复用 MATERIALS_CTX（含 materialPublic——专题详情素材脱敏/字段白名单沿用）。

const routes = [
  // ───── 专题列表(公开；管理员可 all=1 查全部) ─────
  { method: 'GET', pattern: '/api/collections', handler: async (ctx, { req, res, url }) => {
    const { db, sendJSON, authUser } = ctx
    const viewer = authUser(req)
    const showAll = url.searchParams.get('all') === '1' && viewer && viewer.is_admin
    const rows = db.prepare(`
      SELECT c.*, COUNT(ci.material_id) AS item_count
      FROM collections c LEFT JOIN collection_items ci ON ci.collection_id = c.id
      ${showAll ? '' : 'WHERE c.is_visible = 1'}
      GROUP BY c.id ORDER BY c.id DESC
    `).all()
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 专题详情(公开，含素材) ─────
  { method: 'GET', pattern: '/api/collections/:id(\\d+)', handler: async (ctx, { res, params }) => {
    const { db, sendJSON, materialPublic } = ctx
    const cid = parseInt(params.id)
    const c = db.prepare('SELECT * FROM collections WHERE id = ? AND is_visible = 1').get(cid)
    if (!c) { sendJSON(res, 404, { ok: false, message: '专题不存在' }); return }
    const items = db.prepare(`
      SELECT m.* FROM collection_items ci JOIN materials m ON m.id = ci.material_id
      WHERE ci.collection_id = ? AND m.status IN ('published','approved')
      ORDER BY ci.added_at DESC
    `).all(cid).map(materialPublic)
    const total = db.prepare('SELECT COUNT(*) c FROM collection_items WHERE collection_id = ?').get(cid).c
    sendJSON(res, 200, { ok: true, data: { ...c, item_total: total, items } })
  } },

  // ───── 专题新建(editor/admin) ─────
  { method: 'POST', pattern: '/api/collections', auth: 'staff:editor', handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req, 16 * 1024).catch(() => Buffer.alloc(0))
    const { title, description, color } = JSON.parse(body.toString() || '{}')
    if (!title || !title.trim()) { sendJSON(res, 400, { ok: false, message: '专题标题不能为空' }); return }
    if (title.length > 60) { sendJSON(res, 400, { ok: false, message: '标题不能超过 60 字' }); return }
    const result = db.prepare('INSERT INTO collections (title,description,color,created_by) VALUES (?,?,?,?)')
      .run(title.trim(), (description || '').trim(), /^#[0-9A-Fa-f]{6}$/.test(color || '') ? color : '#1D3A6B', user.id)
    sendJSON(res, 200, { ok: true, id: result.lastInsertRowid, message: '专题已创建' })
  } },

  // ───── 专题编辑(editor/admin) ─────
  { method: 'PUT', pattern: '/api/collections/:id(\\d+)', auth: 'staff:editor', handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON, readBody } = ctx
    const cid = parseInt(params.id)
    const c = db.prepare('SELECT * FROM collections WHERE id = ?').get(cid)
    if (!c) { sendJSON(res, 404, { ok: false, message: '专题不存在' }); return }
    const body = await readBody(req, 16 * 1024).catch(() => Buffer.alloc(0))
    const { title, description, color, isVisible } = JSON.parse(body.toString() || '{}')
    const t = title && title.trim() ? title.trim() : c.title
    if (t.length > 60) { sendJSON(res, 400, { ok: false, message: '标题不能超过 60 字' }); return }
    const col = /^#[0-9A-Fa-f]{6}$/.test(color || '') ? color : c.color
    db.prepare('UPDATE collections SET title=?, description=?, color=?, is_visible=? WHERE id=?')
      .run(t, description != null ? String(description).trim().slice(0, 300) : c.description, col, isVisible === 0 ? 0 : (isVisible === 1 ? 1 : c.is_visible), cid)
    sendJSON(res, 200, { ok: true, message: '专题已更新' })
  } },

  // ───── 专题删除(editor/admin，级联移除关联) ─────
  { method: 'DELETE', pattern: '/api/collections/:id(\\d+)', auth: 'staff:editor', handler: async (ctx, { res, params }) => {
    const { db, sendJSON } = ctx
    const cid = parseInt(params.id)
    db.prepare('DELETE FROM collection_items WHERE collection_id = ?').run(cid)
    db.prepare('DELETE FROM collections WHERE id = ?').run(cid)
    sendJSON(res, 200, { ok: true, message: '专题已删除' })
  } },

  // ───── 专题加入素材(editor/admin) ─────
  { method: 'POST', pattern: '/api/collections/:id(\\d+)/items', auth: 'staff:editor', handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody } = ctx
    const cid = parseInt(params.id)
    const c = db.prepare('SELECT id FROM collections WHERE id = ?').get(cid)
    if (!c) { sendJSON(res, 404, { ok: false, message: '专题不存在' }); return }
    const body = await readBody(req, 8 * 1024).catch(() => Buffer.alloc(0))
    const { material_id } = JSON.parse(body.toString() || '{}')
    const mid = Number(material_id)
    const m = db.prepare("SELECT id, status FROM materials WHERE id = ?").get(mid)
    if (!m) { sendJSON(res, 404, { ok: false, message: '素材不存在' }); return }
    if (!['published', 'approved'].includes(m.status)) { sendJSON(res, 400, { ok: false, message: '仅审核通过或已发布的素材可加入专题' }); return }
    const dup = db.prepare('SELECT 1 FROM collection_items WHERE collection_id = ? AND material_id = ?').get(cid, mid)
    if (dup) { sendJSON(res, 400, { ok: false, message: '该素材已在此专题中' }); return }
    db.prepare('INSERT INTO collection_items (collection_id, material_id, added_by) VALUES (?,?,?)').run(cid, mid, user.id)
    sendJSON(res, 200, { ok: true, message: '素材已加入专题' })
  } },

  // ───── 专题移除素材(editor/admin) ─────
  { method: 'DELETE', pattern: '/api/collections/:id(\\d+)/items/:mid(\\d+)', auth: 'staff:editor', handler: async (ctx, { res, params }) => {
    const { db, sendJSON } = ctx
    db.prepare('DELETE FROM collection_items WHERE collection_id = ? AND material_id = ?').run(parseInt(params.id), parseInt(params.mid))
    sendJSON(res, 200, { ok: true, message: '已移出专题' })
  } },
]

const dispatch = require('./router')(routes)

module.exports = async function routesCollections(ctx, req, res, p, method, url) {
  return dispatch(ctx, req, res, p, method, url)
}
