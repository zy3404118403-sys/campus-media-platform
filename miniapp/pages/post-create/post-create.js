/**
 * 发布内容 —— 一页三类型（博客 / 论坛帖 / 表白墙）
 *   ?type=blog|forum|wall
 *   博客：POST /api/blog/posts
 *   论坛：POST /api/forum/threads（需 boardId）
 *   表白墙：POST /api/wall/posts
 *
 * 三者共用「写正文 + 提交」主流程，差异只有：
 *   ① 有没有标题（表白墙没有）② 要不要选板块（只有论坛要）
 *   ③ 正文长度门槛不同（博客是长文，墙是一句话）
 * 合成一页避免三份重复的校验与提交逻辑。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');

const TYPES = [
  { key: 'blog', text: '博客' },
  { key: 'forum', text: '论坛帖' },
  { key: 'wall', text: '表白墙' },
];

const RULE = {
  blog: { needTitle: true, needBoard: false, minTitle: 6, minBody: 50, ph: '写清楚背景、做法和结论，像给同学讲一遍' },
  forum: { needTitle: true, needBoard: true, minTitle: 6, minBody: 10, ph: '说明你的问题或想分享的内容，附上必要细节' },
  wall: { needTitle: false, needBoard: false, minTitle: 0, minBody: 5, ph: '想说的话留在这里，默认匿名发布' },
};

const NAMES = { blog: '博客', forum: '论坛帖', wall: '表白墙' };

Page({
  data: {
    types: TYPES,
    type: 'blog',
    rule: RULE.blog,
    boards: [],
    boardIndex: 0,
    title: '',
    body: '',
    err: '',
    submitting: false,
    anonymous: true,
  },

  onLoad(opts) {
    this._alive = true;
    this._redirect = null;
    const t = RULE[opts && opts.type] ? opts.type : 'blog';
    this.setData({
      type: t,
      rule: RULE[t],
      boards: mock.forumBoards.slice(),
    });
    wx.setNavigationBarTitle({ title: '发布' + NAMES[t] });

    if (!auth.isLoggedIn()) {
      wx.showModal({
        title: '需要登录',
        content: '发布内容需要先登录学号账号。',
        confirmText: '去登录',
        confirmColor: '#d8b46a',
        success: (res) => {
          if (res.confirm) auth.ensureLogin();
          else wx.navigateBack();
        },
      });
    }
  },

  onType(e) {
    const t = e.currentTarget.dataset.key;
    if (t === this.data.type) return;
    this.setData({ type: t, rule: RULE[t], err: '' });
    wx.setNavigationBarTitle({ title: '发布' + NAMES[t] });
  },

  onBoard(e) {
    this.setData({ boardIndex: Number(e.detail.value) });
  },

  onTitle(e) {
    this.setData({ title: e.detail.value, err: '' });
  },

  onBody(e) {
    this.setData({ body: e.detail.value, err: '' });
  },

  onAnon(e) {
    this.setData({ anonymous: e.detail.value });
  },

  onSubmit() {
    const d = this.data;
    const r = d.rule;
    const title = String(d.title || '').trim();
    const body = String(d.body || '').trim();

    if (r.needTitle && title.length < r.minTitle) {
      return this.setData({ err: '标题至少 ' + r.minTitle + ' 个字' });
    }
    if (body.length < r.minBody) {
      return this.setData({ err: '正文至少 ' + r.minBody + ' 个字，再补充一些' });
    }
    if (d.submitting) return;

    this.setData({ submitting: true, err: '' });
    wx.showLoading({ title: '发布中', mask: true });

    mock.delay(520).then(() => {
      wx.hideLoading();
      const u = auth.getUser() || {};
      const now = new Date();
      const pad = (n) => (n < 10 ? '0' + n : String(n));
      const date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
      const id = Date.now();
      const author = d.type === 'wall' && d.anonymous ? '匿名' : (u.name || '匿名');
      const paras = body.split('\n').map((p) => p.trim()).filter((p) => p);

      if (d.type === 'blog') {
        mock.blogPosts.unshift({
          id: id,
          title: title,
          excerpt: body.slice(0, 48) + (body.length > 48 ? '…' : ''),
          author: author,
          date: date,
          readMin: Math.max(1, Math.round(body.length / 300)),
          views: 0,
          likes: 0,
          comments: 0,
          tone: 'ph-1',
          body: paras,
        });
      } else if (d.type === 'forum') {
        mock.forumThreads.unshift({
          id: id,
          boardId: d.boards[d.boardIndex].id,
          title: title,
          excerpt: body.slice(0, 48) + (body.length > 48 ? '…' : ''),
          author: author,
          date: date,
          replies: 0,
          likes: 0,
          pinned: false,
          tone: 'ph-2',
          body: paras,
        });
      } else {
        mock.wallPosts.unshift({
          id: id,
          content: body.slice(0, 60) + (body.length > 60 ? '…' : ''),
          author: author,
          date: date,
          likes: 0,
          comments: 0,
          tone: 'ph-3',
          body: paras,
          mine: true,
        });
      }

      // 内容已经写进 mock（相当于服务端已收下），但页面没了就不再做 UI 动作
      if (!this._alive) return;
      this.setData({ submitting: false });
      wx.showToast({ title: '已发布', icon: 'success' });

      // 直接跳到刚发的这条，用户能立刻看到自己的内容
      this._redirect = setTimeout(() => {
        const map = { blog: 'blog', forum: 'thread', wall: 'wall' };
        wx.redirectTo({
          url: '/pages/post-detail/post-detail?type=' + map[d.type] + '&id=' + id,
        });
      }, 700);
    });
  },

  onBack() {
    const stack = getCurrentPages();
    if (stack.length > 1) wx.navigateBack();
    else wx.navigateTo({ url: '/pages/community/community' });
  },

  /* 发布途中用户可以点系统返回：此时不应再 setData / 强制跳转 */
  onUnload() {
    this._alive = false;
    if (this._redirect) {
      clearTimeout(this._redirect);
      this._redirect = null;
    }
  },
});
