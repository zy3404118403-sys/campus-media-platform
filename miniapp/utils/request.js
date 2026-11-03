/**
 * 统一请求层（预埋，当前未被页面调用）
 *
 * 设计目标：接入真实接口时，只改 CONFIG.baseURL + 页面里把 utils/mock.js 换成这里，
 * 页面结构、三态逻辑、错误文案都不用动。
 *
 * 关键约定（与校园平台现有接口对齐）：
 *   - 成功：HTTP 200 + { ok: true, data|..., }
 *   - 失败：HTTP 401/403/404/429/5xx + { ok: false, message }
 *   - 鉴权：小程序走 Authorization: Bearer <token>（服务端已实现，Bearer 免 CSRF；见 lib/helpers.js）
 *   - 列表：GET /api/materials?limit=&offset= 风格
 */

const CONFIG = {
  // 留空时视为「未接真实服务」，调用方应回落到 mock
  baseURL: '',
  timeout: 10000,
  tokenKey: 'cm_token',
};

function hasBase() {
  return !!CONFIG.baseURL;
}

function getToken() {
  try {
    return wx.getStorageSync(CONFIG.tokenKey) || '';
  } catch (e) {
    return '';
  }
}

function setToken(token) {
  try {
    wx.setStorageSync(CONFIG.tokenKey, token || '');
  } catch (e) {
    /* 存储失败不阻断主流程 */
  }
}

function clearToken() {
  try {
    wx.removeStorageSync(CONFIG.tokenKey);
  } catch (e) {
    /* ignore */
  }
}

/**
 * 统一错误对象
 * code: NETWORK | TIMEOUT | AUTH_REQUIRED | FORBIDDEN | NOT_FOUND | RATE_LIMITED | SERVER | BUSINESS | UNKNOWN
 * retryable: 是否值得给用户「重试」按钮
 */
function makeError(code, message, extra) {
  const map = {
    NETWORK: { message: '网络连接失败，请检查网络后重试', retryable: true },
    TIMEOUT: { message: '请求超时，请稍后重试', retryable: true },
    AUTH_REQUIRED: { message: '登录已过期，请重新登录', retryable: false },
    FORBIDDEN: { message: '没有权限执行该操作', retryable: false },
    NOT_FOUND: { message: '内容不存在或已被删除', retryable: false },
    RATE_LIMITED: { message: '操作过于频繁，请稍等几秒再试', retryable: true },
    SERVER: { message: '服务暂时不可用，请稍后重试', retryable: true },
    BUSINESS: { message: '操作未成功', retryable: false },
    UNKNOWN: { message: '出现未知错误', retryable: true },
  };
  const base = map[code] || map.UNKNOWN;
  const err = new Error(message || base.message);
  err.code = code;
  err.retryable = base.retryable;
  if (extra) {
    for (const k in extra) err[k] = extra[k];
  }
  return err;
}

function statusToCode(status) {
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER';
  return 'BUSINESS';
}

/**
 * @param {Object} options
 * @param {string} options.url      以 / 开头的接口路径
 * @param {string} [options.method] 默认 GET
 * @param {Object} [options.data]
 * @returns {Promise<any>} 成功 resolve 业务 data，失败 reject 归一化 Error
 */
function request(options) {
  const url = options.url || '';
  const method = (options.method || 'GET').toUpperCase();

  return new Promise((resolve, reject) => {
    if (!hasBase()) {
      reject(makeError('NETWORK', '未配置服务器地址（原型阶段应使用 mock 数据）'));
      return;
    }

    const header = { 'content-type': 'application/json', 'X-Client': 'miniapp' };
    const token = getToken();
    if (token) header.Authorization = 'Bearer ' + token;
    if (options.header) {
      for (const k in options.header) header[k] = options.header[k];
    }

    wx.request({
      url: CONFIG.baseURL + url,
      method: method,
      data: options.data || {},
      header: header,
      timeout: CONFIG.timeout,
      success(res) {
        const status = res.statusCode;

        if (status === 401) {
          // 登录态失效：清 token，交给页面引导登录
          clearToken();
          reject(makeError('AUTH_REQUIRED', null, { status }));
          return;
        }

        if (status < 200 || status >= 300) {
          const body = res.data || {};
          reject(
            makeError(statusToCode(status), body.message || null, {
              status,
              payload: body,
            })
          );
          return;
        }

        const body = res.data || {};
        if (body && body.ok === false) {
          reject(makeError('BUSINESS', body.message || null, { payload: body }));
          return;
        }
        resolve(body);
      },
      fail(e) {
        const msg = String((e && e.errMsg) || '');
        if (msg.indexOf('timeout') > -1) {
          reject(makeError('TIMEOUT'));
        } else {
          reject(makeError('NETWORK', null, { raw: msg }));
        }
      },
    });
  });
}

/* 便捷方法 */
const get = (url, data) => request({ url, method: 'GET', data });
const post = (url, data) => request({ url, method: 'POST', data });
const put = (url, data) => request({ url, method: 'PUT', data });
const del = (url, data) => request({ url, method: 'DELETE', data });

module.exports = {
  CONFIG,
  hasBase,
  request,
  get,
  post,
  put,
  del,
  getToken,
  setToken,
  clearToken,
};
