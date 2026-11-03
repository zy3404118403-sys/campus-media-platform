/**
 * 上传素材（投稿）
 *   选文件 → 填信息 → 提交 → 进审核队列
 *   接口：POST /api/materials（普通）、/api/materials/upload-big（大文件分片）、/api/oss/multipart/*
 *
 * 为什么单独一页：投稿需要「选文件 + 写标题/描述/标签/学院」四类信息，
 * 塞进任何现有页面都会挤爆；而且上传失败要能单独重试，不牵连其他页面。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');
const drafts = require('../../utils/drafts.js');

const TYPES = ['视频', '图片', '文档'];
const COLLEGES = [
  '融媒体中心',
  '传媒学院',
  '人文学院',
  '数字媒体技术',
  '设计学院',
  '数字治理学院',
];
const HOT_TAGS = ['迎新晚会', '校运会', '活动', '混剪', '素材', '校园四季', '采访'];

const LIMIT = {
  视频: 2000, // MB，与平台 20GB 上限的客户端提示口径不同，此处按移动网络友好值提示
  图片: 20,
  文档: 50,
};

Page({
  data: {
    types: TYPES,
    type: '视频',
    colleges: COLLEGES,
    collegeIndex: 0,
    hotTags: HOT_TAGS,
    file: null, // { name, size, sizeText, duration, path }
    title: '',
    desc: '',
    tags: [],
    state: 'idle', // idle | uploading | done
    progress: 0,
    err: '',
    submitting: false,
    limitText: '',
    draftId: 0,      // >0 表示这份表单来自草稿，提交成功后要删掉对应草稿
    fromDraft: false,
  },

  onLoad(query) {
    this._alive = true;
    this._timer = null;
    this._redirect = null;
    if (!auth.isLoggedIn()) {
      wx.showModal({
        title: '需要登录',
        content: '上传素材需要先登录学号账号，登录后可查看自己的投稿与审核状态。',
        confirmText: '去登录',
        confirmColor: '#d8b46a',
        success: (res) => {
          if (res.confirm) auth.ensureLogin();
          else wx.navigateBack();
        },
      });
    }
    this.setData({ limitText: '单个文件不超过 ' + LIMIT[this.data.type] + ' MB' });

    // 从草稿箱点进来：回填文字，文件必须重选（临时路径重启即失效）
    const did = Number((query && query.draftId) || 0);
    if (did) this.restoreDraft(did);
  },

  /* 回填草稿：只恢复文字，不恢复文件 */
  restoreDraft(id) {
    const d = drafts.byId(id);
    if (!d) return;
    this.setData({
      draftId: d.id,
      fromDraft: true,
      type: d.type || '视频',
      collegeIndex: d.collegeIndex || 0,
      title: d.title || '',
      desc: d.desc || '',
      tags: d.tags || [],
      limitText: '单个文件不超过 ' + LIMIT[d.type || '视频'] + ' MB',
    });
    wx.showToast({ title: '已恢复草稿，请重新选择文件', icon: 'none', duration: 2600 });
  },

  /* 存草稿：必须有标题，否则草稿箱里全是一条条「无标题」 */
  onSaveDraft() {
    const d = this.data;
    if (String(d.title).trim().length < 4) {
      return this.setData({ err: '存草稿至少要填 4 个字的标题，方便以后找回' });
    }
    const item = drafts.save({
      id: d.draftId,
      title: d.title,
      desc: d.desc,
      type: d.type,
      college: d.colleges[d.collegeIndex],
      collegeIndex: d.collegeIndex,
      tags: d.tags,
      fileName: d.file ? d.file.name : '',
    });
    this.setData({ draftId: item.id, fromDraft: true, err: '' });
    wx.showToast({ title: '已存入草稿箱', icon: 'success' });
  },

  /* ── 类型切换 ── */
  onType(e) {
    const t = e.currentTarget.dataset.v;
    if (t === this.data.type) return;
    // 换类型后已选文件可能不合法，直接清掉重新选，避免提交时才发现
    this.setData({
      type: t,
      file: null,
      limitText: '单个文件不超过 ' + LIMIT[t] + ' MB',
      err: '',
    });
  },

  /* ── 选文件 ── */
  onPick() {
    const type = this.data.type;
    if (type === '文档') {
      wx.chooseMessageFile({
        count: 1,
        type: 'file',
        success: (res) => this.acceptFile(res.tempFiles[0]),
        fail: () => {},
      });
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: type === '视频' ? ['video'] : ['image'],
      sourceType: ['album', 'camera'],
      maxDuration: 300,
      sizeType: ['original'],
      success: (res) => {
        const f = res.tempFiles[0];
        this.acceptFile({
          path: f.tempFilePath,
          size: f.size,
          name: (f.tempFilePath || '').split('/').pop().split('?')[0],
          duration: f.duration || 0,
          fileType: type,
        });
      },
      fail: () => {},
    });
  },

  acceptFile(f) {
    if (!f) return;
    const mb = (f.size || 0) / 1024 / 1024;
    if (mb > LIMIT[this.data.type]) {
      this.setData({ err: '文件 ' + mb.toFixed(1) + ' MB，超出 ' + this.data.type + ' 的 ' + LIMIT[this.data.type] + ' MB 上限' });
      return;
    }
    const d = f.duration || 0;
    this.setData({
      err: '',
      file: {
        name: f.name || '未命名文件',
        size: f.size || 0,
        sizeText: mb >= 1 ? mb.toFixed(1) + ' MB' : ((f.size || 0) / 1024).toFixed(0) + ' KB',
        duration: d ? Math.floor(d / 60) + ':' + ('0' + Math.floor(d % 60)).slice(-2) : '',
        path: f.path || '',
      },
    });
  },

  onRemoveFile() {
    this.setData({ file: null });
  },

  /* ── 表单 ── */
  onTitle(e) {
    this.setData({ title: e.detail.value, err: '' });
  },

  onDesc(e) {
    this.setData({ desc: e.detail.value, err: '' });
  },

  onCollege(e) {
    this.setData({ collegeIndex: Number(e.detail.value) });
  },

  onTag(e) {
    const t = e.currentTarget.dataset.v;
    const tags = this.data.tags.slice();
    const i = tags.indexOf(t);
    if (i > -1) tags.splice(i, 1);
    else if (tags.length >= 5) {
      wx.showToast({ title: '最多选 5 个标签', icon: 'none' });
      return;
    } else tags.push(t);
    this.setData({ tags: tags });
  },

  /* ── 提交 ── */
  onSubmit() {
    const d = this.data;
    if (!d.file) return this.setData({ err: '请先选择要上传的文件' });
    if (String(d.title).trim().length < 4) return this.setData({ err: '标题至少 4 个字，写清活动名称或拍摄主题' });
    if (String(d.desc).trim().length < 10) return this.setData({ err: '描述至少 10 个字，说明拍了什么、可用于什么场景' });
    if (d.submitting) return;

    this.setData({ submitting: true, state: 'uploading', progress: 0, err: '' });

    // 原型：模拟分片上传进度；接真实后端时换成 wx.uploadFile 的 onProgressUpdate
    let p = 0;
    this._timer = setInterval(() => {
      if (!this._alive) return;
      p = Math.min(96, p + 8 + Math.random() * 10);
      this.setData({ progress: Math.floor(p) });
    }, 160);

    mock.delay(2000).then(() => {
      this.clearTimer();
      if (!this._alive) return; // 上传途中用户已离开：不再 setData、不强制跳转
      this.setData({ progress: 100 });

      const now = new Date();
      const pad = (n) => (n < 10 ? '0' + n : String(n));
      const date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

      // 写进 mock 的投稿列表，让「我的投稿」立刻能看到（真实接口会由服务端返回）
      mock.myUploads.unshift({
        id: Date.now(),
        title: d.title.trim(),
        type: d.type,
        college: d.colleges[d.collegeIndex],
        size: d.file.sizeText,
        status: 'pending',
        reason: '',
        at: date,
        tone: 'ph-2',
      });

      // 这份草稿已经变成正式投稿，草稿箱里不该再留一份
      if (d.draftId) drafts.remove(d.draftId);

      this.setData({ submitting: false, state: 'done', draftId: 0 });
      wx.showToast({ title: '已提交，等待审核', icon: 'success' });

      this._redirect = setTimeout(() => {
        wx.redirectTo({ url: '/pages/my-list/my-list?type=uploads' });
      }, 900);
    });
  },

  onBack() {
    const stack = getCurrentPages();
    if (stack.length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/profile/profile' });
  },

  /* 离开页面必须停掉进度定时器与跳转定时器：
     否则定时器会一直 setData 到已销毁的页面，且用户返回后仍会被强行跳到「我的投稿」 */
  clearTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this._redirect) {
      clearTimeout(this._redirect);
      this._redirect = null;
    }
  },

  onUnload() {
    this._alive = false;
    this.clearTimer();
  },
});
