'use strict'
// 通用工具函数（P2 自 server.js 拆出）
const crypto = require('node:crypto')

function sendJSON(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  })
  res.end(body)
}

function readBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    // Content-Length 预检：声明大小超限直接拒绝，一个字节都不进内存。
    // 旧实现超限即 req.destroy()，socket 被掐断导致 413 报错 JSON 根本送不到客户端；
    // 现改为「丢弃模式」：把客户端仍在发送的剩余数据读入即弃，保证 413 响应可正常送达。
    const declared = Number(req.headers['content-length'] || 0)
    if (declared > limit) {
      req.removeAllListeners('data')
      req.removeAllListeners('end')
      req.on('error', () => {}) // 丢弃期间客户端中断属正常，吞掉避免未处理 error 事件
      req.resume() // 持续排空入站数据
      reject(new Error('body_too_large'))
      return
    }
    let size = 0
    const chunks = []
    let overflow = false
    req.on('data', (c) => {
      if (overflow) return // 已超限但客户端还没发完：继续丢弃
      size += c.length
      if (size > limit) {
        overflow = true
        chunks.length = 0 // 立刻释放已缓冲内存，封顶单请求占用
        reject(new Error('body_too_large'))
        return
      }
      chunks.push(c)
    })
    req.on('end', () => { if (!overflow) resolve(Buffer.concat(chunks)) })
    req.on('error', (e) => { if (!overflow) reject(e) })
  })
}

function parseCookies(req) {
  const out = {}
  const h = req.headers.cookie
  if (!h) return out
  h.split(';').forEach((p) => {
    const i = p.indexOf('=')
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim())
  })
  return out
}

// ── 文件类型检测（magic bytes）──
function detectFileType(buf) {
  if (!buf || buf.length < 4) return 'unknown'
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg'
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'png'
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif'
  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      && buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'webp'
  // MP4/MOV: ftyp at offset 4
  if (buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return 'mp4'
  // PDF: 25 50 44 46
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'pdf'
  // ZIP/DOCX/XLSX: 50 4B 03/05
  if (buf[0] === 0x50 && buf[1] === 0x4B && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) return 'zip'
  // MS Office (DOC/XLS/PPT): D0 CF 11 E0
  if (buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0) return 'ms-office'
  // MP3: ID3 header 49 44 33 or sync frame FF FB/FF F3/FF FA/FF F2
  if ((buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
      (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0)) return 'mp3'
  // WAV: RIFF....WAVE
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      && buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45) return 'wav'
  // FLAC: fLaC
  if (buf[0] === 0x66 && buf[1] === 0x4C && buf[2] === 0x61 && buf[3] === 0x43) return 'flac'
  // AAC/MP4 audio: same ftyp as MP4 at offset 4 — already caught above, mp4 covers both
  // M4A: also ftyp box — covered by mp4 detection above
  // OGG: OggS
  if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return 'ogg'
  // WMA: ASF header 30 26 B2 75
  if (buf[0] === 0x30 && buf[1] === 0x26 && buf[2] === 0xB2 && buf[3] === 0x75) return 'wma'
  return 'unknown'
}

// 允许上传的文件类型白名单
const UPLOAD_ALLOWED = {
  image: ['jpg', 'png', 'gif', 'webp'],
  video: ['mp4'],
  document: ['pdf', 'zip', 'ms-office'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'],
  resume: ['pdf', 'zip', 'ms-office'], // 招新简历
}

// 前端 type 字段(中文) → UPLOAD_ALLOWED category 映射
const TYPE_TO_CATEGORY = {
  '图片': 'image',
  '视频': 'video',
  '文档': 'document',
  '音频': 'audio',
  '其他': 'image', // 默认宽松: 也接受图片格式
}

function validateUploadedFile(file, category) {
  if (!file || !file.data || file.data.length === 0) return { ok: false, message: '文件为空' }
  const allowed = UPLOAD_ALLOWED[category] || []
  const detected = detectFileType(file.data)
  if (!allowed.includes(detected)) {
    return { ok: false, message: `不支持的文件类型(检测为 ${detected})，允许: ${allowed.join(', ')}` }
  }
  return { ok: true, detected }
}

// ── CSRF 防护（double-submit cookie 模式）──
// /api/login 与 /api/login/2fa 免 CSRF：此时浏览器尚无会话/csrf cookie（各有独立鉴权：密码+限速 / 挑战令牌+限速）
const CSRF_EXEMPT = new Set(['/api/login', '/api/login/2fa', '/api/recruit', '/api/deploy', '/api/csp-report'])
function getOrCreateCSRFToken(req, res) {
  const cookies = parseCookies(req)
  if (cookies.csrf) return cookies.csrf
  const token = crypto.randomBytes(16).toString('hex')
  return token
}
function validateCSRF(req) {
  // 2026-11-01：小程序通道（Authorization: Bearer）免 CSRF。
  // 依据：CSRF 攻击的前提是浏览器会**自动**附带凭证（Cookie）；Bearer 必须由脚本显式写入
  //       header，第三方站点既读不到 token 也无法伪造，该通道不存在 CSRF 面。
  // 边界：此分支只对 Bearer 放行，下方 Cookie 双提交校验逻辑**完全不变**。
  const _authHeader = String(req.headers.authorization || '')
  if (/^Bearer\s+\S+$/.test(_authHeader)) return true

  const headerToken = req.headers['x-csrf-token'] || ''
  if (!headerToken) return false

  // 2026-10-23 修复：HTTP/HTTPS 切换后浏览器会同时存在多个同名 `csrf` cookie
  // （一个带 Secure 一个不带）。而 `document.cookie` 的返回顺序与浏览器实际发送的
  // Cookie header 顺序**并不保证一致**，所以"前端取第几个"这种对齐方式天生不可靠。
  // 改为：收集【所有】同名 csrf 值，header 与其中任意一个匹配即通过。
  // 安全性不受损：攻击者仍然不知道任何一个 token 的真实值（CSRF 防护本质不变）。
  const raw = req.headers.cookie || ''
  const candidates = []
  raw.split(';').forEach((p) => {
    const i = p.indexOf('=')
    if (i > -1 && p.slice(0, i).trim() === 'csrf') {
      let v = p.slice(i + 1).trim()
      try { v = decodeURIComponent(v) } catch (e) {}
      if (v) candidates.push(v)
    }
  })
  if (!candidates.length) {
    // 兼容没有 cookie header 的极端调用（内部调用场景）
    const cookies = parseCookies(req)
    if (cookies.csrf) candidates.push(cookies.csrf)
  }
  if (!candidates.length) return false

  const hb = Buffer.from(String(headerToken))
  let matched = false
  for (const c of candidates) {
    try {
      const cb = Buffer.from(String(c))
      if (cb.length === hb.length && crypto.timingSafeEqual(cb, hb)) { matched = true; break }
    } catch (e) { /* 继续尝试下一个 */ }
  }
  // 2026-10-23：CSRF 失败时把诊断写入文件（服务无 stdout 重定向，console 会丢）
  // 只记录前缀与长度，不落完整 token，兼顾安全与排查
  if (!matched) {
    try {
      const rec = new Date().toISOString() + ' ' + JSON.stringify({
        path: req.url,
        method: req.method,
        hasHeader: !!headerToken,
        headerLen: headerToken.length,
        headerPrefix: headerToken ? String(headerToken).slice(0, 8) : '',
        cookieCount: candidates.length,
        cookieLens: candidates.map((c) => c.length),
        cookiePrefixes: candidates.map((c) => c.slice(0, 8)),
        hasCookieHeader: !!req.headers.cookie,
        ua: String(req.headers['user-agent'] || '').slice(0, 60),
        referer: String(req.headers.referer || '').slice(0, 60),
      }) + '\n'
      require('fs').appendFileSync('C:/app/csrf-fail.log', rec)
    } catch (e) {}
  }
  return matched
}

// ── 文件名净化 ──
function sanitizeOriginalName(name) {
  return String(name || 'file').replace(/[\\/\:*?"<>|]/g, '_').replace(/\.\.+/g, '.').slice(0, 200)
}

// ── LIKE 搜索通配符转义 ──
function escapeLike(s) {
  return String(s || '').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

// ── 中和 HTML 中的危险协议链接（javascript:/vbscript:）──
// 服务端二次防线：前端 shared.js 已做一次净化；此处防「绕过前端直接调 API」的提交
function neutralizeJsLinks(html) {
  // 解码常见实体（数字/十六进制/冒号），用于识别实体混淆的协议前缀
  function decodeEntities(v) {
    return String(v)
      .replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCharCode(parseInt(h, 16)) })
      .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(parseInt(d, 10)) })
      .replace(/&colon;/gi, ':').replace(/&tab;/gi, '\t').replace(/&newline;/gi, '\n')
  }
  var s = String(html || '')
  // ① 带引号属性值：解码实体 + 去空白/控制字符后判断协议前缀
  s = s.replace(/(href|src)\s*=\s*(["'])([\s\S]*?)\2/gi, function (m, attr, q, val) {
    var v = decodeEntities(val).replace(/[\s\x00-\x1f]+/g, '').toLowerCase()
    if (/^(javascript|vbscript|data:text\/html)/.test(v)) return attr + '=' + q + '#' + q
    return m
  })
  // ② 无引号写法兜底
  s = s.replace(/\b(href|src)\s*=\s*(?:javascript|vbscript)\s*:/gi, '$1=#')
  return s
}

// ── 密码强度校验 ──
function validatePasswordStrength(pwd) {
  if (!pwd || pwd.length < 8) return { ok: false, message: '密码至少8位' }
  if (!/[A-Z]/.test(pwd)) return { ok: false, message: '密码需包含大写字母' }
  if (!/[a-z]/.test(pwd)) return { ok: false, message: '密码需包含小写字母' }
  if (!/[0-9]/.test(pwd)) return { ok: false, message: '密码需包含数字' }
  return { ok: true }
}

module.exports = { sendJSON, readBody, parseCookies, detectFileType, UPLOAD_ALLOWED, TYPE_TO_CATEGORY, validateUploadedFile, getOrCreateCSRFToken, validateCSRF, CSRF_EXEMPT, sanitizeOriginalName, escapeLike, validatePasswordStrength, neutralizeJsLinks }
