/**
 * 我的列表 —— 一页三模式
 *   ?type=favorites  我的收藏   GET /api/me/favorites
 *   ?type=downloads  我的下载   GET /api/me/downloads
 *   ?type=uploads    我的投稿   GET /api/me/materials
 *
 * 三者列表结构一致（缩略图 + 标题 + 元信息 + 时间），差异只在：
 *   ① 标题文案与空态引导   ② 投稿多一个审核状态与退回原因   ③ 投稿需要状态筛选
 * 所以合成一个页面：以后调样式只改一处，不会三处不同步。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');
const drafts = require('../../utils/drafts.js');

const PAGE_SIZE = 5;

/* 审核状态：色义与 Web 端一致 —— 通过=绿、待审=金、退回=红、草稿=灰 */
const STATUS = {
  draft: { text: '草稿', cls: 'pill-mute' },
  pending: { text: '待审核', cls: 'pill' },
  approved: { text: '已通过', cls: 'pill-ok' },
  published: { text: '已发布', cls: 'pill-ok' },
  rejected: { text: '已退回', cls: 'pill-danger' },
};

const MODES = {
  drafts: {
    kicker: 'MY DRAFTS',
    title: '草稿箱',
    atLabel: '保存于',
    src: function () {
      return drafts.list();
    },
    emptyTitle: '草稿箱是空的',
    emptyDesc: '上传素材时点「存草稿」，写了一半的内容会留在这里，下次接着填。',
    emptyAction: '去投稿',
    emptyUrl: '/pages/upload/upload',
    errorTitle: '草稿加载失败',
    footNote: '草稿只保存标题、描述、标签等文字信息；文件不会保留，重新打开时需要再选一次。',
  },
  favorites: {
    kicker: 'MY FAVORITES',
    title: '我的收藏',
    atLabel: '收藏于',
    src: function () {
      return mock.myFavorites;
    },
    emptyTitle: '还没有收藏任何素材',
    emptyDesc: '在素材详情页点「收藏」，之后可以在这里快速找回。',
    emptyAction: '去素材库看看',
    emptyUrl: '/pages/index/index',
    errorTitle: '收藏加载失败',
    footNote: '',
  },
  downloads: {
    kicker: 'MY DOWNLOADS',
    title: '我的下载',
    atLabel: '下载于',
    src: function () {
      return mock.myDownloads;
    },
    emptyTitle: '还没有下载记录',
    emptyDesc: '下载过的素材会留在这里，方便重复取用。',
    emptyAction: '去素材库看看',
    emptyUrl: '/pages/index/index',
    errorTitle: '下载记录加载失败',
    footNote: '按平台规范，下载素材仅限校内教学与宣传使用，对外发布请注明来源。',
  },
  uploads: {
    kicker: 'MY UPLOADS',
    title: '我的投稿',
    atLabel: '提交于',
    src: function () {
      return mock.myUploads;
    },
    emptyTitle: '还没有投稿',
    emptyDesc: '投稿经审核通过后会归档进素材库，并被全校师生检索到。',
    emptyAction: '上传第一件素材',
    emptyUrl: '/pages/upload/upload',
    errorTitle: '投稿记录加载失败',
    footNote: '投稿进入审核队列后通常 1–2 个工作日处理；被退回会附上具体原因。',
  },
};

Page({
  data: {
    mode: 'favorites',
    kicker: '',
    title: '',
    atLabel: '',
    footNote: '',
    showFilter: false,
    filters: ['全部', '待审核', '已通过', '已退回'],
    filter: '全部',
    state: 'loading', // loading | ready | empty | error | guest
    list: [],
    shown: 0,
    total: 0,
    unit: ' 条',
    hasMore: false,
    loadingMore: false,
    subtitle: '',
    emptyTitle: '',
    emptyDesc: '',
    emptyAction: '',
    errorTitle: '',
  },

  onLoad(opts) {
    const mode = MODES[opts && opts.type] ? opts.type : 'favorites';
    const cfg = MODES[mode];
    // 代际编号：筛选/刷新时 +1，作废在途的翻页回调（否则筛选后会自动多加载一页）
    this._gen = 0;

    this.setData({
      mode: mode,
      kicker: cfg.kicker,
      title: cfg.title,
      atLabel: cfg.atLabel,
      footNote: cfg.footNote,
      showFilter: mode === 'uploads',
      emptyTitle: cfg.emptyTitle,
      emptyDesc: cfg.emptyDesc,
      emptyAction: cfg.emptyAction,
      errorTitle: cfg.errorTitle,
      subtitle: '加载中…',
    });

    wx.setNavigationBarTitle({ title: cfg.title });
    this.load();
  },

  onShow() {
    // onLoad 里已经 load 过一次，首次 onShow 不必重复请求
    if (!this._shownOnce) {
      this._shownOnce = true;
      return;
    }
    // 从登录页返回时，登录态可能已变化 —— 仅在「未登录」状态下重新尝试
    if (this.data.state === 'guest' && auth.isLoggedIn()) {
      this.load();
      return;
    }
    // 草稿存在 Storage 里，编辑页改了这边感知不到：
    // 从「继续编辑」返回时必须重读，否则刚存的草稿不出现。
    if (this.data.mode === 'drafts') this.load();
  },

  /* ── 加载 ── */
  load() {
    if (!auth.isLoggedIn()) {
      this.setData({ state: 'guest', subtitle: '登录后查看' });
      return Promise.resolve();
    }

    this.setData({ state: 'loading', list: [], shown: 0, subtitle: '加载中…' });
    const cfg = MODES[this.data.mode];
    const gen = ++this._gen;

    return mock
      .delay(360)
      .then(() => {
        if (gen !== this._gen) return; // 期间筛选过，这次结果作废
        this._all = cfg.src() || [];
        this._cursor = 0;
        this.render(false);
      })
      .catch(() => this.setData({ state: 'error', subtitle: '请下拉或点击重试' }));
  },

  /* 投稿按审核状态筛选；收藏/下载无筛选 */
  filtered() {
    const all = this._all || [];
    if (this.data.mode !== 'uploads' || this.data.filter === '全部') return all;

    const map = { 待审核: 'pending', 已通过: 'approved', 已退回: 'rejected' };
    const want = map[this.data.filter];
    if (!want) return all;

    return all.filter((it) => {
      if (want === 'approved') return it.status === 'approved' || it.status === 'published';
      return it.status === want;
    });
  },

  render(append) {
    const list = this.filtered();
    const slice = list.slice(this._cursor, this._cursor + PAGE_SIZE);
    const next = (append ? this.data.list.slice() : []).concat(
      slice.map((it) => {
        const st = STATUS[it.status] || null;
        return Object.assign({}, it, {
          statusText: st ? st.text : '',
          statusCls: st ? st.cls : '',
        });
      })
    );

    this._cursor += slice.length;
    const total = list.length;
    const unit = this.data.mode === 'uploads' ? ' 件' : this.data.mode === 'drafts' ? ' 份' : ' 条';

    this.setData({
      list: next,
      shown: this._cursor,
      total: total,
      unit: unit,
      hasMore: this._cursor < total,
      loadingMore: false,
      state: total ? 'ready' : 'empty',
      subtitle: total
        ? '共 ' + total + unit + ' · 已显示 ' + this._cursor + unit
        : '当前条件下没有记录',
    });
  },

  /* ── 交互 ── */
  onFilter(e) {
    this._gen++;
    this.setData({ filter: e.currentTarget.dataset.v });
    this._cursor = 0;
    this.render(false);
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    const gen = this._gen;
    this.setData({ loadingMore: true });
    mock.delay(240).then(() => {
      if (gen !== this._gen) return; // 期间筛选/刷新过，丢弃这次翻页
      this.render(true);
    });
  },

  onLoadMoreTap() {
    this.onReachBottom();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  onOpen(e) {
    const id = e.currentTarget.dataset.id;
    // 草稿点开是「继续编辑」，不是看详情
    if (this.data.mode === 'drafts') {
      wx.navigateTo({ url: '/pages/upload/upload?draftId=' + id });
      return;
    }
    if (this.data.mode === 'uploads') {
      const item = this.data.list.filter((x) => x.id === Number(id))[0];
      if (item && item.status === 'rejected') {
        // 退回件的主要动作是「看原因 + 重新提交」，原型阶段用弹窗呈现原因全文
        wx.showModal({
          title: '退回原因',
          content: item.reason || '未填写原因，请联系审核老师。',
          confirmText: '知道了',
          showCancel: false,
          confirmColor: '#d8b46a',
        });
        return;
      }
      if (item && item.status === 'pending') {
        wx.showToast({ title: '审核中，通过后会归档进素材库', icon: 'none' });
        return;
      }
    }
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },

  onLogin() {
    auth.ensureLogin();
  },

  /* 投稿模式下的上传入口 */
  onUpload() {
    if (!auth.isLoggedIn()) {
      auth.ensureLogin();
      return;
    }
    wx.navigateTo({ url: '/pages/upload/upload' });
  },

  onGoEmpty() {
    const url = MODES[this.data.mode].emptyUrl;
    // tabBar 页面必须用 switchTab，否则会压栈失败
    const tabs = ['/pages/home/home', '/pages/index/index', '/pages/items/items', '/pages/messages/messages', '/pages/profile/profile'];
    if (tabs.indexOf(url) > -1) wx.switchTab({ url: url });
    else wx.navigateTo({ url: url });
  },

  onRetry() {
    this.load();
  },
});
