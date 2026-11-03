/**
 * 聊天
 *   消息流：GET /api/messages/chat/:partner
 *   发送：  POST /api/messages/send
 *
 * 用 scroll-view + scroll-into-view 定位到最后一条：
 * 直接 setData 后 pageScrollTo 在键盘弹起时容易算错位置。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');

Page({
  data: {
    conv: null,
    list: [],
    anchor: '',
    draft: '',
    sending: false,
    state: 'loading', // loading | ready | empty
  },

  onLoad(opts) {
    this._id = Number(opts && opts.id) || 0;
    this.load();
  },

  load() {
    const conv = mock.byId(mock.conversations, this._id);
    if (!conv) {
      this.setData({ state: 'empty' });
      return;
    }
    const list = (mock.messages[this._id] || []).slice();
    this.setData({ state: 'ready', conv: conv, list: list });
    wx.setNavigationBarTitle({ title: conv.name });
    this.scrollToEnd();
  },

  scrollToEnd() {
    const list = this.data.list;
    if (!list.length) return;
    this.setData({ anchor: 'msg-' + list[list.length - 1].id });
  },

  onDraft(e) {
    this.setData({ draft: e.detail.value });
  },

  onSend() {
    const text = String(this.data.draft || '').trim();
    if (!text) return;
    if (!auth.isLoggedIn()) {
      auth.ensureLogin();
      return;
    }
    if (this.data.sending) return;

    const d = new Date();
    const pad = (n) => (n < 10 ? '0' + n : String(n));
    const time = pad(d.getHours()) + ':' + pad(d.getMinutes());
    const msg = { id: Date.now(), from: 'me', text: text, time: time };

    // 先上屏再落库：输入框要立刻清空，用户不等网络
    const list = this.data.list.concat([msg]);
    this.setData({ list: list, draft: '', sending: true });

    // 同步到 mock，让消息列表的「最后一条」跟着变
    if (!mock.messages[this._id]) mock.messages[this._id] = [];
    mock.messages[this._id].push(msg);
    const conv = mock.byId(mock.conversations, this._id);
    if (conv) {
      conv.last = text;
      conv.time = time;
    }

    this.setData({ anchor: 'msg-' + msg.id });

    mock.delay(320).then(() => {
      this.setData({ sending: false });
    });
  },

  onBack() {
    const stack = getCurrentPages();
    if (stack.length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/profile/profile' });
  },
});
