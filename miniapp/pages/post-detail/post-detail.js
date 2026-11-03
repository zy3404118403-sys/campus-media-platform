/**
 * 帖子详情 —— 一页三模式（博客 / 论坛主题帖 / 表白墙）
 *   ?type=blog|thread|wall&id=xxx
 *   数据：GET /api/blog/posts/:id · /api/forum/threads/:id · /api/wall/posts/:id
 *   评论：GET .../comments        点赞：POST /api/like
 *
 * 三者的详情排版几乎一致（作者 / 时间 / 正文 / 评论），
 * 差异只有「有没有标题」和「有没有封面」，所以合成一页。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');

const SRC = {
  blog: { list: 'blogPosts', label: '博客' },
  thread: { list: 'forumThreads', label: '论坛' },
  wall: { list: 'wallPosts', label: '表白墙' },
};

Page({
  data: {
    type: 'blog',
    state: 'loading', // loading | ready | empty | error
    post: null,
    body: [],
    comments: [],
    liked: false,
    likeCount: 0,
    hasTitle: true,
    commentCount: 0,
    draft: '',
    posting: false,
    err: '',
  },

  onLoad(opts) {
    this._type = SRC[opts && opts.type] ? opts.type : 'blog';
    this._id = Number(opts && opts.id) || 0;
    this._key = this._type + '-' + this._id;
    this.setData({ type: this._type });
    this.load();
  },

  load() {
    this.setData({ state: 'loading' });
    return mock
      .delay(320)
      .then(() => {
        const cfg = SRC[this._type];
        const post = mock.byId(mock[cfg.list], this._id);
        if (!post) {
          this.setData({ state: 'empty' });
          return;
        }
        const cs = (mock.comments[this._key] || []).slice();
        // 头像首字在 JS 里算好：WXML 里对字符串做 [0] 取值的支持不稳定
        const withInitial = (o) => {
          const copy = {};
          for (const k in o) copy[k] = o[k];
          copy.initial = String(o.author || '匿').slice(0, 1);
          return copy;
        };

        this.setData({
          state: 'ready',
          post: withInitial(post),
          body: post.body || [post.excerpt || post.content || ''],
          comments: cs.map(withInitial),
          commentCount: cs.length,
          likeCount: post.likes || 0,
          hasTitle: this._type !== 'wall',
        });
        wx.setNavigationBarTitle({ title: cfg.label + '详情' });
      })
      .catch(() => this.setData({ state: 'error' }));
  },

  onRetry() {
    this.load();
  },

  onLike() {
    if (!auth.ensureLogin()) return;
    const next = !this.data.liked;
    this.setData({
      liked: next,
      likeCount: this.data.likeCount + (next ? 1 : -1),
    });
  },

  onDraft(e) {
    this.setData({ draft: e.detail.value, err: '' });
  },

  /* ── 发表评论：本地追加（接真实接口时改为 POST .../comments）── */
  onSend() {
    if (!auth.ensureLogin()) return;
    const text = String(this.data.draft || '').trim();
    if (!text) {
      this.setData({ err: '说点什么再发送吧' });
      return;
    }
    if (this.data.posting) return;

    this.setData({ posting: true, err: '' });
    mock.delay(360).then(() => {
      const u = auth.getUser() || {};
      const d = new Date();
      const pad = (n) => (n < 10 ? '0' + n : String(n));
      const c = {
        id: Date.now(),
        author: u.name || '匿名',
        initial: String(u.name || '匿').slice(0, 1),
        text: text,
        date: pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
        likes: 0,
        mine: true,
      };
      const list = this.data.comments.concat([c]);
      this.setData({
        comments: list,
        commentCount: list.length,
        draft: '',
        posting: false,
      });
      wx.showToast({ title: '评论已发布', icon: 'success' });
    });
  },

  onBack() {
    const stack = getCurrentPages();
    if (stack.length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/home/home' });
  },

  onShareAppMessage() {
    const p = this.data.post;
    const title = p ? (this.data.hasTitle ? p.title : (p.content || '').slice(0, 24)) : '校园社区';
    return {
      title: title,
      path: '/pages/post-detail/post-detail?type=' + this._type + '&id=' + this._id,
    };
  },

  onShareTimeline() {
    const p = this.data.post;
    const title = p ? (this.data.hasTitle ? p.title : (p.content || '').slice(0, 24)) : '校园社区';
    return {
      title: title,
      query: 'type=' + this._type + '&id=' + this._id,
    };
  },
});
