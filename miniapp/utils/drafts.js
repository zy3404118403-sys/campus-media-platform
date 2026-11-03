/**
 * 投稿草稿箱
 *
 * 原来上传页只有「提交审核」一个出口：写了一半切走，标题、描述、标签全丢，
 * 而 my-list 那边其实已经有「草稿」这个状态标签，却没有生产草稿的地方 —— 断头路。
 *
 * 这里只存表单文字（标题/描述/类型/学院/标签），不存文件临时路径：
 * wx.chooseMedia 返回的 tempFilePath 在小程序重启后就失效，
 * 存下来会让用户以为草稿里有文件、结果提交时才报错。恢复草稿时明确提示「需重新选择文件」。
 */
const KEY = 'state_drafts';

function read() {
    let v;
    try {
        v = wx.getStorageSync(KEY);
    } catch (e) {
        v = [];
    }
    return Array.isArray(v) ? v : [];
}

function write(list) {
    try {
        wx.setStorageSync(KEY, list);
    } catch (e) {
        /* 存储失败不阻断主流程 */
    }
    return list;
}

/* 列表页展示用：补上 my-list 需要的字段形状（tone / at / size） */
function list() {
    return read().map(function (d) {
        return {
            id: d.id,
            title: d.title || '未命名草稿',
            type: d.type || '视频',
            college: d.college || '',
            size: d.fileName ? '需重新选择文件' : '',
            at: d.at || '',
            status: 'draft',
            reason: '',
            tone: 'ph-2',
            /* 原始表单，点开草稿时回填 */
            draft: d,
        };
    });
}

function count() {
    return read().length;
}

function byId(id) {
    const n = Number(id);
    return read().filter(function (d) {
        return Number(d.id) === n;
    })[0] || null;
}

/**
 * 生成不重复的草稿 id
 *
 * 一开始直接用 Date.now()，实测有坑：连续两次 save 都发生在同一毫秒时
 * id 完全相同，第二份会「覆盖」第一份而不是新增 —— 用户连点两下存草稿就丢内容。
 * 这里保证 id 严格大于已有最大值。
 */
function nextId(all) {
    let max = 0;
    for (let i = 0; i < all.length; i++) {
        const n = Number(all[i].id) || 0;
        if (n > max) max = n;
    }
    const now = Date.now();
    return now > max ? now : max + 1;
}

/**
 * 保存草稿
 *   id 已存在则覆盖（同一个草稿反复编辑不会堆出一堆副本），否则新建
 */
function save(draft) {
    const all = read();
    const n = Number(draft.id);
    const now = new Date();
    const pad = function (x) {
        return x < 10 ? '0' + x : String(x);
    };
    const at =
        now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
        ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());

    const item = {
        id: n || nextId(all),
        title: String(draft.title || '').trim(),
        desc: String(draft.desc || '').trim(),
        type: draft.type || '视频',
        college: draft.college || '',
        collegeIndex: draft.collegeIndex || 0,
        tags: draft.tags || [],
        fileName: draft.fileName || '',
        at: at,
    };

    const i = all.findIndex(function (d) {
        return Number(d.id) === Number(item.id);
    });
    if (i > -1) all[i] = item;
    else all.unshift(item);

    write(all);
    return item;
}

function remove(id) {
    return write(
        read().filter(function (d) {
            return Number(d.id) !== Number(id);
        })
    );
}

module.exports = { read, list, count, byId, save, remove };
