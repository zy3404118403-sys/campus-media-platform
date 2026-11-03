'use strict'
// 会话层：SQLite 持久化，进程重启不掉线（P2 自 server.js 拆出）
const crypto = require('node:crypto')

module.exports = function initSessions(db) {
// ── 会话层：SQLite 持久化（进程重启不掉线），Map 接口兼容 ──
const SESSION_TTL = 2 * 60 * 60 * 1000 // 2小时不活动过期
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 最长7天

db.exec(`CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_access INTEGER NOT NULL,
  ip TEXT DEFAULT '',
  client TEXT DEFAULT 'web'
)`)
// 兼容早期无 ip 列的旧表：幂等补列（已存在则静默跳过）
try { db.exec("ALTER TABLE sessions ADD COLUMN ip TEXT DEFAULT ''") } catch {}
// 2026-11-01：按端隔离会话（web / miniapp）。表已存在时 CREATE TABLE 不会补列，必须单独 ALTER。
try { db.exec("ALTER TABLE sessions ADD COLUMN client TEXT DEFAULT 'web'") } catch {}

const SESSIONS = {
  get(token) {
    const row = db.prepare('SELECT user_id, created_at, last_access FROM sessions WHERE token = ?').get(token)
    return row ? { userId: row.user_id, createdAt: row.created_at, lastAccess: row.last_access } : undefined
  },
  set(token, { userId, createdAt, lastAccess, ip, client }) {
    db.prepare('INSERT OR REPLACE INTO sessions (token, user_id, created_at, last_access, ip, client) VALUES (?, ?, ?, ?, ?, ?)')
      .run(token, userId, createdAt, lastAccess, String(ip || ''), client === 'miniapp' ? 'miniapp' : 'web')
  },
  delete(token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  },
  // 顺带刷新活跃时间（authUser 高频调用，与 get 合并省一次写）
  touch(token, lastAccess) {
    db.prepare('UPDATE sessions SET last_access = ? WHERE token = ?').run(lastAccess, token)
  }
}

// ── 单点登录（2026-10-23 · 2026-11-01 改为按端隔离）──
// 原策略：同一账号**全局**只保留一个活跃会话 → 小程序与 Web 会互相踢下线
//（校园场景"白天机房用 Web、晚上手机看小程序"必然冲突）。
// 现策略：**同一 client 维度**只保留一个活跃会话（web / miniapp 各一个），
//         既保留"同端不允许并发在线"的安全意图，又避免跨端互踢。
// 仍选择"单会话"而非"单 IP"：校园网 NAT 下同 IP 多设备极常见，按 IP 判断会误伤。
function createSession(userId, ip, client) {
  const c = client === 'miniapp' ? 'miniapp' : 'web'
  try {
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND client = ?').run(userId, c)
  } catch (e) {
    // 极端情况：client 列尚未补上 → 退化为旧的全局单会话，保证可用性
    try { db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId) } catch (e2) {}
  }
  const token = crypto.randomBytes(24).toString('hex')
  const now = Date.now()
  SESSIONS.set(token, { userId, createdAt: now, lastAccess: now, ip, client: c })
  return token
}

// 定期清理过期会话（每10分钟，物理删除）
setInterval(() => {
  const cutoff = Date.now() - SESSION_MAX_AGE
  db.prepare('DELETE FROM sessions WHERE last_access < ? OR created_at < ?').run(Date.now() - SESSION_TTL, cutoff)
}, 10 * 60 * 1000)
  return { SESSIONS, createSession, SESSION_TTL, SESSION_MAX_AGE }
}
