/**
 * 本地状态持久化
 *
 * 原型阶段没有后端，但「我报名的活动」「我领的任务」「消息已读」这三类状态
 * 必须在页面之间、冷启动之后都还在，否则用户领完任务退出再进来就丢了。
 * 统一用 wx.setStorageSync 存，键名集中在这里，避免各页面自己拼字符串。
 */

const KEY = {
    claimed: 'state_claimed_tasks',      // 已领取的任务 id 数组
    joined: 'state_joined_acts',         // 已报名的活动 id 数组
    readConv: 'state_read_convs',        // 已读会话 id 数组
    readNotice: 'state_read_notices',    // 已读通知 id 数组

    /* 管理员在「内容管理」里的操作。必须持久化：
       下架后素材库要立刻不再显示，用户退出重进也得保持，否则像没生效。 */
    featured: 'state_featured_materials',  // 被精选的素材 id
    offline: 'state_offline_materials',    // 被下架的素材 id
};

/**
 * 内存缓存
 *
 * 原来每个 has() 都调一次 wx.getStorageSync，而列表页渲染时是逐条判断的：
 * items 页一次 syncMine 就要读 10 次 Storage，onShow 又频繁触发 —— 实测是明显的同步 IO 浪费。
 * 这里做进程内缓存：读走内存，写时同时更新内存与 Storage。
 */
const cache = {};

function readList(key) {
    if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
    let v;
    try {
        v = wx.getStorageSync(key);
    } catch (e) {
        v = [];
    }
    const list = Array.isArray(v) ? v : [];
    cache[key] = list;
    return list;
}

function writeList(key, list) {
    cache[key] = list;
    try {
        wx.setStorageSync(key, list);
    } catch (e) {
        /* 存储失败不阻断主流程 */
    }
}

function has(key, id) {
    return readList(key).indexOf(Number(id)) > -1;
}

function add(key, id) {
    const list = readList(key);
    const n = Number(id);
    if (list.indexOf(n) > -1) return list;
    list.push(n);
    writeList(key, list);
    return list;
}

function remove(key, id) {
    const n = Number(id);
    const list = readList(key).filter((x) => x !== n);
    writeList(key, list);
    return list;
}

function toggle(key, id) {
    return has(key, id) ? remove(key, id) : add(key, id);
}

function clear(key) {
    writeList(key, []);
}

module.exports = {
    KEY,
    readList,
    has,
    add,
    remove,
    toggle,
    clear,
    /* 语义化封装 */
    hasClaimed: (id) => has(KEY.claimed, id),
    claim: (id) => add(KEY.claimed, id),
    unclaim: (id) => remove(KEY.claimed, id),
    hasJoined: (id) => has(KEY.joined, id),
    join: (id) => add(KEY.joined, id),
    quit: (id) => remove(KEY.joined, id),
    isFeatured: (id) => has(KEY.featured, id),
    toggleFeatured: (id) => toggle(KEY.featured, id),
    isOffline: (id) => has(KEY.offline, id),
    toggleOffline: (id) => toggle(KEY.offline, id),
    /* 素材库/首页取列表前统一过滤下架项，避免每个页面各写一遍 */
    hideOffline: (list) => {
        const off = readList(KEY.offline);
        if (!off.length) return list;
        return list.filter((x) => off.indexOf(Number(x.id)) < 0);
    },
};
