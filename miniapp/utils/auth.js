/**
 * 登录态管理
 *
 * 两条路径：
 *   ① 已配置 baseURL → 走真实接口（POST /api/login，带 X-Client: miniapp 拿 body token）
 *   ② 未配置 baseURL → 原型模式，不发任何网络请求，用本地 mock 用户模拟登录
 *
 * 令牌与用户信息分开存：
 *   - token 由 utils/request.js 管理（key: cm_token）
 *   - 用户信息由本模块管理（key: cm_user），用于冷启动时立即渲染头像/昵称，不必等接口
 */
const req = require('./request.js');
const mock = require('./mock.js');

const USER_KEY = 'cm_user';
const LOGIN_PAGE = '/pages/login/login';

let _user = null;

function isMock() {
  return !req.hasBase();
}

function makeErr(message, code) {
  const e = new Error(message);
  e.code = code || 'AUTH';
  return e;
}

function getUser() {
  if (_user) return _user;
  try {
    _user = wx.getStorageSync(USER_KEY) || null;
  } catch (e) {
    _user = null;
  }
  /* 升级兼容：早期版本存下来的用户对象没有 role 字段，
     不补的话「已经登录过的人」进小程序看不到管理入口，会被当成功能没做。 */
  if (_user && !_user.role && isMock()) {
    _user.role = mock.profile.role || 'member';
    saveUser(_user);
  }
  return _user;
}

function saveUser(user) {
  _user = user || null;
  try {
    if (user) wx.setStorageSync(USER_KEY, user);
    else wx.removeStorageSync(USER_KEY);
  } catch (e) {
    /* 存储失败不阻断登录 */
  }
}

function isLoggedIn() {
  if (!getUser()) return false;
  // 原型模式没有真 token，只要本地有用户即视为已登录
  return isMock() ? true : !!req.getToken();
}

/**
 * 第一步登录
 * @returns {Promise<Object>} 用户对象；需要 2FA 时 reject 一个 code='NEED_2FA' 且带 challenge 的错误
 */
function login(id, password) {
  const sid = String(id || '').trim();
  const pwd = String(password || '');

  // 前置校验放在发请求之前，避免无谓的网络往返与登录限速消耗
  if (!sid) return Promise.reject(makeErr('请输入学号'));
  if (sid.length < 6) return Promise.reject(makeErr('学号格式不正确'));
  if (!pwd) return Promise.reject(makeErr('请输入密码'));

  if (isMock()) {
    return mock.delay(520).then(() => {
      const user = {
        id: sid,
        name: mock.profile.name,
        sid: sid,
        // 角色决定小程序端能看到哪些管理功能；真实接口由服务端下发
        role: mock.profile.role || 'member',
        college: mock.profile.college,
        points: mock.profile.points,
        rank: mock.profile.rank,
        // 统计与 mock 资料保持一致，避免「有贡献值但零投稿」的语义矛盾
        stats: mock.profile.stats,
        mock: true,
      };
      req.setToken('mock-token-' + sid);
      saveUser(user);
      return user;
    });
  }

  return req.post('/api/login', { id: sid, password: pwd }).then((body) => {
    if (body && body.need2fa) {
      const e = makeErr('需要两步验证', 'NEED_2FA');
      e.challenge = body.challenge;
      throw e;
    }
    if (!body || !body.token) {
      throw makeErr('登录返回缺少令牌，请联系管理员');
    }
    req.setToken(body.token);
    saveUser(body.user || null);
    return body.user;
  });
}

/**
 * 当前用户角色
 *   admin    管理员：全部管理功能
 *   reviewer 审核员：只能进审核队列
 *   member   普通成员：看不到管理入口
 */
function role() {
  const u = getUser();
  return (u && u.role) || 'member';
}

function isAdmin() {
  return role() === 'admin';
}

/* 能进审核页的角色。审核员是特意分开的：给内容组同学开放审核，
   但不让他们改动成员角色、也不让他们发全员通知。 */
function canReview() {
  const r = role();
  return r === 'admin' || r === 'reviewer';
}

/**
 * 第二步：TOTP 动态码或备用恢复码（服务端自动识别，长度上限 32）
 */
function login2fa(challenge, code) {
  const c = String(code || '').trim();
  if (!challenge) return Promise.reject(makeErr('验证会话已失效，请重新登录'));
  if (!c) return Promise.reject(makeErr('请输入动态验证码'));

  if (isMock()) {
    return mock.delay(420).then(() => getUser());
  }

  return req.post('/api/login/2fa', { challenge: challenge, code: c }).then((body) => {
    if (!body || !body.token) throw makeErr('验证返回缺少令牌，请联系管理员');
    req.setToken(body.token);
    saveUser(body.user || null);
    return body.user;
  });
}

/**
 * 退出登录：先尽力通知服务端（失败也继续清本地）
 */
function logout() {
  const clear = () => {
    req.clearToken();
    saveUser(null);
  };
  if (isMock() || !req.getToken()) {
    clear();
    return Promise.resolve();
  }
  return req
    .post('/api/logout', {})
    .then(clear)
    .catch(clear);
}

/**
 * 登录守卫：未登录则跳登录页，并记录来源页以便登录后返回
 * @returns {boolean} 是否已登录
 */
function ensureLogin() {
  if (isLoggedIn()) return true;

  let redirect = '';
  const stack = getCurrentPages();
  const cur = stack.length ? stack[stack.length - 1] : null;
  if (cur && cur.route) {
    redirect = '/' + cur.route;
    const opts = cur.options || {};
    const qs = Object.keys(opts)
      .map((k) => k + '=' + encodeURIComponent(opts[k]))
      .join('&');
    if (qs) redirect += '?' + qs;
  }

  wx.navigateTo({
    url: LOGIN_PAGE + (redirect ? '?redirect=' + encodeURIComponent(redirect) : ''),
  });
  return false;
}

module.exports = {
  isMock,
  getUser,
  isLoggedIn,
  role,
  isAdmin,
  canReview,
  login,
  login2fa,
  logout,
  ensureLogin,
  LOGIN_PAGE,
};
