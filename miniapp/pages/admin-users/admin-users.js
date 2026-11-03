/**
 * 管理后台 · 成员管理
 *
 * 两条红线写死在代码里：
 *   ① 学号只从数据层的 sidMask 取，页面没有任何「查看完整学号」的入口
 *      （Web 后台那张用户表曾完整露出 13 位真实学号，截图外流风险极高）
 *   ② 不能修改自己的角色 —— 否则管理员把自己降成成员就再没人能进后台
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');

const FILTERS = ['全部', '管理员', '审核员', '成员'];

Page({
    data: {
        deny: false,
        filters: FILTERS,
        filter: '全部',
        keyword: '',
        list: [],
        total: 0,
        roleCount: { admin: 0, reviewer: 0, member: 0 },
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
        const me = (auth.getUser() || {}).name;

        let list = mock.adminUsers.slice();
        if (f !== '全部') list = list.filter((u) => mock.ROLE_TEXT[u.role] === f);
        if (kw) {
            const k = kw.toLowerCase();
            list = list.filter((u) => (u.name + u.college + u.sidMask).toLowerCase().indexOf(k) > -1);
        }

        const count = { admin: 0, reviewer: 0, member: 0 };
        mock.adminUsers.forEach((u) => {
            count[u.role] = (count[u.role] || 0) + 1;
        });

        this.setData({
            list: list.map((u) => ({
                id: u.id,
                name: u.name,
                sidMask: u.sidMask,
                college: u.college,
                role: u.role,
                roleText: mock.ROLE_TEXT[u.role] || '成员',
                status: u.status,
                uploads: u.uploads,
                isMe: u.name === me,
            })),
            total: list.length,
            roleCount: count,
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

    /* 点开某个人：用 ActionSheet 给可选操作，避免列表里堆四个按钮 */
    onMember(e) {
        const id = Number(e.currentTarget.dataset.id);
        const u = mock.adminUsers.filter((x) => x.id === id)[0];
        if (!u) return;

        if (u.name === (auth.getUser() || {}).name) {
            wx.showModal({
                title: '不能修改自己',
                content: '管理员不能改自己的角色或限制自己上传，避免误操作后没人能进后台。如需变更，请让另一位管理员处理。',
                showCancel: false,
                confirmColor: '#d8b46a',
            });
            return;
        }

        const limited = u.status !== '正常';
        const actions = ['设为管理员', '设为审核员', '设为成员', limited ? '解除上传限制' : '限制上传'];
        wx.showActionSheet({
            itemList: actions,
            success: (res) => {
                const pick = actions[res.tapIndex];
                if (pick === '解除上传限制' || pick === '限制上传') {
                    u.status = limited ? '正常' : '限制上传';
                    wx.showToast({ title: limited ? '已解除限制' : '已限制上传', icon: 'none' });
                    this.load();
                    return;
                }
                const map = { 设为管理员: 'admin', 设为审核员: 'reviewer', 设为成员: 'member' };
                const role = map[pick];
                if (role === 'member' && u.role === 'admin') {
                    wx.showModal({
                        title: '降级管理员？',
                        content: u.name + ' 将失去全部管理权限，仅保留普通成员的功能。',
                        confirmText: '确认降级',
                        confirmColor: '#d8636e',
                        success: (r) => {
                            if (!r.confirm) return;
                            u.role = 'member';
                            wx.showToast({ title: '已设为成员', icon: 'none' });
                            this.load();
                        },
                    });
                    return;
                }
                u.role = role;
                wx.showToast({ title: '已设为' + mock.ROLE_TEXT[role], icon: 'none' });
                this.load();
            },
            fail: () => {},
        });
    },
});
