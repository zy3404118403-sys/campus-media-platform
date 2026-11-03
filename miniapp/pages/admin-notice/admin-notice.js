/**
 * 管理后台 · 通知发布
 *
 * 一条通知两条约束：
 *   ① 标题与正文都要校验，且实时显示字数 —— 超长会在服务端被截断，不如提前拦住
 *   ② 发送前必须二次确认并显示触达人数 —— 发错范围无法撤回，只能再发一条澄清
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');

const TITLE_MAX = 40;
const BODY_MAX = 200;

Page({
    data: {
        deny: false,
        title: '',
        body: '',
        /* 范围选择：全体成员是一个按钮，学院/部门是一个可展开列表。
           原来把 7 个选项平铺成横向胶囊，一屏放不下、右侧被截断，
           而且「全体」和具体学院是两个层级，混在一排里看不出从属关系。 */
        allCount: 0,
        colleges: [],
        scopeMode: 'all', // all | college
        collegeIndex: 0,
        pickerOpen: false,
        scopeName: '全体成员',
        reach: 0,
        titleMax: TITLE_MAX,
        bodyMax: BODY_MAX,
        bodyLen: 0,
        err: '',
        busy: false,
        notices: [],
    },

    onLoad() {
        if (!auth.isAdmin()) {
            this.setData({ deny: true });
            return;
        }
        const all = mock.pointOverview.totalUsers;
        this.setData({
            allCount: all,
            colleges: mock.collegeUsers.slice(),
            scopeMode: 'all',
            collegeIndex: 0,
            scopeName: '全体成员',
            reach: all,
        });
        this.loadNotices();
    },

    onShow() {
        if (!this.data.deny) this.loadNotices();
    },

    loadNotices() {
        /* 百分比在 JS 里算好：WXML 的表达式不支持 toFixed 这类方法调用 */
        this.setData({
            notices: mock.adminNotices.map((n) => ({
                id: n.id,
                title: n.title,
                scope: n.scope,
                at: n.at,
                read: n.read,
                total: n.total,
                pct: n.total ? Math.round((n.read / n.total) * 100) : 0,
            })),
        });
    },

    onTitle(e) {
        this.setData({ title: e.detail.value, err: '' });
    },

    onBody(e) {
        const v = e.detail.value;
        this.setData({ body: v, bodyLen: v.length, err: '' });
    },

    /* 选「全体成员」：直接生效，顺手收起展开栏 */
    onPickAll() {
        this.setData({
            scopeMode: 'all',
            scopeName: '全体成员',
            reach: this.data.allCount,
            pickerOpen: false,
            err: '',
        });
    },

    onTogglePicker() {
        this.setData({ pickerOpen: !this.data.pickerOpen });
    },

    onPickCollege(e) {
        const i = Number(e.currentTarget.dataset.i);
        const c = this.data.colleges[i];
        if (!c) return;
        this.setData({
            scopeMode: 'college',
            collegeIndex: i,
            scopeName: c.name,
            reach: c.n,
            pickerOpen: false,
            err: '',
        });
    },

    onSend() {
        const d = this.data;
        if (d.busy) return;

        const title = String(d.title).trim();
        const body = String(d.body).trim();
        if (title.length < 4) return this.setData({ err: '标题至少 4 个字，写清这条通知关于什么' });
        if (title.length > TITLE_MAX) return this.setData({ err: '标题超过 ' + TITLE_MAX + ' 字，服务端会截断' });
        if (body.length < 10) return this.setData({ err: '正文至少 10 个字，避免"见附件"这类空通知' });
        if (body.length > BODY_MAX) return this.setData({ err: '正文超过 ' + BODY_MAX + ' 字，请精简或改为公告链接' });

        const scope = { name: d.scopeName, n: d.reach };

        wx.showModal({
            title: '确认发送',
            content:
                '发送范围：' + scope.name + '（' + scope.n + ' 人）\n发送后无法撤回，只能再发一条说明。',
            confirmText: '发送',
            confirmColor: '#d8b46a',
            success: (res) => {
                if (!res.confirm) return;
                this.doSend(title, body, scope);
            },
        });
    },

    doSend(title, body, scope) {
        this.setData({ busy: true });

        mock.delay(420).then(() => {
            const now = new Date();
            const pad = (n) => (n < 10 ? '0' + n : String(n));

            /* 新通知插到最前，并把「已发布通知」列表一起刷新 */
            mock.adminNotices.unshift({
                id: Date.now(),
                title: title,
                scope: scope.name,
                at: pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()),
                read: 0,
                total: scope.n,
            });

            this.setData({
                busy: false,
                title: '',
                body: '',
                bodyLen: 0,
                err: '',
                /* 发完回到默认范围，避免下一条误发给上次选的学院 */
                scopeMode: 'all',
                scopeName: '全体成员',
                reach: this.data.allCount,
                pickerOpen: false,
            });
            this.loadNotices();
            wx.showToast({ title: '已发送', icon: 'success' });
        });
    },

    onNotice(e) {
        const i = Number(e.currentTarget.dataset.i);
        const n = this.data.notices[i];
        if (!n) return;
        const pct = n.total ? Math.round((n.read / n.total) * 100) : 0;
        wx.showModal({
            title: n.title,
            content:
                '范围：' + n.scope + '\n发送：' + n.at + '\n已读 ' + n.read + ' / ' + n.total + '（' + pct + '%）',
            showCancel: false,
            confirmColor: '#d8b46a',
        });
    },
});
