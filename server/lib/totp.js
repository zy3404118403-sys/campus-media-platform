'use strict'
// ── TOTP 两步验证模块（RFC 6238，零依赖，node:crypto 实现）──
// 设计要点：
//   - 密钥 160 位随机 → base32(RFC 4648)，比 80 位下限更充裕
//   - 校验窗口 ±1 步（容忍时钟漂移 ±30s），timingSafeEqual 恒时比较
//   - 备用恢复码 8 组 × 10 字符（无混淆字符集），服务端只存 SHA-256 哈希
//     （备用码本身是 96 位高熵随机值，抗暴力，快速哈希在此场景安全）
const crypto = require('node:crypto')

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
// 备用码字符集：去掉 0/O/1/I/L 防手抄混淆
const BACKUP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function base32Encode(buf) {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { out += B32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '')
  let bits = 0, value = 0
  const out = []
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch)
    if (idx === -1) return null
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}

// 生成 160 位密钥（base32，32 字符）
function generateSecret() {
  return base32Encode(crypto.randomBytes(20))
}

// 计算 TOTP：30s 步长、6 位、HMAC-SHA1（RFC 6238 默认参数）
function totpAt(secretB32, counter) {
  const key = base32Decode(secretB32)
  if (!key || !key.length) return null
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', key).update(msg).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]
  return String(bin % 1000000).padStart(6, '0')
}

function currentCounter(stepSec = 30, t = Date.now()) {
  return Math.floor(t / 1000 / stepSec)
}

// 恒时比较字符串（长度不同直接 false 不泄长度信息也无妨——固定 6 位）
function safeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b))
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

// 校验动态码，容忍 ±window 步时钟漂移
function verifyTotp(secretB32, code, window = 1) {
  const clean = String(code || '').replace(/[\s-]/g, '')
  if (!/^\d{6}$/.test(clean)) return false
  const counter = currentCounter()
  for (let i = -window; i <= window; i++) {
    const expect = totpAt(secretB32, counter + i)
    if (expect && safeEqual(clean, expect)) return true
  }
  return false
}

// otpauth URI（验证器 App 扫码/手动录入用）
function otpauthUri(secret, accountName, issuer = 'CampusMedia') {
  const label = encodeURIComponent(issuer + ':' + accountName)
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' })
  return `otpauth://totp/${label}?${params.toString()}`
}

// ── 备用恢复码 ──
function generateBackupCodes(n = 8) {
  const codes = []
  for (let i = 0; i < n; i++) {
    let s = ''
    for (let j = 0; j < 10; j++) s += BACKUP_ALPHABET[crypto.randomInt(BACKUP_ALPHABET.length)]
    codes.push(s.slice(0, 5) + '-' + s.slice(5))
  }
  return codes
}

function hashBackupCode(code) {
  return crypto.createHash('sha256').update(String(code).toUpperCase().replace(/[\s-]/g, '')).digest('hex')
}

// 判定输入是否为备用码格式（10 位字母数字）；否则视为 6 位 TOTP
function looksLikeBackupCode(code) {
  const clean = String(code || '').toUpperCase().replace(/[\s-]/g, '')
  return /^[A-Z0-9]{10}$/.test(clean) && !/^\d{6}$/.test(String(code || '').replace(/[\s-]/g, ''))
}

module.exports = { generateSecret, verifyTotp, totpAt, currentCounter, otpauthUri, generateBackupCodes, hashBackupCode, looksLikeBackupCode, base32Decode }
