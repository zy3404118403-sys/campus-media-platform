/* ═══════════════════════════════════════════════════════════════
   polish.js · 全站交互体验增强层 v1 (2026-08-30)
   原则：纯增量、防御式（任何一步失败静默跳过，不影响原有功能）；
   删除本文件引用即可完全回滚。
   覆盖：汉堡菜单 aria/ESC/滚动锁 · 移动端底部快捷导航（active 同步）
   ═══════════════════════════════════════════════════════════════ */
;(function () {
  'use strict'
  function $(id) { return document.getElementById(id) }

  /* ── 1. 汉堡菜单增强：aria-expanded 同步 + ESC 关闭 + 背景滚动锁定 ── */
  var toggle = $('menuToggle'), nav = $('mainNav'), overlay = $('navOverlay')
  if (toggle && nav) {
    var syncMenu = function () {
      var open = nav.classList.contains('mobile-show')
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
      toggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单')
      document.documentElement.classList.toggle('polish-menu-open', open)
    }
    // 包装现有 toggleMenu/closeMenu（window 全局函数），保留原行为
    if (typeof window.toggleMenu === 'function') {
      var _origToggle = window.toggleMenu
      window.toggleMenu = function () { _origToggle(); syncMenu() }
    }
    if (typeof window.closeMenu === 'function') {
      var _origClose = window.closeMenu
      window.closeMenu = function () { _origClose(); syncMenu() }
    }
    syncMenu()
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('mobile-show')) {
        window.closeMenu(); toggle.focus()
      }
    })
    // 抽屉内链接点击后 closeMenu 已由 showPage 调用，同步即可
    nav.addEventListener('click', function () { setTimeout(syncMenu, 0) })
  }

  /* ── 2. 移动端底部快捷导航（≤768px 显示，active 与当前 page 同步） ── */
  var ITEMS = [
    { page: 'home', label: '首页', icon: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>' },
    { page: 'library', label: '素材库', icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-5-5L5 21"/></svg>' },
    { page: 'colleges', label: '学院', icon: '<svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"/></svg>' },
    { href: '/community.html', match: 'community', label: '社区', icon: '<svg viewBox="0 0 24 24"><path d="M17 8a5 5 0 1 0-10 0c0 4-2 5-2 5h14s-2-1-2-5"/><path d="M10.3 17a2 2 0 0 0 3.4 0"/></svg>' }
    /* 2026-09-22 B1：任务入口移至登录后头像下拉菜单（内部事务不出现在公开导航） */
  ]
  var bar = document.createElement('nav')
  bar.className = 'polish-bottom-nav'
  bar.setAttribute('aria-label', '快捷导航')
  bar.innerHTML = ITEMS.map(function (it, i) {
    var act = i === 0 ? ' class="active" aria-current="page"' : ''
    var click = it.page
      ? ' onclick="showPage(\'' + it.page + '\');return false;" data-polish-page="' + it.page + '"'
      : ''
    var href = it.page ? '#' : it.href
    var match = it.match ? ' data-polish-match="' + it.match + '"' : ''
    return '<a href="' + href + '"' + act + click + match + '>' + it.icon + '<span>' + it.label + '</span></a>'
  }).join('')
  var mount = function () {
    if ($('polishBottomNav')) return
    bar.id = 'polishBottomNav'
    document.body.appendChild(bar)
    syncActive()
  }
  function syncActive() {
    var active = document.querySelector('.page-section.active')
    if (!active) return
    var cur = active.id.replace(/^page-/, '')
    bar.querySelectorAll('a').forEach(function (a) {
      var p = a.getAttribute('data-polish-page')
      var mt = a.getAttribute('data-polish-match')
      // SPA 分区按 page id 匹配；外链页按 data-polish-match 与路径匹配（首页分区下外链永不高亮）
      var isCur = p ? p === cur : (cur === 'home' ? false : (mt ? location.pathname.indexOf(mt) > -1 : false))
      a.classList.toggle('active', isCur)
      if (isCur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current')
    })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
  // 监听 SPA 分区切换 → 底栏高亮同步（showPage 切换 .page-section.active）
  if (window.MutationObserver) {
    var mo = new MutationObserver(function () { syncActive() })
    setTimeout(function () {
      document.querySelectorAll('.page-section').forEach(function (sec) {
        mo.observe(sec, { attributes: true, attributeFilter: ['class'] })
      })
    }, 300)
  }
})()
