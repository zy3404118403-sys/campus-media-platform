/**
 * 活动 / 任务数据层自测
 *
 * 重点是状态机与删除守卫 —— 这两处出错在真机上很难发现：
 *   ① 跳级（草稿直接结束）会让 C 端出现一条从没开放过的「已结束」活动
 *   ② 删掉已有报名的活动，会让报名记录指向空条目
 */
const path = require('path');

global.wx = { getStorageSync: () => '', setStorageSync: () => {} };

const ROOT = path.join(__dirname, '..', 'miniapp');
const mock = require(path.join(ROOT, 'utils', 'mock.js'));
const ops = require(path.join(ROOT, 'utils', 'admin-ops.js'));

let fail = 0;
const eq = (name, a, b) => {
    const okv = JSON.stringify(a) === JSON.stringify(b);
    console.log((okv ? '  ✓ ' : '  ✗ ') + name + (okv ? '' : '   实际=' + JSON.stringify(a) + ' 期望=' + JSON.stringify(b)));
    if (!okv) fail++;
};
const ok = (name) => console.log('  ✓ ' + name);

console.log('=== 1. 基线：草稿不进前台 ===');
eq('活动总数', mock.activities.length, 8);
eq('前台可见活动', mock.publicActivities().length, 6);
eq('任务总数', mock.tasks.length, 10);
eq('前台可见任务', mock.publicTasks().length, 8);
eq('publicActivities 无草稿', mock.publicActivities().filter((a) => a.state === '草稿').length, 0);
eq('publicTasks 无草稿', mock.publicTasks().filter((t) => t.state === '草稿').length, 0);

console.log('\n=== 2. 新建活动：默认草稿，且不出现在前台 ===');
const before = mock.publicActivities().length;
const a1 = ops.saveActivity({
    title: '测试活动 · 春天摄影',
    place: '操场',
    capacity: 50,
    points: 20,
    deadline: '2027-04-01 23:59',
    intro: '这是一个用于验证的测试活动描述，长度足够。',
    agenda: [{ t: '04-01', d: '投稿' }],
    notes: ['须为本人拍摄'],
});
eq('状态为草稿', a1.state, '草稿');
eq('前台数量不变', mock.publicActivities().length, before);
eq('time 由截止时间派生', a1.time, '04-01 截止');
eq('id 唯一', mock.activities.filter((x) => x.id === a1.id).length, 1);

console.log('\n=== 3. 活动状态机 ===');
eq('草稿不能直接结束（跳级被拒）', ops.closeActivity(a1.id), false);
eq('发布成功', ops.publishActivity(a1.id), true);
eq('状态变可报名', ops.publishActivity(a1.id), false); // 已不是草稿
eq('前台可见数 +1', mock.publicActivities().length, before + 1);
eq('结束成功', ops.closeActivity(a1.id), true);
eq('已结束后不能再结束', ops.closeActivity(a1.id), false);

console.log('\n=== 4. 删除守卫 ===');
const draftA = ops.saveActivity({ title: '临时草稿活动', capacity: 10, points: 5, deadline: '2027-05-01', intro: '临时活动描述够十个字了' });
eq('无人参与的草稿可删', ops.removeActivity(draftA.id), true);
const joined = mock.activities.filter((x) => Number(x.joined) > 0)[0];
eq('有报名的活动不可删', ops.removeActivity(joined.id), false);
eq('该活动仍在', mock.activities.filter((x) => x.id === joined.id).length, 1);
eq('不存在的 id 返回 false', ops.removeActivity(999999), false);

console.log('\n=== 5. 编辑不改变状态 ===');
const editTarget = mock.activities.filter((x) => x.state === '已结束')[0];
const stateBefore = editTarget.state;
ops.saveActivity({
    id: editTarget.id,
    title: '编辑后的标题',
    place: '新地点',
    capacity: editTarget.capacity,
    points: editTarget.points,
    deadline: editTarget.deadline,
    intro: '编辑后的简介内容，同样超过十个字。',
    agenda: [],
    notes: [],
});
eq('标题已更新', editTarget.title, '编辑后的标题');
eq('状态未被动过', editTarget.state, stateBefore);

console.log('\n=== 6. 任务状态机 ===');
const t1 = ops.saveTask({
    title: '测试任务 · 空镜补拍',
    type: '视频',
    points: 30,
    slots: '2 人',
    deadline: '2027-06-01 23:59',
    desc: '这是一段用于测试的任务描述，长度足够。',
    deliver: '3 段素材',
    requirements: ['保留原始文件'],
});
eq('状态为草稿', t1.state, '草稿');
eq('deadline 存短格式', t1.deadline, '06-01');
eq('deadlineFull 存原值', t1.deadlineFull, '2027-06-01 23:59');
eq('草稿不能直接截止（跳级被拒）', ops.closeTask(t1.id), false);
eq('发布成功', ops.publishTask(t1.id), true);
eq('重复发布返回 false', ops.publishTask(t1.id), false);
eq('截止成功', ops.closeTask(t1.id), true);

console.log('\n=== 7. 任务删除守卫 ===');
const draftT = ops.saveTask({ title: '临时草稿任务', type: '照片', points: 10, desc: '临时任务描述够十个字了' });
eq('无人领取的草稿可删', ops.removeTask(draftT.id), true);
const claimed = mock.tasks.filter((x) => Number(x.claimedCount) > 0)[0];
eq('已有人领取的任务不可删', ops.removeTask(claimed.id), false);

console.log('\n=== 8. 全量一致性 ===');
const actStates = [...new Set(mock.activities.map((a) => a.state))];
const taskStates = [...new Set(mock.tasks.map((t) => t.state))];
ok('活动状态集合：' + actStates.join('/'));
ok('任务状态集合：' + taskStates.join('/'));
const ids = mock.activities.map((a) => a.id);
eq('活动 id 无重复', new Set(ids).size, ids.length);
const tids = mock.tasks.map((t) => t.id);
eq('任务 id 无重复', new Set(tids).size, tids.length);
eq('草稿活动报名数都为 0', mock.activities.filter((a) => a.state === '草稿' && Number(a.joined) > 0).length, 0);

console.log('\n=== 9. 截止时间缩写 ===');
[['2026-11-30 23:59', '11-30'], ['2027-1-5', '01-05'], ['11-30', '11-30'], ['', '']].forEach(([i, e]) => {
    eq('shortDeadline(' + JSON.stringify(i) + ')', ops.shortDeadline(i), e);
});

console.log('\n' + (fail ? '❌ 失败 ' + fail + ' 项' : '✅ 全部通过'));
process.exit(fail ? 1 : 0);
