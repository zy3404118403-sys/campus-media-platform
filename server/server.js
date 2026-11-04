'use strict'
// ── 轻量 .env 加载（2026-10-23）：零依赖，仅补未设置的环境变量（不覆盖系统已有的）──
try {
  // .env 双布局探测：旧布局在代码同级，新布局在 .seedance-data/
  const _envCandidates = [
    require('path').join(__dirname, '.env'),
    require('path').join(__dirname, '..', '.seedance-data', '.env'),
  ]
  const _envPath = _envCandidates.find((p) => { try { return require('fs').existsSync(p) } catch (e) { return false } })
    || _envCandidates[0]
  if (require('fs').existsSync(_envPath)) {
    require('fs').readFileSync(_envPath, 'utf8').split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    })
  }
} catch (e) {}
/**
 * 校园素材库 · 后端服务器
 * 零 npm 依赖:Node 22 内置 http + node:sqlite
 *
 * 启动:  node server.js
 * 端口:  默认 3000(可用环境变量 PORT 覆盖)
 */
const http = require('node:http')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const zlib = require('node:zlib')
const { db, UPLOAD_DIR, THUMB_DIR, publicUser, hashPassword, verifyPassword } = require('./db')
const { filter: sensitiveFilter, reloadFilter } = require('./sensitive-filter')
const { publishArticle, unpublishArticle } = require('./article-publisher')

// ── 数据库迁移（增量添加列等）──
// users.is_locked 封禁标志
try {
  db.exec('ALTER TABLE users ADD COLUMN is_locked INTEGER DEFAULT 0')
  console.log('  ✓ 数据库迁移: users.is_locked 列已添加')
} catch (e) {
  if (!e.message.includes('duplicate column')) console.warn('  ⚠ 迁移警告:', e.message)
}
// download_logs 下载记录表
try {
  db.exec(`CREATE TABLE IF NOT EXISTS download_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    ip TEXT DEFAULT '',
    downloaded_at TEXT DEFAULT (datetime('now','localtime'))
  )`)
  console.log('  ✓ 数据库迁移: download_logs 表已创建')
} catch (e) {
  console.warn('  ⚠ 迁移警告:', e.message)
}
// download_logs 增加 user_id 列（P0-1 下载记录）
try {
  const dlCols = db.prepare('PRAGMA table_info(download_logs)').all()
  if (!dlCols.some(c => c.name === 'user_id')) {
    db.exec('ALTER TABLE download_logs ADD COLUMN user_id TEXT')
    console.log('  ✓ 数据库迁移: download_logs.user_id 已添加')
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_dl_user ON download_logs(user_id, id)')
} catch (e) {
  console.warn('  ⚠ 迁移警告:', e.message)
}

// home_gallery 首页校园风光画廊表（P0-2 首页 CMS 化）
try {
  db.exec(`CREATE TABLE IF NOT EXISTS home_gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image TEXT NOT NULL,              -- 图片路径（/photos/ 静态 或 /api/gallery/ 上传）
    title TEXT DEFAULT '',            -- 直存标题文案（不走 i18n key）
    wide INTEGER DEFAULT 0,
    tall INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_visible INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`)
  console.log('  ✓ 数据库迁移: home_gallery 表已创建')
  // 首次建表后将原 index.js 硬编码的 11 项按原顺序写入，保证前台视觉零变化
  const galCount = db.prepare('SELECT COUNT(*) c FROM home_gallery').get().c
  if (galCount === 0) {
    const seed = [
      ['/photos/campus_01_card.jpg', '校园全景', 1, 0],
      ['/photos/campus_02_card.jpg', '教学区', 0, 0],
      ['/photos/campus_03_card.jpg', '建筑群', 0, 0],
      ['/photos/campus_04_card.jpg', '运动场', 1, 0],
      ['/photos/campus_05_card.jpg', '校园黄昏', 0, 0],
      ['/photos/campus_06_card.jpg', '航拍全景', 0, 0],
      ['/photos/campus_07_card.jpg', '垂直全景', 0, 1],
      ['/photos/campus_08_card.jpg', '校园细节', 0, 0],
      ['/photos/campus_09_card.jpg', '远眺校园', 1, 0],
      ['/photos/campus_10_card.jpg', '校园俯瞰', 0, 0],
      ['/photos/campus_11_card.jpg', '校园风光', 0, 0],
    ]
    const ins = db.prepare('INSERT INTO home_gallery (image,title,wide,tall,sort_order,is_visible) VALUES (?,?,?,?,?,1)')
    seed.forEach((row, i) => ins.run(row[0], row[1], row[2], row[3], i))
    console.log('  ✓ home_gallery 种子数据: 11 项硬编码画廊已入库')
  }
} catch (e) {
  console.warn('  ⚠ 迁移警告:', e.message)
}

// P0-3 独立标签表:tags / asset_tags（materials.tags 字符串双写保留,作为回滚保障）
try {
  db.exec(`CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    source TEXT DEFAULT 'manual',
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS asset_tags (
    material_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    source TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (material_id, tag_id)
  )`)
  db.exec('CREATE INDEX IF NOT EXISTS idx_at_tag ON asset_tags(tag_id)')
  console.log('  ✓ 数据库迁移: tags / asset_tags 表已创建')
  // 存量迁移:materials.tags 拆分入库(INSERT OR IGNORE 幂等,重复启动零副作用)
  const tagRows = db.prepare("SELECT id, tags FROM materials WHERE tags IS NOT NULL AND tags != ''").all()
  const insTagMig = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
  const tagIdMig = db.prepare('SELECT id FROM tags WHERE name = ?')
  const insMapMig = db.prepare('INSERT OR IGNORE INTO asset_tags (material_id, tag_id, source) VALUES (?,?,?)')
  let expectPairs = 0
  const seenPairs = new Set()
  db.exec('BEGIN')
  try {
    for (const r of tagRows) {
      for (const name of String(r.tags).split(/[,，\s]+/).map(s => s.trim()).filter(Boolean)) {
        const key = r.id + '\x00' + name
        if (seenPairs.has(key)) continue
        seenPairs.add(key)
        expectPairs++
        insTagMig.run(name)
        const t = tagIdMig.get(name)
        if (t) insMapMig.run(r.id, t.id, 'manual')
      }
    }
    db.exec('COMMIT')
  } catch (e) { db.exec('ROLLBACK'); throw e }
  const mapCount = db.prepare('SELECT COUNT(*) c FROM asset_tags').get().c
  if (expectPairs > 0 && mapCount !== expectPairs) {
    console.warn(`  ⚠ 标签迁移校验: 拆分 ${expectPairs} 对 != 映射 ${mapCount} 行(不阻断启动)`)
  } else {
    console.log(`  ✓ 标签表迁移: ${tagRows.length} 条素材 / ${mapCount} 行映射已就绪`)
  }
} catch (e) {
  console.warn('  ⚠ 迁移警告:', e.message)
}

// ── P0-3 标签双写维护:materials.tags(字符串) 与 tags/asset_tags(关联表) 同步 ──
function normalizeTagList(tagsString) {
  return String(tagsString || '').split(/[,，\s]+/).map(s => s.trim()).filter(Boolean)
}
const _tagSync = {
  delMaps: db.prepare('DELETE FROM asset_tags WHERE material_id = ?'),
  insTag: db.prepare('INSERT OR IGNORE INTO tags (name, source) VALUES (?, ?)'),
  idOf: db.prepare('SELECT id FROM tags WHERE name = ?'),
  insMap: db.prepare('INSERT OR IGNORE INTO asset_tags (material_id, tag_id, source) VALUES (?,?,?)'),
}
function upsertAssetTags(materialId, tagsString) {
  try {
    const list = normalizeTagList(tagsString)
    db.exec('BEGIN')
    try {
      _tagSync.delMaps.run(materialId)
      for (const name of list) {
        _tagSync.insTag.run(name, 'manual')
        const t = _tagSync.idOf.get(name)
        if (t) _tagSync.insMap.run(materialId, t.id, 'manual')
      }
      db.exec('COMMIT')
    } catch (e) { db.exec('ROLLBACK'); throw e }
  } catch (e) {
    console.warn(`  ⚠ 标签关联同步失败(material ${materialId}):`, e.message)
  }
}

// community_notifications 社区通知表
try {
  db.exec(`CREATE TABLE IF NOT EXISTS community_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    target_type TEXT,
    target_id INTEGER,
    target_title TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`)
  console.log('  ✓ 数据库迁移: community_notifications 表已创建')
} catch (e) {
  console.warn('  ⚠ 迁移警告:', e.message)
}

// forum_threads 增加 last_reply_at 列（论坛排序用）
try {
  db.exec(`ALTER TABLE forum_threads ADD COLUMN last_reply_at TEXT`)
  console.log('  ✓ 数据库迁移: forum_threads.last_reply_at 列已添加')
} catch (e) {
  if (!e.message.includes('duplicate column')) console.warn('  ⚠ 迁移警告:', e.message)
}

// ── 性能索引优化（v4 迁移）──
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
    CREATE INDEX IF NOT EXISTS idx_materials_author ON materials(author_id);
    CREATE INDEX IF NOT EXISTS idx_materials_college ON materials(college);
    CREATE INDEX IF NOT EXISTS idx_forum_threads_status ON forum_threads(status);
    CREATE INDEX IF NOT EXISTS idx_forum_threads_author ON forum_threads(author_id);
    CREATE INDEX IF NOT EXISTS idx_wall_posts_author ON wall_posts(author_id);
    CREATE INDEX IF NOT EXISTS idx_blog_comments_author ON blog_comments(author_id);
    CREATE INDEX IF NOT EXISTS idx_blog_comments_post_status ON blog_comments(post_id, status);
    CREATE INDEX IF NOT EXISTS idx_forum_replies_author ON forum_replies(author_id);
    CREATE INDEX IF NOT EXISTS idx_forum_replies_thread_status ON forum_replies(thread_id, status);
    CREATE INDEX IF NOT EXISTS idx_blog_likes_post ON blog_likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_blog_likes_user ON blog_likes(user_id);
    CREATE INDEX IF NOT EXISTS idx_wall_likes_post ON wall_likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_wall_likes_user ON wall_likes(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_user_follows_followee ON user_follows(followee_id, type);
    CREATE INDEX IF NOT EXISTS idx_community_notif_user ON community_notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_notifications_owner ON notifications(owner);
    CREATE INDEX IF NOT EXISTS idx_material_likes_user ON material_likes(user_id);
    CREATE INDEX IF NOT EXISTS idx_material_fav_user ON material_favorites(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_joins_user ON activity_joins(user_id);
  `)
  console.log('  ✓ v4迁移: 21个性能索引已创建')
} catch (e) {
  console.warn('  ⚠ 索引迁移警告:', e.message)
}

// private_messages 站内私信表
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS private_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_to_read ON private_messages(to_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_pm_pair ON private_messages(from_id, to_id, created_at);
  `)
  console.log('  ✓ 数据库迁移: private_messages 表已创建')
} catch (e) {
  console.warn('  ⚠ 迁移警告:', e.message)
}

// forum_polls / forum_poll_votes 论坛投票表（v5）
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS forum_polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      allow_multiple INTEGER DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_thread ON forum_polls(thread_id);
    CREATE TABLE IF NOT EXISTS forum_poll_votes (
      thread_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      option_index INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (thread_id, user_id, option_index)
    );
    CREATE INDEX IF NOT EXISTS idx_poll_votes_thread ON forum_poll_votes(thread_id);
  `)
  console.log('  ✓ 数据库迁移: forum_polls / forum_poll_votes 表已创建')
} catch (e) {
  console.warn('  ⚠ 迁移警告:', e.message)
}

// 活动报名系统增强：activities 增加容量/地点/截止时间；activity_joins 增加时间戳和状态
try {
  db.exec(`ALTER TABLE activities ADD COLUMN capacity INTEGER DEFAULT 0`)
  console.log('  ✓ 数据库迁移: activities.capacity 列已添加')
} catch (e) {
  if (!e.message.includes('duplicate column')) console.warn('  ⚠ 迁移警告:', e.message)
}
try {
  db.exec(`ALTER TABLE activities ADD COLUMN location TEXT DEFAULT ''`)
  console.log('  ✓ 数据库迁移: activities.location 列已添加')
} catch (e) {
  if (!e.message.includes('duplicate column')) console.warn('  ⚠ 迁移警告:', e.message)
}
try {
  db.exec(`ALTER TABLE activities ADD COLUMN reg_deadline TEXT DEFAULT ''`)
  console.log('  ✓ 数据库迁移: activities.reg_deadline 列已添加')
} catch (e) {
  if (!e.message.includes('duplicate column')) console.warn('  ⚠ 迁移警告:', e.message)
}
try {
  db.exec(`ALTER TABLE activity_joins ADD COLUMN registered_at TEXT DEFAULT ''`)
  console.log('  ✓ 数据库迁移: activity_joins.registered_at 列已添加')
} catch (e) {
  if (!e.message.includes('duplicate column')) console.warn('  ⚠ 迁移警告:', e.message)
}
try {
  db.exec(`ALTER TABLE activity_joins ADD COLUMN status TEXT DEFAULT 'registered'`)
  console.log('  ✓ 数据库迁移: activity_joins.status 列已添加')
} catch (e) {
  if (!e.message.includes('duplicate column')) console.warn('  ⚠ 迁移警告:', e.message)
}

const PORT = process.env.PORT || 3000
const PUBLIC_DIR = path.join(__dirname, 'public')

// P2 拆分：lib 模块（工具/会话/OG/路由域）
const { sendJSON, readBody, parseCookies, detectFileType, UPLOAD_ALLOWED, TYPE_TO_CATEGORY, validateUploadedFile, getOrCreateCSRFToken, validateCSRF, CSRF_EXEMPT, sanitizeOriginalName, escapeLike, validatePasswordStrength } = require('./lib/helpers')
const { SESSIONS, createSession, SESSION_TTL, SESSION_MAX_AGE } = require('./lib/sessions')(db)
const { injectOGTags } = require('./lib/og')(db)
const routesArticles = require('./lib/routes-articles')
const routesCommunity = require('./lib/routes-community')
const routesSearch = require('./lib/routes-search')
const routesGraph = require('./lib/routes-graph')
const routesEmbed = require('./lib/routes-embed')
const routesTasks = require('./lib/routes-tasks')
const totp2fa = require('./lib/totp')
const { buildZip } = require('./lib/zip.js')
const ROUTE_CTX_BASE = { db, sendJSON, readBody, authUser, escapeLike }
const ARTICLES_CTX = { ...ROUTE_CTX_BASE, sensitiveFilter, reloadFilter, publishArticle, unpublishArticle }
const COMMUNITY_CTX = { ...ROUTE_CTX_BASE, sensitiveFilter, buildPollData, requireAuth }
// P2 阶段二：声明式路由表上下文（函数声明提升，此处引用安全）+ 分享域模块
const P2_CTX = { ...ROUTE_CTX_BASE, requireAuth, requireAdmin, requireStaff, UPLOAD_DIR, THUMB_DIR, getClientIP }
const routesShare = require('./lib/routes-share')
const routesPublic = require('./lib/routes-public')
const routesActivities = require('./lib/routes-activities')
const routesMaterials = require('./lib/routes-materials')
const routesCollections = require('./lib/routes-collections')
const routesAdmin = require('./lib/routes-admin')
const routesUser = require('./lib/routes-user')
const routesAbout = require('./lib/routes-about')
const oss = require('./lib/oss')
const routesOss = require('./lib/routes-oss')(oss)
const initTranscode = require('./lib/transcode')
const transcode = initTranscode(db, oss, { uploadDir: UPLOAD_DIR })
transcode.start()
setTimeout(() => transcode.backfill(), 3000)
// P2 批五/六/七：各域上下文（helpers 经 ctx 传入，模块内零重复定义）
const ACTIVITIES_CTX = { ...P2_CTX, parseMultipart, parseMultipartFiles, validateUploadedFile, sanitizeOriginalName, detectFileType }
const MATERIALS_CTX = { ...P2_CTX, parseMultipart, parseMultipartFiles, validateUploadedFile, sanitizeOriginalName, detectFileType, materialPublic, upsertAssetTags, normalizeTagList, recordGuestUpload, TYPE_TO_CATEGORY }
// 批七：专题复用 MATERIALS_CTX（专题详情需 materialPublic）；admin 域需 multipart/文件校验/buildZip/escapeLike
const ADMIN_CTX = { ...P2_CTX, parseMultipartFiles, detectFileType, escapeLike, buildZip }
// 批八：个人中心域复用 COMMUNITY_CTX（含 sensitiveFilter——私信/编辑校验），补 PUBLIC_DIR（base64 图片落盘）
const USER_CTX = { ...COMMUNITY_CTX, PUBLIC_DIR }


// 远程部署密钥:优先环境变量 → 其次 .deploy-key 文件 → 最后生成随机密钥并持久化
// 正式环境请通过环境变量 DEPLOY_KEY 注入
/* 部署密钥双布局探测：若旧布局密钥存在必须沿用，
   否则会被误判为「没有密钥」而生成新密钥，导致旧的部署通道全部失效 */
const DEPLOY_KEY_FILE = [
  path.join(__dirname, '.deploy-key'),
  path.join(__dirname, '..', '.seedance-data', '.deploy-key'),
].find((p) => fs.existsSync(p)) || path.join(__dirname, '..', '.seedance-data', '.deploy-key')
let DEPLOY_KEY = process.env.DEPLOY_KEY || ''
if (!DEPLOY_KEY) {
  try {
    DEPLOY_KEY = fs.readFileSync(DEPLOY_KEY_FILE, 'utf8').trim()
  } catch {
    DEPLOY_KEY = crypto.randomBytes(32).toString('hex')
    fs.writeFileSync(DEPLOY_KEY_FILE, DEPLOY_KEY, { mode: 0o600 })
    console.log('  ⚡ 已生成新的部署密钥,保存到 .deploy-key 文件')
  }
}



// ── 登录速率限制(内存,基于 IP) ──
const loginAttempts = new Map() // ip -> { count, firstAttempt, blockedUntil }
// ── 2FA 登录挑战（内存态：challenge -> {userId, exp, attempts}）──
// 5 分钟有效、最多 5 次尝试、一次性消费；进程重启即失效（用户需重新走第一步，可接受）
const pending2fa = new Map()
setInterval(() => { const now = Date.now(); for (const [k, v] of pending2fa) if (v.exp < now) pending2fa.delete(k) }, 60 * 1000)
const LOGIN_MAX_FAILS = 5        // 最多失败次数
const LOGIN_WINDOW_MS = 15 * 60 * 1000  // 15 分钟窗口
const LOGIN_BLOCK_MS = 15 * 60 * 1000    // 锁定 15 分钟

function checkLoginRate(ip) {
  const now = Date.now()
  const rec = loginAttempts.get(ip)
  if (!rec) return { allowed: true }
  // 锁定期内
  if (rec.blockedUntil && now < rec.blockedUntil) {
    const remain = Math.ceil((rec.blockedUntil - now) / 60000)
    return { allowed: false, message: `登录尝试过于频繁，请 ${remain} 分钟后再试` }
  }
  // 锁定过期或窗口过期 -> 重置
  if (rec.blockedUntil || (now - rec.firstAttempt > LOGIN_WINDOW_MS)) {
    loginAttempts.delete(ip)
  }
  return { allowed: true }
}

function recordLoginFailure(ip) {
  const now = Date.now()
  let rec = loginAttempts.get(ip)
  if (!rec || (now - rec.firstAttempt > LOGIN_WINDOW_MS)) {
    rec = { count: 0, firstAttempt: now, blockedUntil: null }
  }
  rec.count++
  if (rec.count >= LOGIN_MAX_FAILS) {
    rec.blockedUntil = now + LOGIN_BLOCK_MS
  }
  loginAttempts.set(ip, rec)
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip)
}

// 定期清理登录尝试失败记录（每10分钟）
setInterval(() => {
  const now = Date.now()
  for (const [ip, rec] of loginAttempts) {
    if (!rec.blockedUntil && (now - rec.firstAttempt > LOGIN_WINDOW_MS)) {
      loginAttempts.delete(ip)
    }
    if (rec.blockedUntil && now > rec.blockedUntil + LOGIN_BLOCK_MS) {
      loginAttempts.delete(ip)
    }
  }
  // 清理游客上传计数
  for (const [ip, rec] of guestUploadAttempts) {
    if (now - rec.windowStart > GUEST_UPLOAD_WINDOW) {
      guestUploadAttempts.delete(ip)
    }
  }
  // 清理 API 限流桶
  for (const [ip, bucket] of apiRateBuckets) {
    if (now - bucket.read.windowStart > API_WINDOW_MS && now - bucket.write.windowStart > API_WINDOW_MS) {
      apiRateBuckets.delete(ip)
    }
  }
}, 10 * 60 * 1000)

// ── 游客上传频率限制(内存,基于 IP) ──
const guestUploadAttempts = new Map()
const GUEST_UPLOAD_MAX = 10     // 每小时最多10次
const GUEST_UPLOAD_WINDOW = 60 * 60 * 1000  // 1小时窗口

function checkGuestUploadRate(ip) {
  const now = Date.now()
  const rec = guestUploadAttempts.get(ip)
  if (!rec || (now - rec.windowStart > GUEST_UPLOAD_WINDOW)) {
    guestUploadAttempts.set(ip, { count: 0, windowStart: now })
    return { allowed: true }
  }
  if (rec.count >= GUEST_UPLOAD_MAX) {
    return { allowed: false, message: '游客上传过于频繁，请登录后继续' }
  }
  return { allowed: true }
}

function recordGuestUpload(ip) {
  const now = Date.now()
  let rec = guestUploadAttempts.get(ip)
  if (!rec || (now - rec.windowStart > GUEST_UPLOAD_WINDOW)) {
    rec = { count: 0, windowStart: now }
  }
  rec.count++
  guestUploadAttempts.set(ip, rec)
}

// ── 全局 API 限流(内存,基于 IP) ──
const apiRateBuckets = new Map() // ip -> { read: {count, windowStart}, write: {count, windowStart} }
const API_READ_MAX = 300          // 每分钟最多 300 次读请求（SPA 一次页面加载就要 20+ 请求，120 太紧易误伤正常浏览）
const API_WRITE_MAX = 30          // 每分钟最多 30 次写请求
const API_WINDOW_MS = 60 * 1000   // 1 分钟窗口

function checkApiRate(ip, method) {
  const isWrite = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)
  const limit = isWrite ? API_WRITE_MAX : API_READ_MAX
  const now = Date.now()
  let bucket = apiRateBuckets.get(ip)
  if (!bucket) {
    bucket = { read: { count: 0, windowStart: now }, write: { count: 0, windowStart: now } }
    apiRateBuckets.set(ip, bucket)
  }
  const slot = isWrite ? bucket.write : bucket.read
  if (now - slot.windowStart > API_WINDOW_MS) {
    slot.count = 0
    slot.windowStart = now
  }
  if (slot.count >= limit) {
    const remain = Math.ceil((API_WINDOW_MS - (now - slot.windowStart)) / 1000)
    return { allowed: false, message: `请求过于频繁，请 ${remain} 秒后再试` }
  }
  slot.count++
  return { allowed: true }
}

function buildPollData(pollRow, user) {
  let options
  try { options = JSON.parse(pollRow.options || '[]') } catch (e) { options = [] }
  const counts = db.prepare('SELECT option_index, COUNT(*) c FROM forum_poll_votes WHERE thread_id = ? GROUP BY option_index').all(pollRow.thread_id)
  const map = {}
  counts.forEach((r) => { map[r.option_index] = r.c })
  const totalVotes = counts.reduce((s, r) => s + r.c, 0)
  const myVotes = user
    ? db.prepare('SELECT option_index FROM forum_poll_votes WHERE thread_id = ? AND user_id = ?').all(pollRow.thread_id, user.id).map((r) => r.option_index)
    : []
  return {
    question: pollRow.question,
    options: options.map((text, i) => ({ index: i, text, votes: map[i] || 0 })),
    totalVotes,
    allowMultiple: !!pollRow.allow_multiple,
    myVotes,
    hasVoted: myVotes.length > 0
  }
}

// 2026-11-01：小程序通道 —— 优先 Cookie（Web 端），无 Cookie 时回落 Authorization: Bearer。
// 只在这一处取令牌，下游 requireAuth / requireAdmin / staff 守卫自动同时支持两种通道，
// 无需改动任何域模块（lib/routes-*.js）。
function sessionTokenOf(req) {
  const cookies = parseCookies(req)
  if (cookies.token) return cookies.token
  const h = String(req.headers.authorization || '')
  if (/^Bearer\s+\S+$/.test(h)) return h.slice(7).trim()
  return ''
}

function authUser(req) {
  const token = sessionTokenOf(req)
  if (!token) return null
  const sess = SESSIONS.get(token)
  if (!sess) return null
  const now = Date.now()
  // 检查会话超时
  if (now - sess.lastAccess > SESSION_TTL || now - sess.createdAt > SESSION_MAX_AGE) {
    SESSIONS.delete(token)
    return null
  }
  // 更新最后访问时间（持久化到库）
  SESSIONS.touch(token, now)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(sess.userId) || null
  // 封禁用户拒绝访问
  if (user && user.is_locked) return null
  return user
}

function safeFileName(name) {
  return name.replace(/[^\w.一-龥-]/g, '_').slice(0, 80)
}

// multipart/form-data 解析(仅支持简单字段 + 单文件)
function parseMultipart(buf, contentType) {
  const m = contentType && contentType.match(/boundary=(.+)$/)
  if (!m) return { fields: {}, file: null }
  const boundary = Buffer.from('--' + m[1].trim())
  const parts = []
  let start = 0
  while (true) {
    const idx = buf.indexOf(boundary, start)
    if (idx === -1) break
    const next = buf.indexOf(boundary, idx + boundary.length)
    if (next === -1) break
    parts.push(buf.slice(idx + boundary.length + 2, next - 2))
    start = next
  }
  const fields = {}
  let file = null
  parts.forEach((part) => {
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd === -1) return
    const headers = part.slice(0, headerEnd).toString('utf8')
    const body = part.slice(headerEnd + 4)
    const nameMatch = headers.match(/name="([^"]+)"/)
    const fnMatch = headers.match(/filename="([^"]*)"/)
    const name = nameMatch && nameMatch[1]
    if (!name) return
    if (fnMatch && fnMatch[1]) {
      file = {
        field: name,
        originalName: fnMatch[1],
        data: body,
        mime: (headers.match(/Content-Type:\s*([^\r\n]+)/i) || [])[1] || 'application/octet-stream',
      }
    } else {
      fields[name] = body.toString('utf8')
    }
  })
  return { fields, file }
}

// multipart 解析(支持多文件),返回 { fields, files: [] }
function parseMultipartFiles(buf, contentType) {
  const m = contentType && contentType.match(/boundary=(.+)$/)
  if (!m) return { fields: {}, files: [] }
  const boundary = Buffer.from('--' + m[1].trim())
  const parts = []
  let start = 0
  while (true) {
    const idx = buf.indexOf(boundary, start)
    if (idx === -1) break
    const next = buf.indexOf(boundary, idx + boundary.length)
    if (next === -1) break
    parts.push(buf.slice(idx + boundary.length + 2, next - 2))
    start = next
  }
  const fields = {}
  const files = []
  parts.forEach((part) => {
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd === -1) return
    const headers = part.slice(0, headerEnd).toString('utf8')
    const body = part.slice(headerEnd + 4)
    const nameMatch = headers.match(/name="([^"]+)"/)
    const fnMatch = headers.match(/filename="([^"]*)"/)
    const name = nameMatch && nameMatch[1]
    if (!name) return
    if (fnMatch && fnMatch[1]) {
      files.push({
        field: name,
        originalName: fnMatch[1],
        data: body,
        mime: (headers.match(/Content-Type:\s*([^\r\n]+)/i) || [])[1] || 'application/octet-stream',
      })
    } else {
      fields[name] = body.toString('utf8')
    }
  })
  return { fields, files }
}

// 需要登录
function requireAuth(req, res) {
  const user = authUser(req)
  if (!user) { sendJSON(res, 401, { ok: false, message: '未登录或登录已过期' }); return null }
  return user
}

// 需要管理员
function requireAdmin(req, res) {
  const user = requireAuth(req, res)
  if (!user) return null
  if (!user.is_admin && user.role !== 'admin') { sendJSON(res, 403, { ok: false, message: '需要管理员权限' }); return null }
  return user
}

// ── 角色分权：staff 角色判定 + 分级守卫 ──
function staffRole(user) {
  if (!user) return 'student'
  if (user.is_admin || user.role === 'admin') return 'admin'
  if (['editor', 'reviewer', 'reporter'].includes(user.role)) return user.role
  return 'student'
}
function requireStaff(req, res, allowed) {
  const user = requireAuth(req, res)
  if (!user) return null
  const r = staffRole(user)
  if (r !== 'admin' && !(Array.isArray(allowed) && allowed.includes(r))) {
    sendJSON(res, 403, { ok: false, message: '权限不足（需要：' + (allowed || []).join('/') + '）' })
    return null
  }
  return user
}

// ── IP 归属地查询(带缓存) ──
function getClientIP(req) {
  // 仅当请求确实来自本机 nginx 反代时才信任转发头，防伪造 XFF 绕过限流
  const ra = (req.socket.remoteAddress || '').replace(/^::ffff:/, '')
  const trustedProxy = ra === '127.0.0.1' || ra === '::1'
  if (trustedProxy) {
    const fwd = req.headers['x-forwarded-for']
    if (fwd) return fwd.split(',')[0].trim()
    const real = req.headers['x-real-ip']
    if (real) return real
  }
  let ip = req.socket.remoteAddress || ''
  // 去掉 IPv4-mapped IPv6 前缀 ::ffff:
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  return ip
}

function lookupIPRegion(ip) {
  if (!ip) return { region: '未知', city: '', isp: '' }
  // 去掉 IPv4-mapped IPv6 前缀
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { region: '本地', city: '本地', isp: '本地网络' }
  }
  // 查缓存
  try {
    const cached = db.prepare('SELECT * FROM ip_cache WHERE ip = ?').get(ip)
    if (cached) return Promise.resolve({ region: cached.region || '', city: cached.city || '', isp: cached.isp || '' })
  } catch (e) { /* 缓存查询失败，跳过，继续在线查询 */ }
  return new Promise((resolve) => {
    const httpReq = http.request('http://ip-api.com/json/' + encodeURIComponent(ip) + '?lang=zh-CN&fields=status,country,regionName,city,isp', {
      method: 'GET',
      timeout: 3000,
    }, (resp) => {
      let data = ''
      resp.on('data', (c) => { data += c })
      resp.on('end', () => {
        try {
          const j = JSON.parse(data)
          if (j.status === 'success') {
            const result = { region: j.regionName || j.country || '未知', city: j.city || '', isp: j.isp || '' }
            // 写缓存
            try {
              db.prepare('INSERT OR REPLACE INTO ip_cache (ip, region, city, isp, updated_at) VALUES (?,?,?,?,datetime(\'now\',\'localtime\'))')
                .run(ip, result.region, result.city, result.isp)
            } catch (e) { /* 缓存写入失败，非关键 */ }
          } else {
            resolve({ region: '未知', city: '', isp: '' })
          }
        } catch (e) {
          resolve({ region: '未知', city: '', isp: '' })
        }
      })
    })
    httpReq.on('error', () => resolve({ region: '未知', city: '', isp: '' }))
    httpReq.on('timeout', () => { httpReq.destroy(); resolve({ region: '未知', city: '', isp: '' }) })
    httpReq.end()
  })
}

// ── 访问日志记录(异步,不阻塞响应) ──
function logAccess(req, res, statusCode) {
  try {
    const p = new URL(req.url, 'http://x').pathname
    if (p.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|ttf|woff2?|map)$/i)) return
    // 2026-10-23：API 也记录（此前完全不记录，导致接口问题无法诊断）
    //   写操作全记；GET 只在出错时记；轮询/健康检查类跳过，避免刷爆日志
    const isPage = p === '/' || p.endsWith('.html')
    const SKIP_API_PREFIX = ['/api/notifications', '/api/health', '/api/media-accounts']
    let shouldLog = false
    if (isPage) shouldLog = true
    else if (p.startsWith('/api/')) {
      if (req.method !== 'GET') shouldLog = true
      else if (statusCode >= 400) shouldLog = true
      else if (!SKIP_API_PREFIX.some((x) => p.startsWith(x))) shouldLog = true
    }
    if (!shouldLog) return

    const ip = getClientIP(req)
    const ua = (req.headers['user-agent'] || '').slice(0, 500)
    const referer = (req.headers.referer || '').slice(0, 500)
    const user = authUser(req)

    // 先插入日志(IP 归属地异步查询后更新)
    const info = db.prepare(
      'INSERT INTO access_logs (ip, method, path, user_agent, referer, user_id, user_name, status_code, region, city) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(ip, req.method, p, ua, referer, user ? user.id : null, user ? user.name : null, statusCode, '', '')

    // 异步查询 IP 归属地并更新
    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      lookupIPRegion(ip).then((geo) => {
        try {
          db.prepare('UPDATE access_logs SET region=?, city=? WHERE id=?')
            .run(geo.region, geo.city, info.lastInsertRowid)
        } catch (e) { /* IP 归属地更新失败，非关键 */ }
      })
    } else {
      db.prepare('UPDATE access_logs SET region=?, city=? WHERE id=?')
        .run('本地', '本地', info.lastInsertRowid)
    }
  } catch (e) {
    // 日志记录失败不影响正常请求
  }
}

function materialPublic(m) {
  return {
    id: m.id, title: m.title, type: m.type, college: m.college,
    author: m.author, description: m.description, shot_date: m.shot_date,
    tags: (m.tags || '').split(',').filter(Boolean),
    status: m.status || 'approved',
    downloads: m.downloads, views: m.views, likes: m.likes,
    created_at: m.created_at,
    has_file: !!(m.oss_key || (m.filename && fs.existsSync(path.join(UPLOAD_DIR, m.filename)))),
    has_hls: !!(m.hls_dir && m.transcode_status === 'done'),
    hls_dir: m.hls_dir || '',
    transcode_status: m.transcode_status || '',
    original_name: m.original_name, file_size: m.file_size, mime: m.mime,
    width: m.width || 0, height: m.height || 0, duration: m.duration || 0,
    has_thumb: !!(m.thumb_filename && fs.existsSync(path.join(THUMB_DIR, m.thumb_filename))),
    thumb_filename: m.thumb_filename || '',
    drive_url: (m.drive_url || '').trim(),
    sub_type: m.sub_type || '',
    featured: !!m.featured,
  }
}

// ───────────────────────── HTTP 服务 ─────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const p = url.pathname
  const method = req.method

  // 访问日志(响应结束时异步记录)
  res.on('finish', () => { logAccess(req, res, res.statusCode) })

  // ── CSRF: 生成或复用 token，注入到所有响应的 Set-Cookie ──
  const _csrfToken = parseCookies(req).csrf || crypto.randomBytes(16).toString('hex')
  // HTTPS 迁移：nginx 443 传 X-Forwarded-Proto，HTTPS 响应的 Cookie 自动补 Secure（HTTP 保持不带，双轨兼容）
  const _cookieSecure = String(req.headers['x-forwarded-proto'] || '').toLowerCase().indexOf('https') === 0 ? '; Secure' : ''
  const _origWriteHead = res.writeHead
  res.writeHead = function(status, headers) {
    headers = headers || {}
    const csrfCookie = `csrf=${_csrfToken}; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 3600}${_cookieSecure}`
    if (headers['Set-Cookie']) {
      const existing = headers['Set-Cookie']
      headers['Set-Cookie'] = Array.isArray(existing) ? [...existing, csrfCookie] : [existing, csrfCookie]
    } else {
      headers['Set-Cookie'] = csrfCookie
    }
    return _origWriteHead.call(res, status, headers)
  }

  // CORS 预检 (同源策略:不设置 Access-Control-Allow-Origin,仅响应 OPTIONS)
  if (method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // ── CSRF 防护: POST/PUT/DELETE/PATCH 验证 Origin + double-submit token ──
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && !CSRF_EXEMPT.has(p)) {
    // 1. Origin 检查（主防线）—— 精确比较 hostname，防止子串绕过
    const origin = req.headers['origin'] || ''
    const host = (req.headers['host'] || '').split(':')[0] // 去掉端口
    if (origin) {
      let originHost = ''
      try { originHost = new URL(origin).hostname } catch {}
      if (originHost && host && originHost !== host) {
        sendJSON(res, 403, { ok: false, message: '跨域请求被拒绝' })
        return
      }
    }
    // 2. CSRF token 检查（双提交 cookie 模式）
    if (!validateCSRF(req)) {
      sendJSON(res, 403, { ok: false, message: 'CSRF token 验证失败，请刷新页面重试' })
      return
    }
  }

  // ── 全局 API 限流（健康检查除外）──
  if (p !== '/api/health' && p !== '/health') {
    const apiRateCheck = checkApiRate(getClientIP(req), method)
    if (!apiRateCheck.allowed) {
      sendJSON(res, 429, { ok: false, message: apiRateCheck.message })
      return
    }
  }

  // ═══ P2 阶段二：声明式路由表分发（双分发共存；未命中回落旧 if 链，API 契约不变）═══
  // 挂载于限流/CSRF 全局闸门之后，路由表内全部路由自动受其保护
  if (await routesShare(P2_CTX, req, res, p, method, url)) return

  // ── 所有路由处理器包裹在 try-catch 中，防止未捕获错误导致客户端挂起 ──
  try {

  // ═══ 公开读域 API（P2 批四拆分至 lib/routes-public.js；仍在 try 保护区，500 兜底不变）═══
  if (await routesPublic(P2_CTX, req, res, p, method, url)) return

  // ───── 登录 ─────
  if (p === '/api/login' && method === 'POST') {
    const clientIP = getClientIP(req)
    // 通道标识：小程序显式声明 X-Client: miniapp；缺省按 Web 处理（老客户端零影响）
    const clientType = String(req.headers['x-client'] || '').toLowerCase() === 'miniapp' ? 'miniapp' : 'web'
    // 速率限制检查
    const rateCheck = checkLoginRate(clientIP)
    if (!rateCheck.allowed) { sendJSON(res, 429, { ok: false, message: rateCheck.message }); return }
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const { id, password } = parsed
    const studentId = String(id || '').trim()
    if (!studentId || !password) { sendJSON(res, 400, { ok: false, message: '请填写学号和密码' }); return }
    if (studentId.length > 50) { sendJSON(res, 400, { ok: false, message: '学号格式不正确' }); return }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(studentId)
    if (!user || !verifyPassword(String(password), user.password)) {
      recordLoginFailure(clientIP)
      sendJSON(res, 401, { ok: false, message: '学号或密码错误' })
      return
    }
    clearLoginAttempts(clientIP)
    // ── 2FA：已启用两步验证 → 不建会话，签发短时挑战进入第二步 ──
    if (user.totp_enabled) {
      const challenge = crypto.randomBytes(32).toString('hex')
      pending2fa.set(challenge, { userId: user.id, exp: Date.now() + 5 * 60 * 1000, attempts: 0, client: clientType })
      sendJSON(res, 200, { ok: true, need2fa: true, challenge })
      return
    }
    const token = createSession(user.id, clientIP, clientType)
    if (clientType === 'miniapp') {
      // 小程序没有浏览器 cookie jar：令牌随 body 下发，客户端存本地、后续放 Authorization
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: true, user: publicUser(user), token }))
      return
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}${_cookieSecure}`,
    })
    res.end(JSON.stringify({ ok: true, user: publicUser(user) }))
    return
  }

  // ───── 两步验证登录（第二步：TOTP 动态码 或 备用恢复码，自动识别）─────
  if (p === '/api/login/2fa' && method === 'POST') {
    const clientIP = getClientIP(req)
    const rateCheck = checkLoginRate(clientIP)
    if (!rateCheck.allowed) { sendJSON(res, 429, { ok: false, message: rateCheck.message }); return }
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const { challenge, code } = parsed
    const rec = (typeof challenge === 'string' && challenge.length === 64) ? pending2fa.get(challenge) : null
    if (!rec || rec.exp < Date.now()) { if (rec) pending2fa.delete(challenge); sendJSON(res, 401, { ok: false, message: '验证会话已过期，请重新登录' }); return }
    const input = String(code || '')
    if (!input || input.length > 32) { sendJSON(res, 400, { ok: false, message: '请输入动态验证码' }); return }
    rec.attempts++
    if (rec.attempts > 5) { pending2fa.delete(challenge); recordLoginFailure(clientIP); sendJSON(res, 429, { ok: false, message: '尝试次数过多，请重新登录' }); return }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(rec.userId)
    if (!user || !user.totp_enabled) { pending2fa.delete(challenge); sendJSON(res, 401, { ok: false, message: '验证状态异常，请重新登录' }); return }
    let okVerify = false
    if (totp2fa.looksLikeBackupCode(input)) {
      // 备用恢复码：哈希比对，一次性（用后即焚）
      const codes = JSON.parse(user.backup_codes || '[]')
      const idx = codes.indexOf(totp2fa.hashBackupCode(input))
      if (idx !== -1) {
        codes.splice(idx, 1)
        db.prepare('UPDATE users SET backup_codes=? WHERE id=?').run(JSON.stringify(codes), user.id)
        okVerify = true
      }
    } else if (user.totp_secret) {
      okVerify = totp2fa.verifyTotp(user.totp_secret, input)
    }
    if (!okVerify) { recordLoginFailure(clientIP); sendJSON(res, 401, { ok: false, message: '动态验证码不正确' }); return }
    pending2fa.delete(challenge)
    clearLoginAttempts(clientIP)
    const token = createSession(user.id, clientIP, rec.client === 'miniapp' ? 'miniapp' : 'web')
    if (rec.client === 'miniapp') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: true, user: publicUser(user), token }))
      return
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}${_cookieSecure}`,
    })
    res.end(JSON.stringify({ ok: true, user: publicUser(user) }))
    return
  }

  // ───── 当前用户 ─────
  // ───── CSP violation 收集（Report-Only 阶段，2026-10-25）─────
  // 浏览器在 Report-Only 模式下会把违规项 POST 到 report-uri；此处落盘便于分析收紧
  if (p === '/api/csp-report' && method === 'POST') {
    const body = await readBody(req, 32 * 1024).catch(() => Buffer.alloc(0))
    try {
      require('fs').appendFileSync('C:/app/csp-reports.log',
        new Date().toISOString() + ' ' + body.toString('utf8').replace(/\s+/g, ' ').slice(0, 2000) + '\n')
    } catch (e) { /* 落盘失败不影响响应 */ }
    res.writeHead(204); res.end()
    return
  }

  if (p === '/api/me' && method === 'GET') {
    const user = authUser(req)
    sendJSON(res, 200, { ok: true, user: user ? publicUser(user) : null })
    return
  }

  // ───── 更新个人资料 ─────
  if (p === '/api/me/profile' && method === 'POST') {
    const user = requireAuth(req, res)
    if (!user) return
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const name = (parsed.name || '').trim()
    const college = (parsed.college || '').trim()
    const grade = (parsed.grade || '').trim()
    const bio = (parsed.bio || '').trim().slice(0, 200)
    const sets = []
    const vals = []
    if (name) { sets.push('name=?'); vals.push(name) }
    if (college) { sets.push('college=?'); vals.push(college) }
    if (grade) { sets.push('grade=?'); vals.push(grade) }
    sets.push('bio=?'); vals.push(bio)
    vals.push(user.id)
    db.prepare('UPDATE users SET ' + sets.join(', ') + ' WHERE id=?').run(...vals)
    const updated = db.prepare('SELECT * FROM users WHERE id=?').get(user.id)
    sendJSON(res, 200, { ok: true, user: publicUser(updated) })
    return
  }

  // ───── 修改密码 ─────
  if (p === '/api/me/password' && method === 'POST') {
    const user = requireAuth(req, res)
    if (!user) return
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const currentPassword = String(parsed.currentPassword || '')
    const newPassword = String(parsed.newPassword || '')
    if (!currentPassword || !newPassword) { sendJSON(res, 400, { ok: false, message: '请填写当前密码和新密码' }); return }
    const fullUser = db.prepare('SELECT * FROM users WHERE id=?').get(user.id)
    if (!fullUser || !verifyPassword(currentPassword, fullUser.password)) { sendJSON(res, 403, { ok: false, message: '当前密码不正确' }); return }
    const strength = validatePasswordStrength(newPassword)
    if (!strength.ok) { sendJSON(res, 400, { ok: false, message: strength.message }); return }
    db.prepare('UPDATE users SET password=? WHERE id=?').run(hashPassword(newPassword), user.id)
    sendJSON(res, 200, { ok: true })
    return
  }

  // ───── 2FA 状态查询 ─────
  if (p === '/api/me/2fa' && method === 'GET') {
    const user = requireAuth(req, res)
    if (!user) return
    const full = db.prepare('SELECT totp_enabled, backup_codes FROM users WHERE id=?').get(user.id)
    let remaining = 0
    try { remaining = JSON.parse(full.backup_codes || '[]').length } catch (e) {}
    sendJSON(res, 200, { ok: true, enabled: !!full.totp_enabled, backupCodesLeft: full.totp_enabled ? remaining : 0 })
    return
  }

  // ───── 2FA 开始绑定：生成密钥（启用前可反复重生成，正式生效需验证动态码）─────
  if (p === '/api/me/2fa/setup' && method === 'POST') {
    const user = requireAuth(req, res)
    if (!user) return
    const full = db.prepare('SELECT totp_enabled FROM users WHERE id=?').get(user.id)
    if (full.totp_enabled) { sendJSON(res, 400, { ok: false, message: '两步验证已启用，如需重新绑定请先关闭' }); return }
    const secret = totp2fa.generateSecret()
    db.prepare("UPDATE users SET totp_secret=?, totp_enabled=0, backup_codes='[]' WHERE id=?").run(secret, user.id)
    sendJSON(res, 200, { ok: true, secret, otpauth: totp2fa.otpauthUri(secret, user.id) })
    return
  }

  // ───── 2FA 确认启用：验证首次动态码 → 签发一次性备用恢复码（明文仅此一次）─────
  if (p === '/api/me/2fa/enable' && method === 'POST') {
    const user = requireAuth(req, res)
    if (!user) return
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const full = db.prepare('SELECT totp_secret, totp_enabled FROM users WHERE id=?').get(user.id)
    if (full.totp_enabled) { sendJSON(res, 400, { ok: false, message: '两步验证已启用' }); return }
    if (!full.totp_secret) { sendJSON(res, 400, { ok: false, message: '请先开始绑定' }); return }
    if (!totp2fa.verifyTotp(full.totp_secret, String(parsed.code || ''))) { sendJSON(res, 401, { ok: false, message: '动态码不正确，请确认验证器已添加本账号后再试' }); return }
    const codes = totp2fa.generateBackupCodes(8)
    db.prepare('UPDATE users SET totp_enabled=1, backup_codes=? WHERE id=?').run(JSON.stringify(codes.map(totp2fa.hashBackupCode)), user.id)
    sendJSON(res, 200, { ok: true, backupCodes: codes })
    return
  }

  // ───── 2FA 关闭：需密码 + 有效动态码/备用码（双因素确认，防止密码泄露单独关闭）─────
  if (p === '/api/me/2fa/disable' && method === 'POST') {
    const user = requireAuth(req, res)
    if (!user) return
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const full = db.prepare('SELECT * FROM users WHERE id=?').get(user.id)
    if (!full.totp_enabled) { sendJSON(res, 400, { ok: false, message: '尚未启用两步验证' }); return }
    if (!verifyPassword(String(parsed.password || ''), full.password)) { sendJSON(res, 403, { ok: false, message: '密码不正确' }); return }
    const input = String(parsed.code || '')
    let okVerify = full.totp_secret ? totp2fa.verifyTotp(full.totp_secret, input) : false
    if (!okVerify && totp2fa.looksLikeBackupCode(input)) {
      const codes = JSON.parse(full.backup_codes || '[]')
      const idx = codes.indexOf(totp2fa.hashBackupCode(input))
      if (idx !== -1) {
        codes.splice(idx, 1)
        db.prepare('UPDATE users SET backup_codes=? WHERE id=?').run(JSON.stringify(codes), user.id)
        okVerify = true
      }
    }
    if (!okVerify) { sendJSON(res, 401, { ok: false, message: '动态码不正确' }); return }
    db.prepare("UPDATE users SET totp_secret='', totp_enabled=0, backup_codes='[]' WHERE id=?").run(user.id)
    sendJSON(res, 200, { ok: true })
    return
  }

  // ───── 2FA 备用码重新生成（需密码确认，旧码全部作废）─────
  if (p === '/api/me/2fa/backup/regen' && method === 'POST') {
    const user = requireAuth(req, res)
    if (!user) return
    const body = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const full = db.prepare('SELECT totp_enabled, password FROM users WHERE id=?').get(user.id)
    if (!full.totp_enabled) { sendJSON(res, 400, { ok: false, message: '尚未启用两步验证' }); return }
    if (!verifyPassword(String(parsed.password || ''), full.password)) { sendJSON(res, 403, { ok: false, message: '密码不正确' }); return }
    const codes = totp2fa.generateBackupCodes(8)
    db.prepare('UPDATE users SET backup_codes=? WHERE id=?').run(JSON.stringify(codes.map(totp2fa.hashBackupCode)), user.id)
    sendJSON(res, 200, { ok: true, backupCodes: codes })
    return
  }

  // ───── 更新头像(上传图片) ─────
  if (p === '/api/me/avatar' && method === 'POST') {
    const user = requireAuth(req, res)
    if (!user) return
    const contentType = req.headers['content-type'] || ''
    if (!contentType.includes('multipart/form-data')) { sendJSON(res, 400, { ok: false, message: '请上传图片' }); return }
    const buf = await readBody(req, 5 * 1024 * 1024).catch((e) => {
      sendJSON(res, 413, { ok: false, message: '头像文件过大' })
      return null
    })
    if (!buf) return
    const { file } = parseMultipart(buf, contentType)
    if (!file) { sendJSON(res, 400, { ok: false, message: '请上传图片文件' }); return }
    // magic bytes 校验
    const avatarChk = validateUploadedFile(file, 'image')
    if (!avatarChk.ok) { sendJSON(res, 400, { ok: false, message: avatarChk.message }); return }
    const avatarDir = path.join(UPLOAD_DIR, 'avatars')
    if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true })
    const avatarName = `av_${user.id}_${Date.now()}.${avatarChk.detected}`
    fs.writeFileSync(path.join(avatarDir, avatarName), file.data)
    // 删除旧头像
    if (user.avatar) { try { fs.unlinkSync(path.join(avatarDir, user.avatar)) } catch {} }
    db.prepare('UPDATE users SET avatar=? WHERE id=?').run(avatarName, user.id)
    const updated = db.prepare('SELECT * FROM users WHERE id=?').get(user.id)
    sendJSON(res, 200, { ok: true, user: publicUser(updated) })
    return
  }

  // ───── 头像文件访问 ─────
  const avatarFile = p.match(/^\/api\/avatars\/([^/]+)$/)
  if (avatarFile && method === 'GET') {
    const name = avatarFile[1]
    const fp = path.join(UPLOAD_DIR, 'avatars', name)
    if (!fs.existsSync(fp)) { sendJSON(res, 404, { ok: false, message: '头像不存在' }); return }
    const ext = path.extname(fp)
    const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' }
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'max-age=86400' })
    fs.createReadStream(fp).pipe(res)
    return
  }

  // ───── 退出登录 ─────
  if (p === '/api/logout' && method === 'POST') {
    // 2026-11-01：Cookie 与 Bearer 两个通道都能登出
    const _tk = sessionTokenOf(req)
    if (_tk) SESSIONS.delete(_tk)
    sendJSON(res, 200, { ok: true })
    return
  }

  // ───── 远程部署(更新前端文件,需密钥) ─────
  if (p === '/api/deploy' && method === 'POST') {
    // 鉴权:仅接受 X-Deploy-Key 请求头（URL 参数传递密钥会进历史/日志，已移除）；哈希后恒时比较
    const supplied = String(req.headers['x-deploy-key'] || '')
    const h1 = crypto.createHash('sha256').update(supplied).digest()
    const h2 = crypto.createHash('sha256').update(String(DEPLOY_KEY)).digest()
    if (!supplied || !crypto.timingSafeEqual(h1, h2)) { sendJSON(res, 401, { ok: false, message: '部署密钥错误' }); return }
    const contentType = req.headers['content-type'] || ''
    if (!contentType.includes('multipart/form-data')) { sendJSON(res, 400, { ok: false, message: '请使用 multipart/form-data 上传' }); return }
    const buf = await readBody(req, 20 * 1024 * 1024).catch((e) => {
      sendJSON(res, 413, { ok: false, message: e.message === 'body_too_large' ? '文件过大' : '读取失败' })
      return null
    })
    if (!buf) return
    const { fields, files } = parseMultipartFiles(buf, contentType)
    // 是否更新后端代码(需显式声明 X-Deploy-Backend:1,且只允许白名单文件)
    const isBackend = req.headers['x-deploy-backend'] === '1'
    const BACKEND_ALLOWED = new Set(['server.js', 'db.js', 'package.json'])
    const isAllowedBackendFile = (rel) => BACKEND_ALLOWED.has(rel) || /^lib\/[A-Za-z0-9._-]+\.js$/.test(rel)
    const written = []
    for (const f of files) {
      // 安全校验:拒绝路径穿越
      const rel = (f.originalName || '').replace(/\\/g, '/')
      if (rel.includes('..') || rel.startsWith('/') || /^[a-z]:/i.test(rel)) {
        sendJSON(res, 400, { ok: false, message: '非法文件路径: ' + rel })
        return
      }
      if (isBackend) {
        // 后端文件:只允许白名单(根目录 3 文件 + lib/ 下单层 .js),写入项目根目录
        if (!isAllowedBackendFile(rel)) { sendJSON(res, 400, { ok: false, message: '不允许更新该后端文件: ' + rel }); return }
        const target = path.resolve(__dirname, rel)
        if (!target.startsWith(__dirname + path.sep) && target !== __dirname) { sendJSON(res, 400, { ok: false, message: '非法路径' }); return }
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, f.data)
        written.push('backend/' + rel)
      } else {
        // 前端文件:写入 public/  -- 扩展名白名单校验
        const FRONTEND_ALLOWED_EXTS = new Set(['.html','.js','.css','.json','.svg','.png','.jpg','.jpeg','.ico','.ttf','.woff','.woff2','.webp','.gif','.map','.txt','.xml'])
        const fext = path.extname(rel).toLowerCase()
        if (!FRONTEND_ALLOWED_EXTS.has(fext)) { sendJSON(res, 400, { ok: false, message: '不允许的文件类型: ' + fext }); return }
        const target = path.resolve(PUBLIC_DIR, rel)
        if (!target.startsWith(PUBLIC_DIR + path.sep) && target !== PUBLIC_DIR) { sendJSON(res, 400, { ok: false, message: '非法路径' }); return }
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, f.data)
        written.push(rel)
      }
    }
    sendJSON(res, 200, { ok: true, message: isBackend ? '部署成功(后端代码,即将自动重启)' : '部署成功', files: written })
    // 后端文件部署后自动重启
    if (isBackend) {
      console.log('  ⚡ 后端代码已更新, 1 秒后自动重启...')
      setTimeout(() => { process.exit(0) }, 1000)
    }
    return
  }

  // ═══ 融媒体文稿系统 API（P2 拆分至 lib/routes-articles.js）═══
  if (await routesArticles(ARTICLES_CTX, req, res, p, method, url)) return


  // ═══ 校园社区 API（P2 拆分至 lib/routes-community.js）═══
  if (await routesCommunity(COMMUNITY_CTX, req, res, p, method, url)) return


  // ═══ FTS5 统一搜索 API（阶段三 P1 · lib/routes-search.js）═══
  if (await routesSearch(P2_CTX, req, res, p, method, url)) return

  // ═══ 记忆图谱 API（阶段三 P2 · lib/routes-graph.js）═══
  if (await routesGraph(P2_CTX, req, res, p, method, url)) return

  // ═══ 嵌入 Widget API（阶段三 P3c · lib/routes-embed.js，无 XFO 供第三方 iframe）═══
  if (await routesEmbed(P2_CTX, req, res, p, method, url)) return

  // ═══ 关于我们 · 照片墙在线换图（2026-10-22 · lib/routes-about.js；读公开/写仅管理员）═══
  if (await routesAbout(ADMIN_CTX, req, res, p, method, url)) return

  // ═══ OSS 直传凭证 / 签名访问（2026-10-23 · lib/routes-oss.js）═══
  if (await routesOss(P2_CTX, req, res, p, method, url)) return


  // ═══ 创作任务 + 贡献值 API（阶段二收官 · lib/routes-tasks.js）═══
  if (await routesTasks(ROUTE_CTX_BASE, req, res, p, method, url)) return


  // ═══ 活动域 + 招新域 API（P2 批五拆分至 lib/routes-activities.js）═══
  if (await routesActivities(ACTIVITIES_CTX, req, res, p, method, url)) return


  // ═══ 素材域 + 标签管理 + 文件服务 API（P2 批六拆分至 lib/routes-materials.js）═══
  if (await routesMaterials(MATERIALS_CTX, req, res, p, method, url)) return


  // ═══ 专题系统 API（P2 批七拆分至 lib/routes-collections.js）═══
  if (await routesCollections(MATERIALS_CTX, req, res, p, method, url)) return


  // ═══ 画廊 CMS + 用户管理/通知/统计/日志/导出 API（P2 批七拆分至 lib/routes-admin.js）═══
  if (await routesAdmin(ADMIN_CTX, req, res, p, method, url)) return


  // ═══ 个人中心域 API（P2 批八收官拆分至 lib/routes-user.js；401 文案「请先登录」）═══
  if (await routesUser(USER_CTX, req, res, p, method, url)) return


  // ───── Service Worker：经无扩展名路径绕过 nginx 静态缓存，始终 no-cache ─────
  if (p === '/sw' && method === 'GET') {
    const swFp = path.join(PUBLIC_DIR, 'sw.js')
    if (fs.existsSync(swFp) && fs.statSync(swFp).isFile()) {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
      fs.createReadStream(swFp).pipe(res)
      return
    }
  }

  // ───── 静态文件(前端页面) ─────
  if (method === 'GET') {
    let fp
    if (p === '/' || p === '/index.html') fp = path.join(PUBLIC_DIR, 'index.html')
    else fp = path.join(PUBLIC_DIR, decodeURIComponent(p))
    // 防路径穿越：解析后必须仍在 PUBLIC_DIR 内（path.relative 不接受 '..' 前缀与绝对路径）
    const relFromPub = path.relative(PUBLIC_DIR, fp)
    if (relFromPub.startsWith('..') || path.isAbsolute(relFromPub)) { sendJSON(res, 403, { ok: false, message: 'forbidden' }); return }
    if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      const ext = path.extname(fp)
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t' }
      const contentType = types[ext] || 'application/octet-stream'
      const acceptEnc = req.headers['accept-encoding'] || ''
      const canGzip = acceptEnc.includes('gzip') && ['.html','.js','.css','.json','.svg','.m3u8'].includes(ext)
      // HTML 一律 no-cache（每次向服务端验证，未变返回 304）：避免"旧页面引用旧 JS 版本号 → 缓存 30 天 → 改了看不到"的死循环
      const cacheHeader = p === '/sw.js' ? 'no-cache, no-store, must-revalidate' : (ext === '.html' ? 'no-store, no-cache, must-revalidate, max-age=0' : (['.js','.css','.png','.jpg','.jpeg','.webp','.svg','.ico','.ttf','.woff2','.woff'].includes(ext) ? 'public, max-age=2592000' : 'no-cache'))
      const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        // ── CSP 第一阶段：Report-Only（2026-10-25）──
        // 依据实测盘点：内联 script 30 块 / 178.5KB、内联 style 12 块 / 88.7KB、
        // 行内事件属性 496 处、javascript: URL 5 处、shared.js 有 1 处 new Function。
        // 故本阶段必须保留 'unsafe-inline' 与 'unsafe-eval'；Report-Only 只上报不拦截，零风险。
        // 收紧路线：① 把 496 处 onclick 改为 addEventListener ② 内联脚本改外部文件或加 nonce
        //          ③ ~~去掉 new Function~~ ✅ 已完成（2026-10-25）④ 切换为正式 Content-Security-Policy
        'Content-Security-Policy-Report-Only': [
          "default-src 'self'",
          // 2026-10-25 收紧第一步：移除 'unsafe-eval'（全项目已无 eval / new Function，
          //   shared.js 原 706 行的 new Function 已改为 ctaFn 函数引用）
          // 仍保留 'unsafe-inline'：30 个内联脚本块 + 496 处行内 onclick + 12 个内联 <style>
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "media-src 'self' blob:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "frame-ancestors 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
          'report-uri /api/csp-report',
        ].join('; '),
      }
      if (ext === '.html') {
        const html = injectOGTags(fs.readFileSync(fp, 'utf8'), p, req)
        const bodyBuf = Buffer.from(html, 'utf8')
        if (canGzip) {
          const gz = zlib.gzipSync(bodyBuf, { level: 6 })
          res.writeHead(200, Object.assign({ 'Content-Type': contentType, 'Content-Encoding': 'gzip', 'Cache-Control': cacheHeader, 'Vary': 'Accept-Encoding' }, securityHeaders))
          res.end(gz)
        } else {
          res.writeHead(200, Object.assign({ 'Content-Type': contentType, 'Cache-Control': cacheHeader }, securityHeaders))
          res.end(bodyBuf)
        }
        return
      }
      if (canGzip) {
        const raw = fs.readFileSync(fp)
        const gz = zlib.gzipSync(raw, { level: 6 })
        res.writeHead(200, Object.assign({ 'Content-Type': contentType, 'Content-Encoding': 'gzip', 'Cache-Control': cacheHeader, 'Vary': 'Accept-Encoding' }, securityHeaders))
        res.end(gz)
      } else {
        res.writeHead(200, Object.assign({ 'Content-Type': contentType, 'Cache-Control': cacheHeader }, securityHeaders))
        fs.createReadStream(fp).pipe(res)
      }
      return
    }
  }

  if (!res.headersSent) sendJSON(res, 404, { ok: false, message: '接口不存在' })

  } catch (err) {
    console.error('⚠ 路由处理异常:', err.message)
    if (!res.headersSent) sendJSON(res, 500, { ok: false, message: '服务器内部错误' })
  }
})

// ───── 全局错误保护:任何异常只返回错误,不让进程崩溃 ─────
server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
})
process.on('uncaughtException', (err) => {
  console.error('⚠ 未捕获异常, 进程即将退出:', err.message, err.stack)
  // 记录到专用错误日志
  try {
    const fs2 = require('node:fs')
    const logLine = `[${new Date().toISOString()}] UNCAUGHT: ${err.message}\n${err.stack || '(no stack)'}\n`
    fs2.appendFileSync(path.join(__dirname, 'crash.log'), logLine)
  } catch {}
  // 给服务器几秒时间发送完正在处理的响应
  setTimeout(() => { process.exit(1) }, 3000)
})
process.on('unhandledRejection', (reason) => {
  const msg = reason && reason.message ? reason.message : String(reason)
  console.error('⚠ 未处理的Promise拒绝(已保护):', msg)
  // 记录到专用错误日志
  try {
    const fs3 = require('node:fs')
    const logLine = `[${new Date().toISOString()}] UNHANDLED_REJECTION: ${msg}\n${reason && reason.stack ? reason.stack : '(no stack)'}\n`
    fs3.appendFileSync(path.join(__dirname, 'crash.log'), logLine)
  } catch {}
})

const HOST = process.env.HOST || '0.0.0.0'
server.listen(PORT, HOST, () => {
  console.log(`✅ 校园素材库后端已启动: http://${HOST}:${PORT}`)
  console.log(`   健康检查: http://localhost:${PORT}/api/health`)
  console.log(`   部署密钥: ${DEPLOY_KEY.slice(0, 8)}...${DEPLOY_KEY.slice(-4)} (完整密钥见 .deploy-key 文件)`)
})
