/**
 * 管理后台 · 工作台
 *
 * 只保留手机上真会做的操作：审核、内容上下架、成员角色、发通知。
 * Web 后台另有「招新管理 / 审计日志 / 访问统计 / 媒体矩阵 / 文章工作台」，
 * 那些需要大表格与长流程，手机上做反而低效，故不搬 —— 页面底部如实写明。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');
const state = require('../../utils/state.js');

Page({
    data: {
        deny: false,
        roleText: '',
        isAdmin: false,
        kpi: { pending: 0, materials: 0, users: 0, offline: 0 },
        todos: [],
        entries: [],
    },

    onLoad() {
        this.load();
    },

    /* 审核完返回工作台，待审数要立刻变，所以 onShow 也读一遍 */
    onShow() {
        this.load();
    },

    load() {
        if (!auth.canReview()) {
            this.setData({ deny: true, roleText: mock.ROLE_TEXT[auth.role()] || '成员' });
            return;
        }

        const q = mock.reviewQueue;
        const isAdmin = auth.isAdmin();

        /* 含肖像风险的：取系统预检里提到「面孔」的条目。
           这类不能批量通过，必须逐条看。 */
        const portrait = q.filter((x) => (x.hints || []).join('').indexOf('面孔') > -1).length;
        const restricted = mock.adminUsers.filter((u) => u.status !== '正常').length;
        /* 草稿只是暂存，不进 C 端；这里数出来提醒管理员别写完忘了发 */
        const draftTotal =
            mock.activities.filter((a) => a.state === '草稿').length +
            mock.tasks.filter((t) => t.state === '草稿').length;

        this.setData({
            deny: false,
            isAdmin: isAdmin,
            roleText: mock.ROLE_TEXT[auth.role()] || '成员',
            kpi: {
                pending: q.length,
                materials: mock.materials.length,
                /* 与贡献值页共用同一个「开通账号」数，不另造一个 466 */
                users: mock.pointOverview.totalUsers,
                offline: state.readList(state.KEY.offline).length,
            },
            todos: [
                { key: 'queue', label: '待审素材', n: q.length, url: '/pages/admin-review/admin-review' },
                {
                    key: 'draft',
                    label: '活动 / 任务草稿待发布',
                    n: draftTotal,
                    url: '/pages/admin-items/admin-items',
                },
                {
                    key: 'portrait',
                    label: '含肖像风险，需逐条确认',
                    n: portrait,
                    url: '/pages/admin-review/admin-review?risk=1',
                },
                { key: 'restricted', label: '被限制上传的成员', n: restricted, url: '/pages/admin-users/admin-users' },
            ],
            entries: [
                {
                    key: 'review',
                    t: '审核队列',
                    s: '通过 / 退回，退回须填原因',
                    url: '/pages/admin-review/admin-review',
                    off: false,
                },
                {
                    key: 'materials',
                    t: '内容管理',
                    s: '精选与下架，下架后前台不再显示',
                    url: '/pages/admin-materials/admin-materials',
                    off: !isAdmin,
                },
                {
                    key: 'users',
                    t: '成员管理',
                    s: '角色与上传限制',
                    url: '/pages/admin-users/admin-users',
                    off: !isAdmin,
                },
                {
                    key: 'activities',
                    t: '活动管理',
                    s: '发布 / 结束，看报名情况',
                    url: '/pages/admin-items/admin-items?kind=activity',
                    off: !isAdmin,
                },
                {
                    key: 'tasks',
                    t: '任务管理',
                    s: '发布 / 截止，看领取情况',
                    url: '/pages/admin-items/admin-items?kind=task',
                    off: !isAdmin,
                },
                {
                    key: 'notice',
                    t: '通知发布',
                    s: '按全员或指定学院推送',
                    url: '/pages/admin-notice/admin-notice',
                    off: !isAdmin,
                },
            ],
        });
    },

    onEntry(e) {
        const item = this.data.entries[e.currentTarget.dataset.i];
        if (!item) return;
        if (item.off) {
            wx.showToast({ title: '该模块仅管理员可用', icon: 'none' });
            return;
        }
        wx.navigateTo({ url: item.url });
    },

    onTodo(e) {
        const item = this.data.todos[e.currentTarget.dataset.i];
        if (!item || !item.n) {
            wx.showToast({ title: '暂时没有待办', icon: 'none' });
            return;
        }
        wx.navigateTo({ url: item.url });
    },
});
