/* ═══ 一次性自毁 Service Worker（2026-10-23）═══
 * 背景：历史 SW 缓存污染导致"改了代码但页面永远不变"。
 * 策略：本版 SW 安装后 → 清空所有 cache → 注销自身 → 通知所有窗口重载。
 * 效果：用户刷新一次即回到"无 SW、全走网络"的干净状态。
 * 如需恢复 PWA 离线能力，请以后重新启用带 precache 的 sw.js（并提升版本号）。 */
'use strict'

self.addEventListener('install', function () {
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys()
      await Promise.all(keys.map(function (k) { return caches.delete(k) }))
    } catch (e) {}
    try { await self.registration.unregister() } catch (e) {}
    try {
      var clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach(function (c) { try { c.navigate(c.url) } catch (e) {} })
    } catch (e) {}
  })())
})

// 不拦截任何请求：全部直接走网络
self.addEventListener('fetch', function () {})
