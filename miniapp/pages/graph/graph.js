const mock = require('../../utils/mock.js');

/**
 * 内容关系（列表版）
 *
 * Web 端是 canvas 力导向图，小程序端降级为「按类型浏览 + 展开看关联」。
 * 数据全部从 mock 派生，不另外编造：关联边只取真实存在的「素材 ↔ 标签」归属关系，
 * 其他类型暂时没有关系字段，就如实显示为独立节点，不硬凑数字。
 */
function build() {
  const materials = mock.materials || [];

  /* 标签聚合：标签是连接素材的枢纽 */
  const tagMap = {};
  materials.forEach((m) => {
    (m.tags || []).forEach((t) => {
      if (!tagMap[t]) tagMap[t] = [];
      tagMap[t].push({ id: m.id, title: m.title });
    });
  });
  const tags = Object.keys(tagMap)
    .map((name, i) => ({
      id: 'tag-' + i,
      name: name,
      count: tagMap[name].length,
      items: tagMap[name],
    }))
    .sort((a, b) => b.count - a.count || (a.name > b.name ? 1 : -1));

  const mats = materials.map((m) => ({
    id: m.id,
    title: m.title,
    type: m.type,
    college: m.college || '未分类',
    tags: m.tags || [],
  }));

  const cols = (mock.collections || []).map((c) => ({
    id: c.id,
    title: c.title,
    desc: c.desc || '',
    count: c.count || 0,
  }));

  const acts = (mock.publicActivities() || []).map((a) => ({
    id: a.id,
    title: a.title,
    sub: [a.time, a.place].filter(Boolean).join(' · '),
    state: a.state || '',
  }));

  const others = []
    .concat((mock.blogPosts || []).map((b) => ({ id: 'blog-' + b.id, kind: '博客', title: b.title || '' })))
    .concat((mock.forumThreads || []).map((t) => ({ id: 'th-' + t.id, kind: '论坛帖', title: t.title || '' })))
    .concat((mock.wallPosts || []).map((w) => ({ id: 'wall-' + w.id, kind: '墙贴', title: w.text || w.title || '' })));

  /* 只统计真实存在的关联边：素材 ↔ 标签 */
  const edges = tags.reduce((s, t) => s + t.count, 0);
  const nodes = mats.length + tags.length + cols.length + acts.length + others.length;

  return { mats, tags, cols, acts, others, nodes, edges };
}

Page({
  data: {
    tab: 'material',
    expanded: '',
    g: { mats: [], tags: [], cols: [], acts: [], others: [], nodes: 0, edges: 0 },
    counts: { material: 0, tag: 0, more: 0 },
  },

  onLoad() {
    const g = build();
    this.setData({
      g: g,
      counts: {
        material: g.mats.length,
        tag: g.tags.length,
        more: g.cols.length + g.acts.length + g.others.length,
      },
    });
    wx.setNavigationBarTitle({ title: '内容关系' });
  },

  onSeg(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.tab) return;
    this.setData({ tab: tab, expanded: '' });
  },

  /* 标签点开/收起：一次只展开一个，避免列表被撑得过长 */
  onToggleTag(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ expanded: this.data.expanded === id ? '' : id });
  },

  onMaterial(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  onActivity(e) {
    wx.navigateTo({ url: '/pages/activity-detail/activity-detail?id=' + e.currentTarget.dataset.id });
  },

  onCollection(e) {
    wx.navigateTo({ url: '/pages/articles/articles?id=' + e.currentTarget.dataset.id });
  },
});
