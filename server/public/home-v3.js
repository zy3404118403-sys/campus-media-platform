/* ═══════════════════════════════════════════════════════════════
   首页 V3 交互层（移植自 proto-v3-live.html）
   依赖 index.js / shared.js 全局能力：
   openDetail(id) 素材详情弹窗 · showPage(p) SPA 导航
   showCollegeDetail(id) 学院详情 · toast(msg) 轻提示
   openCampusLightbox(i) 校园图集灯箱 · campusGalleryItems 图集数据
   ═══════════════════════════════════════════════════════════════ */
;(function () {
  'use strict'
  var HOME = document.getElementById('page-home')
  if (!HOME) return

  function $(id) { return document.getElementById(id) }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  function apiGet(p) {
    return fetch(p).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    })
  }
  function fmt(n) { return (n || 0).toLocaleString('zh-Hans-CN') }
  /* 双语文案：按当前站点语言取值（i18n 补全 2026-09-08） */
  function hl(zh, en) {
    try { return (localStorage.getItem('lang') === 'en') ? en : zh } catch (e) { return zh }
  }
  var TYPE_EN = { '图片': 'Photo', '视频': 'Video', '文档': 'Doc', '音频': 'Audio', '其他': 'Other' }
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec || 0))
    if (!sec) return ''
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
    var mm = (m < 10 ? '0' : '') + m, ss = (s < 10 ? '0' : '') + s
    return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss
  }

  /* ── V3 演示兜底数据（接口不可用时保持视觉与交互完整） ── */
  var DEMO_MATS = [
    { t: '毕业典礼航拍全景 4K', ty: '视频', au: '融媒体中心', dl: 2861, dur: '02:41' },
    { t: '教学楼逆光延时合集', ty: '视频', au: '文传学院·李同学', dl: 1924, dur: '01:12' },
    { t: '运动会百米决赛抓拍组图', ty: '图片', au: '设计·王同学', dl: 1538 },
    { t: '毕业季学士服人像集', ty: '图片', au: '音演学院·陈同学', dl: 1372 },
    { t: '校园晚会开场灯光秀', ty: '视频', au: '融媒体中心', dl: 1187, dur: '00:45' },
    { t: '迎新晚会完整流程策划案', ty: '文档', au: '管理学院·赵同学', dl: 964, dur: '24 页' },
    { t: '军训汇演方阵高清组图', ty: '图片', au: '数据工程·刘同学', dl: 892 },
    { t: '校园广播站台呼音频包', ty: '音频', au: '融媒体中心', dl: 745, dur: '12 首' },
    { t: '名家讲坛全程录像', ty: '视频', au: '马院·周老师', dl: 688, dur: '58:20' },
    { t: 'logo 规范 VI 手册', ty: '文档', au: '融媒体中心', dl: 621, dur: '36 页' }
  ]

  /* ═══ 滚动入场 ═══ */
  try {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target) }
      })
    }, { threshold: .1 })
    document.querySelectorAll('#page-home .reveal').forEach(function (el) { io.observe(el) })
  } catch (e) { document.querySelectorAll('#page-home .reveal').forEach(function (el) { el.classList.add('on') }) }

  /* ═══ 数字滚动（hero 统计） ═══ */
  function countUpFmt(el) {
    var to = +el.dataset.to || 0, dur = 1400, t0 = performance.now()
    ;(function tick(t) {
      var p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3)
      el.textContent = fmt(Math.round(to * e))
      if (p < 1) requestAnimationFrame(tick)
    })(t0)
  }
  try {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { countUpFmt(e.target); cio.unobserve(e.target) }
      })
    }, { threshold: .6 })
    document.querySelectorAll('#page-home .count').forEach(function (el) { cio.observe(el) })
  } catch (e) { document.querySelectorAll('#page-home .count').forEach(countUpFmt) }

  /* ═══ 数据面板条形图 ═══ */
  try {
    var gio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.gp-fill').forEach(function (f, i) {
            setTimeout(function () { f.style.width = f.dataset.w }, 150 + i * 110)
          })
          gio.unobserve(e.target)
        }
      })
    }, { threshold: .3 })
    document.querySelectorAll('#page-home .glass-panel').forEach(function (el) { gio.observe(el) })
  } catch (e) {
    document.querySelectorAll('#page-home .gp-fill').forEach(function (f) { f.style.width = f.dataset.w })
  }

  /* ═══ 返回顶部 ═══ */
  function bindBackTop() {
    var backTop = $('backTop')
    if (!backTop) return false
    addEventListener('scroll', function () {
      backTop.classList.toggle('show', scrollY > 600)
    }, { passive: true })
    backTop.addEventListener('click', function () {
      scrollTo({ top: 0, behavior: 'smooth' })
    })
    return true
  }
  if (!bindBackTop()) {
    /* 兜底：按钮晚于脚本解析时（如置于 body 尾部），DOM 就绪后再绑定 */
    document.addEventListener('DOMContentLoaded', bindBackTop)
  }

  /* ═══ 热门素材：渲染 + 类型/标签/关键词组合筛选 ═══ */
  var ICONS = {
    '图片': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    '视频': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
    '文档': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    '音频': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    '其他': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>'
  }
  var TC = {
    '图片': 'linear-gradient(135deg,#134E4A,#2DD4BF)',
    '视频': 'linear-gradient(135deg,#3B2A6B,#A78BFA)',
    '文档': 'linear-gradient(135deg,#78350F,#FBBF24)',
    '音频': 'linear-gradient(135deg,#881337,#FB7185)',
    '其他': 'linear-gradient(135deg,#374151,#9CA3AF)'
  }

  var LIVE = false
  var MATS = DEMO_MATS.slice()
  var MAT_TOTAL = MATS.length
  var curType = 'all', curKw = '', curTag = '', apiSeq = 0
  /* 最近一次数据快照：语言切换（wb:lang）后按新语言重渲染动态文案 */
  var LAST_LIST = null, LAST_TOTAL = 0, LAST_TOTALS = null, LAST_CC = null, LAST_RANK = null, LAST_STATS = null, LAST_TAGS = null

  var grid = $('matGrid')
  var searchChip = $('searchChip'), scKeyword = $('scKeyword'), scCount = $('scCount')

  function toMat(r) {
    return {
      id: r.id,
      t: r.title || hl('(未命名)', '(Untitled)'),
      ty: r.type || '其他',
      au: (r.college ? r.college.split('（')[0] + '·' : '') + (r.author || hl('匿名', 'Anonymous')),
      dl: r.downloads || 0,
      dur: fmtDur(r.duration),
      tags: r.tags || [],
      featured: !!r.featured,
      thumb: (r.has_thumb && r.thumb_filename) ? ('/api/thumbs/' + encodeURIComponent(r.thumb_filename)) : null
    }
  }

  function renderCards(list, total) {
    if (!grid) return
    LAST_LIST = list; LAST_TOTAL = total
    grid.innerHTML = ''
    if (!list.length) {
      grid.innerHTML = '<div class="v3-empty"><div class="es-ic"><svg width="26" height="26" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>' + hl('没有找到与 ', 'No materials found for ') + '<b>「' + esc((curKw.trim() || curTag)) + '」</b>' + hl(' 相关的素材', '') + '<br><button class="es-clear" data-v3clear="1">' + hl('清除筛选，浏览全部', 'Clear filters and browse all') + '</button></div>'
    } else {
      list.forEach(function (m, i) {
        var c = document.createElement('div')
        c.className = 'mat-card'
        c.setAttribute('data-mid', m.id != null ? m.id : '')
        c.setAttribute('role', 'button')
        c.setAttribute('tabindex', '0')
        c.innerHTML =
          '<div class="mat-thumb" style="--tc:' + (TC[m.ty] || TC['其他']) + '">' +
            (m.thumb
              ? '<img src="' + esc(m.thumb) + '" alt="' + esc(m.t) + '" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.remove()">'
              : '<div class="pat"></div><div class="big">' + (ICONS[m.ty] || ICONS['其他']) + '</div>') +
            '<span class="mat-type" style="color:#fff">' + esc(TYPE_EN[m.ty] || m.ty) + '</span>' +
            (m.featured ? '<span class="mat-featured" title="管理员精选">' + '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' + ' 精选</span>' : '') +
            (m.dur ? '<span class="mat-dur">' + esc(m.dur) + '</span>' : '') +
          '</div>' +
          '<div class="mat-body">' +
            '<h4>' + esc(m.t) + '</h4>' +
            '<div class="mat-meta">' +
              '<span class="dl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' + fmt(m.dl) + '</span>' +
              '<span class="au">' + esc(m.au) + '</span>' +
            '</div>' +
          '</div>'
        grid.appendChild(c)
        c.style.opacity = 0; c.style.transform = 'translateY(14px)'
        c.style.transition = 'opacity .5s ease, transform .5s cubic-bezier(.22,1,.36,1)'
        c.style.transitionDelay = Math.min(i * 40, 360) + 'ms'
        requestAnimationFrame(function () { requestAnimationFrame(function () { c.style.opacity = 1; c.style.transform = 'none' }) })
      })
    }
    var hasKw = !!(curKw.trim() || curTag)
    if (searchChip) searchChip.classList.toggle('show', hasKw)
    if (hasKw) {
      if (scKeyword) scKeyword.textContent = curKw.trim() || curTag
      if (scCount) scCount.textContent = hl('命中 ', 'Matches ') + list.length + ' / ' + (total || MAT_TOTAL) + hl(' 份', '')
    }
    document.querySelectorAll('#hotTags a').forEach(function (a) {
      var kw = a.getAttribute('data-kw') || a.dataset.tag || a.textContent.trim()
      a.classList.toggle('on', !!curTag && kw === curTag)
    })
  }

  function filterLocal() {
    var kw = curKw.trim().toLowerCase(), tag = curTag
    var list = MATS.filter(function (m) {
      return (curType === 'all' || m.ty === curType) &&
        (!tag || (m.tags || []).indexOf(tag) >= 0) &&
        (!kw || m.t.toLowerCase().indexOf(kw) >= 0 || m.au.toLowerCase().indexOf(kw) >= 0)
    })
    renderCards(list, MATS.length)
  }

  function applyFilter() {
    if (!LIVE) { filterLocal(); return }
    var seq = ++apiSeq, qs = []
    if (curKw.trim()) qs.push('q=' + encodeURIComponent(curKw.trim()))
    if (curTag) qs.push('tag=' + encodeURIComponent(curTag))
    if (curType !== 'all') qs.push('type=' + encodeURIComponent(curType))
    qs.push('sort=downloads', 'page=1', 'pageSize=48')
    apiGet('/api/materials?' + qs.join('&')).then(function (j) {
      if (seq !== apiSeq) return
      renderCards((j.data || []).map(toMat), j.total || MAT_TOTAL)
    }).catch(function () { if (seq === apiSeq) filterLocal() })
  }

  function clearSearch() {
    curKw = ''; curTag = ''; curType = 'all'
    var hi = $('heroSearchInput'); if (hi) hi.value = ''
    var ns = $('navSearchInput'); if (ns) ns.value = ''
    document.querySelectorAll('#matTabs .tab').forEach(function (t) {
      var on = t.dataset.type === 'all'
      t.classList.toggle('active', on)
      t.setAttribute('aria-selected', String(on))
    })
    applyFilter()
  }

  function scrollHot() {
    var hs = $('hot-section')
    if (hs) hs.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function runSearch(kw, scroll) {
    curKw = kw || ''
    if (curKw.trim()) curTag = ''
    applyFilter()
    if (scroll !== false) {
      if (HOME.classList.contains('active')) scrollHot()
      else { showPage('home'); setTimeout(scrollHot, 450) }
    }
  }

  function setType(type) {
    curType = type || 'all'
    document.querySelectorAll('#matTabs .tab').forEach(function (t) {
      var on = t.dataset.type === curType
      t.classList.toggle('active', on)
      t.setAttribute('aria-selected', String(on))
    })
    applyFilter()
    if (HOME.classList.contains('active')) scrollHot()
    else { showPage('home'); setTimeout(scrollHot, 450) }
  }

  /* tabs 点击 */
  var matTabs = $('matTabs')
  if (matTabs) {
    matTabs.addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return
      setType(b.dataset.type)
    })
  }

  /* hero 主搜索：按钮 + 回车 */
  var heroBtn = $('heroSearchBtn'), heroInput = $('heroSearchInput')
  if (heroBtn) heroBtn.addEventListener('click', function () {
    var v = heroInput ? heroInput.value : ''
    if (!v.trim()) { toast(hl('请输入要搜索的素材关键词', 'Please enter a keyword to search')); return }
    runSearch(v)
  })
  if (heroInput) heroInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); runSearch(e.target.value) }
  })

  /* 顶栏搜索：回车联动主搜索（非首页时先切回首页） */
  var navInput = $('navSearchInput')
  if (navInput) navInput.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    var v = e.target.value
    if (!v.trim()) { toast(hl('请输入要搜索的素材关键词', 'Please enter a keyword to search')); return }
    if (heroInput) heroInput.value = v
    runSearch(v)
  })

  /* 热门标签点击 → 标签筛选 */
  var hotTags = $('hotTags')
  if (hotTags) hotTags.addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return
    e.preventDefault()
    var kw = a.getAttribute('data-kw') || a.dataset.tag || a.textContent.trim()
    if (heroInput) heroInput.value = kw
    var ns = $('navSearchInput'); if (ns) ns.value = kw
    curKw = ''; curTag = kw
    applyFilter()
    if (HOME.classList.contains('active')) scrollHot()
    else { showPage('home'); setTimeout(scrollHot, 450) }
  })

  /* 清除筛选（含空状态按钮，事件委托） */
  HOME.addEventListener('click', function (e) {
    if (e.target.closest('#scClear') || e.target.closest('[data-v3clear]')) { clearSearch(); return }
    var card = e.target.closest('#matGrid .mat-card')
    if (card) {
      var id = parseInt(card.getAttribute('data-mid'), 10)
      if (id && typeof openDetail === 'function') openDetail(id)
    }
  })
  HOME.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return
    var card = e.target.closest ? e.target.closest('#matGrid .mat-card') : null
    if (card) {
      e.preventDefault()
      var id = parseInt(card.getAttribute('data-mid'), 10)
      if (id && typeof openDetail === 'function') openDetail(id)
    }
  })

  /* ═══ 联机数据层 ═══ */
  function applyStats(d) {
    LAST_STATS = d
    var counts = document.querySelectorAll('#page-home .count')
    var map = [d.materials, d.colleges, d.downloads]
    counts.forEach(function (el, i) {
      if (map[i] != null) { el.dataset.to = map[i]; el.textContent = '0'; countUpFmt(el) }
    })
    var foot = document.querySelector('#page-home .gp-foot .t b')
    if (foot && d.materials != null) foot.textContent = fmt(d.materials)
  }

  function applyTypeTotals(totals, collegeCount) {
    LAST_TOTALS = totals; LAST_CC = collegeCount
    /* totals: {图片:n,视频:n,文档:n,音频:n,其他:n}；gp-nm/h3 已 data-i18n 化，匹配用 data-cat 原始类型名 */
    var rows = document.querySelectorAll('#page-home .gp-row')
    var vals = []
    rows.forEach(function (row) {
      var nm = row.querySelector('.gp-nm')
      if (!nm) return
      var key = nm.getAttribute('data-cat') || nm.textContent.trim()
      if (key === '学院专栏') vals.push({ row: row, v: collegeCount != null ? collegeCount : 12 })
      else if (totals[key] != null) vals.push({ row: row, v: totals[key] })
    })
    var max = 0
    vals.forEach(function (x) { if (x.v > max) max = x.v })
    if (!max) max = 1
    vals.forEach(function (x, i) {
      var fill = x.row.querySelector('.gp-fill'), num = x.row.querySelector('.gp-num')
      var w = Math.round(x.v / max * 100)
      if (fill) {
        fill.dataset.w = w + '%'
        /* 真实数据晚于首屏 IntersectionObserver 触达（此时 data-w 仍为初始 0%），需自行重放动画 */
        fill.style.width = '0'
        setTimeout(function () { fill.style.width = w + '%' }, 150 + i * 110)
      }
      if (num) num.textContent = fmt(x.v)
    })
    /* 快捷分类卡计数（data-cat 匹配原始类型，单位随语言） */
    document.querySelectorAll('#page-home .cat-card').forEach(function (card) {
      var h = card.querySelector('h3'), cnt = card.querySelector('.cnt')
      if (!h || !cnt) return
      var name = h.getAttribute('data-cat') || h.textContent.trim()
      if (name === '学院专栏' && collegeCount != null) cnt.textContent = collegeCount + hl(' 个学院', ' colleges')
      else if (totals[name] != null) cnt.textContent = fmt(totals[name]) + hl(' 份素材', ' materials')
    })
  }

  function applyTags(tagList) {
    var box = $('hotTags')
    if (!box || !tagList.length) return
    LAST_TAGS = tagList
    box.innerHTML = ''
    tagList.forEach(function (x) {
      var a = document.createElement('a')
      a.href = '#'
      a.textContent = x.tag
      a.dataset.tag = x.tag
      a.setAttribute('data-kw', x.tag)
      box.appendChild(a)
    })
  }

  /* P1 性能：本地校园卡图优先用 WebP（DB 路径仍为 .jpg），加载失败回退原图 */
  function toWebp(p) {
    if (p && /^\/photos\/campus_\d+_card\.jpg$/.test(p)) return p.replace(/\.jpg$/, '.webp')
    return p
  }
  function applyGallery(list) {
    if (!list || !list.length) return
    try { campusGalleryItems = list.map(function (it) { return { src: it.image, title: it.title || '', wide: !!it.wide, tall: !!it.tall } }) }
    catch (e) { /* index.js 变量不可写时忽略（仅影响灯箱） */ }
    var cards = document.querySelectorAll('#page-home .topic-card')
    list.slice(0, cards.length).forEach(function (g, i) {
      var c = cards[i]; if (!c) return
      c.setAttribute('data-gidx', i)
      var img = c.querySelector('img')
      if (img) {
        img.src = toWebp(g.image)
        img.onerror = function () { img.onerror = null; img.src = g.image }
        img.alt = (g.title || '专题') + '专题'
      }
      var t = c.querySelector('.topic-info .t')
      if (t) t.textContent = g.title || '专题'
    })
  }

  function applyRank(colleges) {
    LAST_RANK = colleges
    var box = document.querySelector('#page-home .rank-grid')
    if (!box || !colleges.length) return
    var nameOf = (typeof collegeName === 'function') ? collegeName : function (n) { return n }
    var sorted = colleges.slice().sort(function (a, b) { return (b.material_count || 0) - (a.material_count || 0) })
    var active = sorted.filter(function (c) { return (c.material_count || 0) > 0 })
    var rest = sorted.filter(function (c) { return !(c.material_count || 0) })
    var show = active.concat(rest)
    if (active.length < 4) show = show.slice(0, 4)
    else show = show.slice(0, 8)
    var medal = [hl('冠军', 'Champion'), hl('亚军', 'Runner-up'), hl('季军', 'Third')]
    box.innerHTML = show.map(function (c, i) {
      var cls = i < 3 ? ' r' + (i + 1) : ''
      var m = i < 3 ? '<span class="rank-medal">' + medal[i] + '</span>' : ''
      var nm = nameOf(c.name)
      return '<div class="rank-card' + cls + '" data-cid="' + esc(c.id) + '" role="button" tabindex="0">' +
        '<span class="rank-no">' + (i < 9 ? '0' : '') + (i + 1) + '</span>' + m +
        '<div class="rank-avatar" style="' + (i < 3 ? '' : 'background:' + (c.color || '#9aa3b5') + '1a;color:' + (c.color || '#9aa3b5')) + '">' + esc(nm.charAt(0)) + '</div>' +
        '<h4>' + esc(nm) + m + '</h4>' +
        '<div class="rank-stats"><div><b>' + fmt(c.material_count || 0) + '</b>' + hl('已上传', ' uploaded') + '</div><div><b>' + fmt(c.downloads || 0) + '</b>' + hl('获下载', ' downloads') + '</div></div>' +
        '</div>'
    }).join('')
    box.addEventListener('click', function (e) {
      var card = e.target.closest('[data-cid]')
      if (card && typeof showCollegeDetail === 'function') showCollegeDetail(card.getAttribute('data-cid'))
    })
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return
      var card = e.target.closest('[data-cid]')
      if (card && typeof showCollegeDetail === 'function') { e.preventDefault(); showCollegeDetail(card.getAttribute('data-cid')) }
    })
  }

  /* P1 性能：优先消费 /api/home-bundle 聚合数据（index.html 内联脚本预先发起，与 index.js 共用同一请求），
     失败时回退到旧的逐接口加载路径，行为不变 */
  function initLive() {
    var started = false
    function startLegacy() {
      if (started) return Promise.resolve()
      started = true
      return apiGet('/api/health').then(function (h) {
        if (!h || h.ok !== true) throw new Error('health fail')
        LIVE = true
        var p1 = apiGet('/api/materials?sort=downloads&page=1&pageSize=48').then(function (j) {
          MATS = (j.data || []).map(toMat)
          MAT_TOTAL = j.total != null ? j.total : MATS.length
        })
        var p2 = apiGet('/api/stats').then(function (j) {
          var d = j.data || {}
          applyStats(d)
          return d.colleges
        }).catch(function () { return null })
        var p3 = apiGet('/api/tags').then(function (j) {
          applyTags((j.data || []).filter(function (x) { return x.count > 0 }).slice(0, 6))
        }).catch(function () { })
        var p4 = apiGet('/api/home-gallery').then(function (j) {
          applyGallery(j.data || [])
        }).catch(function () { })
        var p5 = apiGet('/api/colleges').then(function (j) {
          var list = j.data || []
          var p6 = Promise.all(['图片', '视频', '文档', '音频', '其他'].map(function (tp) {
            return apiGet('/api/materials?type=' + encodeURIComponent(tp) + '&page=1&pageSize=1').then(function (r) { return r.total || 0 }).catch(function () { return 0 })
          })).then(function (arr) {
            var totals = {}
            ;['图片', '视频', '文档', '音频', '其他'].forEach(function (tp, i) { totals[tp] = arr[i] })
            return p2.then(function (collegeCount) {
              applyTypeTotals(totals, collegeCount != null ? collegeCount : list.length)
            })
          }).catch(function () { })
          /* 排行榜：上传数用 colleges 精确值，下载量从全量素材聚合（总量≤100 时精确） */
          var p7 = apiGet('/api/materials?sort=downloads&page=1&pageSize=100').then(function (j) {
            var total = j.total || 0
            var agg = {}
            ;(j.data || []).forEach(function (m) {
              if (!agg[m.college]) agg[m.college] = 0
              agg[m.college] += (m.downloads || 0)
            })
            var exact = total <= 100
            list.forEach(function (c) {
              c.downloads = exact ? (agg[c.name] || 0) : null
            })
            applyRank(list)
          }).catch(function () {
            list.forEach(function (c) { c.downloads = null })
            applyRank(list)
          })
          return Promise.all([p6, p7])
        }).catch(function () { })
        return Promise.all([p1, p2, p3, p4, p5])
      }).catch(function () {
        LIVE = false
      }).then(function () { applyFilter() })
    }
    var hbp = window.__homeBundle
    if (hbp && typeof hbp.then === 'function') {
      hbp.then(function (j) {
        if (started) return
        if (!j || j.ok !== true || !j.data) return startLegacy()
        started = true
        var b = j.data
        LIVE = true
        applyStats(b.stats || {})
        applyTags((b.tags || []).filter(function (x) { return x.count > 0 }).slice(0, 6))
        applyGallery(b.gallery || [])
        var tc = {}
        ;['图片', '视频', '文档', '音频', '其他'].forEach(function (tp) { tc[tp] = (b.typeCounts && b.typeCounts[tp]) || 0 })
        var cCount = b.stats && b.stats.colleges != null ? b.stats.colleges : (b.colleges || []).length
        applyTypeTotals(tc, cCount)
        applyRank(b.colleges || [])
        return apiGet('/api/materials?sort=downloads&page=1&pageSize=48').then(function (j) {
          MATS = (j.data || []).map(toMat)
          MAT_TOTAL = j.total != null ? j.total : MATS.length
        }).catch(function () { })
      }).catch(function () { return startLegacy() }).then(function () { applyFilter() })
    } else {
      startLegacy()
    }
  }
  initLive()

  /* ═══ V3 区块导航接线（快捷分类 / 更多链接 / 专题 / 非对称专题） ═══ */
  HOME.addEventListener('click', function (e) {
    var cat = e.target.closest('.cat-card')
    if (cat) {
      var h = cat.querySelector('h3')
      var name = h ? h.textContent.trim() : ''
      if (name === '学院专栏') { showPage('colleges'); return }
      if (name === '校园社区') { location.href = '/community.html'; return }
      if (TC[name]) { setType(name); return }
      return
    }
    var more = e.target.closest('.more-link')
    if (more) {
      var sec = more.closest('section')
      var eyebrow = sec ? sec.querySelector('.sec-eyebrow') : null
      var label = eyebrow ? eyebrow.textContent.replace(/^\s*\d+\s*/, '').trim() : ''
      if (label.indexOf('精选专题') >= 0) {
        /* campusGalleryItems 为 index.js 顶层 let（全局词法绑定，不在 window 上），须直接判断 */
        if (typeof openCampusLightbox === 'function' && typeof campusGalleryItems !== 'undefined' && campusGalleryItems.length) openCampusLightbox(0)
        else toast('暂无校园图集内容')
        return
      }
      if (label.indexOf('贡献排行') >= 0) { showPage('colleges'); return }
      showPage('library')
      return
    }
    var topic = e.target.closest('.topic-card')
    if (topic) {
      var gi = topic.getAttribute('data-gidx')
      if (gi != null && typeof openCampusLightbox === 'function' && typeof campusGalleryItems !== 'undefined' && campusGalleryItems.length) {
        openCampusLightbox(parseInt(gi, 10) || 0)
      }
      return
    }
    var feat = e.target.closest('.feat-hero,.feat-mini')
    if (feat) {
      var kw = feat.getAttribute('data-kw')
      if (kw) runSearch(kw)
      return
    }
  })

  /* ═══ 主题切换后重放面板条形图动画 ═══ */
  var _v3ThemeHook = function () {
    document.querySelectorAll('#page-home .gp-fill').forEach(function (f) {
      f.style.width = '0'
      setTimeout(function () { f.style.width = f.dataset.w || '0%' }, 60)
    })
  }
  window.addEventListener('theme-toggled', _v3ThemeHook)

  /* ═══ 语言切换（wb:lang）后按新语言重渲染动态文案 ═══ */
  window.addEventListener('wb:lang', function () {
    try {
      if (LAST_STATS) applyStats(LAST_STATS)
      if (LAST_TOTALS) applyTypeTotals(LAST_TOTALS, LAST_CC)
      if (LAST_RANK && LAST_RANK.length) applyRank(LAST_RANK)
      if (LAST_LIST) renderCards(LAST_LIST, LAST_TOTAL)
      /* data-i18n 会把 .gp-foot .t 重置回 <b>0</b>，applyStats 已在上面重放数字 */
    } catch (e) { /* 防御式：失败静默 */ }
  })
})()
