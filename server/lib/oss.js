'use strict'
// ═══ 阿里云 OSS 零依赖签名模块（2026-10-23）═══
// 不引入 ali-oss SDK：只用 crypto 手算 HMAC-SHA1，保持项目「零依赖」风格。
// 凭证从环境变量读取（部署时写入服务器，绝不进代码库/前端）：
//   OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET / OSS_REGION
const crypto = require('crypto')

const BUCKET = process.env.OSS_BUCKET || 'rmtcs123'
const REGION = process.env.OSS_REGION || 'oss-cn-chengdu'
const AK_ID = process.env.OSS_ACCESS_KEY_ID || ''
const AK_SECRET = process.env.OSS_ACCESS_KEY_SECRET || ''
const HOST = BUCKET + '.' + REGION + '.aliyuncs.com'

function configured() { return !!(AK_ID && AK_SECRET) }

function hmacSha1(key, data) {
  return crypto.createHmac('sha1', key).update(data, 'utf8').digest('base64')
}

// ── 直传凭证：前端用 PostObject 表单直接上传（服务器不中转流量）──
function postPolicy(opts) {
  opts = opts || {}
  const prefix = opts.prefix || 'materials/'
  const maxSize = Math.min(opts.maxSize || 5 * 1024 * 1024 * 1024, 5 * 1024 * 1024 * 1024) // OSS 单次 Post 上限 5GB
  const expireSec = opts.expireSec || 3600
  const expiration = new Date(Date.now() + expireSec * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const policyObj = {
    expiration,
    conditions: [
      ['content-length-range', 0, maxSize],
      ['starts-with', '$key', prefix],
    ],
  }
  const policy = Buffer.from(JSON.stringify(policyObj), 'utf8').toString('base64')
  return {
    host: 'https://' + HOST,
    bucket: BUCKET,
    accessKeyId: AK_ID,
    policy,
    signature: hmacSha1(AK_SECRET, policy),
    expiration,
    prefix,
    maxSize,
  }
}

// ── 签名 URL：私有 Bucket 的播放 / 下载（有效期默认 1 小时）──
// OSS 签名的关键细节（实测得出）：子资源参与 StringToSign 时，
//   · StringToSign 里用【原始值】（不 URL 编码）
//   · 最终 query 里用【URL 编码值】
// 两者都编码或都不编码都会 403 SignatureDoesNotMatch。
function signedUrl(key, opts) {
  opts = opts || {}
  const expires = Math.floor(Date.now() / 1000) + (opts.expireSec || 3600)
  const safeKey = String(key).replace(/^\/+/, '')
  let canonical = ''
  let extraQuery = ''
  if (opts.filename) {
    const cd = "attachment; filename*=UTF-8''" + encodeURIComponent(opts.filename)
    canonical = '?response-content-disposition=' + cd          // 原始值入签
    extraQuery = '&response-content-disposition=' + encodeURIComponent(cd) // query 编码
  }
  const stringToSign = 'GET\n\n\n' + expires + '\n/' + BUCKET + '/' + safeKey + canonical
  const signature = encodeURIComponent(hmacSha1(AK_SECRET, stringToSign))
  return 'https://' + HOST + '/' + safeKey + '?OSSAccessKeyId=' + encodeURIComponent(AK_ID) + '&Expires=' + expires + '&Signature=' + signature + extraQuery
}

// ── 服务端 PUT（小文件/缩略图，或迁移历史文件时用）──
async function putObject(key, buffer, contentType) {
  const date = new Date().toUTCString()
  const md5 = crypto.createHash('md5').update(buffer).digest('base64')
  const stringToSign = 'PUT\n' + md5 + '\n' + (contentType || '') + '\n' + date + '\n/' + BUCKET + '/' + key
  const signature = hmacSha1(AK_SECRET, stringToSign)
  const res = await fetch('https://' + HOST + '/' + key, {
    method: 'PUT',
    headers: {
      'Date': date,
      'Content-Type': contentType || 'application/octet-stream',
      'Content-MD5': md5,
      'Authorization': 'OSS ' + AK_ID + ':' + signature,
    },
    body: buffer,
  })
  return { ok: res.ok, status: res.status, text: res.ok ? '' : await res.text() }
}

// ── 服务端删除 ──
async function deleteObject(key) {
  const date = new Date().toUTCString()
  const stringToSign = 'DELETE\n\n\n' + date + '\n/' + BUCKET + '/' + key
  const signature = hmacSha1(AK_SECRET, stringToSign)
  const res = await fetch('https://' + HOST + '/' + key, {
    method: 'DELETE',
    headers: { 'Date': date, 'Authorization': 'OSS ' + AK_ID + ':' + signature },
  })
  return { ok: res.ok || res.status === 404, status: res.status }
}

// ═══ 分片上传（Multipart，支持 10GB+ 长视频；OSS 单文件上限 48.8TB）═══
// 子资源按字典序拼进 CanonicalizedResource：partNumber < uploadId ✓

// ① 初始化分片任务 → 拿 uploadId
async function initiateMultipart(key, contentType) {
  const date = new Date().toUTCString()
  const ct = contentType || ''
  const stringToSign = 'POST\n\n' + ct + '\n' + date + '\n/' + BUCKET + '/' + key + '?uploads'
  const signature = hmacSha1(AK_SECRET, stringToSign)
  const res = await fetch('https://' + HOST + '/' + key + '?uploads', {
    method: 'POST',
    headers: { 'Date': date, 'Content-Type': ct, 'Authorization': 'OSS ' + AK_ID + ':' + signature },
  })
  const txt = await res.text()
  const m = txt.match(/<UploadId>([^<]+)<\/UploadId>/)
  return { ok: res.ok && !!m, status: res.status, uploadId: m ? m[1] : '', raw: res.ok ? '' : txt.slice(0, 300) }
}

// ② 签发单个分片的直传 URL（前端 PUT 该 URL，拿响应头 ETag）
// ⚠️ 实测要点：URL 签名时 Content-Type 参与签名，前端 PUT 必须带**完全相同的** Content-Type，
// 否则 403 SignatureDoesNotMatch。这里统一固定为 application/octet-stream。
function signedPartUrl(key, uploadId, partNumber, expireSec) {
  const expires = Math.floor(Date.now() / 1000) + (expireSec || 3600)
  const ct = 'application/octet-stream'
  const stringToSign = 'PUT\n\n' + ct + '\n' + expires + '\n/' + BUCKET + '/' + key +
    '?partNumber=' + partNumber + '&uploadId=' + uploadId
  const signature = encodeURIComponent(hmacSha1(AK_SECRET, stringToSign))
  return 'https://' + HOST + '/' + key + '?partNumber=' + partNumber + '&uploadId=' + encodeURIComponent(uploadId) +
    '&OSSAccessKeyId=' + encodeURIComponent(AK_ID) + '&Expires=' + expires + '&Signature=' + signature
}

// ③ 合并分片（parts: [{n, etag}]）
async function completeMultipart(key, uploadId, parts) {
  const date = new Date().toUTCString()
  const ct = 'application/xml'
  const body = '<CompleteMultipartUpload>' + parts
    .slice()
    .sort((a, b) => a.n - b.n)
    .map((p) => '<Part><PartNumber>' + p.n + '</PartNumber><ETag>' + String(p.etag).replace(/"/g, '&quot;') + '</ETag></Part>')
    .join('') + '</CompleteMultipartUpload>'
  const md5 = crypto.createHash('md5').update(body, 'utf8').digest('base64')
  const stringToSign = 'POST\n' + md5 + '\n' + ct + '\n' + date + '\n/' + BUCKET + '/' + key + '?uploadId=' + uploadId
  const signature = hmacSha1(AK_SECRET, stringToSign)
  const res = await fetch('https://' + HOST + '/' + key + '?uploadId=' + encodeURIComponent(uploadId), {
    method: 'POST',
    headers: { 'Date': date, 'Content-Type': ct, 'Content-MD5': md5, 'Authorization': 'OSS ' + AK_ID + ':' + signature },
    body,
  })
  const txt = await res.text()
  const okTag = /<CompleteMultipartUploadResult>/.test(txt)
  return { ok: res.ok && okTag, status: res.status, raw: okTag ? '' : txt.slice(0, 400) }
}

// ④ 已上传分片查询（断点续传用）
async function listParts(key, uploadId) {
  const date = new Date().toUTCString()
  const stringToSign = 'GET\n\n\n' + date + '\n/' + BUCKET + '/' + key + '?uploadId=' + uploadId
  const signature = hmacSha1(AK_SECRET, stringToSign)
  const res = await fetch('https://' + HOST + '/' + key + '?uploadId=' + encodeURIComponent(uploadId), {
    headers: { 'Date': date, 'Authorization': 'OSS ' + AK_ID + ':' + signature },
  })
  const txt = await res.text()
  const parts = [...txt.matchAll(/<Part>[\s\S]*?<PartNumber>(\d+)<\/PartNumber>[\s\S]*?<ETag>([^<]+)<\/ETag>[\s\S]*?<\/Part>/g)]
    .map((m) => ({ n: Number(m[1]), etag: m[2] }))
  return { ok: res.ok, status: res.status, parts }
}

// ⑤ 取消分片任务（清理残留）
async function abortMultipart(key, uploadId) {
  const date = new Date().toUTCString()
  const stringToSign = 'DELETE\n\n\n' + date + '\n/' + BUCKET + '/' + key + '?uploadId=' + uploadId
  const signature = hmacSha1(AK_SECRET, stringToSign)
  const res = await fetch('https://' + HOST + '/' + key + '?uploadId=' + encodeURIComponent(uploadId), {
    method: 'DELETE',
    headers: { 'Date': date, 'Authorization': 'OSS ' + AK_ID + ':' + signature },
  })
  return { ok: res.ok || res.status === 404, status: res.status }
}

module.exports = {
  configured, postPolicy, signedUrl, putObject, deleteObject,
  initiateMultipart, signedPartUrl, completeMultipart, listParts, abortMultipart,
  BUCKET, REGION, HOST, AK_ID,
}
