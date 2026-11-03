const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');

Page({
    data: {
        state: 'loading',
        item: null,
        related: [],
        liked: false,
        fav: false,
        dlOpen: false,
        dlAgree: false,
    },

    onLoad(query) {
        const id = query && query.id;
        mock
            .delay(320)
            .then(() => {
                const item = mock.byId(mock.materials, id);
                if (!item) {
                    this.setData({ state: 'error' });
                    return;
                }
                const related = mock.materials
                    .filter((m) => m.id !== item.id)
                    .slice(0, 3)
                    .map((m) => ({
                        id: m.id,
                        title: m.title,
                        tone: m.tone,
                        why: m.college === item.college ? '同学院' : '同标签',
                    }));
                this.setData({ state: 'ready', item: item, related: related });
            })
            .catch(() => this.setData({ state: 'error' }));
    },

    onLike() {
        // 点赞需要登录态，未登录先引导登录
        if (!auth.ensureLogin()) return;
        const next = !this.data.liked;
        this.setData({ liked: next });
        wx.showToast({ title: next ? '已点赞' : '已取消', icon: 'none' });
    },

    onFav() {
        if (!auth.ensureLogin()) return;
        const next = !this.data.fav;
        this.setData({ fav: next });
        wx.showToast({ title: next ? '已加入收藏' : '已取消收藏', icon: 'none' });
    },

    /* 下载前必须过使用规范。
     * 不用 wx.showModal：原生弹窗放不了勾选框，也无法截图/自动化验证，
     * 而「勾选后才可下载」是这条合规约束的关键，所以自绘。 */
    onDownload() {
        this.setData({ dlOpen: true, dlAgree: false });
    },

    onDlAgree() {
        this.setData({ dlAgree: !this.data.dlAgree });
    },

    onDlClose() {
        this.setData({ dlOpen: false, dlAgree: false });
    },

    onDlConfirm() {
        if (!this.data.dlAgree) {
            wx.showToast({ title: '请先勾选同意使用规范', icon: 'none' });
            return;
        }
        this.setData({ dlOpen: false, dlAgree: false });
        wx.showToast({ title: '开始下载（原型）', icon: 'none' });
    },

    /* 阻止弹窗内容区的点击冒泡到遮罩（否则点内容也会关闭） */
    noop() {},

    onRelated(e) {
        wx.redirectTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
    },

    onBack() {
        wx.navigateBack({ delta: 1 });
    },

    /* ── 分享：素材是内容型页面，分享是主要拉新路径 ── */
    onShareAppMessage() {
        const it = this.data.item;
        return {
            title: it ? it.title + ' · 校园融媒体素材库' : '校园融媒体素材库',
            path: '/pages/detail/detail?id=' + (it ? it.id : ''),
        };
    },

    onShareTimeline() {
        const it = this.data.item;
        return {
            title: it ? it.title : '校园融媒体素材库',
            query: 'id=' + (it ? it.id : ''),
        };
    },
});
