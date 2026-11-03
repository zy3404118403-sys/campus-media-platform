/**
 * 管理后台 · 审核队列
 *
 * 两个必须做对的地方：
 *   ① 退回必须选原因 —— 与 Web 后台口径一致（rejectReasons），提交者才知道改什么
 *   ② 通过后把素材真正推进 mock.materials —— 否则「通过」只是从列表消失，
 *      素材库里看不到，等于假按钮
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');
const ops = require('../../utils/admin-ops.js');

const TYPES = ['全部', '视频', '图片', '文档'];

Page({
    data: {
        deny: false,
        state: 'loading', // loading | ready | empty
        filters: TYPES,
        filter: '全部',
        riskOnly: false, // 从工作台「含肖像风险」点进来时只显示风险项
        list: [],
        pending: 0,
        safeCount: 0, // 无风险提示、可批量通过的条数
        doneToday: 0,
    },

    onLoad(query) {
        if (!auth.canReview()) {
            this.setData({ deny: true, state: 'ready' });
            return;
        }
        if (query && query.risk === '1') this.setData({ riskOnly: true });
        this.load();
    },

    load() {
        const q = mock.reviewQueue;
        const f = this.data.filter;

        let list = q.slice();
        if (f !== '全部') list = list.filter((x) => x.type === f);
        if (this.data.riskOnly) {
            list = list.filter((x) => (x.hints || []).join('').indexOf('面孔') > -1);
        }

        // 「无风险」判定：系统预检没有提示，或明确写了可直接入库
        const safe = list.filter((x) => {
            const h = (x.hints || []).join('');
            return !h || h.indexOf('可直接入库') > -1;
        });

        this.setData({
            state: list.length ? 'ready' : 'empty',
            list: list,
            pending: q.length,
            safeCount: safe.length,
        });
    },

    onFilter(e) {
        this.setData({ filter: e.currentTarget.dataset.v });
        this.load();
    },

    onClearRisk() {
        this.setData({ riskOnly: false });
        this.load();
    },

    /* ── 通过 ── */
    onPass(e) {
        const id = Number(e.currentTarget.dataset.id);
        const item = mock.reviewQueue.filter((x) => x.id === id)[0];
        if (!item) return;

        /* 含肖像风险的不能一键放行，必须逐条确认 —— 这是审核的底线 */
        const risky = (item.hints || []).join('').indexOf('面孔') > -1;
        if (risky) {
            wx.showModal({
                title: '该素材含可识别面孔',
                content: '通过即代表素材库对外开放，请确认已取得画面中同学的同意。',
                confirmText: '已取得同意',
                cancelText: '再看看',
                confirmColor: '#d8b46a',
                success: (res) => {
                    if (res.confirm) this.doPass(item);
                },
            });
            return;
        }
        this.doPass(item);
    },

    doPass(item, silent) {
        /* 入库逻辑在 utils/admin-ops.js，页面只管提示与刷新 */
        const mat = ops.approve(item);
        if (silent) return;
        if (!mat) {
            wx.showToast({ title: '该条目已被处理', icon: 'none' });
            this.load();
            return;
        }
        this.setData({ doneToday: this.data.doneToday + 1 });
        wx.showToast({ title: '已通过，已入库', icon: 'success' });
        this.load();
    },

    /* ── 退回 ── */
    onReject(e) {
        const id = Number(e.currentTarget.dataset.id);
        const item = mock.reviewQueue.filter((x) => x.id === id)[0];
        if (!item) return;

        wx.showActionSheet({
            alertText: '选择退回原因（提交者会看到）',
            itemList: mock.rejectReasons,
            success: (res) => {
                const reason = mock.rejectReasons[res.tapIndex];
                this.doReject(item, reason);
            },
            fail: () => {
                /* 用户取消，不提示 */
            },
        });
    },

    doReject(item, reason) {
        if (!ops.reject(item)) {
            wx.showToast({ title: '该条目已被处理', icon: 'none' });
            this.load();
            return;
        }
        this.setData({ doneToday: this.data.doneToday + 1 });
        wx.showToast({ title: '已退回：' + reason.slice(0, 10) + '…', icon: 'none', duration: 2200 });
        this.load();
    },

    /* ── 批量：只放行无风险项 ── */
    onPassSafe() {
        const n = this.data.safeCount;
        if (!n) {
            wx.showToast({ title: '当前没有可批量通过的条目', icon: 'none' });
            return;
        }
        wx.showModal({
            title: '批量通过 ' + n + ' 条',
            content: '只会处理系统预检无风险提示的素材；含肖像或版权疑问的条目仍需逐条确认。',
            confirmText: '通过',
            confirmColor: '#d8b46a',
            success: (res) => {
                if (!res.confirm) return;
                const ids = this.data.list
                    .filter((x) => {
                        const h = (x.hints || []).join('');
                        return !h || h.indexOf('可直接入库') > -1;
                    })
                    .map((x) => x.id);
                /* 逐条静默入库，避免每条都弹一次 toast、重载一次列表 */
                ids.forEach((id) => {
                    const it = mock.reviewQueue.filter((x) => x.id === id)[0];
                    if (it) this.doPass(it, true);
                });
                this.setData({ doneToday: this.data.doneToday + ids.length });
                this.load();
                wx.showToast({ title: '已通过 ' + ids.length + ' 条', icon: 'success' });
            },
        });
    },

    onBackAdmin() {
        wx.navigateBack();
    },
});
