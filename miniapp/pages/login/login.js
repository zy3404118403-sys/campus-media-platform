const auth = require('../../utils/auth.js');

Page({
    data: {
        step: 'pwd',
        sid: '',
        pwd: '',
        code: '',
        challenge: '',
        showPwd: false,
        loading: false,
        error: '',
        mock: false,
        redirect: '',
    },

    onLoad(query) {
        let redirect = '';
        if (query && query.redirect) {
            try {
                redirect = decodeURIComponent(query.redirect);
            } catch (e) {
                redirect = '';
            }
        }
        this.setData({ mock: auth.isMock(), redirect: redirect });
    },

    /* ── 输入（错误时不清空，只取消高亮）── */
    onSid(e) {
        this.setData({ sid: e.detail.value, error: '' });
    },

    onPwd(e) {
        this.setData({ pwd: e.detail.value, error: '' });
    },

    onCode(e) {
        this.setData({ code: e.detail.value, error: '' });
    },

    onTogglePwd() {
        this.setData({ showPwd: !this.data.showPwd });
    },

    /* ── 第一步登录 ── */
    onSubmit() {
        if (this.data.loading) return;
        this.setData({ loading: true, error: '' });

        auth
            .login(this.data.sid, this.data.pwd)
            .then(() => this.finish())
            .catch((err) => {
                if (err && err.code === 'NEED_2FA') {
                    this.setData({
                        loading: false,
                        step: '2fa',
                        challenge: err.challenge || '',
                        code: '',
                        error: '',
                    });
                    return;
                }
                this.setData({ loading: false, error: (err && err.message) || '登录失败，请稍后重试' });
            });
    },

    /* ── 第二步验证 ── */
    onVerify() {
        if (this.data.loading) return;
        this.setData({ loading: true, error: '' });

        auth
            .login2fa(this.data.challenge, this.data.code)
            .then(() => this.finish())
            .catch((err) => {
                this.setData({ loading: false, error: (err && err.message) || '验证失败，请重试' });
            });
    },

    onBackStep() {
        this.setData({ step: 'pwd', challenge: '', code: '', error: '' });
    },

    finish() {
        this.setData({ loading: false });
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => {
            const redirect = this.data.redirect;
            if (redirect) {
                wx.redirectTo({
                    url: redirect,
                    fail: () => wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/index/index' }) }),
                });
                return;
            }
            wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/index/index' }) });
        }, 600);
    },

    onGuest() {
        wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/index/index' }) });
    },
});
