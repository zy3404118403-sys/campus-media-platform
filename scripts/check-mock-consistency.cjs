/**
 * mock 数据自洽性检查
 *
 * 起因：profile 写死 120 分 / 排名 7，贡献值页读 pointOverview 的 32 分 / 排名 1，
 * 同一用户在两个页面显示两套数字；排行榜里还混着「系统测试账号 · 功能验证」这种内部痕迹。
 * 这类问题不影响编译、不影响点击，只有人肉翻页面才发现 —— 所以固化成脚本。
 *
 * 跑法：node audit/phase2/check-mock-consistency.cjs
 */
const path = require('path');

global.wx = { getStorageSync: () => '', setStorageSync: () => {} };
const mock = require(path.join(__dirname, '..', 'miniapp', 'utils', 'mock.js'));

let fail = 0;
let warn = 0;

const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => {
    console.log('  ✗ ' + m);
    fail++;
};
const soft = (m) => {
    console.log('  ⚠ ' + m);
    warn++;
};

const eq = (name, a, b) => (a === b ? ok(name + ' = ' + b) : bad(name + ' 不一致：' + a + ' ≠ ' + b));

console.log('=== [1] 贡献值：同一用户只能有一套数字 ===');
const ov = mock.pointOverview;
eq('profile.points 与 pointOverview.total', mock.profile.points, ov.total);
eq('profile.rank 与 pointOverview.rank', mock.profile.rank, ov.rank);

const logSum = mock.pointLogs.reduce((s, x) => s + Number(x.points || 0), 0);
eq('流水求和 与 总览 total', logSum, ov.total);

if (ov.rank < 1 || ov.rank > mock.pointRank.length) {
    bad('总览排名 ' + ov.rank + ' 超出排行榜长度 ' + mock.pointRank.length);
} else {
    ok('总览排名 ' + ov.rank + ' 落在排行榜范围内');
}

console.log('\n=== [2] 排行榜 ===');
const mine = mock.pointRank.filter((x) => x.mine);
if (mine.length !== 1) bad('「我」的条目应有且仅有 1 条，实际 ' + mine.length + ' 条');
else {
    const me = mine[0];
    eq('排行榜「我」的名字 与 profile.name', me.name, mock.profile.name);
    eq('排行榜「我」的分数 与 总览', me.points, ov.total);
    const idx = mock.pointRank.indexOf(me) + 1;
    eq('排行榜「我」的实际位次 与 总览排名', idx, ov.rank);
}

let sorted = true;
for (let i = 1; i < mock.pointRank.length; i++) {
    if (mock.pointRank[i].points > mock.pointRank[i - 1].points) sorted = false;
}
sorted ? ok('排行榜按分数降序') : bad('排行榜未按分数降序');

const ids = mock.pointRank.map((x) => x.id);
new Set(ids).size === ids.length ? ok('排行榜 id 不重复') : bad('排行榜 id 有重复');

console.log('\n=== [3] 个人清单引用完整性 ===');
[['收藏', mock.myFavorites], ['下载', mock.myDownloads], ['投稿', mock.myUploads]].forEach(([label, list]) => {
    if (!Array.isArray(list) || !list.length) return soft('「我的' + label + '」为空，跳过');
    const broken = list.filter((x) => !x || x.title === undefined);
    broken.length
        ? bad('「我的' + label + '」有 ' + broken.length + ' 条引用了不存在的素材 id')
        : ok('「我的' + label + '」' + list.length + ' 条全部能解析到素材');
});

const matIds = mock.materials.map((m) => m.id);
new Set(matIds).size === matIds.length ? ok('素材 id 不重复（' + matIds.length + ' 条）') : bad('素材 id 有重复');

console.log('\n=== [4] 用户可见文案里的内部痕迹 ===');
const BAD_WORDS = ['系统测试账号', '功能验证', '测试用例', 'demo', 'DEMO', 'TODO', '占位'];
const hits = [];
const scan = (obj, trail) => {
    if (obj === null || obj === undefined) return;
    if (typeof obj === 'string') {
        BAD_WORDS.forEach((w) => {
            if (obj.indexOf(w) > -1) hits.push(trail + ' → 「' + obj + '」');
        });
        return;
    }
    if (Array.isArray(obj)) return obj.forEach((v, i) => scan(v, trail + '[' + i + ']'));
    if (typeof obj === 'object') {
        Object.keys(obj).forEach((k) => scan(obj[k], trail + '.' + k));
    }
};
['pointRank', 'pointLogs', 'pointRules', 'materials', 'activities', 'tasks', 'blogPosts', 'forumThreads', 'wallPosts', 'notifications'].forEach((k) => {
    scan(mock[k], k);
});
hits.length ? hits.slice(0, 12).forEach((h) => soft('出现内部痕迹 ' + h)) : ok('未发现测试/占位类文案');

console.log('\n=== [5] 素材与派生视图 ===');
const mats = mock.materials;
mats.forEach((m) => {
    if (!m.title) bad('素材 id=' + m.id + ' 缺标题');
    if (!m.college) bad('素材 id=' + m.id + ' 缺学院');
});
if (!fail) ok('全部素材有标题与学院');

const tags = new Set();
mats.forEach((m) => (m.tags || []).forEach((t) => tags.add(t)));
ok('标签去重后 ' + tags.size + ' 个，素材-标签关联 ' + mats.reduce((s, m) => s + (m.tags || []).length, 0) + ' 条');

console.log('\n=== [6] 字段取值必须落在样式与筛选的枚举内 ===');
const fs = require('fs');
const wxss = fs.readFileSync(path.join(__dirname, '..', 'miniapp', 'app.wxss'), 'utf8');
const definedTones = new Set((wxss.match(/\.ph-\d+/g) || []).map((x) => x.slice(1)));
const definedRatios = new Set((wxss.match(/\.thumb-[a-z]/g) || []).map((x) => x.replace('.thumb-', '')));

const badTone = mats.filter((m) => !definedTones.has(m.tone));
badTone.length
    ? bad('有 ' + badTone.length + ' 条素材用了未定义的占位色：' + badTone.slice(0, 3).map((m) => m.id + ':' + m.tone).join(', '))
    : ok('素材占位色全部有对应样式（' + definedTones.size + ' 组）');

const badRatio = mats.filter((m) => !definedRatios.has(m.ratio));
badRatio.length
    ? bad('有 ' + badRatio.length + ' 条素材的 ratio 未定义样式：' + badRatio.map((m) => m.id + ':' + m.ratio).join(', '))
    : ok('素材比例类全部有对应样式（' + [...definedRatios].join('/') + '）');

const TYPES = ['视频', '图片', '文档'];
const badType = mats.filter((m) => TYPES.indexOf(m.type) < 0);
badType.length ? bad('素材类型超出筛选枚举：' + badType.map((m) => m.id + ':' + m.type).join(', ')) : ok('素材类型都在「' + TYPES.join('/') + '」内');

const ACT_STATES = ['草稿', '可报名', '已结束'];
const TASK_STATES = ['草稿', '进行中', '已截止'];

const stateCount = {};
mock.activities.forEach((a) => (stateCount[a.state] = (stateCount[a.state] || 0) + 1));
const badState = Object.keys(stateCount).filter((k) => ACT_STATES.indexOf(k) < 0);
badState.length ? bad('活动状态超出枚举：' + badState.join(', ')) : ok('活动状态分布 ' + JSON.stringify(stateCount));

const tStateCount = {};
mock.tasks.forEach((t) => (tStateCount[t.state] = (tStateCount[t.state] || 0) + 1));
const badTState = Object.keys(tStateCount).filter((k) => TASK_STATES.indexOf(k) < 0);
badTState.length ? bad('任务状态超出枚举：' + badTState.join(', ')) : ok('任务状态分布 ' + JSON.stringify(tStateCount));

const TASK_TYPES = ['视频', '照片', '设计'];
const badTaskType = mock.tasks.filter((t) => TASK_TYPES.indexOf(t.type) < 0);
badTaskType.length ? bad('任务类型超出枚举：' + badTaskType.map((t) => t.id + ':' + t.type).join(', ')) : ok('任务类型都在「' + TASK_TYPES.join('/') + '」内');

console.log('\n=== [7] 标题年份 与 拍摄日期年份 ===');
const yearBad = mats.filter((m) => {
    const inTitle = String(m.title).match(/(20\d{2})/);
    if (!inTitle) return false;
    return inTitle[1] !== String(m.shotDate).slice(0, 4);
});
yearBad.length
    ? bad('标题写死年份却与拍摄日期不符：' + yearBad.map((m) => m.id + '《' + m.title + '》vs ' + m.shotDate).join(' / '))
    : ok('带年份的标题都与 shotDate 一致');

console.log('\n=== [8] 活动内容完整性 ===');
const thin = mock.activities.filter((a) => !a.intro || !(a.agenda || []).length || !(a.notes || []).length);
thin.length
    ? bad('有 ' + thin.length + ' 个活动缺少简介/流程/须知：' + thin.map((a) => a.id).join(', '))
    : ok(mock.activities.length + ' 个活动都有简介、流程与须知');

const taskThin = mock.tasks.filter((t) => !t.desc || !t.deliver || !(t.requirements || []).length);
taskThin.length
    ? bad('有 ' + taskThin.length + ' 个任务缺少描述/交付物/要求：' + taskThin.map((t) => t.id).join(', '))
    : ok(mock.tasks.length + ' 个任务都有描述、交付物与要求');

const over = mock.activities.filter((a) => Number(a.joined) > Number(a.capacity));
over.length ? bad('报名人数超过名额：' + over.map((a) => a.id).join(', ')) : ok('没有活动报名人数超过名额');

console.log('\n=== [9] 筛选器必须覆盖数据里出现过的所有类型 ===');
const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'miniapp', 'pages', 'index', 'index.js'), 'utf8');
const fm = indexSrc.match(/filters:\s*\[([^\]]*)\]/);
if (!fm) {
    bad('index.js 里找不到 filters 定义');
} else {
    const chips = (fm[1].match(/'([^']*)'/g) || []).map((x) => x.replace(/'/g, ''));
    const usedTypes = [...new Set(mats.map((m) => m.type))];
    const unreachable = usedTypes.filter((t) => chips.indexOf(t) < 0);
    unreachable.length
        ? bad('这些类型在素材库里筛不到（只能从「全部」翻）：' + unreachable.join('、') + '；筛选器只有 ' + chips.join('/'))
        : ok('素材库筛选器覆盖全部 ' + usedTypes.length + ' 种类型：' + chips.join(' / '));
}

console.log('\n=== [10] 管理后台：权限与脱敏 ===');
const ROLES = Object.keys(mock.ROLE_TEXT);
const badRole = mock.adminUsers.filter((u) => ROLES.indexOf(u.role) < 0);
badRole.length ? bad('成员角色超出枚举：' + badRole.map((u) => u.id + ':' + u.role).join(', ')) : ok('成员角色都在「' + ROLES.join('/') + '」内');
ok('角色中文名映射齐全：' + ROLES.map((r) => mock.ROLE_TEXT[r]).join(' / '));

/* 脱敏是硬红线：Web 后台曾整表露出真实学号，小程序端不允许出现完整学号 */
const leakSid = mock.adminUsers.filter((u) => String(u.sidMask).indexOf('*') < 0);
leakSid.length
    ? bad('有 ' + leakSid.length + ' 个成员存了未脱敏学号：' + leakSid.map((u) => u.name).join('、'))
    : ok(mock.adminUsers.length + ' 个成员的学号全部为脱敏形式');

const queueLeak = mock.reviewQueue.filter((x) => String(x.sidMask).indexOf('*') < 0);
queueLeak.length ? bad('待审条目里有未脱敏学号：' + queueLeak.map((x) => x.id).join(', ')) : ok('待审条目的投稿人学号同样脱敏');

const adminCount = mock.adminUsers.filter((u) => u.role === 'admin').length;
adminCount >= 1 ? ok('至少保留 1 名管理员（' + adminCount + ' 名）') : bad('没有任何管理员，后台将无人可进');

console.log('\n=== [11] 管理后台：数据自洽 ===');
const qIds = mock.reviewQueue.map((x) => x.id);
new Set(qIds).size === qIds.length ? ok('待审 id 不重复（' + qIds.length + ' 条）') : bad('待审 id 有重复');

/* 通过后素材会被 unshift 进 materials，id 撞车会产生两条同 id 素材 */
const clash = qIds.filter((id) => matIds.indexOf(id) > -1);
clash.length
    ? bad('待审 id 与已有素材 id 冲突（通过后会出现重复 id）：' + clash.join(', '))
    : ok('待审 id 与素材库 id 无冲突');

const badQTone = mock.reviewQueue.filter((x) => !definedTones.has(x.tone) || !definedRatios.has(x.ratio));
badQTone.length ? bad('待审条目的占位色/比例未定义样式：' + badQTone.map((x) => x.id).join(', ')) : ok('待审条目占位样式齐全');

const badQType = mock.reviewQueue.filter((x) => TYPES.indexOf(x.type) < 0);
badQType.length ? bad('待审条目类型超出枚举：' + badQType.map((x) => x.id + ':' + x.type).join(', ')) : ok('待审条目类型都在「' + TYPES.join('/') + '」内');

const overRead = mock.adminNotices.filter((n) => Number(n.read) > Number(n.total));
overRead.length ? bad('通知已读数超过触达数：' + overRead.map((n) => n.id).join(', ')) : ok('通知已读不超过触达数');

console.log('\n=== [12] 草稿不能出现在前台 ===');
const pubA = mock.publicActivities();
const pubT = mock.publicTasks();
pubA.filter((a) => a.state === '草稿').length
    ? bad('前台可见活动里混进了草稿：' + pubA.filter((a) => a.state === '草稿').map((a) => a.id).join(', '))
    : ok('前台可见活动 ' + pubA.length + ' 条，无草稿（后台共 ' + mock.activities.length + ' 条）');
pubT.filter((t) => t.state === '草稿').length
    ? bad('前台可见任务里混进了草稿：' + pubT.filter((t) => t.state === '草稿').map((t) => t.id).join(', '))
    : ok('前台可见任务 ' + pubT.length + ' 条，无草稿（后台共 ' + mock.tasks.length + ' 条）');

const draftJoined = mock.activities.filter((a) => a.state === '草稿' && Number(a.joined) > 0);
draftJoined.length
    ? bad('草稿活动却有报名人数：' + draftJoined.map((a) => a.id + '=' + a.joined).join(', '))
    : ok('草稿活动的报名数都为 0');

const draftClaimed = mock.tasks.filter((t) => t.state === '草稿' && Number(t.claimedCount) > 0);
draftClaimed.length
    ? bad('草稿任务却有人领取：' + draftClaimed.map((t) => t.id).join(', '))
    : ok('草稿任务的领取数都为 0');

console.log('\n=== [13] 学院账号数必须与总账号数对齐 ===');
const cuSum = mock.collegeUsers.reduce((s, x) => s + Number(x.n), 0);
cuSum === mock.pointOverview.totalUsers
    ? ok('各学院账号数合计 ' + cuSum + ' = 总账号数')
    : bad('各学院账号数合计 ' + cuSum + ' ≠ 总账号数 ' + mock.pointOverview.totalUsers + '（发通知的触达人数会对不上）');

const dupCollege = mock.collegeUsers.map((x) => x.name).filter((n, i, a) => a.indexOf(n) !== i);
dupCollege.length ? bad('学院重复：' + dupCollege.join('、')) : ok(mock.collegeUsers.length + ' 个学院无重复');




console.log('\n════════ 汇总 ════════');
console.log('  错误: ' + fail + ' | 提示: ' + warn);
if (fail) {
    console.log('  结论: 存在数据矛盾，需修正');
    process.exit(1);
}
console.log('  结论: mock 数据自洽');
