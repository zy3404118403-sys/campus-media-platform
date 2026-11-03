/**
 * 管理后台 · 内容管理
 *
 * 两个动作：
 *   精选 —— 打标，前台暂只在管理列表里可见（Web 端会进首页精选位）
 *   下架 —— 真的影响前台：素材库与首页都不再出现，且写入本地存储，重启仍然生效
 * 下架之所以要持久化，是因为它改变的是「对外可见性」，不是页面内的临时状态。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');
const state = require('../../utils/state.js');

const FILTERS = ['全部', '已精选', '已下架'];

Page({
    data: {
        deny: false,
        filters: FILTERS,
        filter: '全部',
        keyword: '',
        list: [],
        total: 0,
        featuredCount: 0,
        offlineCount: 0,
    },

    onLoad() {
        if (!auth.isAdmin()) {
            this.setData({ deny: true });
            return;
        }
        this.load();
    },

    onShow() {
        if (!this.data.deny) this.load();
    },

    load() {
        const kw = String(this.data.keyword).trim();
        const f = this.data.filter;

        let list = state.hideOffline(mock.materials.slice());
        /* 下架后的素材要能在这里找回，所以「已下架」单独取全量 */
        if (f === '已下架') {
            const off = state.readList(state.KEY.offline);
            list = mock.materials.filter((x) => off.indexOf(Number(x.id)) > -1);
        }

        if (kw) {
            list = list.filter((x) => {
                const hay = (x.title + x.college + (x.tags || []).join('')).toLowerCase();
                return hay.indexOf(kw.toLowerCase()) > -1;
            });
        }

        if (f === '已精选') list = list.filter((x) => state.isFeatured(x.id));

        this.setData({
            list: list.map((x) => ({
                id: x.id,
                title: x.title,
                type: x.type,
                college: x.college,
                tone: x.tone,
                size: x.size,
                featured: state.isFeatured(x.id),
                offline: state.isOffline(x.id),
            })),
            total: list.length,
            featuredCount: state.readList(state.KEY.featured).length,
            offlineCount: state.readList(state.KEY.offline).length,
        });
    },

    onFilter(e) {
        this.setData({ filter: e.currentTarget.dataset.v });
        this.load();
    },

    onSearch(e) {
        this.setData({ keyword: e.detail.value });
        if (this._t) clearTimeout(this._t);
        this._t = setTimeout(() => {
            this._t = null;
            this.load();
        }, 260);
    },

    onUnload() {
        if (this._t) clearTimeout(this._t);
    },

    /* ── 精选 ── */
    onFeature(e) {
        const id = Number(e.currentTarget.dataset.id);
        state.toggleFeatured(id);
        wx.showToast({ title: state.isFeatured(id) ? '已精选' : '已取消精选', icon: 'none' });
        this.load();
    },

    /* ── 下架 / 恢复 ── */
    onOffline(e) {
        const id = Number(e.currentTarget.dataset.id);
        const item = this.data.list.filter((x) => x.id === id)[0];
        if (!item) return;

        if (item.offline) {
            state.toggleOffline(id);
            wx.showToast({ title: '已恢复上架', icon: 'success' });
            this.load();
            return;
        }

        wx.showModal({
            title: '下架这条素材？',
            content: '下架后素材库与首页都不再显示，已下载的文件不受影响。可随时恢复。',
            confirmText: '下架',
            confirmColor: '#d8636e',
            success: (res) => {
                if (!res.confirm) return;
                state.toggleOffline(id);
                wx.showToast({ title: '已下架', icon: 'none' });
                this.load();
            },
        });
    },
});
