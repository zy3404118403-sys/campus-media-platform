'use strict'
/**
 * 校园素材库 · SQLite 数据层
 * 使用 Node 22 内置 node:sqlite,零 npm 依赖
 */
const { DatabaseSync } = require('node:sqlite')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')

/* 数据目录自动探测：旧布局（数据在代码同级）与新布局（.seedance-data/）都认。
   目的：同一份代码可以部署到尚未重排的服务器，也让线上重排可以分步做。
   探测顺序 = 优先找到已存在的目录；都没有时用最后一个（新布局，由下方 mkdir 创建）。
   ⚠️ 移动/重命名 .seedance-data 必须同步改这里的候选列表。 */
function pickDir() {
  for (let i = 0; i < arguments.length; i++) {
    try { if (fs.existsSync(arguments[i])) return arguments[i] } catch (e) { /* 忽略探测异常 */ }
  }
  return arguments[arguments.length - 1]
}

const DATA_DIR = pickDir(
  path.join(__dirname, 'data'),
  path.join(__dirname, '..', '.seedance-data', 'data')
)
const UPLOAD_DIR = pickDir(
  path.join(__dirname, 'uploads'),
  path.join(__dirname, '..', '.seedance-data', 'uploads')
)
console.log('  数据目录:', DATA_DIR)
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbs')
if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR, { recursive: true })

const DB_PATH = path.join(DATA_DIR, 'campus.db')
const db = new DatabaseSync(DB_PATH)

// —— 连接级 PRAGMA（Phase1 · S-2 并发健壮性止血）——
// WAL：写不再阻塞读，消除并发访问时的 SQLITE_BUSY 报错；副作用是 data/ 下会出现 -wal/-shm 伴生文件
db.exec(`PRAGMA journal_mode = WAL`)
// 遇到锁竞争时先等待 5 秒再报错，而不是立刻失败
db.exec(`PRAGMA busy_timeout = 5000`)
// WAL 模式推荐档位：掉电最多丢最后一次事务的持久化速度，不损一致性
db.exec(`PRAGMA synchronous = NORMAL`)

// 基础表
db.exec(`
  CREATE TABLE IF NOT EXISTS colleges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    desc TEXT,
    icon TEXT,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,            -- 学号(登录名)
    name TEXT NOT NULL,
    password TEXT NOT NULL,         -- 明文(演示)。真实环境请换 bcrypt
    college TEXT,
    grade TEXT,
    avatar TEXT,                    -- 头像文件名(存 uploads/avatars/)
    bio TEXT,                       -- 个人简介
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    college TEXT,
    author TEXT,
    author_id TEXT,
    description TEXT,
    shot_date TEXT,
    tags TEXT DEFAULT '',           -- 逗号分隔的标签
    status TEXT DEFAULT 'approved', -- draft | pending_review | approved | published | archived | rejected
    filename TEXT,                  -- 服务端保存的文件名
    original_name TEXT,             -- 原始文件名
    file_size INTEGER DEFAULT 0,
    mime TEXT,
    width INTEGER DEFAULT 0,        -- 图片/视频宽度(px)
    height INTEGER DEFAULT 0,       -- 图片/视频高度(px)
    duration INTEGER DEFAULT 0,     -- 视频/音频时长(秒)
    thumb_filename TEXT,            -- 缩略图文件名(存 uploads/thumbs/)
    downloads INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT,
    status TEXT DEFAULT 'upcoming',  -- ongoing | upcoming | ended
    icon TEXT,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS recruits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    sid TEXT,
    grade TEXT,
    college TEXT,
    email TEXT,
    resume_name TEXT,
    resume_file TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS material_likes (
    material_id INTEGER,
    user_id TEXT,
    PRIMARY KEY (material_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS material_favorites (
    material_id INTEGER,
    user_id TEXT,
    PRIMARY KEY (material_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS activity_joins (
    activity_id INTEGER,
    user_id TEXT,
    PRIMARY KEY (activity_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT NOT NULL,            -- 通知接收人(素材上传者)
    material_id INTEGER,
    material_title TEXT,
    actor TEXT,                     -- 触发动作的人
    action TEXT,                    -- 'download' | 'like'
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS material_status_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    from_status TEXT,               -- 变更前状态
    to_status TEXT NOT NULL,        -- 变更后状态
    action TEXT NOT NULL,           -- submit | approve | reject | publish | archive | unarchive | resubmit
    operator_id TEXT,               -- 操作者学号
    operator_name TEXT,             -- 操作者姓名
    reason TEXT,                    -- 审核原因/备注
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    method TEXT,
    path TEXT,
    user_agent TEXT,
    referer TEXT,
    user_id TEXT,                   -- 登录用户学号(未登录为 NULL)
    user_name TEXT,                 -- 登录用户姓名
    region TEXT,                    -- IP 归属省份
    city TEXT,                      -- IP 归属城市
    status_code INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS ip_cache (
    ip TEXT PRIMARY KEY,
    region TEXT,
    city TEXT,
    isp TEXT,
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_access_logs_created ON access_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_access_logs_ip ON access_logs(ip);
  CREATE INDEX IF NOT EXISTS idx_access_logs_region ON access_logs(region);
`)

// ── 迁移:为已存在的数据库补充新列(兼容旧库) ──
function ensureColumn(table, col, def) {
  try {
    // 用 PRAGMA 检测列是否真的存在
    const cols = db.prepare(`PRAGMA table_info(${table})`).all()
    const exists = cols.some(c => c.name === col)
    if (!exists) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`)
      console.log(`  ✓ 迁移: ${table}.${col} 已添加`)
    }
  } catch (e) {
    console.log(`  ⚠ 迁移: ${table}.${col} 失败: ${e.message}`)
  }
}
ensureColumn('users', 'avatar', "TEXT DEFAULT ''")
ensureColumn('users', 'bio', "TEXT DEFAULT ''")
ensureColumn('users', 'created_at', "TEXT DEFAULT ''")  // 常量默认值,SQLite 才允许 ALTER ADD
ensureColumn('materials', 'tags', "TEXT DEFAULT ''")
ensureColumn('materials', 'status', "TEXT DEFAULT 'approved'")
ensureColumn('materials', 'width', "INTEGER DEFAULT 0")
ensureColumn('materials', 'height', "INTEGER DEFAULT 0")
ensureColumn('materials', 'featured', "INTEGER DEFAULT 0")  // 运营批(2026-09-22)：精选标记，审核端点 feature/unfeature 切换
ensureColumn('materials', 'duration', "INTEGER DEFAULT 0")
ensureColumn('materials', 'thumb_filename', "TEXT DEFAULT ''")
ensureColumn('materials', 'drive_url', "TEXT DEFAULT ''")
ensureColumn('materials', 'sub_type', "TEXT DEFAULT ''")
ensureColumn('activities', 'poster', "TEXT DEFAULT ''")
  ensureColumn('users', 'role', "TEXT DEFAULT 'student'")
  // ── 2FA 两步验证（TOTP）──
  ensureColumn('users', 'totp_secret', "TEXT DEFAULT ''")
  ensureColumn('users', 'totp_enabled', 'INTEGER DEFAULT 0')
  ensureColumn('users', 'backup_codes', "TEXT DEFAULT '[]'")
  ensureColumn('articles', 'scheduled_at', "TEXT DEFAULT ''")
  ensureColumn('activities', 'capacity', 'INTEGER DEFAULT 0')
  ensureColumn('activities', 'location', "TEXT DEFAULT ''")
  ensureColumn('activities', 'sign_in_code', "TEXT DEFAULT ''")
  ensureColumn('activities', 'capacity', 'INTEGER DEFAULT 0')
  ensureColumn('activities', 'location', "TEXT DEFAULT ''")
  ensureColumn('activities', 'sign_in_code', "TEXT DEFAULT ''")
// 已有素材默认 published(存量数据不受影响)
try { db.exec("UPDATE materials SET status='published' WHERE status IS NULL OR status='' OR status='pending'") } catch (e) {}

// ── 安全迁移:将默认弱密码更新为强密码(仅当密码仍为默认值时执行) ──
// 初始密码不硬编码：优先读环境变量 ADMIN_INIT_PASSWORD / DEMO_INIT_PASSWORD，
// 未设置时随机生成并仅在控制台打印一次（历史字面量密码已移除——本文件随代码分发，硬编码=公开初始口令）。
function _randomPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 16; i++) s += alphabet[crypto.randomInt(alphabet.length)]
  return s + '!Aa1'
}
try {
  const adminRow = db.prepare("SELECT password FROM users WHERE id='admin'").get()
  if (adminRow && adminRow.password === '123456') {
    const pw = process.env.ADMIN_INIT_PASSWORD || _randomPassword()
    db.prepare("UPDATE users SET password=? WHERE id='admin'").run(pw)
    console.log('  ✓ 安全迁移: admin 密码已更新为强密码' + (process.env.ADMIN_INIT_PASSWORD ? '' : '（随机生成，仅本次打印）: ' + pw))
  }
} catch (e) { console.log('  ⚠ 安全迁移 admin 密码失败:', e.message) }

try {
  const demoRow = db.prepare("SELECT password FROM users WHERE id='demo'").get()
  if (demoRow && demoRow.password === 'demo') {
    const pw = process.env.DEMO_INIT_PASSWORD || _randomPassword()
    db.prepare("UPDATE users SET password=? WHERE id='demo'").run(pw)
    console.log('  ✓ 安全迁移: demo 密码已更新为强密码（随机生成，仅本次打印）: ' + pw)
  }
} catch (e) { console.log('  ⚠ 安全迁移 demo 密码失败:', e.message) }

// ── 角色迁移:管理员回填 role ──
  try { const r = db.prepare("UPDATE users SET role = 'admin' WHERE is_admin = 1 AND (role IS NULL OR role = 'student')").run(); if (r.changes > 0) console.log('  ✓ 角色迁移: ' + r.changes + ' 个管理员已回填 role=admin') } catch (e) {}

  // ── 安全迁移:将所有明文密码哈希化(scrypt) ──
try {
  const allUsers = db.prepare('SELECT id, password FROM users').all()
  const updatePwd = db.prepare('UPDATE users SET password=? WHERE id=?')
  let hashed = 0
  for (const u of allUsers) {
    if (!isHashed(u.password)) {
      updatePwd.run(hashPassword(u.password), u.id)
      hashed++
    }
  }
  if (hashed > 0) console.log(`  ✓ 安全迁移: ${hashed} 个用户密码已哈希化(scrypt)`)
} catch (e) { console.log('  ⚠ 密码哈希迁移失败:', e.message) }

// ── 种子数据(首次运行写入) ──
const count = db.prepare('SELECT COUNT(*) c FROM colleges').get().c
if (count === 0) {
  const colleges = [
    ['kuajing', '商学院', '跨商融合，链接全球', '🌐', '#e53e3e'],
    ['guanli', '管理学院', '管以修身，理以治业', '📋', '#3182ce'],
    ['waiyu', '外语外贸学院', '语通世界，贸连八方', '🌍', '#38a169'],
    ['wenxue', '人文学院', '文以载道，创以致远', '✍️', '#d53f8c'],
    ['shuxue', '计算机学院', '数启智慧，计算未来', '💻', '#dd6b20'],
    ['dashuju', '智能工程学院', '数据驱动，智创未来', '🤖', '#805ad5'],
    ['chaoda', '数字治理学院', '数治超大城市，智绘美好生活', '🏙️', '#e53e3e'],
    ['yishu', '设计学院', '艺海无涯，设计有道', '🎨', '#d53f8c'],
    ['yinyue', '音乐学院', '弦歌不辍，舞动青春', '🎵', '#b83280'],
    ['jiaoyu', '教育学院', '立德树人，育人为本', '📚', '#38a169'],
    ['tiyu', '体育学院', '野蛮体魄，文明精神', '🏃', '#dd6b20'],
    ['makesi', '通识教育学院', '信仰坚定，理论先行', '⭐', '#e53e3e'],
    ['guoji', '国际学院', '融通中外，兼济天下', '🤝', '#3182ce'],
    ['rongmeiti', '传媒学院', '光影叙事，融媒传播', '🎬', '#e53e3e'],
  ]
  const insC = db.prepare('INSERT INTO colleges (id,name,desc,icon,color) VALUES (?,?,?,?,?)')
  colleges.forEach(c => insC.run(...c))

  // 演示账号(密码已哈希)
  // admin/demo 初始密码不硬编码：环境变量优先，否则随机生成并仅打印一次（与上方安全迁移共用策略）
  const _adminPw = process.env.ADMIN_INIT_PASSWORD || _randomPassword()
  const _demoPw = process.env.DEMO_INIT_PASSWORD || _randomPassword()
  console.log('  ✓ 初始账号 admin 密码: ' + _adminPw + '（仅本次打印，登录后请立即修改）')
  const insU = db.prepare('INSERT INTO users (id,name,password,college,grade,is_admin) VALUES (?,?,?,?,?,?)')
  insU.run('admin', '管理员', hashPassword(_adminPw), '设计学院', '2023级', 1)
  insU.run('20230001', '李明', hashPassword('Student@2026'), '设计学院', '2023级', 0)
  insU.run('20230002', '张华', hashPassword('Student@2026'), '人文学院', '2023级', 0)
  insU.run('20240001', '王芳', hashPassword('Student@2026'), '商学院', '2024级', 0)
  insU.run('20240002', '陈实', hashPassword('Student@2026'), '智能工程学院', '2024级', 0)
  insU.run('demo', '演示学生', hashPassword(_demoPw), '设计学院', '2024级', 0)
  console.log('  ✓ 初始账号 demo 密码: ' + _demoPw + '（仅本次打印）')

  // 样例素材(与前端原数据对应)
  const seedMaterials = [
    ['校园春日樱花摄影集', '图片', '设计学院', '李明', '20230001', 86],
    ['校运会精彩瞬间混剪', '视频', '人文学院', '张华', '20230002', 142],
    ['大创答辩PPT模板', '文档', '商学院', '王芳', '20240001', 235],
    ['校园广播片头音乐', '音频', '人文学院', '陈实', '20240002', 53],
    ['图书馆建筑摄影组图', '图片', '计算机学院', '刘洋', null, 67],
    ['校园微电影《青春序曲》', '视频', '设计学院', '赵薇薇', null, 198],
    ['校园文化节海报设计稿', '图片', '设计学院', '周婷', null, 104],
    ['模拟法庭辩论赛录像', '视频', '通识教育学院', '吴磊', null, 76],
    ['数据结构课程笔记整理', '文档', '智能工程学院', '郑宇', null, 312],
    ['校园Vlog - 一日生活', '视频', '人文学院', '林佳', null, 89],
    ['毕业季纪念视频素材包', '视频', '人文学院', '融媒体中心', null, 156],
    ['校园植物图鉴手册', '文档', '计算机学院', '孙逸', null, 44],
  ]
  const insM = db.prepare('INSERT INTO materials (title,type,college,author,author_id,downloads,status) VALUES (?,?,?,?,?,?,?)')
  seedMaterials.forEach(m => insM.run(m[0],m[1],m[2],m[3],m[4],m[5],'published'))

  // 活动
  const insA = db.prepare('INSERT INTO activities (title,description,date,status,icon,color) VALUES (?,?,?,?,?,?)')
  const acts = [
    ['「光影校园」摄影大赛', '用镜头记录校园之美。优秀作品将在校史馆展出并在官微推送。', '2026年3月15日 - 4月15日', 'ended', '📸', 'linear-gradient(135deg, #667eea, #764ba2)'],
    ['「青春视界」短视频大赛', '围绕「青春·校园·梦想」主题创作短视频，最佳作品将推荐参加省级比赛。', '2026年5月1日 - 6月10日', 'ongoing', '🎬', 'linear-gradient(135deg, #f093fb, #f5576c)'],
    ['「创意无限」平面设计大赛', '设计校园文创产品图案，入选作品将制成实物发售。', '2026年6月1日 - 7月1日', 'upcoming', '🎨', 'linear-gradient(135deg, #4facfe, #00f2fe)'],
    ['「声动校园」配音大赛', '影视片段配音、纪录片旁白皆可参加，单人组和团体组分别评奖。', '2026年7月20日 - 8月20日', 'upcoming', '🎙️', 'linear-gradient(135deg, #43e97b, #38f9d7)'],
    ['「笔墨校园」新闻采写大赛', '围绕校园新闻事件进行采访与写作，优秀稿件将在校报刊登。', '2026年8月1日 - 8月30日', 'upcoming', '✏️', 'linear-gradient(135deg, #a18cd1, #fbc2eb)'],
    ['「映像校园」微电影展映周', '征集校园微电影作品，评审后在学术报告厅进行为期一周的展映。', '2026年9月10日 - 10月20日', 'upcoming', '🎞️', 'linear-gradient(135deg, #fa709a, #fee140)'],
  ]
  acts.forEach(a => insA.run(...a))
}

// ── 迁移:补充缺失的学院(存量数据库) ──
{
  const exists = db.prepare("SELECT COUNT(*) c FROM colleges WHERE id=? OR name=?").get('rongmeiti', '传媒学院')
  if (exists.c === 0) {
    db.prepare("INSERT INTO colleges (id,name,desc,icon,color) VALUES (?,?,?,?,?)")
      .run('rongmeiti', '传媒学院', '光影叙事，融媒传播', '🎬', '#e53e3e')
    console.log('  ✓ 迁移: 新增学院 传媒学院')
  }
}

// ── 密码哈希(Node 内置 crypto.scrypt,零依赖) ──
// 存储格式: salt_hex:hash_hex (salt 16字节, hash 64字节)
function hashPassword(plain) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(plain, salt, 64)
  return salt.toString('hex') + ':' + hash.toString('hex')
}

function verifyPassword(plain, stored) {
  if (!stored || typeof stored !== 'string') return false
  // 如果不是 salt:hash 格式,说明是明文(旧数据),直接比较
  if (!stored.includes(':')) return plain === stored
  const [saltHex, hashHex] = stored.split(':')
  try {
    const salt = Buffer.from(saltHex, 'hex')
    const expectedHash = Buffer.from(hashHex, 'hex')
    const hash = crypto.scryptSync(plain, salt, 64)
    return crypto.timingSafeEqual(hash, expectedHash)
  } catch {
    return false
  }
}

// 判断密码是否已哈希
function isHashed(pwd) {
  return typeof pwd === 'string' && pwd.includes(':') && pwd.split(':').length === 2
}

// ── 查询辅助 ──
function publicUser(u) {
  if (!u) return null
  return {
    id: u.id, name: u.name, college: u.college, grade: u.grade,
    avatar: u.avatar || '', bio: u.bio || '', is_admin: !!u.is_admin, role: u.role || (u.is_admin ? 'admin' : 'student'),
    totp_enabled: !!u.totp_enabled
  }
}

// ── v2 迁移:融媒体文稿系统 + 新媒体矩阵 ──
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    cover_image TEXT DEFAULT '',
    author_id TEXT NOT NULL,
    author_name TEXT DEFAULT '',
    category TEXT DEFAULT 'news',
    review_level INTEGER DEFAULT 1,
    status TEXT DEFAULT 'draft',
    publish_targets TEXT DEFAULT '[]',
    published_at TEXT,
    views INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS article_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    reviewer_id TEXT NOT NULL,
    reviewer_name TEXT DEFAULT '',
    review_stage TEXT NOT NULL,
    action TEXT NOT NULL,
    comment TEXT DEFAULT '',
    annotations TEXT DEFAULT '[]',
    content_snapshot TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (article_id) REFERENCES articles(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sensitive_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE,
    level TEXT DEFAULT 'medium',
    category TEXT DEFAULT '',
    replacement TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS media_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_id TEXT DEFAULT '',
    owner_id TEXT,
    owner_name TEXT DEFAULT '',
    department TEXT DEFAULT '',
    qr_code TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    registered_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS publish_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    external_id TEXT DEFAULT '',
    external_url TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    error_msg TEXT DEFAULT '',
    published_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (article_id) REFERENCES articles(id)
  );

  CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
  CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id);
  CREATE INDEX IF NOT EXISTS idx_article_reviews_article ON article_reviews(article_id);
  CREATE INDEX IF NOT EXISTS idx_publish_logs_article ON publish_logs(article_id);
`)

// 敏感词种子数据
{
  const swCount = db.prepare('SELECT COUNT(*) c FROM sensitive_words').get().c
  if (swCount === 0) {
    const seedWords = [
      ['反动', 'high', '政治', ''], ['暴恐', 'high', '暴力', ''],
      ['色情', 'high', '色情', ''], ['赌博', 'high', '违法', ''],
      ['毒品', 'high', '违法', ''], ['诈骗', 'high', '违法', ''],
      ['法轮', 'high', '政治', ''], ['六四', 'high', '政治', ''],
      ['传销', 'medium', '违法', ''], ['枪支', 'medium', '暴力', ''],
      ['弹药', 'medium', '暴力', ''], ['炸药', 'medium', '暴力', ''],
      ['个人信息', 'medium', '隐私', ''], ['手机号', 'low', '隐私', ''],
      ['微信号', 'low', '隐私', ''], ['QQ群', 'low', '广告', ''],
    ]
    const ins = db.prepare('INSERT OR IGNORE INTO sensitive_words (word,level,category,replacement) VALUES (?,?,?,?)')
    seedWords.forEach(w => ins.run(...w))
    console.log('  ✓ 敏感词库: 已写入 ' + seedWords.length + ' 条种子数据')
  }
}

console.log('  ✓ v2迁移: 文稿系统5张表已就绪')

// ── v3 迁移:校园社区系统 ──
db.exec(`
  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id TEXT NOT NULL,
    author_name TEXT DEFAULT '',
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    category TEXT DEFAULT 'campus',
    tags TEXT DEFAULT '[]',
    cover_image TEXT DEFAULT '',
    column_id INTEGER,
    status TEXT DEFAULT 'pending',
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS blog_columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id TEXT NOT NULL,
    owner_name TEXT DEFAULT '',
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    cover TEXT DEFAULT '',
    subscribers INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS blog_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT DEFAULT '',
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (post_id) REFERENCES blog_posts(id)
  );

  CREATE TABLE IF NOT EXISTS blog_likes (
    post_id INTEGER,
    user_id TEXT,
    PRIMARY KEY (post_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS forum_boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '💬',
    sort_order INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    is_anonymous INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS forum_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT DEFAULT '',
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    is_anonymous INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    views INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (board_id) REFERENCES forum_boards(id)
  );

  CREATE TABLE IF NOT EXISTS forum_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT DEFAULT '',
    content TEXT NOT NULL,
    parent_reply_id INTEGER,
    is_anonymous INTEGER DEFAULT 0,
    status TEXT DEFAULT 'approved',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (thread_id) REFERENCES forum_threads(id)
  );

  CREATE TABLE IF NOT EXISTS wall_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id TEXT NOT NULL,
    author_name TEXT DEFAULT '',
    content TEXT NOT NULL,
    images TEXT DEFAULT '[]',
    is_anonymous INTEGER DEFAULT 0,
    tag TEXT DEFAULT '分享',
    emotion TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    is_featured INTEGER DEFAULT 0,
    expires_at TEXT,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS wall_likes (
    post_id INTEGER,
    user_id TEXT,
    PRIMARY KEY (post_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS wall_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT DEFAULT '',
    content TEXT NOT NULL,
    is_anonymous INTEGER DEFAULT 0,
    status TEXT DEFAULT 'approved',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (post_id) REFERENCES wall_posts(id)
  );

  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#1D3A6B',
    is_visible INTEGER DEFAULT 1,
    created_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS collection_items (
    collection_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    added_by TEXT DEFAULT '',
    added_at TEXT DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (collection_id, material_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id)
  );

  CREATE TABLE IF NOT EXISTS article_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    title TEXT DEFAULT '',
    content TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    saved_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (article_id) REFERENCES articles(id)
  );

  CREATE TABLE IF NOT EXISTS user_follows (
    follower_id TEXT NOT NULL,
    followee_id TEXT NOT NULL,
    type TEXT DEFAULT 'user',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (follower_id, followee_id, type)
  );

  CREATE TABLE IF NOT EXISTS content_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id TEXT NOT NULL,
    reporter_name TEXT DEFAULT '',
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    reason TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    handled_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
  CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts(author_id);
  CREATE INDEX IF NOT EXISTS idx_blog_comments_post ON blog_comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_forum_threads_board ON forum_threads(board_id);
  CREATE INDEX IF NOT EXISTS idx_forum_replies_thread ON forum_replies(thread_id);
  CREATE INDEX IF NOT EXISTS idx_wall_posts_status ON wall_posts(status);
  CREATE INDEX IF NOT EXISTS idx_wall_comments_post ON wall_comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_collection_items_cid ON collection_items(collection_id);
  CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
  CREATE INDEX IF NOT EXISTS idx_article_versions_aid ON article_versions(article_id);
`)

// 论坛版块种子数据（运营批 2026-09-22：icon 用图标 key，渲染端映射 SVG，禁 emoji）
{
  const boardCount = db.prepare('SELECT COUNT(*) c FROM forum_boards').get().c
  if (boardCount === 0) {
    const boards = [
      ['学习交流', '课程讨论、资料分享、学业互助', 'study', 1, 0],
      ['校园生活', '日常分享、活动记录、生活感悟', 'life', 2, 0],
      ['求职实习', '招聘信息、面试经验、职业规划', 'job', 3, 0],
      ['二手交易', '闲置物品交易、求购信息', 'market', 4, 0],
      ['技术讨论', '编程、设计、创作等技术话题', 'tech', 5, 0],
      ['问答互助', '校园问答、求助解答', 'qa', 6, 0],
      ['树洞', '匿名倾诉、心事分享（匿名版块）', 'tree', 7, 1],
      ['失物招领', '丢失/拾获物品登记', 'lost', 8, 0],
    ]
    const ins = db.prepare('INSERT INTO forum_boards (name,description,icon,sort_order,is_anonymous) VALUES (?,?,?,?,?)')
    boards.forEach(b => ins.run(...b))
    console.log('  ✓ 论坛版块: 已写入 ' + boards.length + ' 个版块')
  } else {
    // 数据迁移：存量库的 emoji 板块图标 → 图标 key（按名称精确匹配，幂等）
    const up = db.prepare('UPDATE forum_boards SET icon = ? WHERE name = ? AND icon = ?')
    const mig = [['study', '学习交流', '📚'], ['life', '校园生活', '🏠'], ['job', '求职实习', '💼'], ['market', '二手交易', '🛒'], ['tech', '技术讨论', '💻'], ['qa', '问答互助', '❓'], ['tree', '树洞', '🌙'], ['lost', '失物招领', '🔍']]
    let n = 0
    mig.forEach(([k, name, emoji]) => { const r = up.run(k, name, emoji); n += r.changes })
    if (n) console.log('  ✓ 迁移: forum_boards.icon emoji→key 共 ' + n + ' 行')
  }
}

console.log('  ✓ v3迁移: 校园社区8张表已就绪')

// ── v4 迁移:创作任务 + 贡献值体系 ──
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'news',      -- news|video|photo|design|other
    points INTEGER DEFAULT 10,         -- 完成奖励贡献值
    slots INTEGER DEFAULT 0,           -- 可领取人数,0=不限
    deadline TEXT DEFAULT '',          -- 截止时间(空=长期)
    status TEXT DEFAULT 'open',        -- open|closed
    created_by TEXT DEFAULT '',
    created_by_name TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS task_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT DEFAULT '',
    status TEXT DEFAULT 'claimed',     -- claimed|submitted|approved|rejected
    submission_note TEXT DEFAULT '',   -- 成果说明
    article_id INTEGER,                -- 关联文稿(可选)
    submitted_at TEXT,
    reviewed_by TEXT DEFAULT '',
    review_comment TEXT DEFAULT '',
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );

  CREATE TABLE IF NOT EXISTS contribution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT DEFAULT '',
    points INTEGER NOT NULL,           -- 可为负(手动扣减)
    type TEXT NOT NULL,                -- task_approved|article_published|adjust
    ref_id TEXT DEFAULT '',            -- 关联对象(任务领取id/文稿id/调整流水id)
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(type, ref_id)               -- 防重复加分(重复发布/重复审核)
  );

  CREATE INDEX IF NOT EXISTS idx_task_claims_task ON task_claims(task_id);
  CREATE INDEX IF NOT EXISTS idx_task_claims_user ON task_claims(user_id);
  CREATE INDEX IF NOT EXISTS idx_contribution_logs_user ON contribution_logs(user_id);
`)
console.log('  ✓ v4迁移: 创作任务+贡献值3张表已就绪')

// ── v5 迁移:素材免登录公开分享（P2 阶段二 F-1）──
db.exec(`
  CREATE TABLE IF NOT EXISTS material_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,        -- 分享令牌(randomBytes 64hex)，即 /s/:token 中的 token
    material_id INTEGER NOT NULL,
    created_by TEXT NOT NULL,          -- 创建者学号(users.id)
    created_by_name TEXT DEFAULT '',
    view_count INTEGER DEFAULT 0,      -- 分享页打开次数
    download_count INTEGER DEFAULT 0,  -- 经分享链接下载次数
    expires_at TEXT DEFAULT '',        -- 空=永久有效(预留字段)
    revoked INTEGER DEFAULT 0,         -- 1=已撤销
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (material_id) REFERENCES materials(id)
  );
  CREATE INDEX IF NOT EXISTS idx_shares_token ON material_shares(token);
  CREATE INDEX IF NOT EXISTS idx_shares_material ON material_shares(material_id);
`)
console.log('  ✓ v5迁移: 素材分享表已就绪')

// ── v5.5 迁移:补齐 tags / asset_tags 建表 ──
// 历史上这两张表只存在于生产库（早期手工创建），代码从未写过建表语句——
// 空库首次启动时，v6 的触发器引用不存在的表会直接崩（no such table: main.asset_tags）。
// 2026-11-04 从生产库提取真实 schema 补齐；IF NOT EXISTS 幂等，存量库不受影响。
db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    source TEXT DEFAULT 'manual',
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS asset_tags (
    material_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    source TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (material_id, tag_id)
  );
`)
console.log('  ✓ v5.5迁移: tags / asset_tags 建表兜底已就绪')

// ── v6 迁移:FTS5 统一搜索（P1 阶段三）──
// search_src 存元数据（type/ref_id/status），search_fts 自持倒排索引（rowid=search_src.id），
// 4 张业务表触发器双写两表保持同步。trigram：≥3 字走 MATCH，<3 字走 LIKE 兜底（探针 fts5-probe2.cjs）。
db.exec(`
  CREATE TABLE IF NOT EXISTS search_src (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,              -- material|blog|forum|wall
    ref_id INTEGER NOT NULL,         -- 业务表主键
    status TEXT DEFAULT '',          -- 业务表状态快照（查询只取 published）
    title TEXT DEFAULT '',           -- 素材/博文/帖子=标题，墙贴=tag（对齐旧接口语义）
    body TEXT DEFAULT '',            -- 素材=description，博文=summary，帖子/墙贴=content（均无 HTML 的字段）
    tags TEXT DEFAULT '',            -- 素材标签逗号串；墙贴=tag；其他空
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(type, ref_id)
  );
  CREATE INDEX IF NOT EXISTS idx_search_src_type ON search_src(type, ref_id);
  CREATE INDEX IF NOT EXISTS idx_search_src_status ON search_src(status);
  DROP TABLE IF EXISTS search_fts;
  CREATE VIRTUAL TABLE search_fts USING fts5(title, body, tags, tokenize='trigram');
  DROP TRIGGER IF EXISTS trg_search_mat_ai;
  DROP TRIGGER IF EXISTS trg_search_mat_au;
  DROP TRIGGER IF EXISTS trg_search_mat_ad;
  DROP TRIGGER IF EXISTS trg_search_blog_ai;
  DROP TRIGGER IF EXISTS trg_search_blog_au;
  DROP TRIGGER IF EXISTS trg_search_blog_ad;
  DROP TRIGGER IF EXISTS trg_search_forum_ai;
  DROP TRIGGER IF EXISTS trg_search_forum_au;
  DROP TRIGGER IF EXISTS trg_search_forum_ad;
  DROP TRIGGER IF EXISTS trg_search_wall_ai;
  DROP TRIGGER IF EXISTS trg_search_wall_au;
  DROP TRIGGER IF EXISTS trg_search_wall_ad;
  DROP TRIGGER IF EXISTS trg_search_atag_ai;
  DROP TRIGGER IF EXISTS trg_search_atag_ad;
  CREATE TRIGGER trg_search_mat_ai AFTER INSERT ON materials BEGIN
    INSERT INTO search_src(type, ref_id, status, title, body, tags)
      VALUES ('material', new.id, new.status, COALESCE(new.title,''), COALESCE(new.description,''), COALESCE(new.tags,''));
    INSERT INTO search_fts(rowid, title, body, tags)
      SELECT id, title, body, tags FROM search_src WHERE type = 'material' AND ref_id = new.id;
  END;
  CREATE TRIGGER trg_search_mat_au AFTER UPDATE ON materials BEGIN
    UPDATE search_src SET status = new.status, title = COALESCE(new.title,''), body = COALESCE(new.description,''),
      tags = COALESCE(new.tags,''), updated_at = datetime('now','localtime')
      WHERE type = 'material' AND ref_id = new.id;
    UPDATE search_fts SET title = COALESCE(new.title,''), body = COALESCE(new.description,''), tags = COALESCE(new.tags,'')
      WHERE rowid = (SELECT id FROM search_src WHERE type = 'material' AND ref_id = new.id);
  END;
  CREATE TRIGGER trg_search_mat_ad AFTER DELETE ON materials BEGIN
    DELETE FROM search_fts WHERE rowid = (SELECT id FROM search_src WHERE type = 'material' AND ref_id = old.id);
    DELETE FROM search_src WHERE type = 'material' AND ref_id = old.id;
  END;
  CREATE TRIGGER trg_search_blog_ai AFTER INSERT ON blog_posts BEGIN
    INSERT INTO search_src(type, ref_id, status, title, body)
      VALUES ('blog', new.id, new.status, COALESCE(new.title,''), COALESCE(new.summary,''));
    INSERT INTO search_fts(rowid, title, body, tags)
      SELECT id, title, body, tags FROM search_src WHERE type = 'blog' AND ref_id = new.id;
  END;
  CREATE TRIGGER trg_search_blog_au AFTER UPDATE ON blog_posts BEGIN
    UPDATE search_src SET status = new.status, title = COALESCE(new.title,''), body = COALESCE(new.summary,''),
      updated_at = datetime('now','localtime')
      WHERE type = 'blog' AND ref_id = new.id;
    UPDATE search_fts SET title = COALESCE(new.title,''), body = COALESCE(new.summary,'')
      WHERE rowid = (SELECT id FROM search_src WHERE type = 'blog' AND ref_id = new.id);
  END;
  CREATE TRIGGER trg_search_blog_ad AFTER DELETE ON blog_posts BEGIN
    DELETE FROM search_fts WHERE rowid = (SELECT id FROM search_src WHERE type = 'blog' AND ref_id = old.id);
    DELETE FROM search_src WHERE type = 'blog' AND ref_id = old.id;
  END;
  CREATE TRIGGER trg_search_forum_ai AFTER INSERT ON forum_threads BEGIN
    INSERT INTO search_src(type, ref_id, status, title, body)
      VALUES ('forum', new.id, new.status, COALESCE(new.title,''), COALESCE(new.content,''));
    INSERT INTO search_fts(rowid, title, body, tags)
      SELECT id, title, body, tags FROM search_src WHERE type = 'forum' AND ref_id = new.id;
  END;
  CREATE TRIGGER trg_search_forum_au AFTER UPDATE ON forum_threads BEGIN
    UPDATE search_src SET status = new.status, title = COALESCE(new.title,''), body = COALESCE(new.content,''),
      updated_at = datetime('now','localtime')
      WHERE type = 'forum' AND ref_id = new.id;
    UPDATE search_fts SET title = COALESCE(new.title,''), body = COALESCE(new.content,'')
      WHERE rowid = (SELECT id FROM search_src WHERE type = 'forum' AND ref_id = new.id);
  END;
  CREATE TRIGGER trg_search_forum_ad AFTER DELETE ON forum_threads BEGIN
    DELETE FROM search_fts WHERE rowid = (SELECT id FROM search_src WHERE type = 'forum' AND ref_id = old.id);
    DELETE FROM search_src WHERE type = 'forum' AND ref_id = old.id;
  END;
  CREATE TRIGGER trg_search_wall_ai AFTER INSERT ON wall_posts BEGIN
    INSERT INTO search_src(type, ref_id, status, title, body, tags)
      VALUES ('wall', new.id, new.status, COALESCE(new.tag,''), COALESCE(new.content,''), COALESCE(new.tag,''));
    INSERT INTO search_fts(rowid, title, body, tags)
      SELECT id, title, body, tags FROM search_src WHERE type = 'wall' AND ref_id = new.id;
  END;
  CREATE TRIGGER trg_search_wall_au AFTER UPDATE ON wall_posts BEGIN
    UPDATE search_src SET status = new.status, title = COALESCE(new.tag,''), body = COALESCE(new.content,''),
      tags = COALESCE(new.tag,''), updated_at = datetime('now','localtime')
      WHERE type = 'wall' AND ref_id = new.id;
    UPDATE search_fts SET title = COALESCE(new.tag,''), body = COALESCE(new.content,''), tags = COALESCE(new.tag,'')
      WHERE rowid = (SELECT id FROM search_src WHERE type = 'wall' AND ref_id = new.id);
  END;
  CREATE TRIGGER trg_search_wall_ad AFTER DELETE ON wall_posts BEGIN
    DELETE FROM search_fts WHERE rowid = (SELECT id FROM search_src WHERE type = 'wall' AND ref_id = old.id);
    DELETE FROM search_src WHERE type = 'wall' AND ref_id = old.id;
  END;
  CREATE TRIGGER trg_search_atag_ai AFTER INSERT ON asset_tags BEGIN
    UPDATE search_src SET tags = (SELECT COALESCE(GROUP_CONCAT(t.name, ','), '') FROM asset_tags a2 JOIN tags t ON t.id = a2.tag_id WHERE a2.material_id = NEW.material_id)
      WHERE type = 'material' AND ref_id = NEW.material_id;
    UPDATE search_fts SET tags = (SELECT ss.tags FROM search_src ss WHERE ss.type = 'material' AND ss.ref_id = NEW.material_id)
      WHERE rowid = (SELECT id FROM search_src WHERE type = 'material' AND ref_id = NEW.material_id);
  END;
  CREATE TRIGGER trg_search_atag_ad AFTER DELETE ON asset_tags BEGIN
    UPDATE search_src SET tags = (SELECT COALESCE(GROUP_CONCAT(t.name, ','), '') FROM asset_tags a2 JOIN tags t ON t.id = a2.tag_id WHERE a2.material_id = OLD.material_id)
      WHERE type = 'material' AND ref_id = OLD.material_id;
    UPDATE search_fts SET tags = (SELECT ss.tags FROM search_src ss WHERE ss.type = 'material' AND ss.ref_id = OLD.material_id)
      WHERE rowid = (SELECT id FROM search_src WHERE type = 'material' AND ref_id = OLD.material_id);
  END;
`)

// 存量回填（幂等）+ FTS 全量对齐（DROP 后 CREATE 已清空，此处一次性灌入）
db.exec(`
  INSERT OR IGNORE INTO search_src(type, ref_id, status, title, body, tags)
    SELECT 'material', id, status, COALESCE(title,''), COALESCE(description,''), COALESCE(tags,'') FROM materials;
  INSERT OR IGNORE INTO search_src(type, ref_id, status, title, body)
    SELECT 'blog', id, status, COALESCE(title,''), COALESCE(summary,'') FROM blog_posts;
  INSERT OR IGNORE INTO search_src(type, ref_id, status, title, body)
    SELECT 'forum', id, status, COALESCE(title,''), COALESCE(content,'') FROM forum_threads;
  INSERT OR IGNORE INTO search_src(type, ref_id, status, title, body, tags)
    SELECT 'wall', id, status, COALESCE(tag,''), COALESCE(content,''), COALESCE(tag,'') FROM wall_posts;
  INSERT INTO search_fts(rowid, title, body, tags)
    SELECT id, title, body, tags FROM search_src;
`)
console.log('  ✓ v6迁移: FTS5 统一搜索索引已就绪（search_src + search_fts 自持 + 14 触发器 + 存量回填）')

// ── v7 迁移:关于我们 · 照片墙覆盖表（管理员在线换图，2026-10-22）──
// 设计：照片墙的照片清单仍固化在 about.html（标题/描述/比例），本表只存"哪些标题被替换成了哪张图"。
// photo_key = 照片标题（photos 组）或毛毡板 note（cork 组）；image 指向 /api/gallery/about_*.jpg
db.exec(`
  CREATE TABLE IF NOT EXISTS about_photo_overrides (
    photo_key TEXT PRIMARY KEY,
    image TEXT NOT NULL,
    updated_by TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );
`)
console.log('  ✓ v7迁移: 关于我们照片墙覆盖表已就绪（about_photo_overrides）')

// ── v8 迁移:素材表加 OSS 对象键（2026-10-23，4K 大文件存 OSS）──
try { db.exec("ALTER TABLE materials ADD COLUMN oss_key TEXT DEFAULT ''") } catch (e) {}
console.log('  ✓ v8迁移: materials.oss_key 已就绪（OSS 直传文件键）')

// ── v9 迁移:HLS 多码率转码（2026-10-23）──
db.exec(`
  CREATE TABLE IF NOT EXISTS transcode_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    error TEXT DEFAULT '',
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    started_at TEXT DEFAULT '',
    finished_at TEXT DEFAULT ''
  );
`)
try { db.exec("ALTER TABLE materials ADD COLUMN hls_dir TEXT DEFAULT ''") } catch (e) {}
try { db.exec("ALTER TABLE materials ADD COLUMN transcode_status TEXT DEFAULT ''") } catch (e) {}
console.log('  ✓ v9迁移: HLS 转码任务表 + materials.hls_dir/transcode_status 已就绪')

// ── v10: 下载授权审计留痕（2026-10-25）──
// ⚠ 重要：download_logs 表由 server.js 早期迁移创建（原有列：id/material_id/ip/downloaded_at/user_id，
//   截至 2026-10-25 已有 12 条真实下载记录）。此处**只补授权审计所需的新列，绝不重建表**，避免丢历史数据。
try {
  const _dlCols = db.prepare('PRAGMA table_info(download_logs)').all().map((c) => c.name)
  const _dlWant = {
    material_title: "TEXT DEFAULT ''",   // 素材标题快照（素材改名/删除后仍可追溯）
    user_name: "TEXT DEFAULT ''",        // 用户名快照
    terms_version: "TEXT DEFAULT ''",    // 用户同意的条款版本
    ua: "TEXT DEFAULT ''",               // User-Agent
  }
  for (const col of Object.keys(_dlWant)) {
    if (!_dlCols.includes(col)) {
      try {
        db.exec(`ALTER TABLE download_logs ADD COLUMN ${col} ${_dlWant[col]}`)
        console.log('  ✓ v10迁移: download_logs.' + col + ' 已添加')
      } catch (e) { console.warn('  ⚠ v10 补列失败 ' + col + ':', e.message) }
    }
  }
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_download_logs_time ON download_logs(downloaded_at)') } catch (e) {}
  console.log('  ✓ v10迁移: 下载授权审计字段就绪（保留原有历史记录）')

// ── v11: 任务数据性质标记（2026-10-25，Luna 要求区分测试夹具/演示内容/真实业务）──
// 0 = 真实业务任务；1 = 演示/测试夹具（可被 cleanup-demo-tasks.cjs 安全清理）
try {
  const _tCols = db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name)
  if (!_tCols.includes('is_demo')) {
    db.exec('ALTER TABLE tasks ADD COLUMN is_demo INTEGER DEFAULT 0')
    console.log('  ✓ v11迁移: tasks.is_demo 已添加（0=真实业务 / 1=演示夹具）')
  } else {
    console.log('  ✓ v11迁移: tasks.is_demo 已存在')
  }
} catch (e) { console.warn('  ⚠ v11迁移异常:', e.message) }
} catch (e) { console.warn('  ⚠ v10迁移异常:', e.message) }

module.exports = { db, UPLOAD_DIR, THUMB_DIR, publicUser, hashPassword, verifyPassword, isHashed }
