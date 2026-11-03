/**
 * 消息列表
 *   会话：GET /api/messages/conversations
 *   未读：GET /api/messages/unread-count
 *   通知：GET /api/community/notifications
 *
 * 系统通知与私信放同一页：用户心智里都是「有人找我」，
 * 分成两个入口会让「哪里去看」变成一道选择题。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');
const state = require('../../utils/state.js');
const badge = require('../../utils/badge.js');

Page({
  data: {
    state: 'loading', // loading | ready | error | guest
    conversations: [],
    unreadMsg: 0,
    unreadNotice: 0,
    subtitle: '',
  },

  onLoad() {
    this.load();
  },

  onShow() {
    // 从聊天页返回时未读数可能已变，只在已有数据时静默刷新
    if (this.data.state === 'ready') this.refresh();
    // 进过会话后未读变了，底栏角标要跟着变
    badge.update();
  },

  load() {
    if (!auth.isLoggedIn()) {
      this.setData({ state: 'guest', subtitle: '登录后查看' });
      return Promise.resolve();
    }
    this.setData({ state: 'loading' });
    return mock
      .delay(320)
      .then(() => {
        this.apply();
      })
      .catch(() => this.setData({ state: 'error', subtitle: '请下拉或点击重试' }));
  },

  refresh() {
    this.apply();
  },

  apply() {
    const readConvs = state.readList(state.KEY.readConv);
    const readNotices = state.readList(state.KEY.readNotice);
    // 已读记录优先于 mock 的 unread 字段，否则退出再进来红点又回来
    const list = mock.conversations.map((c) => {
      const copy = {};
      for (const k in c) copy[k] = c[k];
      if (readConvs.indexOf(Number(c.id)) > -1) copy.unread = 0;
      return copy;
    });
    const unreadMsg = list.reduce((s, c) => s + (c.unread || 0), 0);
    const unreadNotice = mock.notifications.filter(
      (n) => !n.read && readNotices.indexOf(Number(n.id)) === -1
    ).length;
    this.setData({
      state: 'ready',
      conversations: list,
      unreadMsg: unreadMsg,
      unreadNotice: unreadNotice,
      subtitle: unreadMsg + unreadNotice > 0
        ? unreadMsg + unreadNotice + ' 条未读'
        : '没有未读消息',
    });
    wx.setNavigationBarTitle({ title: '消息' });
  },

  onOpenChat(e) {
    const id = Number(e.currentTarget.dataset.id);
    // 进入会话即视为已读（真实接口会 POST .../read）
    const list = this.data.conversations.map((c) => {
      if (c.id !== id) return c;
      const copy = {};
      for (const k in c) copy[k] = c[k];
      copy.unread = 0;
      return copy;
    });
    mock.conversations.forEach((c) => {
      if (c.id === id) c.unread = 0;
    });
    state.add(state.KEY.readConv, id);
    this.setData({ conversations: list });
    this.refresh();
    badge.update();

    wx.navigateTo({ url: '/pages/chat/chat?id=' + id });
  },

  onOpenNotices() {
    wx.navigateTo({ url: '/pages/notifications/notifications' });
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
