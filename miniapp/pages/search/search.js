const mock = require('../../utils/mock.js');

const HIST_KEY = 'cm_search_hist';
const HIST_MAX = 8;
const HOT = ['迎新晚会', '校运会', '三下乡', '银杏', '教师节'];

Page({
    data: {
        keyword: '',
        history: [],
        hot: HOT,
        results: [],
        state: 'idle',
        autoFocus: true,
    },

    onLoad() {
        this._timer = null;
        // 请求序号：清空/重新搜索时 +1，让在途的旧结果作废。
        // 否则输入后 280ms 内点 ✕ 清空，旧结果会在之后回填到空列表里。
        this._seq = 0;
        this.loadHistory();
    },

    onUnload() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    },

    loadHistory() {
        let list = [];
        try {
            list = wx.getStorageSync(HIST_KEY) || [];
        } catch (e) {
            list = [];
        }
        this.setData({ history: Array.isArray(list) ? list : [] });
    },

    saveHistory(kw) {
        const k = String(kw || '').trim();
        if (!k) return;
        let list = this.data.history.filter((x) => x !== k);
        list.unshift(k);
        if (list.length > HIST_MAX) list = list.slice(0, HIST_MAX);
        try {
            wx.setStorageSync(HIST_KEY, list);
        } catch (e) {
            /* 存储失败不影响搜索 */
        }
        this.setData({ history: list });
    },

    onInput(e) {
        const kw = e.detail.value;
        this.setData({ keyword: kw });
        // 300ms 防抖，避免逐字触发搜索
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(() => this.run(kw, false), 300);
    },

    onConfirm(e) {
        this.run(e.detail.value, true);
    },

    onHit(e) {
        const kw = e.currentTarget.dataset.k;
        this.setData({ keyword: kw });
        this.run(kw, true);
    },

    onClear() {
        if (this._timer) clearTimeout(this._timer);
        this._seq++; // 作废在途请求
        this.setData({ keyword: '', results: [], state: 'idle' });
    },

    onClearHistory() {
        try {
            wx.removeStorageSync(HIST_KEY);
        } catch (e) {}
        this.setData({ history: [] });
    },

    run(kwRaw, remember) {
        const kw = String(kwRaw || '').trim();
        const seq = ++this._seq;
        if (!kw) {
            this.setData({ state: 'idle', results: [] });
            return;
        }
        if (remember) this.saveHistory(kw);

        this.setData({ state: 'loading' });
        const k = kw.toLowerCase();
        mock
            .delay(280)
            .then(() => {
                if (seq !== this._seq) return; // 期间已清空或另发了一次搜索
                const results = mock.materials.filter((it) => {
                    const hay = (it.title + ' ' + it.college + ' ' + it.type + ' ' + it.tags.join(' ')).toLowerCase();
                    return hay.indexOf(k) > -1;
                });
                this.setData({ state: results.length ? 'ready' : 'empty', results: results });
            })
            .catch(() => {
                if (seq !== this._seq) return;
                this.setData({ state: 'empty', results: [] });
            });
    },

    onTap(e) {
        wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id });
    },
});
