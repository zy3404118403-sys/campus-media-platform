/**
 * 任务详情
 *   数据：GET /api/tasks/:id
 *   领取：POST /api/tasks/:id/claim
 *   提交：POST /api/tasks/:id/submit  { note, link }
 *
 * 任务的生命周期是四态：未领取 → 已领取 → 已提交（待审核）→ 已通过。
 * 列表页只放得下「领取」，提交成果需要写说明、贴链接，必须是独立页面。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');
const state = require('../../utils/state.js');

const STAGES = {
  open: { text: '待领取', cls: 'pill' },
  claimed: { text: '已领取', cls: 'pill-warn' },
  submitted: { text: '待审核', cls: 'pill-warn' },
  approved: { text: '已通过', cls: 'pill-ok' },
};

Page({
  data: {
    state: 'loading', // loading | ready | empty | error
    task: null,
    stage: 'open',
    stageText: '',
    stageCls: '',
    formOpen: false,
    note: '',
    link: '',
    err: '',
    busy: false,
    submitting: false,
    submittedAt: '',
  },

  onLoad(opts) {
    this._alive = true;
    this._id = Number(opts && opts.id) || 5;
    this.load();
  },

  /* 领取/提交有 400–520ms 延迟，途中用户可以退出：退出后不再 setData */
  onUnload() {
    this._alive = false;
  },

  load() {
    this.setData({ state: 'loading' });
    return mock
      .delay(320)
      .then(() => {
        const t = mock.byId(mock.tasks, this._id);
        if (!t) {
          this.setData({ state: 'empty' });
          return;
        }
        // 本地已领取记录优先，否则退出再进来状态会丢
        const stage = (t.claimed || state.hasClaimed(t.id)) ? 'claimed' : 'open';
        this.setData({
          state: 'ready',
          task: t,
          stage: stage,
          stageText: STAGES[stage].text,
          stageCls: STAGES[stage].cls,
        });
        wx.setNavigationBarTitle({ title: '任务详情' });
      })
      .catch(() => this.setData({ state: 'error' }));
  },

  setStage(stage) {
    this.setData({
      stage: stage,
      stageText: STAGES[stage].text,
      stageCls: STAGES[stage].cls,
    });
  },

  /* ── 领取：可逆、低风险，不弹二次确认 ── */
  onClaim() {
    if (this.data.stage !== 'open') return;
    if (!auth.ensureLogin()) return;
    if (this.data.busy) return;

    this.setData({ busy: true });
    wx.showLoading({ title: '领取中', mask: true });
    mock.delay(400).then(() => {
      wx.hideLoading();
      if (!this._alive) return;
      state.claim(this.data.task.id);
      this.setData({ busy: false, 'task.claimedCount': (this.data.task.claimedCount || 0) + 1 });
      this.setStage('claimed');
      wx.showToast({ title: '领取成功', icon: 'success' });
    });
  },

  /* ── 提交表单 ── */
  onOpenForm() {
    if (!auth.ensureLogin()) return;
    this.setData({ formOpen: true, err: '' });
  },

  onCloseForm() {
    this.setData({ formOpen: false, err: '' });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value, err: '' });
  },

  onLinkInput(e) {
    this.setData({ link: e.detail.value });
  },

  onSubmit() {
    const note = String(this.data.note || '').trim();
    if (note.length < 10) {
      this.setData({ err: '请把成果说明写清楚一些（不少于 10 个字），方便审核老师核对。' });
      return;
    }
    if (this.data.submitting) return;

    this.setData({ submitting: true, err: '' });
    wx.showLoading({ title: '提交中', mask: true });

    mock.delay(520).then(() => {
      wx.hideLoading();
      if (!this._alive) return;
      const d = new Date();
      const pad = (n) => (n < 10 ? '0' + n : String(n));
      this.setData({
        submitting: false,
        formOpen: false,
        submittedAt:
          d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
          ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()),
      });
      this.setStage('submitted');
      wx.showToast({ title: '已提交，等待审核', icon: 'none' });
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
    const t = this.data.task;
    return {
      title: t ? '校园任务：' + t.title : '校园任务',
      path: '/pages/task-detail/task-detail?id=' + this._id,
    };
  },

  onShareTimeline() {
    const t = this.data.task;
    return {
      title: t ? '校园任务：' + t.title : '校园任务',
      query: 'id=' + this._id,
    };
  },
});
