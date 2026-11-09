const auth = require('./utils/auth.js');
const badge = require('./utils/badge.js');

App({
    globalData: {
        appName: '重庆对外经贸学院校融媒体中心',
        // 原型阶段：所有数据来自 utils/mock.js，不发任何网络请求
        mock: true,
    },

    onLaunch() {
        // 冷启动恢复登录态：从本地存储读用户信息，避免首屏闪烁
        auth.getUser();
    },

    onShow() {
        // 消息未读角标：每次回到前台重算，否则已读之后角标还挂着
        badge.update();
    },
});
