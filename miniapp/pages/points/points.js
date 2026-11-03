const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');

Page({
    data: {
        state: 'loading',
        ov: {},
        rules: [],
        rank: [],
        logs: [],
        pct: 0,
        gap: 0,
    },

    onLoad() {
        this.load();
    },

    onShow() {
        // 从任务/上传页回来，贡献值可能有变化，静默刷新
        if (this.data.state === 'ready') this.load();
    },

    load() {
        if (!auth.isLoggedIn()) {
            this.setData({ state: 'guest' });
            return Promise.resolve();
        }
        this.setData({ state: 'loading' });
        return mock
            .delay(320)
            .then(() => {
                const ov = mock.pointOverview;
                const gap = Math.max(0, ov.nextLevel - ov.total);
                // 进度按「距下一档」的比例算，而不是除以一个虚的总数
                const pct = ov.nextLevel > 0
                    ? Math.min(100, Math.round((ov.total / ov.nextLevel) * 100))
                    : 100;
                this.setData({
                    state: 'ready',
                    ov: ov,
                    rules: mock.pointRules,
                    rank: mock.pointRank,
                    logs: mock.pointLogs,
                    pct: pct,
                    gap: gap,
                });
                wx.setNavigationBarTitle({ title: '贡献值' });
            })
            .catch(() => this.setData({ state: 'error' }));
    },

    onLogin() {
        auth.ensureLogin();
    },

    onRetry() {
        this.load();
    },
});
