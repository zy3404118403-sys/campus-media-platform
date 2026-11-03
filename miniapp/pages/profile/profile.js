const auth = require('../../utils/auth.js');
const mock = require('../../utils/mock.js');
const drafts = require('../../utils/drafts.js');

const GUEST_GROUPS = [
    {
        key: 'guest',
        items: [
            { key: 'login', text: '登录学号账号', hint: '查看个人数据' },
            { key: 'about', text: '关于平台', hint: '' },
        ],
    },
];

Page({
    data: {
        loggedIn: false,
        initial: '?',
        nameText: '未登录',
        metaText: '登录后可查看收藏、投稿与贡献值',
        subText: '登录学号账号后使用完整功能',
        stats: { favorites: 0, downloads: 0, uploads: 0, points: 0 },
        groups: GUEST_GROUPS,
        mockNote: '',
    },

    onShow() {
        this.refresh();
    },

    refresh() {
        const loggedIn = auth.isLoggedIn();
        const u = auth.getUser() || {};
        const name = String(u.name || '').trim();
        const mockNote = auth.isMock()
            ? '原型模式：未配置服务器地址，登录为本地模拟，不发网络请求。'
            : '';

        if (!loggedIn) {
            this.setData({
                loggedIn: false,
                initial: '?',
                nameText: '未登录',
                metaText: '登录后可查看收藏、投稿与贡献值',
                subText: '登录学号账号后使用完整功能',
                stats: { favorites: 0, downloads: 0, uploads: 0, points: 0 },
                groups: GUEST_GROUPS,
                mockNote: mockNote,
            });
            return;
        }

        const points = u.points || 0;
        const draftCount = drafts.count();
        // 管理入口只对管理员/审核员出现；普通成员看不到，避免点了被拒
        const showAdmin = auth.canReview();
        const pending = mock.reviewQueue ? mock.reviewQueue.length : 0;
        const rank = u.rank || 0;
        const sid = String(u.sid || u.id || '');
        const college = String(u.college || '');

        // 未读数：让「消息/通知」入口自己说明有没有事，不用点进去才知道
        const unreadMsg = (mock.conversations || []).reduce((s, c) => s + (c.unread || 0), 0);
        const unreadNotice = (mock.notifications || []).filter((n) => !n.read).length;

        this.setData({
            loggedIn: true,
            initial: name ? name.slice(0, 1) : '?',
            nameText: name || '未设置昵称',
            metaText: (sid ? sid : '—') + (college ? ' · ' + college : ''),
            subText: '贡献值 ' + (rank ? rank + ' 名' : '—') + ' · 累计 ' + points + ' 分',
            stats: {
                favorites: u.stats ? u.stats.favorites || 0 : 0,
                downloads: u.stats ? u.stats.downloads || 0 : 0,
                uploads: u.stats ? u.stats.uploads || 0 : 0,
                points: points,
            },
            showAdmin: showAdmin,
            pendingCount: pending,
            groups: [
                {
                    key: 'social',
                    items: [
                        { key: 'messages', text: '消息', hint: unreadMsg > 0 ? unreadMsg + ' 条未读' : '' },
                        { key: 'notifications', text: '通知', hint: unreadNotice > 0 ? unreadNotice + ' 条未读' : '' },
                    ],
                },
                {
                    key: 'content',
                    items: [
                        { key: 'points', text: '贡献值中心', hint: points > 0 ? points + ' 分' : '' },
                        { key: 'graph', text: '内容关系', hint: '节点与关联' },
                        { key: 'uploadNew', text: '上传素材', hint: '投稿' },
                        { key: 'fav', text: '我的收藏', hint: '' },
                        { key: 'download', text: '我的下载', hint: '' },
                        { key: 'upload', text: '我的投稿', hint: '' },
                        { key: 'draft', text: '草稿箱', hint: draftCount > 0 ? draftCount + ' 份' : '' },
                    ],
                },
                {
                    key: 'account',
                    items: [
                        { key: 'settings', text: '账号设置', hint: '密码 · 两步验证' },
                        { key: 'about', text: '关于平台', hint: '' },
                    ],
                },
            ],
            mockNote: mockNote,
        });
    },

    onLogin() {
        auth.ensureLogin();
    },

    onLogout() {
        wx.showModal({
            title: '退出登录',
            content: '退出后需要重新登录才能查看个人数据。',
            confirmColor: '#d8b46a',
            success: (res) => {
                if (!res.confirm) return;
                auth.logout().then(() => {
                    wx.showToast({ title: '已退出', icon: 'none' });
                    this.refresh();
                });
            },
        });
    },

    onMenu(e) {
        const key = e.currentTarget.dataset.key;
        if (key === 'login') {
            this.onLogin();
            return;
        }
        const listMap = { fav: 'favorites', download: 'downloads', upload: 'uploads' };
        if (key === 'points') {
            wx.navigateTo({ url: '/pages/points/points' });
            return;
        }
        if (key === 'graph') {
            wx.navigateTo({ url: '/pages/graph/graph' });
            return;
        }
        if (key === 'draft') {
            wx.navigateTo({ url: '/pages/my-list/my-list?type=drafts' });
            return;
        }
        if (key === 'settings') {
            wx.navigateTo({ url: '/pages/settings/settings' });
            return;
        }
        if (key === 'admin') {
            wx.navigateTo({ url: '/pages/admin/admin' });
            return;
        }
        // 消息已是 tabBar 页：必须 switchTab，navigateTo 会失败
        if (key === 'messages') {
            wx.switchTab({ url: '/pages/messages/messages' });
            return;
        }
        const pageMap = {
            notifications: '/pages/notifications/notifications',
            uploadNew: '/pages/upload/upload',
        };
        if (pageMap[key]) {
            wx.navigateTo({ url: pageMap[key] });
            return;
        }
        if (listMap[key]) {
            wx.navigateTo({ url: '/pages/my-list/my-list?type=' + listMap[key] });
            return;
        }
        if (key === 'about') {
            wx.showModal({
                title: '关于平台',
                content: '芜宇乐的融媒体中心素材库。素材仅供校内教学与宣传使用，对外发布请注明来源。',
                showCancel: false,
                confirmColor: '#d8b46a',
            });
            return;
        }
        wx.showToast({ title: '该功能暂未接入', icon: 'none' });
    },

    /* 四格统计也可点进对应列表，符合「看到数字就想看明细」的直觉 */
    onStat(e) {
        if (!this.data.loggedIn) {
            this.onLogin();
            return;
        }
        const listMap = { fav: 'favorites', download: 'downloads', upload: 'uploads' };
        const type = listMap[e.currentTarget.dataset.key];
        if (type) wx.navigateTo({ url: '/pages/my-list/my-list?type=' + type });
    },
});
