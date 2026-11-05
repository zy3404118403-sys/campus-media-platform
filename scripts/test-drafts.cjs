/**
 * 草稿箱逻辑自测（node 直接跑，不依赖小程序环境）
 *
 * 为什么要这个：drafts.js 依赖 wx.getStorageSync，在小程序外无法直接 require。
 * 这里注入一个内存版 wx，然后走「存 → 读 → 改 → 删」全流程，
 * 确认 my-list 拿到的字段形状和 upload 回填需要的字段都在。
 */
const path = require('path');
const Module = require('module');

/* ── 内存版 wx ── */
const store = {};
global.wx = {
    getStorageSync(k) {
        return store[k] === undefined ? '' : store[k];
    },
    setStorageSync(k, v) {
        store[k] = v;
    },
};

// __dirname = <项目>/audit/phase2 → 上两级才是项目根
const ROOT = path.join(__dirname, '..', 'miniapp');
const drafts = require(path.join(ROOT, 'utils', 'drafts.js'));

let fail = 0;
const check = (name, actual, expect) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expect);
    console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '   实际=' + JSON.stringify(actual) + '  期望=' + JSON.stringify(expect)));
    if (!ok) fail++;
};

console.log('=== 1. 空态 ===');
check('初始 count = 0', drafts.count(), 0);
check('初始 list = []', drafts.list(), []);

console.log('\n=== 2. 新建草稿 ===');
const a = drafts.save({
    title: '  校运会开幕式混剪  ',
    desc: '田径场开幕式，含舞龙与方阵进场，可剪 60 秒短视频',
    type: '视频',
    college: '融媒中心',
    collegeIndex: 0,
    tags: ['校运会', '混剪'],
    fileName: 'sports.mp4',
});
check('id 存在', typeof a.id === 'number' && a.id > 0, true);
check('标题已 trim', a.title, '校运会开幕式混剪');
check('count = 1', drafts.count(), 1);
check('at 有值', /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(a.at), true);

console.log('\n=== 3. my-list 需要的字段形状 ===');
const l = drafts.list();
check('list 长度 1', l.length, 1);
check('status = draft', l[0].status, 'draft');
check('tone 有值', l[0].tone, 'ph-2');
check('size 提示重选文件', l[0].size, '需重新选择文件');
check('college 透传', l[0].college, '融媒中心');
check('原始表单可回填', l[0].draft.tags, ['校运会', '混剪']);

console.log('\n=== 4. 带 id 保存 = 覆盖而不是新增 ===');
const b = drafts.save({
    id: a.id,
    title: '校运会开幕式混剪（改）',
    desc: '改了描述内容',
    type: '视频',
    college: '融媒中心',
    collegeIndex: 0,
    tags: ['校运会'],
});
check('count 仍为 1', drafts.count(), 1);
check('内容已更新', drafts.byId(a.id).title, '校运会开幕式混剪（改）');

console.log('\n=== 5. 第二条草稿：应插在最前 ===');
const c = drafts.save({
    title: '迎新晚会花絮',
    desc: '后台与彩排片段',
    type: '图片',
    college: '设计学院',
    collegeIndex: 4,
    tags: [],
});
check('count = 2', drafts.count(), 2);
check('最新的在最前', drafts.list()[0].title, '迎新晚会花絮');
check('byId 取第二条', drafts.byId(a.id).title, '校运会开幕式混剪（改）');

console.log('\n=== 6. 无标题草稿 ===');
const noTitle = drafts.save({ desc: '只有描述' });
check('空标题存进去后显示占位名', drafts.byId(noTitle.id).title, '');
check('列表展示为「未命名草稿」', drafts.list().filter((x) => x.id === noTitle.id)[0].title, '未命名草稿');

console.log('\n=== 7. 删除 ===');
drafts.remove(c.id);
check('删除后 count = 2', drafts.count(), 2);
check('被删的取不到', drafts.byId(c.id), null);
check('不存在的 id 删除不报错', (() => { try { drafts.remove(999999); return 'ok'; } catch (e) { return 'throw'; } })(), 'ok');

console.log('\n=== 8. 存储脏数据容错 ===');
store.state_drafts = { not: 'an array' };
check('非数组当作空', drafts.count(), 0);
store.state_drafts = [{ id: 1, title: '裸数据' }];
const bare = drafts.list();
check('缺字段补默认 type', bare[0].type, '视频');
check('缺字段补默认 status', bare[0].status, 'draft');

console.log('\n' + (fail ? '❌ 失败 ' + fail + ' 项' : '✅ 全部通过'));
process.exit(fail ? 1 : 0);
