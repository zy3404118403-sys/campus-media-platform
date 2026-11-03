'use strict'
// ═══ 4K 视频 HLS 多码率转码队列（2026-10-23）═══
// 设计：
//   · 上传完成即入队（materials.transcode_status='pending'）
//   · worker 每 12 秒轮询，严格串行（一次只转 1 条，避免打满 CPU）
//   · 一次 ffmpeg 命令生成 3 档 HLS（1080p / 720p / 480p），按原分辨率自动裁剪档位
//   · 源文件在 OSS 时直接用签名 URL 作输入（不落本地，省磁盘）
//   · 完成后写 materials.hls_dir，播放端点据此提供 master.m3u8
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const FFMPEG = process.env.FFMPEG_BIN || 'C:/backend/bin/ffmpeg.exe'
const FFPROBE = process.env.FFPROBE_BIN || 'C:/backend/bin/ffprobe.exe'
const POLL_MS = 12 * 1000

// 档位定义（scale=-2:高，宽度自动偶数）
const VARIANTS = [
  { name: 'v0', height: 1080, vbr: '5000k', maxrate: '5400k', bufsize: '7500k', bandwidth: 5400000 },
  { name: 'v1', height: 720, vbr: '2500k', maxrate: '2800k', bufsize: '4000k', bandwidth: 2700000 },
  { name: 'v2', height: 480, vbr: '1000k', maxrate: '1200k', bufsize: '1800k', bandwidth: 1100000 },
]

// ffmpeg / ffprobe 是否就位（未安装时队列待命，不消耗任务）
function ffmpegReady() {
  try { return fs.existsSync(FFMPEG) && fs.existsSync(FFPROBE) } catch (e) { return false }
}

function run(cmd, args, timeoutMs) {  return new Promise((resolve) => {
    let out = '', err = ''
    const p = spawn(cmd, args, { windowsHide: true })
    const t = setTimeout(() => { try { p.kill() } catch (e) {} }, timeoutMs || 60 * 60 * 1000)
    p.stdout.on('data', (d) => { out += d.toString() })
    p.stderr.on('data', (d) => { err += d.toString() })
    p.on('error', (e) => { clearTimeout(t); resolve({ code: -1, out, err: String(e) }) })
    p.on('close', (code) => { clearTimeout(t); resolve({ code, out, err }) })
  })
}

function probe(fileUrl) {
  return new Promise((resolve) => {
    let out = ''
    const p = spawn(FFPROBE, ['-v', 'error', '-show_entries',
      'stream=codec_type,width,height,duration,bit_rate:format=duration,size,bit_rate', '-of', 'json', fileUrl], { windowsHide: true })
    const t = setTimeout(() => { try { p.kill() } catch (e) {} }, 120000)
    p.stdout.on('data', (d) => { out += d.toString() })
    p.on('error', () => { clearTimeout(t); resolve(null) })
    p.on('close', () => {
      clearTimeout(t)
      try {
        const j = JSON.parse(out)
        const streams = j.streams || []
        const v = streams.filter((s) => s.codec_type === 'video')[0] || {}
        const hasAudio = streams.some((s) => s.codec_type === 'audio')
        const f = j.format || {}
        if (!v.width) { resolve(null); return }
        resolve({
          width: Number(v.width) || 0,
          height: Number(v.height) || 0,
          duration: Math.round(Number(v.duration || f.duration) || 0),
          bitrate: Math.round(Number(v.bit_rate || f.bit_rate) / 1000) || 0, // kbps
          hasAudio: hasAudio,
        })
      } catch (e) { resolve(null) }
    })
  })
}

module.exports = function initTranscode(db, oss, opts) {
  opts = opts || {}
  const HLS_ROOT = opts.hlsRoot || path.join(__dirname, '..', 'public', 'uploads', 'hls')
  let busy = false
  let timer = null

  function enqueue(materialId) {
    try {
      const exists = db.prepare("SELECT id FROM materials WHERE id = ? AND transcode_status IN ('pending','processing')").get(materialId)
      if (exists) return
      db.prepare("UPDATE materials SET transcode_status = 'pending' WHERE id = ?").run(materialId)
      db.prepare("INSERT INTO transcode_jobs (material_id, status, created_at) VALUES (?, 'pending', datetime('now','localtime'))").run(materialId)
    } catch (e) { console.error('[transcode] enqueue 失败:', e.message) }
  }

  async function pickJob() {
    return db.prepare("SELECT * FROM transcode_jobs WHERE status = 'pending' ORDER BY id LIMIT 1").get()
  }

  async function processJob(job) {
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(job.material_id)
    if (!m) {
      db.prepare("UPDATE transcode_jobs SET status='failed', error='素材不存在', finished_at=datetime('now','localtime') WHERE id=?").run(job.id)
      return
    }
    // 源：优先 OSS（签名 URL 直接作为 ffmpeg 输入，不落本地）
    let src = ''
    if (m.oss_key && oss.configured()) src = oss.signedUrl(m.oss_key, { expireSec: 6 * 3600 })
    else if (m.filename) src = path.join(opts.uploadDir || path.join(__dirname, '..', 'public', 'uploads'), m.filename)
    if (!src) {
      db.prepare("UPDATE transcode_jobs SET status='failed', error='无源文件', finished_at=datetime('now','localtime') WHERE id=?").run(job.id)
      db.prepare("UPDATE materials SET transcode_status='skipped' WHERE id=?").run(m.id)
      return
    }

    db.prepare("UPDATE transcode_jobs SET status='processing', started_at=datetime('now','localtime'), attempts=attempts+1 WHERE id=?").run(job.id)
    db.prepare("UPDATE materials SET transcode_status='processing' WHERE id=?").run(m.id)
    console.log(`[transcode] #${m.id} 开始（尝试 ${job.attempts + 1}）`)

    // ① 探测
    const info = await probe(src)
    if (!info || !info.height) {
      db.prepare("UPDATE transcode_jobs SET status='failed', error='探测失败（源不可读或非视频）', finished_at=datetime('now','localtime') WHERE id=?").run(job.id)
      db.prepare("UPDATE materials SET transcode_status='failed' WHERE id=?").run(m.id)
      console.log(`[transcode] #${m.id} 探测失败`)
      return
    }
    try {
      db.prepare('UPDATE materials SET width=?, height=?, duration=? WHERE id=?').run(info.width, info.height, info.duration, m.id)
    } catch (e) {}

    // ② 按原分辨率筛档位（不超过原片）
    const use = VARIANTS.filter((v) => v.height <= info.height + 1)
    if (!use.length) {
      db.prepare("UPDATE transcode_jobs SET status='done', note='分辨率过低，跳过转码', finished_at=datetime('now','localtime') WHERE id=?").run(job.id)
      db.prepare("UPDATE materials SET transcode_status='skipped' WHERE id=?").run(m.id)
      console.log(`[transcode] #${m.id} 分辨率 ${info.width}x${info.height} 过低，跳过`)
      return
    }

    // ③ 输出目录
    const outDir = path.join(HLS_ROOT, String(m.id))
    try { fs.rmSync(outDir, { recursive: true, force: true }) } catch (e) {}
    use.forEach((v) => fs.mkdirSync(path.join(outDir, v.name), { recursive: true }))

    // ④ 一次生成多档 HLS（有音频则 asplit 复制对应路数，无音频只映射视频）
    const split = use.map((v, i) => `[v${i}]`).join('')
    let filters = `[0:v]split=${use.length}${split};` + use.map((v, i) => `[v${i}]scale=-2:${v.height}[o${i}]`).join(';')
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', src]
    if (info.hasAudio) {
      filters += `;[0:a]asplit=${use.length}` + use.map((v, i) => `[a${i}]`).join('')
    }
    args.push('-filter_complex', filters)
    use.forEach((v, i) => {
      args.push('-map', `[o${i}]`, `-c:v:${i}`, 'libx264', '-preset', 'veryfast', '-crf', '23',
        `-b:v:${i}`, v.vbr, `-maxrate:v:${i}`, v.maxrate, `-bufsize:v:${i}`, v.bufsize)
      if (info.hasAudio) {
        args.push('-map', `[a${i}]`, `-c:a:${i}`, 'aac', `-b:a:${i}`, '128k')
      }
    })
    const varMap = info.hasAudio
      ? use.map((v, i) => `v:${i},a:${i}`).join(' ')
      : use.map((v, i) => `v:${i}`).join(' ')
    args.push('-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', path.join(outDir, '%v', 'seg_%04d.ts'),
      '-master_pl_name', 'master.m3u8',
      '-var_stream_map', varMap,
      path.join(outDir, '%v', 'index.m3u8'))

    const t0 = Date.now()
    const res = await run(FFMPEG, args, 3 * 60 * 60 * 1000)
    const cost = Math.round((Date.now() - t0) / 1000)

    if (res.code !== 0) {
      const errBrief = String(res.err || '').split('\n').filter(Boolean).slice(-2).join(' | ').slice(0, 300)
      db.prepare("UPDATE transcode_jobs SET status='failed', error=?, finished_at=datetime('now','localtime') WHERE id=?").run(errBrief, job.id)
      db.prepare("UPDATE materials SET transcode_status='failed' WHERE id=?").run(m.id)
      try { fs.rmSync(outDir, { recursive: true, force: true }) } catch (e) {}
      console.log(`[transcode] #${m.id} 失败（${cost}s）：${errBrief}`)
      return
    }

    // ⑤ 修正 m3u8 路径分隔符
    // ⚠️ ffmpeg 在 Windows 上会把 master.m3u8 里的档位路径写成 `0\index.m3u8`（反斜杠），
    //    而 HLS 规范要求正斜杠，否则 hls.js 解析失败。这里统一后处理成正斜杠。
    try {
      const fix = (fp) => {
        if (!fs.existsSync(fp)) return
        const txt = fs.readFileSync(fp, 'utf8')
        const fixed = txt.replace(/\\/g, '/')
        if (fixed !== txt) fs.writeFileSync(fp, fixed, 'utf8')
      }
      fix(path.join(outDir, 'master.m3u8'))
      use.forEach((v) => fix(path.join(outDir, v.name, 'index.m3u8')))
    } catch (e) {}

    // ⑥ 完成
    const rel = '/uploads/hls/' + m.id
    db.prepare("UPDATE transcode_jobs SET status='done', finished_at=datetime('now','localtime'), note=? WHERE id=?")
      .run(`档位 ${use.map((v) => v.height + 'p').join('/')} · 耗时 ${cost}s`, job.id)
    db.prepare("UPDATE materials SET transcode_status='done', hls_dir=? WHERE id=?").run(rel, m.id)
    console.log(`[transcode] #${m.id} 完成（${cost}s，档位 ${use.map((v) => v.height + 'p').join('/')}）`)
  }

  async function tick() {
    if (busy) return
    // ffmpeg 未就位时待命（避免把任务全标成失败）
    if (!ffmpegReady()) return
    busy = true
    try {
      // 补扫：新上传的视频（transcode_status 为空）自动入队（2026-10-23 修复：原本只在启动时扫一次）
      try {
        const news = db.prepare("SELECT id FROM materials WHERE type='视频' AND (transcode_status IS NULL OR transcode_status='') AND (oss_key<>'' OR filename IS NOT NULL) ORDER BY id DESC LIMIT 20").all()
        news.forEach((r) => enqueue(r.id))
      } catch (e) {}
      let guard = 0
      while (guard++ < 5) {
        const job = await pickJob()
        if (!job) break
        await processJob(job)
      }
    } catch (e) {
      console.error('[transcode] 轮询异常:', e.message)
    } finally {
      busy = false
    }
  }

  function start() {
    if (timer) return
    timer = setInterval(tick, POLL_MS)
    timer.unref && timer.unref()
    setTimeout(tick, 5000)
    console.log('[transcode] HLS 转码队列已启动（每 ' + (POLL_MS / 1000) + 's 轮询，串行执行）')
  }

  function stop() { if (timer) { clearInterval(timer); timer = null } }

  // 启动：把历史上标记 pending 但没任务的补进去
  function backfill() {
    try {
      const rows = db.prepare("SELECT id FROM materials WHERE type='视频' AND transcode_status='' AND (oss_key<>'' OR filename IS NOT NULL) LIMIT 50").all()
      rows.forEach((r) => enqueue(r.id))
      if (rows.length) console.log('[transcode] 补入队列 ' + rows.length + ' 条历史视频')
    } catch (e) {}
  }

  return { enqueue, start, stop, tick, backfill, probe, VARIANTS }
}
