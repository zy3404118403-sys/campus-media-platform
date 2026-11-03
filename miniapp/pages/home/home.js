const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');
const state = require('../../utils/state.js');

const QUICK = [
    { key: 'library', text: '素材库', sub: '全部素材', ico: 'ico-image', tone: 'q-1' },
    { key: 'topic', text: '专题', sub: '编辑策展', ico: 'ico-layers', tone: 'q-2' },
    { key: 'activity', text: '活动', sub: '报名签到', ico: 'ico-clock', tone: 'q-3' },
    { key: 'task', text: '任务', sub: '领取成果', ico: 'ico-award', tone: 'q-4' },
];

function greeting() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 12) return '早上好';
    if (h < 18) return '下午好';
    return '晚上好';
}

Page({
    data: {
        state: 'loading',
        hello: '',
        stats: { materials: 0, collections: 0, tasks: 0, activities: 0 },
        quick: QUICK,
        featured: [],
        latest: [],
        posts: [],
        activities: [],
        tasks: [],
        collections: [],
    },

    onLoad() {
        this.load();
    },

    onShow() {
        const u = auth.getUser();
        const name = u && u.name ? u.name : '';
        this.setData({ hello: greeting() + (name ? '，' + name : '') });
    },

    load() {
        this.setData({ state: 'loading' });
        // 返回 Promise：下拉刷新要用它决定何时 stopPullDownRefresh
        return mock
            .delay(340)
            .then(() => {
                /* 已下架的素材不进首页精选与最新列表 */
                const materials = state.hideOffline(mock.materials.slice());
                // 精选：按下载量取前 3
                const featured = materials
                    .slice()
                    .sort((a, b) => b.downloads - a.downloads)
                    .slice(0, 3);
                // 最新：取前 4（真实接口按 created_at 倒序）
                const latest = materials.slice(0, 4);

                this.setData({
                    state: 'ready',
                    featured: featured,
                    latest: latest,
                    posts: mock.blogPosts.slice(0, 2),
                    activities: mock.publicActivities().slice(0, 2),
                    tasks: mock.publicTasks().slice(0, 2),
                    collections: mock.collections,
                    stats: {
                        materials: materials.length,
                        collections: mock.collections.length,
                        tasks: mock.publicTasks().length,
                        activities: mock.publicActivities().length,
                    },
                });
            })
            .catch(() => this.setData({ state: 'error' }));
    },

    onRetry() {
        this.load();
    },

    /* home.json 开了 enablePullDownRefresh，必须有对应处理并显式收尾，
       否则下拉后刷新动画会一直转（且 onReachBottom 的延迟回调也可能打到已重置的列表） */
    onPullDownRefresh() {
        this.load().then(() => wx.stopPullDownRefresh());
    },

    onSearch() {
        wx.navigateTo({ url: '/pages/search/search' });
    },

    onQuick(e) {
        const key = e.currentTarget.dataset.key;
        if (key === 'library') {
            wx.switchTab({ url: '/pages/index/index' });
            return;
        }
        if (key === 'topic') {
            wx.navigateTo({ url: '/pages/articles/articles' });
            return;
        }
        if (key === 'activity') {
            wx.setStorageSync('itemsTab', 'activity');
            wx.switchTab({ url: '/pages/items/items' });
            return;
        }
        if (key === 'task') {
            wx.setStorageSync('itemsTab', 'task');
            wx.switchTab({ url: '/pages/items/items' });
        }
    },

    onMaterial(e) {
        wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
    },

    onAllMaterials() {
        wx.switchTab({ url: '/pages/index/index' });
    },

    onAllActivities() {
        wx.setStorageSync('itemsTab', 'activity');
        wx.switchTab({ url: '/pages/items/items' });
    },

    onAllTasks() {
        wx.setStorageSync('itemsTab', 'task');
        wx.switchTab({ url: '/pages/items/items' });
    },

    onAllArticles() {
        wx.navigateTo({ url: '/pages/articles/articles' });
    },

    onCommunity() {
        wx.navigateTo({ url: '/pages/community/community' });
    },

    onPost(e) {
        wx.navigateTo({
            url: '/pages/post-detail/post-detail?type=blog&id=' + e.currentTarget.dataset.id,
        });
    },
});
