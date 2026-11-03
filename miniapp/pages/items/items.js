const mock = require('../../utils/mock.js');
const state = require('../../utils/state.js');
const badge = require('../../utils/badge.js');

const TONES = ['ph-1', 'ph-2', 'ph-3', 'ph-4'];

Page({
    data: {
        tab: 'activity',
        aState: 'loading',
        aList: [],
        tState: 'loading',
        tList: [],
        /* 「我的」分段：我报名的活动 + 我领的任务 */
        mActs: [],
        mTasks: [],
        mEmpty: true,
    },

    onLoad() {
        this.loadActivities();
        this.loadTasks();
    },

    /* switchTab 无法带参数，首页快捷入口通过 storage 传目标分段 */
    onShow() {
        const t = wx.getStorageSync('itemsTab');
        if (t === 'activity' || t === 'task' || t === 'mine') {
            wx.removeStorageSync('itemsTab');
            if (t !== this.data.tab) this.setData({ tab: t });
        }
        // 从详情页返回时报名/领取状态可能已变，必须重算，否则列表还是旧样子
        this.syncMine();
        badge.update();
    },

    /* 下拉刷新：并行重拉活动与任务，两个都回来再收转圈 */
    onPullDownRefresh() {
        Promise.all([this.loadActivities(), this.loadTasks()])
            .then(() => {
                this.syncMine();
                wx.stopPullDownRefresh();
            })
            .catch(() => wx.stopPullDownRefresh());
    },

    /* 分段切换：活动 / 任务 / 我的 */
    onSeg(e) {
        const tab = e.currentTarget.dataset.tab;
        if (tab === this.data.tab) return;
        this.setData({ tab: tab });
        if (tab === 'mine') this.syncMine();
    },

    /* ───────── 状态合并：报名与领取状态从本地存储读 ───────── */
    syncMine() {
        const aList = (this.data.aList || []).map((it) => {
            const copy = {};
            for (const k in it) copy[k] = it[k];
            copy.joined2 = state.hasJoined(it.id);
            // 人数以 mock 原值为基准，避免每次刷新累加出错
            const base = it._baseJoined === undefined ? it.joined : it._baseJoined;
            copy.joined = base + (copy.joined2 ? 1 : 0);
            return copy;
        });

        const tList = (this.data.tList || []).map((it) => {
            const copy = {};
            for (const k in it) copy[k] = it[k];
            copy.claimed = !!it._baseClaimed || state.hasClaimed(it.id);
            return copy;
        });

        const mActs = aList.filter((it) => it.joined2);
        const mTasks = tList.filter((it) => it.claimed);

        this.setData({
            aList: aList,
            tList: tList,
            mActs: mActs,
            mTasks: mTasks,
            mEmpty: mActs.length === 0 && mTasks.length === 0,
        });
    },

    /* ───────── 活动 ───────── */
    loadActivities() {
        this.setData({ aState: 'loading' });
        return mock
            .delay(280)
            .then(() => {
                /* 草稿只在管理后台可见 */
                const list = mock.publicActivities().map((it) => {
                    const copy = {};
                    for (const k in it) copy[k] = it[k];
                    copy._baseJoined = it.joined;
                    copy.joined2 = state.hasJoined(it.id);
                    return copy;
                });
                this.setData({ aState: list.length ? 'ready' : 'empty', aList: list });
                this.syncMine();
            })
            .catch(() => this.setData({ aState: 'error' }));
    },

    onJoin(e) {
        const id = Number(e.currentTarget.dataset.id);
        state.join(id);
        this.syncMine();
        wx.showToast({ title: '报名成功', icon: 'success' });
    },

    onCancel(e) {
        const id = Number(e.currentTarget.dataset.id);
        wx.showModal({
            title: '取消报名',
            content: '取消后名额将释放给其他同学，确定取消吗？',
            confirmColor: '#d8b46a',
            success: (res) => {
                if (!res.confirm) return;
                state.quit(id);
                this.syncMine();
                wx.showToast({ title: '已取消报名', icon: 'none' });
            },
        });
    },

    onOpenActivity(e) {
        wx.navigateTo({
            url: '/pages/activity-detail/activity-detail?id=' + e.currentTarget.dataset.id,
        });
    },

    onRetryActivity() {
        this.loadActivities();
    },

    /* ───────── 任务 ───────── */
    loadTasks() {
        this.setData({ tState: 'loading' });
        return mock
            .delay(300)
            .then(() => {
                const list = mock.publicTasks().map((it, i) => {
                    const copy = {};
                    for (const k in it) copy[k] = it[k];
                    copy.tone = TONES[i % TONES.length];
                    copy._baseClaimed = !!it.claimed;
                    copy.claimed = !!it.claimed || state.hasClaimed(it.id);
                    return copy;
                });
                this.setData({ tState: list.length ? 'ready' : 'empty', tList: list });
                this.syncMine();
            })
            .catch(() => this.setData({ tState: 'error' }));
    },

    /* 列表不直接领取：先看交付物与要求再决定，避免占名额后交不出东西 */
    onOpenTask(e) {
        wx.navigateTo({
            url: '/pages/task-detail/task-detail?id=' + e.currentTarget.dataset.id,
        });
    },

    onRetryTask() {
        this.loadTasks();
    },
});
