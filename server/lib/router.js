'use strict'
// ═══ P2 阶段二 · 声明式路由表基建（零依赖）═══
// 设计：
//   路由条目 = { method, pattern, auth, handler, unauthorizedMessage?, forbiddenMessage?, unauthAction? }
//   pattern  支持 :param 段（如 '/api/share/:token'，参数段不含斜杠），
//            也支持自定义段正则（如 '/api/blog/posts/:id(\\d+)'——非数字不命中，回落旧链/兜底）
//   auth     null(公开) | 'user'(登录) | 'admin'(管理员) | 'staff:editor,reviewer'(指定职员角色)
//   handler  async (ctx, { req, res, params, url, user, p, method }) => 负责完整响应
//   unauthorizedMessage  可选，401 文案（默认 '未登录或登录已过期'）——迁移旧 if 链时保留原文案用
//   forbiddenMessage     可选，403 文案（默认随 auth 级别生成）
//   unauthAction:'forbid' 可选：声明此字段时未登录不返回 401 而是返回 403+forbiddenMessage
//                        （用于还原旧 if 链「staffRole(null)==='student' → 403 无权限」的语义）
// 分发器签名与 lib/routes-*.js 域模块一致：
//   async (ctx, req, res, p, method, url) => 处理了返回 true，未命中返回 false（回落旧 if 链）
// 挂载位置约定：server.js 全局限流/CSRF 门之后、旧 if 链之前（全局闸门对本表全部生效）

function compilePattern(pattern) {
  const keys = []
  const parts = []
  // 先把 :name(自定义正则) / :name 段抽出为占位符，避免通用转义破坏自定义正则内容
  // 自定义正则支持一层嵌套括号（如负向断言 (?!a$|b$)），多层嵌套不支持
  const rx = String(pattern)
    .replace(/:(\w+)(?:\(((?:[^()]|\([^()]*\))*)\))?/g, (_, k, custom) => {
      keys.push(k); parts.push(custom || '[^/]+'); return '\x00' + (parts.length - 1) + '\x00'
    })
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\x00(\d+)\x00/g, (_, i) => '(' + parts[i] + ')')
  return { regex: new RegExp('^' + rx + '$'), keys }
}

function staffRoleOf(user) {
  if (!user) return 'student'
  if (user.is_admin || user.role === 'admin') return 'admin'
  if (['editor', 'reviewer', 'reporter'].includes(user.role)) return user.role
  return 'student'
}

module.exports = function createDispatcher(routeDefs) {
  const compiled = routeDefs.map((r) => ({ ...r, ...compilePattern(r.pattern) }))
  return async function dispatch(ctx, req, res, p, method, url) {
    for (const r of compiled) {
      if (r.method !== method) continue
      const m = p.match(r.regex)
      if (!m) continue
      const params = {}
      r.keys.forEach((k, i) => {
        try { params[k] = decodeURIComponent(m[i + 1]) } catch { params[k] = m[i + 1] }
      })
      // ── 认证闸门 ──
      let user = null
      if (r.auth) {
        user = ctx.authUser(req)
        if (!user) {
          if (r.unauthAction === 'forbid') {
            ctx.sendJSON(res, 403, { ok: false, message: r.forbiddenMessage || '无权限' })
          } else {
            ctx.sendJSON(res, 401, { ok: false, message: r.unauthorizedMessage || '未登录或登录已过期' })
          }
          return true
        }
        const a = r.auth
        if (a === 'admin' && !(user.is_admin || user.role === 'admin')) {
          ctx.sendJSON(res, 403, { ok: false, message: r.forbiddenMessage || '需要管理员权限' }); return true
        }
        if (typeof a === 'string' && a.startsWith('staff:')) {
          const allowed = a.slice(6).split(',')
          const role = staffRoleOf(user)
          if (role !== 'admin' && !allowed.includes(role)) {
            ctx.sendJSON(res, 403, { ok: false, message: r.forbiddenMessage || '权限不足（需要：' + allowed.join('/') + '）' }); return true
          }
        }
      }
      await r.handler(ctx, { req, res, params, url, user, p, method })
      return true
    }
    return false
  }
}
