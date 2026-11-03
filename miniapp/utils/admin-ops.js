/**
 * 管理操作 · 数据层
 *
 * 为什么单独抽出来：审核动作是整个后台里唯一会**改动前台数据**的地方
 * （通过后素材要真的出现在素材库）。这段逻辑写在 Page({}) 里，
 * Node 测试环境跑不起来，只能靠手点 —— 抽成纯函数后可以用脚本验证。
 */
const mock = require('./mock.js');

/**
 * 通过一条待审素材
 *   幂等：条目已不在队列里就什么都不做（防止连点两下入库两条）
 * @returns {Object|null} 新入库的素材；未处理返回 null
 */
function approve(item) {
    if (!item) return null;
    const inQueue = mock.reviewQueue.some((x) => Number(x.id) === Number(item.id));
    if (!inQueue) return null;

    mock.reviewQueue = mock.reviewQueue.filter((x) => Number(x.id) !== Number(item.id));

    const now = new Date();
    const pad = (n) => (n < 10 ? '0' + n : String(n));

    const mat = {
        id: item.id,
        title: item.title,
        type: item.type,
        college: item.college,
        shotDate: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()),
        duration: item.duration || '',
        size: item.size,
        downloads: 0,
        likes: 0,
        tags: [],
        tone: item.tone,
        ratio: item.ratio,
    };

    mock.materials.unshift(mat);
    return mat;
}

/**
 * 退回一条待审素材
 * @returns {boolean} 是否真的处理了一条
 */
function reject(item) {
    if (!item) return false;
    const inQueue = mock.reviewQueue.some((x) => Number(x.id) === Number(item.id));
    if (!inQueue) return false;
    mock.reviewQueue = mock.reviewQueue.filter((x) => Number(x.id) !== Number(item.id));
    return true;
}

/* ═══════════ 活动与任务 ═══════════
 *
 * 状态机只有单向三条线，不允许跳级：
 *   活动  草稿 → 可报名 → 已结束
 *   任务  草稿 → 进行中 → 已截止
 * 跳级（比如草稿直接结束）会让 C 端看到一条从没开放过的"已结束"活动，
 * 所以这里用「只有某某状态才能转」来挡，而不是简单赋值。
 */

const ACT = { DRAFT: '草稿', OPEN: '可报名', END: '已结束' };
const TASK = { DRAFT: '草稿', ON: '进行中', END: '已截止' };

const TONES = ['ph-1', 'ph-2', 'ph-3', 'ph-4', 'ph-5', 'ph-6', 'ph-7', 'ph-8'];

/**
 * 截止时间缩写：列表里显示 '11-30'，详情用完整 '2026-11-30 23:59'
 * 表单只让填一处，这里统一派生短格式，避免同一个字段在列表里长短混杂
 */
function shortDeadline(s) {
    const str = String(s || '').trim();
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str);
    if (!m) return str;
    const mm = m[2].length < 2 ? '0' + m[2] : m[2];
    const dd = m[3].length < 2 ? '0' + m[3] : m[3];
    return mm + '-' + dd;
}

/* 新条目 id：取现有最大值 +1，避免和审核通过带进来的 id 撞车 */
function nextId(list) {
    let max = 0;
    for (let i = 0; i < list.length; i++) {
        const n = Number(list[i].id) || 0;
        if (n > max) max = n;
    }
    return max + 1;
}

/* ── 活动 ── */
function saveActivity(payload) {
    const id = Number(payload.id) || 0;
    const exist = id ? mock.activities.filter((a) => Number(a.id) === id)[0] : null;

    if (exist) {
        /* 只覆盖可编辑字段；state / joined / id 由状态机与真实报名决定 */
        exist.title = payload.title;
        exist.time = payload.time || (payload.deadline ? shortDeadline(payload.deadline) + ' 截止' : exist.time);
        exist.place = payload.place;
        exist.capacity = Number(payload.capacity) || exist.capacity;
        exist.points = Number(payload.points) || exist.points;
        exist.deadline = payload.deadline;
        exist.intro = payload.intro;
        exist.agenda = payload.agenda || [];
        exist.notes = payload.notes || [];
        return exist;
    }

    const item = {
        id: nextId(mock.activities),
        title: payload.title,
        time: payload.time || (payload.deadline ? shortDeadline(payload.deadline) + ' 截止' : '待定'),
        place: payload.place || '待定',
        joined: 0,
        capacity: Number(payload.capacity) || 50,
        state: ACT.DRAFT,
        tone: TONES[mock.activities.length % TONES.length],
        kicker: 'NEW ACTIVITY',
        organizer: payload.organizer || '融媒体中心',
        points: Number(payload.points) || 10,
        deadline: payload.deadline || '',
        intro: payload.intro,
        agenda: payload.agenda || [],
        notes: payload.notes || [],
    };
    mock.activities.unshift(item);
    return item;
}

function publishActivity(id) {
    const a = mock.activities.filter((x) => Number(x.id) === Number(id))[0];
    if (!a || a.state !== ACT.DRAFT) return false;
    a.state = ACT.OPEN;
    return true;
}

function closeActivity(id) {
    const a = mock.activities.filter((x) => Number(x.id) === Number(id))[0];
    if (!a || a.state !== ACT.OPEN) return false;
    a.state = ACT.END;
    return true;
}

function removeActivity(id) {
    const a = mock.activities.filter((x) => Number(x.id) === Number(id))[0];
    if (!a) return false;
    /* 已有报名的活动不能删，否则报名记录指向空条目 */
    if (Number(a.joined) > 0) return false;
    mock.activities = mock.activities.filter((x) => Number(x.id) !== Number(id));
    return true;
}

/* ── 任务 ── */
function saveTask(payload) {
    const id = Number(payload.id) || 0;
    const exist = id ? mock.tasks.filter((t) => Number(t.id) === id)[0] : null;

    if (exist) {
        exist.title = payload.title;
        exist.type = payload.type || exist.type;
        exist.points = Number(payload.points) || exist.points;
        exist.slots = payload.slots || exist.slots;
        exist.deadline = shortDeadline(payload.deadline) || exist.deadline;
        exist.deadlineFull = payload.deadline || exist.deadlineFull;
        exist.desc = payload.desc;
        exist.deliver = payload.deliver;
        exist.requirements = payload.requirements || [];
        return exist;
    }

    const item = {
        id: nextId(mock.tasks),
        title: payload.title,
        type: payload.type || '照片',
        points: Number(payload.points) || 10,
        slots: payload.slots || '不限',
        deadline: shortDeadline(payload.deadline),
        deadlineFull: payload.deadline || '',
        desc: payload.desc,
        deliver: payload.deliver || '',
        claimedCount: 0,
        state: TASK.DRAFT,
        requirements: payload.requirements || [],
        demo: true,
        claimed: false,
    };
    mock.tasks.unshift(item);
    return item;
}

function publishTask(id) {
    const t = mock.tasks.filter((x) => Number(x.id) === Number(id))[0];
    if (!t || t.state !== TASK.DRAFT) return false;
    t.state = TASK.ON;
    return true;
}

function closeTask(id) {
    const t = mock.tasks.filter((x) => Number(x.id) === Number(id))[0];
    if (!t || t.state !== TASK.ON) return false;
    t.state = TASK.END;
    return true;
}

function removeTask(id) {
    const t = mock.tasks.filter((x) => Number(x.id) === Number(id))[0];
    if (!t) return false;
    if (Number(t.claimedCount) > 0) return false;
    mock.tasks = mock.tasks.filter((x) => Number(x.id) !== Number(id));
    return true;
}

module.exports = {
    approve,
    reject,
    ACT,
    TASK,
    shortDeadline,
    saveActivity,
    publishActivity,
    closeActivity,
    removeActivity,
    saveTask,
    publishTask,
    closeTask,
    removeTask,
};
