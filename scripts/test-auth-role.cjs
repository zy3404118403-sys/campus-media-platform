/**
 * 权限层自测
 *
 * 验三件在真机上很容易翻车的事：
 *   ① 老版本缓存的用户对象没有 role，能不能自动补上（不补 = 已登录的人看不到管理入口）
 *   ② admin / reviewer / member 三种角色的判断是否互斥且正确
 *   ③ 未登录时不能因为 role 判断抛异常
 */
const path = require('path');

const ROOT = path.join(__dirname, '..', 'miniapp');
const store = {};

global.wx = {
    getStorageSync: (k) => (store[k] === undefined ? '' : store[k]),
    setStorageSync: (k, v) => {
        store[k] = v;
    },
    removeStorageSync: (k) => {
        delete store[k];
    },
};

const auth = require(path.join(ROOT, 'utils', 'auth.js'));

let fail = 0;
const eq = (name, a, b) => {
    const okv = JSON.stringify(a) === JSON.stringify(b);
    console.log((okv ? '  ✓ ' : '  ✗ ') + name + (okv ? '' : '   实际=' + JSON.stringify(a) + ' 期望=' + JSON.stringify(b)));
    if (!okv) fail++;
};

console.log('=== 1. 未登录 ===');
eq('role() 回落为 member', auth.role(), 'member');
eq('isAdmin() = false', auth.isAdmin(), false);
eq('canReview() = false', auth.canReview(), false);
eq('isLoggedIn() = false', auth.isLoggedIn(), false);

console.log('\n=== 2. 老缓存：有用户但没有 role 字段 ===');
store.cm_user = { id: '20260000001', name: '芜宇乐', sid: '20260000001', college: '数字媒体技术' };
store.cm_token = 'mock-token-20260000001';
/* 清掉 auth 内部缓存，强制重新读 Storage */
delete require.cache[require.resolve(path.join(ROOT, 'utils', 'auth.js'))];
const auth2 = require(path.join(ROOT, 'utils', 'auth.js'));

const u = auth2.getUser();
eq('补上了 role', u.role, 'admin');
eq('回写进 Storage', store.cm_user.role, 'admin');
eq('role() = admin', auth2.role(), 'admin');
eq('isAdmin() = true', auth2.isAdmin(), true);
eq('canReview() = true', auth2.canReview(), true);

console.log('\n=== 3. 审核员 ===');
store.cm_user = { id: '20260000033', name: '陈屿', sid: '20260000033', role: 'reviewer' };
delete require.cache[require.resolve(path.join(ROOT, 'utils', 'auth.js'))];
const auth3 = require(path.join(ROOT, 'utils', 'auth.js'));
eq('role() = reviewer', auth3.role(), 'reviewer');
eq('isAdmin() = false', auth3.isAdmin(), false);
eq('canReview() = true', auth3.canReview(), true);

console.log('\n=== 4. 普通成员 ===');
store.cm_user = { id: '20260000058', name: '周聿', sid: '20260000058', role: 'member' };
delete require.cache[require.resolve(path.join(ROOT, 'utils', 'auth.js'))];
const auth4 = require(path.join(ROOT, 'utils', 'auth.js'));
eq('role() = member', auth4.role(), 'member');
eq('isAdmin() = false', auth4.isAdmin(), false);
eq('canReview() = false', auth4.canReview(), false);

console.log('\n=== 5. 角色中文名 ===');
const mock = require(path.join(ROOT, 'utils', 'mock.js'));
eq('admin 有中文名', mock.ROLE_TEXT.admin, '管理员');
eq('reviewer 有中文名', mock.ROLE_TEXT.reviewer, '审核员');
eq('member 有中文名', mock.ROLE_TEXT.member, '成员');

console.log('\n' + (fail ? '❌ 失败 ' + fail + ' 项' : '✅ 全部通过'));
process.exit(fail ? 1 : 0);
