/**
 * 活动详情
 *   数据：GET /api/activities/:id
 *   报名：POST /api/activities/:id/join  · 取消：DELETE /api/activities/:id/join
 *   签到：POST /api/activities/:id/signin
 *
 * 列表页只能「一键报名」，看不到议程、须知与名额进度；
 * 这几样恰恰是学生决定要不要报名的关键，所以必须单独一页。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');
const state = require('../../utils/state.js');

Page({
  data: {
    state: 'loading', // loading | ready | empty | error
    act: null,
    joined: false,
    joining: false,
    signedIn: false,
    ended: false,
    pct: 0,
    joinText: '立即报名',
  },

  onLoad(opts) {
    this._alive = true;
    this._id = Number(opts && opts.id) || 1;
    this.load();
  },

  /* 报名/签到有 360–420ms 延迟，途中用户可以退出：退出后不再 setData */
  onUnload() {
    this._alive = false;
  },

  load() {
    this.setData({ state: 'loading' });
    return mock
      .delay(320)
      .then(() => {
        const a = mock.byId(mock.activities, this._id);
        if (!a) {
          this.setData({ state: 'empty' });
          return;
        }
        const pct = Math.min(100, Math.round((a.joined / a.capacity) * 100));
        this.setData({
          state: 'ready',
          act: a,
          ended: a.state === '已结束',
          pct: pct,
          // 本地已报名记录优先，否则退出再进来按钮又变回「立即报名」
          joined: state.hasJoined(a.id),
        });
        wx.setNavigationBarTitle({ title: '活动详情' });
      })
      .catch(() => this.setData({ state: 'error' }));
  },

  /* ── 报名 ──
   * 报名是可撤销的低风险动作（随时可取消），不做二次确认弹窗——
   * 可逆操作上叠加确认只会增加摩擦，确认留给「取消报名」这种有后果的动作。
   */
  onJoin() {
    if (this.data.ended) return;
    if (!auth.ensureLogin()) return;
    if (this.data.joining) return;

    this.setData({ joining: true });
    wx.showLoading({ title: '报名中', mask: true });

    mock.delay(420).then(() => {
      wx.hideLoading();
      if (!this._alive) return;
      const next = this.data.act.joined + 1;
      this.setData({
        joining: false,
        joined: true,
        signedIn: false,
        'act.joined': next,
        pct: Math.min(100, Math.round((next / this.data.act.capacity) * 100)),
      });
      state.join(this._id);
      wx.showToast({ title: '报名成功', icon: 'success' });
    });
  },

  onCancel() {
    wx.showModal({
      title: '取消报名',
      content: '取消后名额会释放给其他同学，确定取消吗？',
      confirmColor: '#d8b46a',
      success: (res) => {
        if (!res.confirm) return;
        this.setData({
          joined: false,
          signedIn: false,
          'act.joined': Math.max(0, this.data.act.joined - 1),
          pct: Math.min(100, Math.round((Math.max(0, this.data.act.joined - 1) / this.data.act.capacity) * 100)),
        });
        state.quit(this._id);
        wx.showToast({ title: '已取消报名', icon: 'none' });
      },
    });
  },

  /* ── 签到（真实接口会校验是否在现场时间段内） ── */
  onSignIn() {
    if (this.data.signedIn) {
      wx.showToast({ title: '今天已完成签到', icon: 'none' });
      return;
    }
    mock.delay(360).then(() => {
      if (!this._alive) return;
      this.setData({ signedIn: true });
      wx.showToast({ title: '签到成功', icon: 'success' });
    });
  },

  onBack() {
    const stack = getCurrentPages();
    if (stack.length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/items/items' });
  },

  onRetry() {
    this.load();
  },

  onShareAppMessage() {
    const a = this.data.act;
    return {
      title: a ? a.title : '校园活动',
      path: '/pages/activity-detail/activity-detail?id=' + this._id,
    };
  },

  onShareTimeline() {
    const a = this.data.act;
    return {
      title: a ? a.title : '校园活动',
      query: 'id=' + this._id,
    };
  },
});
