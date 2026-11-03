/**
 * 校园社区 —— 3 个 tab 共用一个列表容器
 *   博客   GET /api/blog/posts
 *   论坛   GET /api/forum/boards · /api/forum/threads?board=
 *   表白墙 GET /api/wall/posts
 *
 * 为什么合成一页：三者都是「帖子流」，差异只在卡片形态（长文 / 主题帖 / 短文本）。
 * 拆成三个 tab 页会超出 tabBar 上限（已占满 5 个），也会让首页入口变成三个。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');

const TABS = [
  { key: 'blog', text: '博客' },
  { key: 'forum', text: '论坛' },
  { key: 'wall', text: '表白墙' },
];

const DESC = {
  blog: '技术复盘与创作手记，由中心成员与优秀投稿者撰写',
  forum: '器材、后期、约拍与活动通告',
  wall: '匿名也能发，说过的话留在这里',
};

Page({
  data: {
    tab: 'blog',
    tabs: TABS,
    desc: DESC.blog,
    state: 'loading', // loading | ready | error
    blog: [],
    threads: [],
    shownThreads: [],
    wall: [],
    boards: [],
    activeBoard: 0, // 0 = 全部
  },

  onLoad() {
    this.load();
  },

  load() {
    this.setData({ state: 'loading' });
    return mock
      .delay(320)
      .then(() => {
        const threads = mock.forumThreads.slice();
        // 置顶帖永远在最前，其余按时间倒序（真实接口已在服务端排序，这里对齐表现）
        threads.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

        this.setData({
          state: 'ready',
          blog: mock.blogPosts.slice(),
          threads: threads,
          shownThreads: threads,
          wall: mock.wallPosts.map((p) => this.decorate(p)),
          boards: mock.forumBoards.slice(),
        });
      })
      .catch(() => this.setData({ state: 'error' }));
  },

  decorate(p) {
    const copy = {};
    for (const k in p) copy[k] = p[k];
    copy.liked = false;
    return copy;
  },

  onRetry() {
    this.load();
  },

  /* community.json 已开 enablePullDownRefresh，这里必须实现，
     否则下拉后转圈一直挂在顶部不消失 */
  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  /* ── tab 切换：一次加载，切换不重新请求 ── */
  onTab(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.tab) return;
    this.setData({ tab: key, desc: DESC[key] });
  },

  /* ── 论坛板块筛选（WXML 不能过滤，这里算好给视图）── */
  onBoard(e) {
    const id = Number(e.currentTarget.dataset.id);
    const shown = id === 0
      ? this.data.threads
      : this.data.threads.filter((t) => t.boardId === id);
    this.setData({ activeBoard: id, shownThreads: shown });
  },

  /* ── 打开详情 ── */
  onOpen(e) {
    const ds = e.currentTarget.dataset;
    wx.navigateTo({
      url: '/pages/post-detail/post-detail?type=' + ds.type + '&id=' + ds.id,
    });
  },

  /* ── 表白墙点赞（列表内即时反馈）── */
  onLike(e) {
    if (!auth.ensureLogin()) return;
    const id = Number(e.currentTarget.dataset.id);
    const wall = this.data.wall.map((p) => {
      if (p.id !== id) return p;
      const copy = this.decorate(p);
      copy.liked = !p.liked;
      copy.likes = p.likes + (copy.liked ? 1 : -1);
      return copy;
    });
    this.setData({ wall: wall });
  },

  /* ── 发布：统一走发帖页，按当前 tab 预选类型 ── */
  onCreate() {
    if (!auth.ensureLogin()) return;
    const t = this.data.tab;
    const type = t === 'forum' ? 'forum' : t === 'wall' ? 'wall' : 'blog';
    wx.navigateTo({ url: '/pages/post-create/post-create?type=' + type });
  },

  /* 从发帖页返回时刷新列表，让新内容立刻出现在最上面 */
  onShow() {
    if (this.data.state !== 'ready') return;
    const likedMap = {};
    (this.data.wall || []).forEach((p) => {
      if (p.liked) likedMap[p.id] = true;
    });
    this.setData({
      blog: mock.blogPosts.slice(),
      threads: this.data.activeBoard === 0
        ? mock.forumThreads.slice()
        : mock.forumThreads.filter((x) => x.boardId === this.data.activeBoard),
      shownThreads: this.data.activeBoard === 0
        ? mock.forumThreads.slice()
        : mock.forumThreads.filter((x) => x.boardId === this.data.activeBoard),
      wall: mock.wallPosts.map((p) => {
        const item = this.decorate(p);
        if (likedMap[item.id]) item.liked = true;
        return item;
      }),
    });
  },
});
