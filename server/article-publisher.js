'use strict'
/**
 * 文稿推送适配器
 * 负责将审核通过的文稿推送到各发布平台
 * 第一阶段：接口框架 + 日志记录，实际对接需各平台API文档
 */
const { db } = require('./db')

const PLATFORMS = {
  website: { name: '官方网站', endpoint: '', status: 'pending_api' },
  party_site: { name: '党建网', endpoint: '', status: 'pending_api' },
  wechat: { name: '微信公众号', endpoint: '', status: 'pending_api' },
  weibo: { name: '微博', endpoint: '', status: 'pending_api' },
  douyin: { name: '抖音', endpoint: '', status: 'pending_api' },
  bilibili: { name: 'B站', endpoint: '', status: 'pending_api' },
}

async function publishToPlatform(article, platform) {
  const config = PLATFORMS[platform]
  if (!config) {
    return { platform, status: 'failed', error: '未知的推送平台' }
  }

  // 第一阶段：仅记录推送日志，实际API对接待各平台提供文档
  // 当 config.endpoint 为空时，标记为 pending（等待手动发布）
  if (!config.endpoint) {
    return {
      platform,
      platform_name: config.name,
      status: 'pending',
      message: `待手动推送到${config.name}（API未配置）`,
      external_url: '',
    }
  }

  // 实际推送逻辑（预留）
  // const response = await fetch(config.endpoint, { ... })
  // return { platform, status: 'success', external_id: ..., external_url: ... }

  return {
    platform,
    platform_name: config.name,
    status: 'pending',
    message: '推送接口待对接',
  }
}

async function publishArticle(articleId, targets) {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId)
  if (!article) {
    return { ok: false, message: '文稿不存在' }
  }

  let targetList = targets
  try {
    if (typeof targets === 'string') targetList = JSON.parse(targets)
  } catch {
    targetList = []
  }

  if (!Array.isArray(targetList) || targetList.length === 0) {
    return { ok: false, message: '未选择推送目标' }
  }

  const results = []
  const insertLog = db.prepare(`
    INSERT INTO publish_logs (article_id, platform, status, error_msg)
    VALUES (?, ?, ?, ?)
  `)

  for (const platform of targetList) {
    const result = await publishToPlatform(article, platform)
    insertLog.run(articleId, platform, result.status, result.message || result.error || '')
    results.push(result)
  }

  // 更新文稿状态为已发布
  db.prepare(`
    UPDATE articles SET status = 'published', published_at = datetime('now','localtime'),
    publish_targets = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(JSON.stringify(targetList), articleId)

  return { ok: true, results }
}

async function unpublishArticle(articleId) {
  const logs = db.prepare('SELECT * FROM publish_logs WHERE article_id = ? AND status = ?').all(articleId, 'success')
  // 第一阶段：仅更新状态，实际下架需调用各平台API
  db.prepare(`
    UPDATE articles SET status = 'archived', updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(articleId)

  return { ok: true, message: '文稿已下架', external_platforms: logs.length }
}

module.exports = { publishArticle, unpublishArticle, PLATFORMS }
