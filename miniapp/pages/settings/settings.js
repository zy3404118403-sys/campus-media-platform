/**
 * 账号设置
 *   个人资料（只读）· 修改密码 · 两步验证状态 · 退出登录
 *
 * 为什么单独做一页：原来「我的」里「两步验证」标着「未接入」，点了只弹一句
 * 「该功能暂未接入」，而改密码这件事在小程序里根本没有入口 —— 用户只能去找管理员。
 * 账号类操作是「这个产品是否完整」的直觉判断点，缺了显得是个半成品。
 */
const auth = require('../../utils/auth.js');
const mock = require('../../utils/mock.js');

/* 密码规则与服务端保持一致：至少 8 位，且字母数字都要有 */
function checkPwd(p) {
    if (!p) return '请输入新密码';
    if (p.length < 8) return '密码至少 8 位';
    if (!/[a-zA-Z]/.test(p)) return '密码需包含字母';
    if (!/[0-9]/.test(p)) return '密码需包含数字';
    return '';
}

Page({
    data: {
        loggedIn: false,
        name: '',
        initial: '?',
        sid: '',
        college: '',
        role: '普通成员', // 实际值在 refresh 里按 auth.role() 覆盖

        /* 修改密码表单 */
        openPwd: false,
        oldPwd: '',
        newPwd: '',
        againPwd: '',
        pwdErr: '',
        pwdBusy: false,
        pwdDone: false,

        /* 两步验证 */
        twoFA: false,
        twoFAText: '未开启',

        mockNote: '',
    },

    onLoad() {
        this.refresh();
    },

    onShow() {
        this.refresh();
    },

    refresh() {
        const loggedIn = auth.isLoggedIn();
        const u = auth.getUser() || {};
        const name = String(u.name || '').trim();

        this.setData({
            loggedIn: loggedIn,
            name: name || '未登录',
            initial: name ? name.slice(0, 1) : '?',
            sid: u.sid || u.id || '—',
            college: u.college || mock.profile.college,
            role: mock.ROLE_TEXT[auth.role()] || '普通成员',
            twoFA: !!(u && u.twoFA),
            twoFAText: u && u.twoFA ? '已开启' : '未开启',
            mockNote: auth.isMock()
                ? '原型模式：以下为交互演示，修改不会同步到服务器。'
                : '',
        });
    },

    /* ── 修改密码 ── */
    onTogglePwd() {
        if (!auth.isLoggedIn()) {
            auth.ensureLogin();
            return;
        }
        this.setData({
            openPwd: !this.data.openPwd,
            oldPwd: '',
            newPwd: '',
            againPwd: '',
            pwdErr: '',
            pwdDone: false,
        });
    },

    onOld(e) {
        this.setData({ oldPwd: e.detail.value, pwdErr: '' });
    },

    onNew(e) {
        this.setData({ newPwd: e.detail.value, pwdErr: '' });
    },

    onAgain(e) {
        this.setData({ againPwd: e.detail.value, pwdErr: '' });
    },

    onSubmitPwd() {
        const d = this.data;
        if (d.pwdBusy) return;

        if (!d.oldPwd) return this.setData({ pwdErr: '请输入当前密码' });
        const e1 = checkPwd(d.newPwd);
        if (e1) return this.setData({ pwdErr: e1 });
        if (d.newPwd !== d.againPwd) return this.setData({ pwdErr: '两次输入的新密码不一致' });
        if (d.newPwd === d.oldPwd) return this.setData({ pwdErr: '新密码不能与当前密码相同' });

        // 原型不校验原密码正确性（本地无凭据），只走一遍交互与提示
        this.setData({ pwdBusy: true, pwdErr: '' });
        mock.delay(520).then(() => {
            this.setData({
                pwdBusy: false,
                pwdDone: true,
                oldPwd: '',
                newPwd: '',
                againPwd: '',
            });
            wx.showToast({ title: '密码已更新', icon: 'success' });
        });
    },

    /* ── 两步验证 ── */
    onTwoFA() {
        if (this.data.twoFA) {
            wx.showModal({
                title: '两步验证已开启',
                content: '关闭或重置两步验证需要管理员在网页端后台操作，小程序端不提供降级入口。',
                showCancel: false,
                confirmColor: '#d8b46a',
            });
            return;
        }
        wx.showModal({
            title: '在网页端开启',
            content:
                '两步验证需要扫描二维码绑定身份验证器，小程序内无法完成扫码绑定。请用电脑打开网页端，在「账号安全」里开启。',
            confirmText: '知道了',
            showCancel: false,
            confirmColor: '#d8b46a',
        });
    },

    /* ── 退出 ── */
    onLogout() {
        wx.showModal({
            title: '退出登录',
            content: '退出后需要重新登录才能查看个人数据。',
            confirmColor: '#d8b46a',
            success: (res) => {
                if (!res.confirm) return;
                auth.logout().then(() => {
                    wx.showToast({ title: '已退出', icon: 'success' });
                    setTimeout(() => {
                        wx.switchTab({ url: '/pages/profile/profile' });
                    }, 520);
                });
            },
        });
    },

    onLogin() {
        auth.ensureLogin();
    },
});
