const mock = require('../../utils/mock.js');

Page({
    data: {
        state: 'loading',
        collections: [],
        articles: [],
    },

    onLoad() {
        this.load();
    },

    load() {
        this.setData({ state: 'loading' });
        mock
            .delay(300)
            .then(() => {
                this.setData({
                    state: mock.articles.length ? 'ready' : 'empty',
                    collections: mock.collections,
                    articles: mock.articles,
                });
            })
            .catch(() => this.setData({ state: 'error' }));
    },

    onTapArticle(e) {
        wx.navigateTo({ url: '/pages/article/article?id=' + e.currentTarget.dataset.id });
    },

    onRetry() {
        this.load();
    },
});
