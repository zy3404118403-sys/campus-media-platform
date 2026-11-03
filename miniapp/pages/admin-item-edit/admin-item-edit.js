/**
 * 管理后台 · 新建 / 编辑 活动与任务
 *
 * 一个页面承接两种对象，靠 ?kind= 区分。
 * 表单只让填必要字段：流程、须知、要求都用「一行一条」的多行文本，
 * 提交时再拆成数组 —— 手机上反复点「添加一行」比直接换行麻烦得多。
 */
const mock = require('../../utils/mock.js');
const auth = require('../../utils/auth.js');
const ops = require('../../utils/admin-ops.js');

const TASK_TYPES = ['视频', '照片', '设计'];

/* 多行文本 → 数组，丢掉空行 */
function toLines(text) {
    return String(text || '')
        .split('\n')
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
}

/* 「时间｜内容」逐行 → [{t,d}]；没写分隔符就整行当作内容 */
function toAgenda(text) {
    return toLines(text).map((line) => {
        const i = line.indexOf('｜') > -1 ? line.indexOf('｜') : line.indexOf('|');
        if (i < 0) return { t: '', d: line };
        return { t: line.slice(0, i).trim(), d: line.slice(i + 1).trim() };
    });
}

Page({
    data: {
        deny: false,
        kind: 'activity',
        id: 0,
        isEdit: false,
        err: '',
        busy: false,

        /* 活动 */
        title: '',
        time: '',
        place: '',
        capacity: '',
        points: '',
        deadline: '',
        intro: '',
        agendaText: '',
        notesText: '',

        /* 任务 */
        types: TASK_TYPES,
        type: '照片',
        slots: '',
        desc: '',
        deliver: '',
        reqText: '',
    },

    onLoad(query) {
        if (!auth.isAdmin()) {
            this.setData({ deny: true });
            return;
        }
        const kind = query && query.kind === 'task' ? 'task' : 'activity';
        const id = Number((query && query.id) || 0);
        this.setData({ kind: kind, id: id, isEdit: id > 0 });
        wx.setNavigationBarTitle({
            title: (id ? '编辑' : '新建') + (kind === 'task' ? '任务' : '活动'),
        });
        if (id) this.fill(id, kind);
    },

    fill(id, kind) {
        if (kind === 'task') {
            const t = mock.byId(mock.tasks, id);
            if (!t) return this.setData({ err: '任务不存在' });
            this.setData({
                title: t.title,
                type: t.type,
                slots: t.slots,
                points: String(t.points),
                deadline: t.deadlineFull || t.deadline,
                desc: t.desc,
                deliver: t.deliver,
                reqText: (t.requirements || []).join('\n'),
            });
            return;
        }
        const a = mock.byId(mock.activities, id);
        if (!a) return this.setData({ err: '活动不存在' });
        this.setData({
            title: a.title,
            time: a.time,
            place: a.place,
            capacity: String(a.capacity),
            points: String(a.points),
            deadline: a.deadline,
            intro: a.intro,
            agendaText: (a.agenda || []).map((x) => (x.t ? x.t + '｜' + x.d : x.d)).join('\n'),
            notesText: (a.notes || []).join('\n'),
        });
    },

    /* ── 通用输入 ── */
    onInput(e) {
        const key = e.currentTarget.dataset.k;
        const patch = {};
        patch[key] = e.detail.value;
        patch.err = '';
        this.setData(patch);
    },

    onType(e) {
        this.setData({ type: e.currentTarget.dataset.v, err: '' });
    },

    /* ── 保存 ── */
    onSave() {
        if (this.data.busy) return;
        const d = this.data;
        const title = String(d.title).trim();
        if (title.length < 4) return this.setData({ err: '标题至少 4 个字，写清活动或任务是什么' });

        if (d.kind === 'activity') {
            if (!String(d.deadline).trim()) return this.setData({ err: '请填写截止时间，如 2026-11-30 23:59' });
            if (String(d.intro).trim().length < 10) {
                return this.setData({ err: '简介至少 10 个字，说明这个活动做什么、面向谁' });
            }
            const cap = Number(d.capacity);
            if (!cap || cap <= 0) return this.setData({ err: '名额需为大于 0 的数字' });
            const pt = Number(d.points);
            if (!pt || pt <= 0) return this.setData({ err: '贡献值需为大于 0 的数字' });

            /* 编辑既有活动时，名额不能小于已报名人数 */
            if (d.id) {
                const a = mock.byId(mock.activities, d.id);
                if (a && cap < Number(a.joined)) {
                    return this.setData({ err: '名额不能小于已报名人数（' + a.joined + ' 人）' });
                }
            }

            this.setData({ busy: true });
            const item = ops.saveActivity({
                id: d.id,
                title: title,
                time: String(d.time).trim(),
                place: String(d.place).trim(),
                capacity: cap,
                points: pt,
                deadline: String(d.deadline).trim(),
                intro: String(d.intro).trim(),
                agenda: toAgenda(d.agendaText),
                notes: toLines(d.notesText),
            });
            this.done(item);
            return;
        }

        if (String(d.desc).trim().length < 10) {
            return this.setData({ err: '描述至少 10 个字，说明要拍什么、交多少' });
        }
        const pt = Number(d.points);
        if (!pt || pt <= 0) return this.setData({ err: '贡献值需为大于 0 的数字' });
        if (!String(d.deadline).trim()) return this.setData({ err: '请填写截止时间，如 2026-11-30 23:59' });

        this.setData({ busy: true });
        const task = ops.saveTask({
            id: d.id,
            title: title,
            type: d.type,
            slots: String(d.slots).trim(),
            points: pt,
            deadline: String(d.deadline).trim(),
            desc: String(d.desc).trim(),
            deliver: String(d.deliver).trim(),
            requirements: toLines(d.reqText),
        });
        this.done(task);
    },

    done(item) {
        this.setData({ busy: false });
        if (!item) {
            wx.showToast({ title: '保存失败', icon: 'none' });
            return;
        }
        wx.showToast({ title: this.data.isEdit ? '已保存' : '已存为草稿', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 620);
    },
});
