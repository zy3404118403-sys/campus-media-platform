'use strict'
// 素材域 + 标签管理 + 静态文件服务 API（P2 批六自 server.js 本体拆出：22 条 → 声明式路由表）
// 迁移原则：handler 体业务逻辑零改动；旧守卫收口到路由表闸门（requireAuth/requireAdmin/
//          requireStaff 与路由表默认文案逐字一致）。路径参数 p.match()[1] 改 params.*。
// 特殊文案：素材上传未登录 401「请先登录后再上传」（原文案，单独声明 unauthorizedMessage）。
//          删除/编辑/状态流转的业务级 403（无权操作他人素材）属行权校验，保留在 handler 内。

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { Transform, pipeline } = require('stream')
const oss = require('./oss')

// HLS 活跃播放会话（60 秒滑窗，用于按并发数限档）
const HLS_ACTIVE = new Map()
const PUBLIC_DIR = path.join(__dirname, '..', 'public')

const routes = [
  // ───── 素材列表（公开；登录用户分级可见性） ─────
  { method: 'GET', pattern: '/api/materials', handler: async (ctx, { req, res, url }) => {
    const { db, sendJSON, authUser, escapeLike, materialPublic } = ctx
    const type = url.searchParams.get('type')
    const college = url.searchParams.get('college')
    const tag = url.searchParams.get('tag')
    const q = (url.searchParams.get('q') || '').trim()
    const sort = url.searchParams.get('sort') || 'newest'
    const statusFilter = url.searchParams.get('status')
    const authorId = url.searchParams.get('author_id')
    const page = parseInt(url.searchParams.get('page')) || 0
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize')) || 0, 100)
    const user = authUser(req)
    let sql = 'SELECT * FROM materials WHERE 1=1'
    const args = []

    if (statusFilter && statusFilter !== 'all') {
      const allowAll = user && (user.is_admin || (user.id && user.id === authorId))
      if (allowAll) {
        sql += ' AND status = ?'; args.push(statusFilter)
      } else {
        if (statusFilter === 'published' || statusFilter === 'approved') { sql += ' AND status = ?'; args.push(statusFilter) }
        else { sql += " AND status = 'published'" }
      }
    } else if (statusFilter === 'all' && user && user.is_admin) {
      // 管理员查看全部，不加状态过滤
    } else if (user && user.is_admin) {
      sql += " AND status IN ('approved','published')"
    } else {
      sql += " AND status = 'published'"
    }

    if (type) { sql += ' AND type = ?'; args.push(type) }
    if (college) { sql += ' AND college = ?'; args.push(college) }
    // P0-3: 标签过滤由 LIKE 模糊改为关联表精确等值匹配(消除子串误命中)
    if (tag) { sql += ' AND EXISTS (SELECT 1 FROM asset_tags at JOIN tags tg ON tg.id = at.tag_id WHERE at.material_id = materials.id AND tg.name = ?)'; args.push(tag) }
    if (q) { sql += ' AND (title LIKE ? OR author LIKE ? OR description LIKE ? OR tags LIKE ?)'; const like = `%${escapeLike(q)}%`; args.push(like, like, like, like) }
    // P2 阶段二 · F-3：日期区间筛选（YYYY-MM-DD 白名单 + 真实日历校验——2026-13-99 这类
    // 格式合法但日历无效的值会让 SQLite date() 返回 NULL 造成静默全空，必须前置拦截）
    const isRealDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && (() => { const d = new Date(s + 'T00:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s })()
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')
    if (isRealDate(dateFrom)) { sql += ' AND date(created_at) >= date(?)'; args.push(dateFrom) }
    if (isRealDate(dateTo)) { sql += ' AND date(created_at) <= date(?)'; args.push(dateTo) }
    // 运营批（2026-09-22）：精选素材在所有排序下置顶（首页/搜索「精选优先」）
    sql += ' ORDER BY featured DESC, ' + (sort === 'downloads' ? 'downloads DESC' : sort === 'likes' ? 'likes DESC' : 'created_at DESC, id DESC')

    // 分页模式：page 和 pageSize 同时提供时启用
    if (page > 0 && pageSize > 0) {
      const countSql = sql.replace(/^SELECT \*/, 'SELECT COUNT(*) as cnt')
      const cntRow = db.prepare(countSql).get(...args)
      const total = cntRow ? cntRow.cnt : 0
      sql += ' LIMIT ? OFFSET ?'
      args.push(pageSize, (page - 1) * pageSize)
      const rows = db.prepare(sql).all(...args).map(materialPublic)
      sendJSON(res, 200, { ok: true, data: rows, total, page, pageSize, hasMore: page * pageSize < total })
      return
    }

    const rows = db.prepare(sql).all(...args).map(materialPublic)
    sendJSON(res, 200, { ok: true, data: rows, total: rows.length })
  } },

  // ───── 素材上传（未登录 401 原专属文案） ─────
  { method: 'POST', pattern: '/api/materials', auth: 'user', unauthorizedMessage: '请先登录后再上传', handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody, parseMultipartFiles, validateUploadedFile, sanitizeOriginalName, TYPE_TO_CATEGORY, UPLOAD_DIR, THUMB_DIR, materialPublic, upsertAssetTags, recordGuestUpload, getClientIP } = ctx
    const contentType = req.headers['content-type'] || ''
    if (!contentType.includes('multipart/form-data')) {
      sendJSON(res, 400, { ok: false, message: '请使用 multipart/form-data 上传' })
      return
    }
    // Phase1 · S-1 止血：上传缓冲上限 200MB→50MB（readBody 超限即释放已缓冲内存，
    // 单请求内存占用封顶 ~50MB；流式落盘改造在 W2-3 随路由重构落地）
    const buf = await readBody(req, 50 * 1024 * 1024).catch((e) => {
      sendJSON(res, 413, { ok: false, message: e.message === 'body_too_large' ? '文件过大(单文件上限50MB)，请压缩后重试' : '读取失败' })
      return null
    })
    if (!buf) return
    const { fields, files } = parseMultipartFiles(buf, contentType)
    const title = (fields.title || '').trim()
    const type = fields.type || '其他'
    const college = fields.college || ''
    const description = (fields.description || '').trim()
    const shot_date = fields.shot_date || ''
    const tags = (fields.tags || '').split(/[,，\s]+/).filter(Boolean).slice(0, 6).join(',')
    // 元数据上限校验
    const width = Math.min(Number(fields.width) || 0, 100000)
    const height = Math.min(Number(fields.height) || 0, 100000)
    const duration = Math.min(Number(fields.duration) || 0, 86400)
    const submitStatus = fields.status || 'pending_review'
    const isDraft = submitStatus === 'draft' || fields.isDraft === '1' || fields.isDraft === 'true'
    const driveUrl = (fields.drive_url || '').trim()
    const subType = (fields.sub_type || '').trim()

    if (!title) { sendJSON(res, 400, { ok: false, message: '请填写素材标题' }); return }

    // 查找主文件和缩略图
    const mainFile = files.find(f => f.field === 'file')
    const thumbFile = files.find(f => f.field === 'thumb')

    let filename = null, originalName = '', fileSize = 0, mime = ''
    if (mainFile) {
      // 根据素材类型选择校验类别
      const category = TYPE_TO_CATEGORY[type] || 'image'
      const chk = validateUploadedFile(mainFile, category)
      if (!chk.ok) { sendJSON(res, 400, { ok: false, message: chk.message }); return }
      originalName = sanitizeOriginalName(mainFile.originalName)
      fileSize = mainFile.data.length
      mime = mainFile.mime
      const ext = '.' + chk.detected
      filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), mainFile.data)
    }

    let thumbName = null
    if (thumbFile) {
      // 缩略图校验
      const thumbChk = validateUploadedFile(thumbFile, 'image')
      if (!thumbChk.ok) { sendJSON(res, 400, { ok: false, message: '缩略图: ' + thumbChk.message }); return }
      thumbName = `thumb_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${thumbChk.detected}`
      fs.writeFileSync(path.join(THUMB_DIR, thumbName), thumbFile.data)
    }

    // 状态：draft（仅本人可见）或 pending_review（管理员审核队列）
    const status = isDraft ? 'draft' : 'pending_review'
    const info = db.prepare(
      'INSERT INTO materials (title,type,college,author,author_id,description,shot_date,tags,sub_type,status,filename,original_name,file_size,mime,width,height,duration,thumb_filename,drive_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).run(title, type, college, user ? user.name : '游客', user ? user.id : null, description, shot_date, tags, subType, status, filename, originalName, fileSize, mime, width, height, duration, thumbName, driveUrl)
    // P0-3: 同步维护标签关联表(materials.tags 双写保留)
    upsertAssetTags(info.lastInsertRowid, tags)

    // 记录状态日志
    db.prepare('INSERT INTO material_status_logs (material_id,to_status,action,operator_id,operator_name,reason) VALUES (?,?,?,?,?,?)')
      .run(info.lastInsertRowid, status, isDraft ? 'save_draft' : 'submit', user ? user.id : null, user ? user.name : '游客', isDraft ? '保存草稿' : '提交审核')

    // 游客上传计数（闸门已保证登录，此分支保留原样）
    if (!user) recordGuestUpload(getClientIP(req))

    sendJSON(res, 201, {
      ok: true,
      message: isDraft ? '草稿已保存' : '上传成功，等待管理员审核',
      material: materialPublic(db.prepare('SELECT * FROM materials WHERE id = ?').get(info.lastInsertRowid)),
    })
  } },

  // ───── 素材详情 ─────
  { method: 'GET', pattern: '/api/materials/:id(\\d+)', handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON, authUser, materialPublic } = ctx
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(params.id))
    if (!m) { sendJSON(res, 404, { ok: false, message: '素材不存在' }); return }
    const user = authUser(req)
    const isOwner = user && (user.is_admin || (user.id && user.id === m.author_id))
    // published 对所有人可见；其他状态仅本人/管理员可见
    if (m.status !== 'published' && !isOwner) {
      sendJSON(res, 404, { ok: false, message: '素材不存在或未通过审核' })
      return
    }
    db.prepare('UPDATE materials SET views = views + 1 WHERE id = ?').run(m.id)
    let liked = false, favorited = false
    if (user) {
      liked = !!db.prepare('SELECT 1 FROM material_likes WHERE material_id=? AND user_id=?').get(m.id, user.id)
      favorited = !!db.prepare('SELECT 1 FROM material_favorites WHERE material_id=? AND user_id=?').get(m.id, user.id)
    }
    sendJSON(res, 200, { ok: true, data: materialPublic({ ...m, views: m.views + 1 }), liked, favorited, is_owner: !!isOwner })
  } },

  // ───── HLS 播放列表（动态档位：并发感知 + 校内/校外区分，2026-10-23）─────
  // 规则：活跃播放 >30 → 只保留最低档；>15 → 去掉最高档；校外 IP 默认去掉最高档。
  { method: 'GET', pattern: '/api/materials/:id(\\d+)/hls/master.m3u8', handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON, authUser, getClientIP } = ctx
    const m = db.prepare('SELECT id,title,hls_dir,status,author_id FROM materials WHERE id = ?').get(Number(params.id))
    if (!m || !m.hls_dir) { sendJSON(res, 404, { ok: false, message: '该素材暂无高清播放版' }); return }
    const user = authUser(req)
    const isOwner = user && (user.is_admin || user.id === m.author_id)
    if (m.status !== 'published' && m.status !== 'approved' && !isOwner) { sendJSON(res, 404, { ok: false, message: '素材未公开' }); return }

    const rel = String(m.hls_dir).replace(/^\/+/, '')
    const mp = path.join(PUBLIC_DIR, rel, 'master.m3u8')
    if (!fs.existsSync(mp)) { sendJSON(res, 404, { ok: false, message: '播放列表缺失' }); return }
    let txt = fs.readFileSync(mp, 'utf8')

    // 活跃播放统计（60 秒滑窗）
    const ip = getClientIP(req)
    const now = Date.now()
    HLS_ACTIVE.set(ip, now)
    let active = 0
    for (const [k, v] of HLS_ACTIVE) {
      if (now - v > 60000) HLS_ACTIVE.delete(k)
      else active++
    }
    const isInternal = /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(String(ip))

    let cap = Infinity
    let reason = ''
    // 2026-10-23 修正：取消"校外默认限档"（校园网出口本身是公网 IP，误伤自己人；
    // 客户端 ABR 已能按实际带宽自适应）。只在并发高时由服务端兜底限档。
    // cap=4.0M → 保留 720p+480p；cap=1.5M → 仅 480p
    if (active > 30) { cap = 1500000; reason = 'highload' }
    else if (active > 15) { cap = 4000000; reason = 'load' }

    // 过滤 STREAM-INF 段（单行格式：#EXT-X-STREAM-INF:...\nuri）
    if (cap !== Infinity) {
      const lines = txt.split(/\r?\n/)
      const out = []
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const mm = line.match(/^#EXT-X-STREAM-INF:.*BANDWIDTH=(\d+)/)
        if (mm) {
          const bw = Number(mm[1])
          const uri = lines[i + 1] || ''
          if (bw <= cap) { out.push(line); out.push(uri) }
          i++ // 跳过已处理的 uri 行
          continue
        }
        out.push(line)
      }
      txt = out.join('\n')
    }

    // 档位路径改写为绝对路径：hls.js 会相对 master.m3u8 的 URL 解析相对路径，
    // 导致请求 /api/materials/:id/hls/0/index.m3u8（404）。改写成 /uploads/hls/:id/0/index.m3u8
    const hlsBase = '/uploads/hls/' + m.id + '/'
    txt = txt.replace(/^(\d+\/index\.m3u8)\s*$/gm, function (_, rel) { return hlsBase + rel })

    res.writeHead(200, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-store',
      'X-HLS-Active': String(active),
      'X-HLS-Internal': isInternal ? '1' : '0',
      'X-HLS-Cap': String(cap === Infinity ? 0 : cap),
      'X-HLS-Reason': reason || 'full',
    })
    res.end(txt)
  } },

  // ───── 大文件流式上传（4K 视频等，2026-10-23）─────
  // 为什么要单独端点：multipart 解析必须先把整个请求体读进内存（readBody），
  // 2GB 文件 = 2GB 内存会打爆服务。这里改为「二进制 body 流 → 临时文件」，
  // 内存恒定 1~2MB；元数据走 URL query，彻底绕开 multipart 解析。
  // 安全：角色分层限额 + Content-Length 预检 + 真实字节计数（防伪造）+ 磁盘余量检查 + 魔数校验。
  { method: 'POST', pattern: '/api/materials/upload-big', auth: 'user', unauthorizedMessage: '请先登录后再上传', handler: async (ctx, { req, res, user, url }) => {
    const { db, sendJSON, detectFileType, UPLOAD_DIR } = ctx

    // ① 角色分层上限（MB）
    const LIMITS = { admin: 2048, editor: 1024, reviewer: 1024, reporter: 500, student: 200 }
    const role = user.is_admin ? 'admin' : (user.role || 'student')
    const limitMB = LIMITS[role] || 200
    const limitBytes = limitMB * 1024 * 1024

    // ② 元数据（走 query，不走 multipart）
    const q = url.searchParams
    const title = (q.get('title') || '').trim().slice(0, 100)
    const type = q.get('type') || '其他'
    const college = q.get('college') || ''
    const description = (q.get('description') || '').trim().slice(0, 2000)
    const shot_date = q.get('shot_date') || ''
    const tags = (q.get('tags') || '').split(/[,，\s]+/).filter(Boolean).slice(0, 6).join(',')
    const statusQ = q.get('status') || 'pending_review'
    let originalName = ''
    try { originalName = decodeURIComponent(q.get('name') || '').slice(0, 200) } catch (e) { originalName = '' }
    if (!title) { sendJSON(res, 400, { ok: false, message: '请填写素材标题' }); return }

    // ③ 预检：长度 / 限额 / 磁盘余量（保留 2GB 缓冲）
    const declared = Number(req.headers['content-length'] || 0)
    if (!declared || declared <= 0) { sendJSON(res, 411, { ok: false, message: '缺少文件大小信息' }); return }
    if (declared > limitBytes) {
      sendJSON(res, 413, { ok: false, message: '文件超过你的上传上限（' + limitMB + 'MB）', limitMB })
      return
    }
    try {
      const st = fs.statfsSync(UPLOAD_DIR)
      const freeBytes = Number(st.bavail) * Number(st.bsize)
      if (freeBytes < declared * 1.5 + 2048 * 1024 * 1024) {
        sendJSON(res, 507, { ok: false, message: '服务器存储空间不足（剩余 ' + Math.round(freeBytes / 1048576) + 'MB），请联系管理员清理' })
        return
      }
    } catch (e) { /* statfs 不可用时跳过 */ }

    // ④ 流式落盘（内存恒定）
    const tmpDir = path.join(UPLOAD_DIR, 'tmp')
    fs.mkdirSync(tmpDir, { recursive: true })
    const tmpPath = path.join(tmpDir, 'up_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex') + '.part')
    const ws = fs.createWriteStream(tmpPath)
    let received = 0, aborted = false, overLimit = false

    // 用 stream.pipeline 处理背压（手写 pause/drain 在大文件下会死锁）
    const limiter = new Transform({
      transform(chunk, enc, cb) {
        received += chunk.length
        if (received > limitBytes) { overLimit = true; cb(new Error('LIMIT_EXCEEDED')); return }
        cb(null, chunk)
      },
    })
    await new Promise((resolve) => {
      pipeline(req, limiter, ws, (err) => {
        if (err) {
          aborted = true
          if (String(err.message || '').indexOf('LIMIT_EXCEEDED') !== -1) overLimit = true
          else if (err.code === 'ERR_STREAM_PREMATURE_CLOSE' || err.code === 'ECONNRESET') aborted = true
        }
        resolve()
      })
    })

    if (aborted) {
      try { fs.unlinkSync(tmpPath) } catch (e) {}
      sendJSON(res, overLimit ? 413 : 400, { ok: false, message: overLimit ? ('文件超过上限（' + limitMB + 'MB）') : '上传中断，请重试' })
      return
    }
    if (received === 0) {
      try { fs.unlinkSync(tmpPath) } catch (e) {}
      sendJSON(res, 400, { ok: false, message: '文件为空' }); return
    }

    // ⑤ 魔数校验（只读头部 64 字节）
    let detected = 'unknown'
    try {
      const fd = fs.openSync(tmpPath, 'r')
      const head = Buffer.alloc(64)
      fs.readSync(fd, head, 0, 64, 0)
      fs.closeSync(fd)
      detected = detectFileType(head) || 'unknown'
    } catch (e) {}
    if (detected === 'unknown') {
      try { fs.unlinkSync(tmpPath) } catch (e) {}
      sendJSON(res, 400, { ok: false, message: '无法识别的文件格式（支持常见音视频 / 图片 / 文档 / 压缩包）' })
      return
    }

    // ⑥ 正式文件名（保留原扩展名，缺省用检测类型）
    let ext = (originalName.match(/\.[A-Za-z0-9]{2,5}$/) || [''])[0].toLowerCase()
    if (!ext) ext = '.' + (detected === 'ms-office' ? 'doc' : detected)
    const filename = Date.now() + '_' + crypto.randomBytes(8).toString('hex') + ext
    const finalPath = path.join(UPLOAD_DIR, filename)
    try { fs.renameSync(tmpPath, finalPath) } catch (e) {
      try { fs.unlinkSync(tmpPath) } catch (e2) {}
      sendJSON(res, 500, { ok: false, message: '保存文件失败' }); return
    }

    // ⑦ 入库（字段与常规上传一致）
    const mime = req.headers['content-type'] || ''
    const finalStatus = statusQ === 'draft' ? 'draft' : (['pending_review', 'approved', 'published'].includes(statusQ) ? statusQ : 'pending_review')
    let info
    try {
      info = db.prepare(
        'INSERT INTO materials (title,type,college,author,author_id,description,shot_date,tags,sub_type,status,filename,original_name,file_size,mime,width,height,duration,thumb_filename,drive_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
      ).run(title, type, college, user.name, user.id, description, shot_date, tags, '', finalStatus, filename, originalName, received, mime, 0, 0, 0, null, '')
      db.prepare('INSERT INTO material_status_logs (material_id,to_status,action,operator_id,operator_name,reason) VALUES (?,?,?,?,?,?)')
        .run(info.lastInsertRowid, finalStatus, 'upload', user.id, user.name, '大文件流式上传 ' + Math.round(received / 1048576) + 'MB')
    } catch (e) {
      try { fs.unlinkSync(finalPath) } catch (e2) {}
      sendJSON(res, 500, { ok: false, message: '入库失败：' + e.message }); return
    }

    sendJSON(res, 201, {
      ok: true,
      message: '上传成功（' + Math.round(received / 1048576) + 'MB）',
      data: { id: Number(info.lastInsertRowid), filename, size: received, limitMB },
    })
  } },

  // ───── 素材文件下载 ─────
  // ───── 相关推荐（2026-10-25 · 多维打分：同活动类型/同学院/同标签/同时段/同类型）─────
  // 说明：materials 无 activity_id 关联，"同活动"用 sub_type（如"活动记录"）+ shot_date 同月近似
  { method: 'GET', pattern: '/api/materials/:id(\\d+)/related', handler: async (ctx, { req, res, params, url }) => {
    const { db, sendJSON, materialPublic } = ctx
    const mid = Number(params.id)
    const me = db.prepare('SELECT * FROM materials WHERE id = ?').get(mid)
    if (!me) { sendJSON(res, 404, { ok: false, message: '素材不存在' }); return }
    const limit = Math.min(12, parseInt(url.searchParams.get('limit'), 10) || 6)
    const pool = db.prepare("SELECT * FROM materials WHERE id != ? AND status IN ('published','approved')").all(mid)

    const splitTags = (t) => String(t || '').split(/[,，;；\s]+/).map((x) => x.trim()).filter(Boolean)
    const monthOf = (d) => String(d || '').replace(/[^\d]/g, '').slice(0, 6)
    const myTags = splitTags(me.tags)
    const myMonth = monthOf(me.shot_date)

    const scored = pool.map((m) => {
      let score = 0
      const reasons = []
      const mTags = splitTags(m.tags)
      const overlap = mTags.filter((t) => myTags.includes(t))

      if (me.sub_type && m.sub_type && m.sub_type === me.sub_type) { score += 35; reasons.push('同活动类型') }
      if (me.college && m.college && m.college === me.college) { score += 30; reasons.push('同学院') }
      if (overlap.length) { score += Math.min(30, overlap.length * 10); reasons.push('同标签') }
      if (myMonth && monthOf(m.shot_date) === myMonth) { score += 25; reasons.push('同时段') }
      if (me.type && m.type === me.type) { score += 12; reasons.push('同类型') }
      score += Math.min(10, m.downloads || 0)

      return { m, score, reason: reasons[0] || '相关', reasons }
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (b.m.downloads || 0) - (a.m.downloads || 0) || b.m.id - a.m.id)
      .slice(0, limit)

    sendJSON(res, 200, {
      ok: true,
      data: scored.map((x) => Object.assign(materialPublic(x.m), { reason: x.reason, reasons: x.reasons, score: x.score })),
      meta: { based_on: { college: me.college || '', sub_type: me.sub_type || '', tags: myTags, month: myMonth } },
    })
  } },

  // ───── 下载授权确认留痕（2026-10-25 · 补齐审计缺口）─────
  // 前端在用户勾选同意后调用；记录 账号/素材/条款版本/IP/UA/时间，供版权追溯
  { method: 'POST', pattern: '/api/materials/:id(\\d+)/download-agree', handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON, readBody, authUser, getClientIP } = ctx
    const user = authUser(req)
    if (!user) { sendJSON(res, 401, { ok: false, message: '请先登录' }); return }
    const m = db.prepare('SELECT id, title FROM materials WHERE id = ?').get(Number(params.id))
    if (!m) { sendJSON(res, 404, { ok: false, message: '素材不存在' }); return }
    const body = await readBody(req, 8 * 1024).catch(() => Buffer.alloc(0))
    let parsed = {}
    try { parsed = JSON.parse(body.toString('utf8')) } catch {}
    const terms = String(parsed.terms_version || 'v1.0').slice(0, 20)
    let ip = ''
    try { ip = typeof getClientIP === 'function' ? getClientIP(req) : '' } catch (e) { ip = '' }
    if (!ip) ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].replace(/^::ffff:/, '').trim()
    const ua = String(req.headers['user-agent'] || '').slice(0, 200)
    try {
      db.prepare('INSERT INTO download_logs (material_id, material_title, user_id, user_name, terms_version, ip, ua) VALUES (?,?,?,?,?,?,?)')
        .run(m.id, m.title || '', user.id || '', user.name || '', terms, ip, ua)
      sendJSON(res, 200, { ok: true, message: '已记录授权确认', data: { terms } })
    } catch (e) {
      sendJSON(res, 500, { ok: false, message: '记录失败：' + e.message })
    }
  } },

  { method: 'GET', pattern: '/api/materials/:id(\\d+)/file', handler: async (ctx, { req, res, params }) => {
    const { db, sendJSON, authUser, UPLOAD_DIR, getClientIP } = ctx
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(params.id))
    if (!m) { sendJSON(res, 404, { ok: false, message: '素材不存在' }); return }
    const user = authUser(req)
    const isOwner = user && (user.is_admin || (user.id && user.id === m.author_id))
    if (m.status !== 'published' && m.status !== 'approved' && !isOwner) {
      sendJSON(res, 404, { ok: false, message: '素材不存在或未通过审核' })
      return
    }
    // ── OSS 直存文件（2026-10-23）：302 到签名 URL，下载流量走 OSS 不占服务器 ──
    if (m.oss_key && oss.configured()) {
      const signed = oss.signedUrl(m.oss_key, { expireSec: 3600, filename: (m.original_name || m.title || 'download') })
      db.prepare('UPDATE materials SET downloads = downloads + 1 WHERE id = ?').run(m.id)
      try { db.prepare('INSERT INTO download_logs (material_id, ip, user_id) VALUES (?,?,?)').run(m.id, getClientIP(req), user ? user.id : null) } catch (e) {}
      res.writeHead(302, { Location: signed, 'Cache-Control': 'no-store' })
      res.end()
      return
    }
    if (!m.filename) { sendJSON(res, 404, { ok: false, message: '该素材没有关联文件' }); return }
    const fp = path.join(UPLOAD_DIR, m.filename)
    if (!fs.existsSync(fp)) { sendJSON(res, 404, { ok: false, message: '文件已丢失' }); return }
    db.prepare('UPDATE materials SET downloads = downloads + 1 WHERE id = ?').run(m.id)
    // 记录下载日志（安静失败，不影响下载）
    try { db.prepare('INSERT INTO download_logs (material_id, ip, user_id) VALUES (?,?,?)').run(m.id, getClientIP(req), user ? user.id : null) } catch {}
    const dlName = encodeURIComponent(m.original_name || m.title)
    res.writeHead(200, {
      'Content-Type': m.mime || 'application/octet-stream',
      'Content-Length': fs.statSync(fp).size,
      'Content-Disposition': `attachment; filename*=UTF-8''${dlName}`,
    })
    fs.createReadStream(fp).pipe(res)
  } },

  // ───── 素材预览（内联浏览，优先缩略图，不计下载量） ─────
  { method: 'GET', pattern: '/api/materials/:id(\\d+)/preview', handler: async (ctx, { req, res, params, url }) => {
    const { db, sendJSON, authUser, UPLOAD_DIR, THUMB_DIR } = ctx
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(params.id))
    if (!m) { sendJSON(res, 404, { ok: false, message: '素材不存在' }); return }
    const user = authUser(req)
    const isOwner = user && (user.is_admin || (user.id && user.id === m.author_id))
    if (m.status !== 'published' && m.status !== 'approved' && !isOwner) {
      sendJSON(res, 404, { ok: false, message: '素材不存在或未通过审核' })
      return
    }
    const IMG_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' }
    // 安全修复（2026-09-22）：Content-Type 一律由存储文件后缀（=magic bytes 检测类型）推断，
    // 绝不使用 m.mime（上传者可声明任意 mime，配合 magic-bytes 绕过可造成同源存储型 XSS——
    // 典型链：GIF 头+恶意 HTML、声明 mime=text/html、无缩略图走原文件直出 → 管理员审核预览时以管理员会话执行）
    const EXT_MIME = Object.assign({}, IMG_MIME, {
      '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.zip': 'application/zip',
      '.ms-office': 'application/vnd.ms-office', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
      '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.wma': 'audio/x-ms-wma', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
    })
    // ── OSS 直存文件且无缩略图：302 到内联签名 URL（播放/浏览走 OSS）──
    if (!m.thumb_filename && m.oss_key && oss.configured()) {
      const signed = oss.signedUrl(m.oss_key, { expireSec: 3600 })
      res.writeHead(302, { Location: signed, 'Cache-Control': 'no-store' })
      res.end()
      return
    }
    // 2026-10-23：?mid=1 → 2048px 大图预览版（懒生成 + 磁盘缓存）
    // 适用：超大原图（如 8192×5456 / 24MB）在详情页秒开且几乎无损
    if (url.searchParams.get('mid') === '1' && m.filename && !m.oss_key) {
      const IMG_EXT = ['.jpg', '.jpeg', '.png', '.webp']
      const ext = path.extname(m.filename).toLowerCase()
      if (IMG_EXT.includes(ext)) {
        const pvDir = path.join(PUBLIC_DIR, 'uploads', 'preview')
        try { fs.mkdirSync(pvDir, { recursive: true }) } catch (e) {}
        const pvFile = path.join(pvDir, m.id + '.jpg')
        const src = path.join(UPLOAD_DIR, m.filename)
        if (!fs.existsSync(pvFile) && fs.existsSync(src)) {
          try {
            const ffmpeg = process.env.FFMPEG_BIN || 'C:/app/bin/ffmpeg.exe'
            const tmp = pvFile + '.tmp.jpg'
            await new Promise((done) => {
              const child = require('child_process').spawn(ffmpeg, [
                '-hide_banner', '-loglevel', 'error', '-y', '-i', src,
                '-vf', "scale='min(2048,iw)':-2", '-q:v', '2', tmp,
              ], { windowsHide: true })
              const t = setTimeout(() => { try { child.kill() } catch (e) {} }, 90000)
              child.on('error', () => { clearTimeout(t); done() })
              child.on('close', () => { clearTimeout(t); done() })
            })
            if (fs.existsSync(tmp)) fs.renameSync(tmp, pvFile)
          } catch (e) { /* 生成失败 → 落到缩略图逻辑 */ }
        }
        if (fs.existsSync(pvFile)) {
          res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' })
          fs.createReadStream(pvFile).pipe(res)
          return
        }
      }
    }

    // 2026-10-23：?full=1 → 跳过缩略图，直接返回原图（详情页点开看原图用）
    const wantFull = url.searchParams.get('full') === '1'
    let fp = null, mime = null
    if (!wantFull && m.thumb_filename) {
      const tp = path.join(THUMB_DIR, m.thumb_filename)
      if (fs.existsSync(tp)) { fp = tp; mime = IMG_MIME[path.extname(tp).toLowerCase()] || 'image/jpeg' }
    }
    if (!fp) {
      if (!m.filename) { sendJSON(res, 404, { ok: false, message: '该素材没有关联文件' }); return }
      fp = path.join(UPLOAD_DIR, m.filename)
      if (!fs.existsSync(fp)) { sendJSON(res, 404, { ok: false, message: '文件已丢失' }); return }
      mime = EXT_MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream'
    }
    // inline 仅限 image/video/audio（浏览器原生播放器需要）；pdf/zip/office/octet-stream 一律 attachment（下载不渲染）
    const isInline = /^image\/|^video\/|^audio\//.test(mime)
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400', 'Content-Disposition': isInline ? 'inline' : 'attachment', 'X-Content-Type-Options': 'nosniff' })
    fs.createReadStream(fp).pipe(res)
  } },

  // ───── 收藏 / 取消收藏 ─────
  { method: 'POST', pattern: '/api/materials/favorite', auth: 'user', handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req, 16 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const mid = Number(parsed.material_id)
    if (!mid) { sendJSON(res, 400, { ok: false, message: '缺少 material_id' }); return }
    const existing = db.prepare('SELECT * FROM material_favorites WHERE material_id=? AND user_id=?').get(mid, user.id)
    if (existing) {
      db.prepare('DELETE FROM material_favorites WHERE material_id=? AND user_id=?').run(mid, user.id)
      sendJSON(res, 200, { ok: true, favorited: false })
    } else {
      db.prepare('INSERT INTO material_favorites (material_id,user_id) VALUES (?,?)').run(mid, user.id)
      sendJSON(res, 200, { ok: true, favorited: true })
    }
  } },

  // ───── 我的收藏 ─────
  { method: 'GET', pattern: '/api/me/favorites', auth: 'user', handler: async (ctx, { res, user }) => {
    const { db, sendJSON, materialPublic } = ctx
    const rows = db.prepare(
      "SELECT m.* FROM materials m JOIN material_favorites f ON m.id = f.material_id WHERE f.user_id = ? AND m.status IN ('approved','published') ORDER BY f.rowid DESC"
    ).all(user.id).map(materialPublic)
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 我的下载记录 ─────
  { method: 'GET', pattern: '/api/me/downloads', auth: 'user', handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON } = ctx
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize'), 10) || 20))
    const total = db.prepare('SELECT COUNT(*) c FROM download_logs WHERE user_id = ?').get(user.id).c
    const rows = db.prepare(
      `SELECT dl.id, dl.downloaded_at, m.id AS mid, m.title, m.type, m.sub_type,
              m.thumb_filename, m.author, m.status, m.file_size
       FROM download_logs dl LEFT JOIN materials m ON m.id = dl.material_id
       WHERE dl.user_id = ?
       ORDER BY dl.id DESC LIMIT ? OFFSET ?`
    ).all(user.id, pageSize, (page - 1) * pageSize)
    const data = rows.map(r => ({
      id: r.id,
      downloaded_at: r.downloaded_at,
      material: r.mid ? {
        id: r.mid,
        title: r.title || '未命名素材',
        type: r.type,
        sub_type: r.sub_type,
        thumb_filename: r.thumb_filename,
        author: r.author,
        status: r.status,
        file_size: r.file_size,
      } : null,
    }))
    sendJSON(res, 200, { ok: true, data, total, page, pageSize })
  } },

  // ───── 个人数据统计 ─────
  { method: 'GET', pattern: '/api/me/stats', auth: 'user', handler: async (ctx, { res, user }) => {
    const { db, sendJSON } = ctx
    const mats = db.prepare('SELECT * FROM materials WHERE author_id = ?').all(user.id)
    const myLikes = mats.reduce((s, m) => s + (m.likes || 0), 0)
    const myDownloads = mats.reduce((s, m) => s + (m.downloads || 0), 0)
    const favCount = db.prepare('SELECT COUNT(*) c FROM material_favorites WHERE user_id = ?').get(user.id).c
    const actCount = db.prepare('SELECT COUNT(*) c FROM activity_joins WHERE user_id = ?').get(user.id).c
    sendJSON(res, 200, {
      ok: true,
      data: {
        uploaded: mats.length,
        approved: mats.filter(m => m.status === 'approved' || m.status === 'published').length,
        published: mats.filter(m => m.status === 'published').length,
        pending: mats.filter(m => m.status === 'pending_review').length,
        drafts: mats.filter(m => m.status === 'draft' || m.status === 'rejected').length,
        totalLikes: myLikes,
        totalDownloads: myDownloads,
        favorites: favCount,
        activities: actCount,
      },
    })
  } },

  // ───── 点赞（含通知作者） ─────
  { method: 'POST', pattern: '/api/materials/like', auth: 'user', handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req, 16 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const mid = Number(parsed.material_id)
    if (!mid) { sendJSON(res, 400, { ok: false, message: '缺少 material_id' }); return }
    const existing = db.prepare('SELECT * FROM material_likes WHERE material_id=? AND user_id=?').get(mid, user.id)
    if (existing) {
      db.prepare('DELETE FROM material_likes WHERE material_id=? AND user_id=?').run(mid, user.id)
      db.prepare('UPDATE materials SET likes = MAX(0, likes - 1) WHERE id = ?').run(mid)
      sendJSON(res, 200, { ok: true, liked: false })
    } else {
      db.prepare('INSERT INTO material_likes (material_id,user_id) VALUES (?,?)').run(mid, user.id)
      db.prepare('UPDATE materials SET likes = likes + 1 WHERE id = ?').run(mid)
      const m = db.prepare('SELECT * FROM materials WHERE id=?').get(mid)
      if (m && m.author_id && m.author_id !== user.id) {
        db.prepare('INSERT INTO notifications (owner,material_id,material_title,actor,action) VALUES (?,?,?,?,?)')
          .run(m.author_id, mid, m.title, user.name, 'like')
      }
      sendJSON(res, 200, { ok: true, liked: true })
    }
  } },

  // ───── 我的素材(按上传者，附最近退回原因) ─────
  { method: 'GET', pattern: '/api/me/materials', auth: 'user', handler: async (ctx, { res, user }) => {
    const { db, sendJSON, materialPublic } = ctx
    const rows = db.prepare('SELECT * FROM materials WHERE author_id = ? ORDER BY id DESC').all(user.id).map(materialPublic)
    // 附上最近一次退回原因（仅本人可见，文档 P0：投稿后可查看状态与原因）
    const rejMap = {}
    db.prepare("SELECT material_id, reason FROM material_status_logs WHERE action = 'reject' AND reason != '' AND material_id IN (SELECT id FROM materials WHERE author_id = ?) ORDER BY id DESC").all(user.id)
      .forEach(l => { if (!rejMap[l.material_id]) rejMap[l.material_id] = l.reason })
    rows.forEach(r => { if (r.status === 'rejected' && rejMap[r.id]) r.reject_reason = rejMap[r.id] })
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 素材审核(editor/reviewer) ─────
  { method: 'POST', pattern: '/api/materials/review', auth: 'staff:editor,reviewer', handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req, 16 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const mid = Number(parsed.material_id)
    const action = parsed.action // 'approve' | 'reject' | 'publish' | 'archive' | 'feature' | 'unfeature'
    const reason = (parsed.reason || '').trim()
    const validActions = ['approve', 'reject', 'publish', 'archive', 'unarchive', 'feature', 'unfeature']
    if (!mid || !validActions.includes(action)) { sendJSON(res, 400, { ok: false, message: '参数错误' }); return }
    if (action === 'reject' && !reason) { sendJSON(res, 400, { ok: false, message: '退回必须填写原因' }); return }
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(mid)
    if (!m) { sendJSON(res, 404, { ok: false, message: '素材不存在' }); return }

    // ── 精选标记（不改状态机，独立开关；首页/搜索置顶 + 发放精选贡献值）──
    if (action === 'feature' || action === 'unfeature') {
      if (m.status !== 'published' && m.status !== 'approved') { sendJSON(res, 400, { ok: false, message: '仅已通过/已发布素材可设精选' }); return }
      const want = action === 'feature' ? 1 : 0
      db.prepare('UPDATE materials SET featured = ? WHERE id = ?').run(want, mid)
      if (want && m.author_id) {
        // 精选贡献值 +10（UNIQUE(type,ref_id) 幂等：取消再精选不重复加分）
        try {
          db.prepare("INSERT OR IGNORE INTO contribution_logs (user_id,user_name,points,type,ref_id,note) VALUES (?,?,?,?,?,?)")
            .run(m.author_id, m.author, 10, 'featured', mid, '素材被精选：' + m.title)
          db.prepare('INSERT INTO notifications (owner,material_id,material_title,actor,action) VALUES (?,?,?,?,?)')
            .run(m.author_id, mid, m.title, user.name, 'featured')
        } catch (e) { console.warn('  ⚠ 精选贡献值发放失败:', e.message) }
      }
      sendJSON(res, 200, { ok: true, message: want ? '已设为精选（作者 +10 贡献值）' : '已取消精选', featured: !!want })
      return
    }

    // ── 状态机校验 ──
    const current = m.status || 'pending_review'
    const transitions = {
      'pending_review': { approve: 'approved', reject: 'rejected' },
      'rejected': { approve: 'approved' },
      'approved': { publish: 'published', archive: 'archived' },
      'published': { archive: 'archived' },
      'archived': { unarchive: 'approved', publish: 'published' },
    }
    const allowed = transitions[current] || {}
    const newStatus = allowed[action]
    if (!newStatus) { sendJSON(res, 400, { ok: false, message: `当前状态「${current}」不允许执行「${action}」` }); return }

    db.prepare('UPDATE materials SET status = ? WHERE id = ?').run(newStatus, mid)

    // 运营批（2026-09-22）：审核通过自动发放素材贡献值（图片+2/视频+5/其他+3，UNIQUE 幂等）
    if (newStatus === 'approved' && m.author_id) {
      const pts = m.type === '视频' ? 5 : (m.type === '图片' ? 2 : 3)
      try {
        db.prepare("INSERT OR IGNORE INTO contribution_logs (user_id,user_name,points,type,ref_id,note) VALUES (?,?,?,?,?,?)")
          .run(m.author_id, m.author, pts, 'material_approve', mid, '素材通过审核：' + m.title)
      } catch (e) { console.warn('  ⚠ 审核贡献值发放失败:', e.message) }
    }

    // 记录状态日志
    db.prepare('INSERT INTO material_status_logs (material_id,from_status,to_status,action,operator_id,operator_name,reason) VALUES (?,?,?,?,?,?,?)')
      .run(mid, current, newStatus, action, user.id, user.name, reason || '')

    // 通知上传者（除 archive/unarchive 外）
    if (m.author_id && !['archive', 'unarchive'].includes(action)) {
      const actionNames = { approve: 'approved', reject: 'rejected', publish: 'published' }
      db.prepare('INSERT INTO notifications (owner,material_id,material_title,actor,action) VALUES (?,?,?,?,?)')
        .run(m.author_id, mid, m.title, user.name, actionNames[action] || action)
    }

    const messages = { approve: '已通过审核', reject: '已拒绝', publish: '已发布', archive: '已归档', unarchive: '已取消归档' }
    sendJSON(res, 200, { ok: true, message: messages[action], status: newStatus })
  } },

  // ───── 素材删除(本人或管理员；业务级行权校验留 handler) ─────
  { method: 'DELETE', pattern: '/api/materials/:id(\\d+)', auth: 'user', handler: async (ctx, { res, params, user }) => {
    const { db, sendJSON, UPLOAD_DIR, THUMB_DIR } = ctx
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(params.id))
    if (!m) { sendJSON(res, 404, { ok: false, message: '素材不存在' }); return }
    if (!user.is_admin && m.author_id !== user.id) { sendJSON(res, 403, { ok: false, message: '无权删除他人素材' }); return }
    if (m.filename) { try { fs.unlinkSync(path.join(UPLOAD_DIR, m.filename)) } catch {} }
    if (m.thumb_filename) { try { fs.unlinkSync(path.join(THUMB_DIR, m.thumb_filename)) } catch {} }
    db.prepare('DELETE FROM material_status_logs WHERE material_id = ?').run(m.id)
    db.prepare('DELETE FROM asset_tags WHERE material_id = ?').run(m.id)
    db.prepare('DELETE FROM materials WHERE id = ?').run(m.id)
    sendJSON(res, 200, { ok: true, message: '已删除' })
  } },

  // ───── 素材编辑(本人或管理员, multipart 或 JSON) ─────
  { method: 'PUT', pattern: '/api/materials/:id(\\d+)', auth: 'user', handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody, parseMultipartFiles, validateUploadedFile, THUMB_DIR, upsertAssetTags } = ctx
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(params.id))
    if (!m) { sendJSON(res, 404, { ok: false, message: '素材不存在' }); return }
    if (!user.is_admin && m.author_id !== user.id) { sendJSON(res, 403, { ok: false, message: '无权编辑他人素材' }); return }
    const raw = await readBody(req, 64 * 1024).catch(() => Buffer.alloc(0))
    const contentType = req.headers['content-type'] || ''
    let update = {}
    if (contentType.includes('multipart/form-data')) {
      const parts = parseMultipartFiles(raw, contentType)
      update = parts.fields
      // 处理缩略图上传
      const thumbFiles = parts.files.filter(f => f.field === 'thumb')
      if (thumbFiles.length > 0) {
        const thumbFile = thumbFiles[0]
        const thumbChk = validateUploadedFile(thumbFile, 'image')
        if (!thumbChk.ok) { sendJSON(res, 400, { ok: false, message: '缩略图: ' + thumbChk.message }); return }
        const thumbName = `thumb_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${thumbChk.detected}`
        fs.writeFileSync(path.join(THUMB_DIR, thumbName), thumbFile.data)
        if (m.thumb_filename) { try { fs.unlinkSync(path.join(THUMB_DIR, m.thumb_filename)) } catch {} }
        update.thumb_filename = thumbName
      }
    } else {
      try { update = JSON.parse(raw.toString('utf8')) } catch { update = {} }
    }
    // 构建 UPDATE SET 子句
    const setters = [], args = []
    const fields = ['title','college','type','description','shot_date','drive_url','tags','sub_type']
    fields.forEach(f => {
      if (update[f] !== undefined && update[f] !== null) {
        setters.push(`${f} = ?`)
        args.push(String(update[f]).trim())
      }
    })
    if (update.thumb_filename) { setters.push('thumb_filename = ?'); args.push(update.thumb_filename) }
    if (setters.length > 0) {
      args.push(m.id)
      db.prepare(`UPDATE materials SET ${setters.join(', ')} WHERE id = ?`).run(...args)
      // P0-3: tags 变更时同步关联表
      if (update.tags !== undefined && update.tags !== null) upsertAssetTags(m.id, String(update.tags))
    }
    sendJSON(res, 200, { ok: true, message: '素材已更新' })
  } },

  // ───── 素材状态流转(用户提交/重新提交) ─────
  { method: 'POST', pattern: '/api/materials/:id(\\d+)/status', auth: 'user', handler: async (ctx, { req, res, params, user }) => {
    const { db, sendJSON, readBody } = ctx
    const body = await readBody(req, 16 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const mid = Number(params.id)
    const action = parsed.action // 'submit' | 'resubmit'
    if (!mid || !['submit', 'resubmit'].includes(action)) { sendJSON(res, 400, { ok: false, message: '参数错误' }); return }
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(mid)
    if (!m) { sendJSON(res, 404, { ok: false, message: '素材不存在' }); return }
    const isOwner = user.is_admin || (user.id === m.author_id)
    if (!isOwner) { sendJSON(res, 403, { ok: false, message: '无权操作他人素材' }); return }
    const current = m.status || 'draft'
    if (action === 'submit' && current !== 'draft') { sendJSON(res, 400, { ok: false, message: '只有草稿可以提交审核' }); return }
    if (action === 'resubmit' && current !== 'rejected') { sendJSON(res, 400, { ok: false, message: '只有被拒绝的素材可以重新提交' }); return }
    db.prepare('UPDATE materials SET status = ? WHERE id = ?').run('pending_review', mid)
    db.prepare('INSERT INTO material_status_logs (material_id,from_status,to_status,action,operator_id,operator_name,reason) VALUES (?,?,?,?,?,?,?)')
      .run(mid, current, 'pending_review', action, user.id, user.name, '')
    sendJSON(res, 200, { ok: true, message: '已提交审核', status: 'pending_review' })
  } },

  // ───── 素材状态日志 ─────
  { method: 'GET', pattern: '/api/materials/:id(\\d+)/status', auth: 'user', handler: async (ctx, { res, params }) => {
    const { db, sendJSON } = ctx
    const mid = Number(params.id)
    if (!mid) { sendJSON(res, 400, { ok: false, message: '缺少素材ID' }); return }
    const logs = db.prepare('SELECT * FROM material_status_logs WHERE material_id = ? ORDER BY id DESC').all(mid)
    sendJSON(res, 200, { ok: true, data: logs })
  } },

  // ───── 标签管理(editor)：列表 ─────
  { method: 'GET', pattern: '/api/admin/tags', auth: 'staff:editor', handler: async (ctx, { res }) => {
    const { db, sendJSON } = ctx
    const rows = db.prepare(`
      SELECT t.id, t.name, t.source, t.created_at, COUNT(at.material_id) AS count
      FROM tags t LEFT JOIN asset_tags at ON at.tag_id = t.id
      GROUP BY t.id ORDER BY count DESC, t.name
    `).all()
    sendJSON(res, 200, { ok: true, data: rows })
  } },

  // ───── 标签管理(editor)：合并 ─────
  { method: 'POST', pattern: '/api/admin/tags/merge', auth: 'staff:editor', handler: async (ctx, { req, res, user }) => {
    const { db, sendJSON, readBody, normalizeTagList } = ctx
    const body = await readBody(req, 32 * 1024).catch(() => Buffer.alloc(0))
    let parsed
    try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = {} }
    const from = [...new Set(Array.isArray(parsed.from) ? parsed.from.map(s => String(s).trim()).filter(Boolean) : [])]
    const to = String(parsed.to || '').trim()
    if (!from.length || !to) { sendJSON(res, 400, { ok: false, message: '请提供待合并标签与目标标签' }); return }
    if (from.includes(to)) { sendJSON(res, 400, { ok: false, message: '目标标签不能与来源标签相同' }); return }
    const fromSet = new Set(from)
    let affected = 0
    try {
      db.exec('BEGIN')
      try {
        db.prepare('INSERT OR IGNORE INTO tags (name, source) VALUES (?, ?)').run(to, 'manual')
        const toId = db.prepare('SELECT id FROM tags WHERE name = ?').get(to).id
        const placeholders = from.map(() => '?').join(',')
        const affectedRows = db.prepare(`
          SELECT DISTINCT m.id, m.tags FROM materials m
          JOIN asset_tags at ON at.material_id = m.id
          JOIN tags t ON t.id = at.tag_id
          WHERE t.name IN (${placeholders})
        `).all(...from)
        const updMat = db.prepare('UPDATE materials SET tags = ? WHERE id = ?')
        const delMap = db.prepare('DELETE FROM asset_tags WHERE material_id = ? AND tag_id IN (SELECT id FROM tags WHERE name IN (' + placeholders + '))')
        const insMap = db.prepare('INSERT OR IGNORE INTO asset_tags (material_id, tag_id, source) VALUES (?,?,?)')
        for (const m of affectedRows) {
          const list = normalizeTagList(m.tags)
          const hadFrom = list.some(x => fromSet.has(x))
          const kept = list.filter(x => !fromSet.has(x))
          if (hadFrom && !kept.includes(to)) kept.push(to)
          updMat.run(kept.join(','), m.id)
          for (const name of from) delMap.run(m.id, name)
          if (hadFrom) insMap.run(m.id, toId, 'manual')
          affected++
        }
        db.prepare(`DELETE FROM tags WHERE name IN (${placeholders})`).run(...from)
        db.exec('COMMIT')
      } catch (e) { db.exec('ROLLBACK'); throw e }
    } catch (e) {
      sendJSON(res, 500, { ok: false, message: '合并失败: ' + e.message })
      return
    }
    sendJSON(res, 200, { ok: true, message: `已合并 ${from.length} 个标签至「${to}」`, affected })
  } },

  // ───── 标签管理(editor)：删除 ─────
  { method: 'DELETE', pattern: '/api/admin/tags/:id(\\d+)', auth: 'staff:editor', handler: async (ctx, { res, params }) => {
    const { db, sendJSON, normalizeTagList } = ctx
    const tid = Number(params.id)
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tid)
    if (!tag) { sendJSON(res, 404, { ok: false, message: '标签不存在' }); return }
    let affected = 0
    try {
      db.exec('BEGIN')
      try {
        const affectedRows = db.prepare(`
          SELECT DISTINCT m.id, m.tags FROM materials m
          JOIN asset_tags at ON at.material_id = m.id
          WHERE at.tag_id = ?
        `).all(tid)
        const updMat = db.prepare('UPDATE materials SET tags = ? WHERE id = ?')
        for (const m of affectedRows) {
          const kept = normalizeTagList(m.tags).filter(x => x !== tag.name)
          updMat.run(kept.join(','), m.id)
          affected++
        }
        db.prepare('DELETE FROM asset_tags WHERE tag_id = ?').run(tid)
        db.prepare('DELETE FROM tags WHERE id = ?').run(tid)
        db.exec('COMMIT')
      } catch (e) { db.exec('ROLLBACK'); throw e }
    } catch (e) {
      sendJSON(res, 500, { ok: false, message: '删除失败: ' + e.message })
      return
    }
    sendJSON(res, 200, { ok: true, message: `标签「${tag.name}」已删除`, affected })
  } },

  // ───── 缩略图文件服务 ─────
  { method: 'GET', pattern: '/api/thumbs/:name', handler: async (ctx, { res, params }) => {
    const { sendJSON, THUMB_DIR } = ctx
    const fp = path.join(THUMB_DIR, params.name)
    if (!fs.existsSync(fp)) { sendJSON(res, 404, { ok: false, message: '缩略图不存在' }); return }
    const ext = path.extname(fp)
    const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' }
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'max-age=86400' })
    fs.createReadStream(fp).pipe(res)
  } },

  // ───── 活动海报静态文件 ─────
  { method: 'GET', pattern: '/api/posters/:name', handler: async (ctx, { res, params }) => {
    const { sendJSON, UPLOAD_DIR } = ctx
    const fp = path.join(UPLOAD_DIR, 'posters', params.name)
    if (!fs.existsSync(fp)) { sendJSON(res, 404, { ok: false, message: '海报不存在' }); return }
    const ext = path.extname(fp)
    const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' }
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'max-age=86400' })
    fs.createReadStream(fp).pipe(res)
  } },

  // ───── 画廊图片静态文件（uploads/gallery/） ─────
  { method: 'GET', pattern: '/api/gallery/:name', handler: async (ctx, { res, params }) => {
    const { sendJSON, UPLOAD_DIR } = ctx
    const fp = path.join(UPLOAD_DIR, 'gallery', params.name)
    if (!fs.existsSync(fp)) { sendJSON(res, 404, { ok: false, message: '图片不存在' }); return }
    const ext = path.extname(fp)
    const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'max-age=86400' })
    fs.createReadStream(fp).pipe(res)
  } },
]

const dispatch = require('./router')(routes)

module.exports = async function routesMaterials(ctx, req, res, p, method, url) {
  return dispatch(ctx, req, res, p, method, url)
}
