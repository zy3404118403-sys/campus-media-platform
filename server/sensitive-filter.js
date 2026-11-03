'use strict'
/**
 * 敏感词检测引擎 · Trie树匹配
 * 零依赖，纯 Node.js 实现
 */
const { db } = require('./db')

class TrieNode {
  constructor() {
    this.children = {}
    this.isEnd = false
    this.level = ''
    this.category = ''
    this.replacement = ''
  }
}

class SensitiveFilter {
  constructor() {
    this.root = new TrieNode()
    this.wordCount = 0
    this.loaded = false
  }

  loadFromDB() {
    this.root = new TrieNode()
    this.wordCount = 0
    try {
      const rows = db.prepare('SELECT word, level, category, replacement FROM sensitive_words').all()
      for (const row of rows) {
        this.insert(row.word, row.level, row.category, row.replacement)
      }
      this.loaded = true
      console.log(`  ✓ 敏感词引擎: 已加载 ${this.wordCount} 个敏感词`)
    } catch (e) {
      console.log('  ⚠ 敏感词引擎加载失败:', e.message)
    }
  }

  insert(word, level, category, replacement) {
    if (!word) return
    let node = this.root
    for (const ch of word) {
      if (!node.children[ch]) node.children[ch] = new TrieNode()
      node = node.children[ch]
    }
    node.isEnd = true
    node.level = level || 'medium'
    node.category = category || ''
    node.replacement = replacement || ''
    this.wordCount++
  }

  detect(text) {
    if (!text || typeof text !== 'string') return []
    const results = []
    const len = text.length
    for (let i = 0; i < len; i++) {
      let node = this.root
      let j = i
      let matched = ''
      while (j < len && node.children[text[j]]) {
        node = node.children[text[j]]
        matched += text[j]
        j++
        if (node.isEnd) {
          results.push({
            word: matched,
            position: i,
            end: j,
            level: node.level,
            category: node.category,
            replacement: node.replacement,
          })
        }
      }
    }
    return results
  }

  highlight(text) {
    if (!text) return { text, hits: [] }
    const hits = this.detect(text)
    if (hits.length === 0) return { text, hits: [] }
    let result = ''
    let lastEnd = 0
    const sorted = [...hits].sort((a, b) => a.position - b.position)
    for (const hit of sorted) {
      if (hit.position < lastEnd) continue
      result += text.slice(lastEnd, hit.position)
      result += `【${hit.word}】`
      lastEnd = hit.end
    }
    result += text.slice(lastEnd)
    return { text: result, hits }
  }

  hasHigh(text) {
    if (!text) return false
    const hits = this.detect(text)
    return hits.some(h => h.level === 'high')
  }

  hasAny(text) {
    if (!text) return false
    return this.detect(text).length > 0
  }
}

const filter = new SensitiveFilter()

function reloadFilter() {
  filter.loadFromDB()
}

// 首次加载
filter.loadFromDB()

module.exports = { filter, reloadFilter, SensitiveFilter }
