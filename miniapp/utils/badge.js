/**
 * tabBar 消息未读角标
 *
 * 消息已经是底部导航的一级入口，但如果没有任何提示，用户永远不知道有新消息。
 * 未读数 = 私信会话未读数之和 + 未读系统通知数 - 已读记录。
 *
 * 注意：tabBar 索引写死为 MESSAGES_TAB（首页0 / 素材1 / 事项2 / 消息3 / 我的4），
 * 以后调整导航顺序必须同步改这里。
 */
const mock = require('./mock.js');
const state = require('./state.js');

const MESSAGES_TAB = 3;

function unreadCount() {
    const readConvs = state.readList(state.KEY.readConv);
    const readNotices = state.readList(state.KEY.readNotice);

    let total = 0;

    (mock.conversations || []).forEach((c) => {
        if (readConvs.indexOf(Number(c.id)) > -1) return;
        if (c.unread) total += c.unread;
    });

    (mock.notifications || []).forEach((n) => {
        if (n.read) return;
        if (readNotices.indexOf(Number(n.id)) > -1) return;
        total += 1;
    });

    return total;
}

/* 刷新角标：0 时移除，>99 显示 99+ */
function update() {
    const n = unreadCount();
    try {
        if (n > 0) {
            wx.setTabBarBadge({
                index: MESSAGES_TAB,
                text: n > 99 ? '99+' : String(n),
            });
        } else {
            wx.removeTabBarBadge({ index: MESSAGES_TAB });
        }
    } catch (e) {
        /* 非 tabBar 页或组件未就绪时调用会抛错，忽略即可 */
    }
    return n;
}

module.exports = { unreadCount, update, MESSAGES_TAB };
