/**
 * 管理操作数据层自测
 *
 * 重点验三件真会出事的事：
 *   ① 通过后素材必须真的进库（否则"通过"只是从列表消失）
 *   ② 连点两下不能入库两条（幂等）
 *   ③ 通过后素材 id 不能与库里已有 id 重复
 */
const path = require('path');

global.wx = { getStorageSync: () => '', setStorageSync: () => {} };

const ROOT = path.join(__dirname, '..', 'miniapp');
const mock = require(path.join(ROOT, 'utils', 'mock.js'));
const ops = require(path.join(ROOT, 'utils', 'admin-ops.js'));

let fail = 0;
const eq = (name, a, b) => {
    const ok = JSON.stringify(a) === JSON.stringify(b);
    console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '   实际=' + JSON.stringify(a) + ' 期望=' + JSON.stringify(b)));
    if (!ok) fail++;
};
const ok = (name) => console.log('  ✓ ' + name);

console.log('=== 1. 基线 ===');
const q0 = mock.reviewQueue.length;
const m0 = mock.materials.length;
ok('待审 ' + q0 + ' 条 / 素材 ' + m0 + ' 条');

console.log('\n=== 2. 通过一条 ===');
const first = mock.reviewQueue[0];
const mat = ops.approve(first);
eq('队列少一条', mock.reviewQueue.length, q0 - 1);
eq('素材多一条', mock.materials.length, m0 + 1);
eq('新素材 id 沿用原 id', mat.id, first.id);
eq('新素材标题一致', mat.title, first.title);
eq('新素材在列表最前', mock.materials[0].id, first.id);
eq('新素材初始下载为 0', mat.downloads, 0);
ok('新素材字段完整：' + Object.keys(mat).length + ' 个字段');

console.log('\n=== 3. 幂等：同一条再通过一次 ===');
const again = ops.approve(first);
eq('返回 null（不重复入库）', again, null);
eq('素材数量不变', mock.materials.length, m0 + 1);
eq('队列数量不变', mock.reviewQueue.length, q0 - 1);

console.log('\n=== 4. id 唯一性 ===');
const ids = mock.materials.map((x) => x.id);
eq('素材 id 无重复', new Set(ids).size, ids.length);

console.log('\n=== 5. 退回 ===');
const second = mock.reviewQueue[0];
const before = mock.materials.length;
eq('退回返回 true', ops.reject(second), true);
eq('队列再少一条', mock.reviewQueue.length, q0 - 2);
eq('退回不入库', mock.materials.length, before);
eq('退回不存在条目返回 false', ops.reject(second), false);

console.log('\n=== 6. 空参数不炸 ===');
let threw = false;
try {
    ops.approve(null);
    ops.reject(undefined);
} catch (e) {
    threw = true;
}
eq('传 null/undefined 不抛异常', threw, false);

console.log('\n=== 7. 全部审完 ===');
mock.reviewQueue.slice().forEach((x) => ops.approve(x));
eq('队列清空', mock.reviewQueue.length, 0);
eq('素材总数 = 原素材 + 通过的条数', mock.materials.length, m0 + (q0 - 1));
const ids2 = mock.materials.map((x) => x.id);
eq('全量素材 id 仍无重复', new Set(ids2).size, ids2.length);

console.log('\n' + (fail ? '❌ 失败 ' + fail + ' 项' : '✅ 全部通过'));
process.exit(fail ? 1 : 0);
