/**
 * 管理后台 · 事项管理（活动 / 任务）
 *
 * 与 C 端的差别只有一处：这里能看到**草稿**。
 * 「发布」不是打个标，而是真的让条目出现在 C 端事项页与首页 ——
 * 状态机在 utils/admin-ops.js，页面只负责确认与提示。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');
const ops = require('../../utils/admin-ops.js');

Page({
    data: {
        deny: false,
        kind: 'activity', // activity | task
        list: [],
        draftCount: 0,
        openCount: 0,
        endCount: 0,
    },

    onLoad(query) {
        if (!auth.isAdmin()) {
            this.setData({ deny: true });
            return;
        }
        if (query && query.kind === 'task') this.setData({ kind: 'task' });
        this.load();
    },

    onShow() {
        if (!this.data.deny) this.load();
    },

    load() {
        const isAct = this.data.kind === 'activity';
        const D = isAct ? ops.ACT : ops.TASK;
        const src = isAct ? mock.activities : mock.tasks;

        const list = src.map((it) => {
            const draft = it.state === D.DRAFT;
            const ended = it.state === D.END;
            return {
                id: it.id,
                title: it.title,
                state: it.state,
                stateCls: draft || ended ? 'pill-mute' : 'pill-ok',
                draft: draft,
                ended: ended,
                /* 有报名的活动 / 有人领的任务不能直接删，后端也会拒 */
                locked: isAct ? Number(it.joined) > 0 : Number(it.claimedCount) > 0,
                joinText: isAct ? it.joined + ' 人报名' : it.claimedCount + ' 人领取',
                meta: isAct
                    ? '报名 ' + it.joined + '/' + it.capacity + ' · ' + (it.deadline || '无截止')
                    : it.type + ' · ' + it.points + ' 贡献值 · 已领 ' + it.claimedCount,
                sub: isAct ? it.place + ' · ' + it.time : '截止 ' + (it.deadline || '未设置'),
            };
        });

        this.setData({
            list: list,
            draftCount: list.filter((x) => x.draft).length,
            openCount: list.filter((x) => !x.draft && !x.ended).length,
            endCount: list.filter((x) => x.ended).length,
        });
    },

    onSeg(e) {
        const kind = e.currentTarget.dataset.kind;
        if (kind === this.data.kind) return;
        this.setData({ kind: kind });
        this.load();
    },

    onNew() {
        wx.navigateTo({ url: '/pages/admin-item-edit/admin-item-edit?kind=' + this.data.kind });
    },

    onEdit(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: '/pages/admin-item-edit/admin-item-edit?kind=' + this.data.kind + '&id=' + id,
        });
    },

    /* ── 发布 ── */
    onPublish(e) {
        const id = Number(e.currentTarget.dataset.id);
        const isAct = this.data.kind === 'activity';
        const item = this.data.list.filter((x) => x.id === id)[0];
        if (!item) return;

        wx.showModal({
            title: '发布这条' + (isAct ? '活动' : '任务') + '？',
            content: '发布后立刻出现在 C 端「事项」页' + (isAct ? '，同学可以报名' : '，同学可以领取') + '。',
            confirmText: '发布',
            confirmColor: '#d8b46a',
            success: (res) => {
                if (!res.confirm) return;
                const okv = isAct ? ops.publishActivity(id) : ops.publishTask(id);
                wx.showToast({ title: okv ? '已发布' : '状态已变化，请刷新', icon: okv ? 'success' : 'none' });
                this.load();
            },
        });
    },

    /* ── 结束 ── */
    onClose(e) {
        const id = Number(e.currentTarget.dataset.id);
        const isAct = this.data.kind === 'activity';
        wx.showModal({
            title: '结束' + (isAct ? '活动' : '任务') + '？',
            content: '结束后不再接受新的' + (isAct ? '报名' : '领取') + '，已有记录保留。此操作不可撤销。',
            confirmText: '结束',
            confirmColor: '#d8636e',
            success: (res) => {
                if (!res.confirm) return;
                const okv = isAct ? ops.closeActivity(id) : ops.closeTask(id);
                wx.showToast({ title: okv ? '已结束' : '状态已变化，请刷新', icon: okv ? 'success' : 'none' });
                this.load();
            },
        });
    },

    /* ── 删除 ── */
    onRemove(e) {
        const id = Number(e.currentTarget.dataset.id);
        const isAct = this.data.kind === 'activity';
        const item = this.data.list.filter((x) => x.id === id)[0];
        if (!item) return;

        if (item.locked) {
            wx.showModal({
                title: '不能删除',
                content:
                    '该' + (isAct ? '活动' : '任务') + '已有 ' + item.joinText + '，删除会让这些记录指向空条目。请改为「' +
                    (isAct ? '结束' : '截止') + '」。',
                showCancel: false,
                confirmColor: '#d8b46a',
            });
            return;
        }

        wx.showModal({
            title: '删除这条' + (isAct ? '活动' : '任务') + '？',
            content: '草稿或无人参与的内容才能删除，删除后不可恢复。',
            confirmText: '删除',
            confirmColor: '#d8636e',
            success: (res) => {
                if (!res.confirm) return;
                const okv = isAct ? ops.removeActivity(id) : ops.removeTask(id);
                wx.showToast({ title: okv ? '已删除' : '已有参与记录，无法删除', icon: 'none' });
                this.load();
            },
        });
    },
});
