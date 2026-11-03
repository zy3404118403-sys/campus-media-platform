# 芜宇乐的融媒体中心 · 校园融媒体平台

一套面向校园场景的融媒体内容平台：**Web 端（素材库 / 审核流 / 博客 / 论坛 / 表白墙 / 活动任务 / 数据看板）+ 微信小程序端（30 页，含移动审核后台）**，双端同源一套 Node 后端（`X-Client` 按端隔离会话，小程序 Bearer 免 CSRF）。

> **虚构声明**：本项目为教学演示用途。文中与代码里出现的大学、学院、人物、数据均为虚构，不指向任何真实院校或个人。

## 架构

```
+--------------+   +--------------+
|  Web 浏览器   |   |  微信小程序   |
|  原生多页前端 |   |  30 页原生    |
+------+-------+   +------+-------+
       | X-Client: web    | X-Client: miniapp + Bearer
+------v------------------v-------+
|  Node.js >=22 · 零 npm 依赖      |
|  server.js 1260 行 · 9 域 149 路由|
|  node:sqlite · scrypt · CSRF 双提交|
+---------------+-----------------+
         +------v------+
         | SQLite (WAL)|
         +-------------+
```

## 快速开始

```bash
# Node.js >= 22（使用内置 node:sqlite，无需 npm install）
node server/server.js
# 首次启动自动建库，控制台打印一次 admin / demo 初始随机密码
# 访问 http://127.0.0.1:3000
```

- 演示学生账号：`20230001` / `20230002` 等（密码 `Student@2026`，仅演示用途）
- 小程序：`miniapp/` 用微信开发者工具打开，填入自己的 AppID

## 目录

```
server/    后端 + public/ 前端页面
miniapp/   微信小程序（30 页，含移动管理后台）
scripts/   质量门：静态自检 / 数据对账 46 项 / 性能体检 / 4 组单元测试
docs/      设计与交付文档
```

## 质量门

```bash
node scripts/validate-miniapp.cjs        # 静态自检（类名全覆盖 / 禁用写法）
node scripts/check-mock-consistency.cjs  # 数据自洽 46 项
node scripts/test-admin-items.cjs        # 活动/任务状态机 34 项
# 其余见 scripts/
```

## 安全

- 密码 scrypt 哈希；登录限速（5 次锁 15 分钟）；API 限流（读 300 / 写 30 每分钟）
- CSRF 双提交（cookie + header）；会话按端隔离，web 与小程序互不踢
- 初始密码随机生成、仅在首次启动控制台打印一次，不写入代码
- 安全漏洞请通过 GitHub **Security - Report a vulnerability** 私密报告，请勿公开提 issue

## License

[MIT](LICENSE)
