'use strict'
// P1 阶段三：FTS5 统一搜索域（/api/search/v2）
// 数据源：search_src（4 业务表触发器自动维护，db.js v6）+ search_fts（trigram，external content）
// 策略：≥3 字符查询走 FTS5 MATCH（短语 AND）+ bm25 排序；<3 字符走 LIKE 兜底（trigram 最小 3 字符限制）
// 响应形状对齐旧 /api/search：{ ok, data:[{type, id, title, content}] }（content=相关片段），前端零改可用

// FTS5 短语转义：内部双引号翻倍；空格拆词各包短语 AND（trigram 短语=子串匹配语义）
function ftsPhrase(q) {
  return q.split(/\s+/).filter(Boolean)
    .map(w => '"' + w.replace(/"/g, '""') + '"')
    .join(' ')
}

const ROUTES = [
  { method: 'GET', pattern: '/api/search/v2', handler: async (ctx, { res, url }) => {
    const { db, sendJSON, escapeLike } = ctx
    const q = (url.searchParams.get('q') || '').trim()
    const type = url.searchParams.get('type') || 'all'
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 20))
    if (!q) { sendJSON(res, 200, { ok: true, data: [] }); return }

    const typeCond = (type !== 'all' && ['material', 'blog', 'forum', 'wall'].includes(type)) ? 'AND s.type = ?' : ''
    const typeArg = (typeCond ? [type] : [])

    // 单 token 或整串最短 token <3 字符：LIKE 兜底（trigram 最小 3 字符）；多 token 逐词 AND
    const tokens = q.split(/\s+/).filter(Boolean)
    const minLen = Math.min(...tokens.map(t => t.length))
    if (minLen < 3) {
      const likeConds = tokens.map(() => "(s.title LIKE ? ESCAPE '\\' OR s.body LIKE ? ESCAPE '\\' OR s.tags LIKE ? ESCAPE '\\')").join(' AND ')
      const likeArgs = tokens.flatMap(t => { const kw = '%' + escapeLike(t) + '%'; return [kw, kw, kw] })
      const rows = db.prepare(`
        SELECT s.type, s.ref_id AS id, s.title, s.body, s.tags
        FROM search_src s
        WHERE s.status = 'published' ${typeCond} AND ${likeConds}
        ORDER BY s.id DESC LIMIT ?`).all(...typeArg, ...likeArgs, limit)
      sendJSON(res, 200, { ok: true, data: rows.map(r => ({
        type: r.type, id: r.id,
        title: r.title || r.tags || '（无标题）',
        content: (r.body || r.tags || '').slice(0, 120)
      })) })
      return
    }

    // FTS5 主路径（≥3 字符）：仅 ≥3 字 token 进 MATCH（trigram 最小 3 字符），<3 字 token 作为结果内存过滤
    try {
      const longTokens = tokens.filter(t => t.length >= 3)
      const shortTokens = tokens.filter(t => t.length < 3)
      if (!longTokens.length) throw new Error('all-short') // 全短 token → LIKE 降级
      const match = ftsPhrase(longTokens.join(' '))
      const rows = db.prepare(`
        SELECT s.type, s.ref_id AS id, s.title, s.body, s.tags,
               snippet(search_fts, 1, '', '', '…', 18) AS snip,
               bm25(search_fts) AS score
        FROM search_fts
        JOIN search_src s ON s.id = search_fts.rowid
        WHERE search_fts MATCH ? AND s.status = 'published' ${typeCond}
        ORDER BY score LIMIT ?`).all(match, ...typeArg, limit)
      const hit = (r) => shortTokens.every(t => (r.title + r.body + r.tags).includes(t))
      const data = rows
        .filter(r => shortTokens.length === 0 || hit(r))
        .map(r => ({
          type: r.type, id: r.id,
          title: r.title || r.tags || '（无标题）',
          content: (r.snip || r.body || r.tags || '').slice(0, 200)
        }))
      sendJSON(res, 200, { ok: true, data })
    } catch (e) {
      // FTS 语法异常（特殊字符残留等）→ LIKE 降级，搜索永不 500
      const kw = '%' + escapeLike(q) + '%'
      const rows = db.prepare(`
        SELECT s.type, s.ref_id AS id, s.title, s.body, s.tags
        FROM search_src s
        WHERE s.status = 'published' ${typeCond}
          AND (s.title LIKE ? ESCAPE '\\' OR s.body LIKE ? ESCAPE '\\' OR s.tags LIKE ? ESCAPE '\\')
        ORDER BY s.id DESC LIMIT ?`).all(...typeArg, kw, kw, kw, limit)
      sendJSON(res, 200, { ok: true, data: rows.map(r => ({
        type: r.type, id: r.id,
        title: r.title || r.tags || '（无标题）',
        content: (r.body || r.tags || '').slice(0, 120)
      })) })
    }
  } },
]

const dispatch = require('./router')(ROUTES)

module.exports = async function routesSearch(ctx, req, res, p, method, url) {
  return dispatch(ctx, req, res, p, method, url)
}
