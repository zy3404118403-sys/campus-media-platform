const mock = require('../../utils/mock.js');
const state = require('../../utils/state.js');

/* 瀑布流是两列，一批 4 条只出 2 行，24 条素材要连点 6 次「加载更多」——
   改成 8 条一批（4 行），仍是增量渲染，但不用点到手酸。 */
const PAGE_SIZE = 8;

Page({
    data: {
        state: 'loading',
        keyword: '',
        filter: '全部',
        // 平台支持三类素材（见上传页 TYPES），筛选器必须给齐，否则文档类只能从「全部」里找
        filters: ['全部', '视频', '图片', '文档'],
        subtitle: '',
        left: [],
        right: [],
        shown: 0,
        total: 0,
        hasMore: false,
        loadingMore: false,
    },

    onLoad() {
        this._timer = null;
        this._list = [];
        this._cursor = 0;
        // 代际编号：重置（刷新/筛选/搜索）时 +1，用来作废在途的异步回调。
        // 否则「翻页的 260ms 延迟」与「下拉刷新的 cursor 归零」会交叉，
        // 结果是刷新后第一页被跳过、副标题却显示已显示 8 条。
        this._gen = 0;
        this.load();
    },

    onUnload() {
        // 页面销毁时清理定时器，避免防抖回调打到已销毁的页面
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    },

    /* ── 数据加载 ── */
    load() {
        const gen = ++this._gen;
        this._cursor = 0;
        this.setData({ state: 'loading', left: [], right: [], shown: 0 });
        return mock
            .delay(360)
            .then(() => {
                if (gen !== this._gen) return; // 期间又重置过，这次结果作废
                this._list = this.filter();
                this.render(false);
            })
            .catch(() => {
                if (gen !== this._gen) return;
                this.setData({ state: 'error' });
            });
    },

    filter() {
        const kw = String(this.data.keyword || '').trim().toLowerCase();
        const f = this.data.filter;

        /* 管理员在内容管理里下架的素材，前台一律不出现 */
        let list = state.hideOffline(mock.materials.slice());
        if (f !== '全部') {
            list = list.filter((it) => it.type === f);
        }
        if (kw) {
            list = list.filter((it) => {
                const hay = (it.title + ' ' + it.college + ' ' + it.tags.join(' ')).toLowerCase();
                return hay.indexOf(kw) > -1;
            });
        }
        return list;
    },

    /* 双列瀑布流按全局序号交替入列，分页追加时不能重置奇偶 */
    render(append) {
        const slice = this._list.slice(this._cursor, this._cursor + PAGE_SIZE);
        const left = append ? this.data.left.slice() : [];
        const right = append ? this.data.right.slice() : [];

        slice.forEach((it, i) => {
            const globalIndex = this._cursor + i;
            (globalIndex % 2 === 0 ? left : right).push(it);
        });

        this._cursor += slice.length;
        const total = this._list.length;

        this.setData({
            left: left,
            right: right,
            shown: this._cursor,
            total: total,
            hasMore: this._cursor < total,
            loadingMore: false,
            state: total ? 'ready' : 'empty',
            subtitle: total
                ? '共 ' + total + ' 条 · 已显示 ' + this._cursor + ' 条'
                : '当前条件下暂无结果',
        });
    },

    /* ── 交互 ── */
    onInput(e) {
        this.setData({ keyword: e.detail.value });
        // 300ms 防抖，避免每敲一个字就重算一次
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(() => {
            this._gen++; // 作废在途的翻页/刷新回调
            this._list = this.filter();
            this._cursor = 0;
            this.render(false);
        }, 300);
    },

    onFilter(e) {
        if (this._timer) clearTimeout(this._timer);
        this._gen++;
        this.setData({ filter: e.currentTarget.dataset.v });
        this._list = this.filter();
        this._cursor = 0;
        this.render(false);
    },

    onReset() {
        if (this._timer) clearTimeout(this._timer);
        this._gen++;
        this.setData({ keyword: '', filter: '全部' });
        this._list = this.filter();
        this._cursor = 0;
        this.render(false);
    },

    onReachBottom() {
        if (!this.data.hasMore || this.data.loadingMore) return;
        const gen = this._gen;
        this.setData({ loadingMore: true });
        mock.delay(260).then(() => {
            if (gen !== this._gen) return; // 期间重置过，丢弃这次翻页
            this.render(true);
        });
    },

    onLoadMoreTap() {
        this.onReachBottom();
    },

    onPullDownRefresh() {
        this.load().then(() => wx.stopPullDownRefresh());
    },

    onTap(e) {
        wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
    },

    onRetry() {
        this.load();
    },
});
