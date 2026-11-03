/**
 * 通知中心
 *   GET /api/community/notifications
 *   已读：POST /api/community/notifications/:id/read
 *
 * 分「全部 / 未读」而不是按类型分 tab：
 * 通知量本身不大，按类型分会让人要在四个 tab 之间找「刚提醒我的那条」。
 * 类型用图标与颜色区分即可。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');
const state = require('../../utils/state.js');
const badge = require('../../utils/badge.js');

const KIND = {
  review: { text: '审核', ico: 'ico-check', cls: 'k-review' },
  comment: { text: '评论', ico: 'ico-chat', cls: 'k-comment' },
  like: { text: '赞同', ico: 'ico-heart', cls: 'k-like' },
  system: { text: '公告', ico: 'ico-mail', cls: 'k-system' },
};

const TABS = [
  { key: 'all', text: '全部' },
  { key: 'unread', text: '未读' },
];

Page({
  data: {
    tabs: TABS,
    tab: 'all',
    state: 'loading', // loading | ready | empty | error | guest
    list: [],
    shown: [],
    unread: 0,
    subtitle: '',
  },

  onLoad() {
    this.load();
  },

  onShow() {
    // 读完通知返回，底栏角标要同步减少
    badge.update();
  },

  load() {
    if (!auth.isLoggedIn()) {
      this.setData({ state: 'guest', subtitle: '登录后查看' });
      return Promise.resolve();
    }
    this.setData({ state: 'loading' });
    return mock
      .delay(300)
      .then(() => {
        const readNotices = state.readList(state.KEY.readNotice);
        this._all = mock.notifications.map((n) => {
          const k = KIND[n.kind] || KIND.system;
          const copy = {};
          for (const key in n) copy[key] = n[key];
          // 本地已读记录优先，否则退出再进来又变回未读
          copy.read = !!n.read || readNotices.indexOf(Number(n.id)) > -1;
          copy.kindText = k.text;
          copy.ico = k.ico;
          copy.kindCls = k.cls;
          return copy;
        });
        this.render();
      })
      .catch(() => this.setData({ state: 'error', subtitle: '请下拉或点击重试' }));
  },

  render() {
    const all = this._all || [];
    const shown = this.data.tab === 'unread' ? all.filter((n) => !n.read) : all;
    const unread = all.filter((n) => !n.read).length;

    this.setData({
      list: all,
      shown: shown,
      unread: unread,
      state: shown.length ? 'ready' : 'empty',
      subtitle: unread > 0 ? unread + ' 条未读' : '全部已读',
    });
  },

  onTab(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.tab) return;
    this.setData({ tab: key }, () => this.render());
  },

  /* 点通知：标为已读，并按 linkType 跳转 */
  onOpen(e) {
    const id = Number(e.currentTarget.dataset.id);
    const item = this.data.list.filter((n) => n.id === id)[0];
    if (!item) return;

    this._all = this._all.map((n) => {
      if (n.id !== id) return n;
      const copy = {};
      for (const k in n) copy[k] = n[k];
      copy.read = true;
      return copy;
    });
    // 同步回 mock，返回时列表也一致
    mock.notifications.forEach((n) => {
      if (n.id === id) n.read = true;
    });
    state.add(state.KEY.readNotice, id);
    this.render();
    badge.update();

    const type = item.linkType;
    if (type === 'myUploads') {
      wx.navigateTo({ url: '/pages/my-list/my-list?type=uploads' });
    } else if (type === 'wall') {
      wx.navigateTo({ url: '/pages/post-detail/post-detail?type=wall&id=' + item.linkId });
    } else if (type === 'tasks') {
      wx.switchTab({ url: '/pages/items/items' });
    } else {
      wx.showToast({ title: '已读', icon: 'none' });
    }
  },

  onMarkAll() {
    if (!this.data.unread) {
      wx.showToast({ title: '没有未读通知', icon: 'none' });
      return;
    }
    this._all = this._all.map((n) => {
      const copy = {};
      for (const k in n) copy[k] = n[k];
      copy.read = true;
      return copy;
    });
    mock.notifications.forEach((n) => {
      n.read = true;
    });
    // 在「未读」tab 点全部已读后，列表会立刻变空——
    // 停在空页会让用户以为「通知没了」，所以主动切回「全部」看刚读过的那几条
    this.setData({ tab: this.data.tab === 'unread' ? 'all' : this.data.tab }, () => this.render());
    wx.showToast({ title: '已全部标为已读', icon: 'none' });
  },

  onLogin() {
    auth.ensureLogin();
  },

  onRetry() {
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },
});
