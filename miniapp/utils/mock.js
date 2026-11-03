/**
 * 原型阶段的本地假数据。
 * 形状对齐校园平台真实接口返回字段（GET /api/materials 等），
 * 接真实接口时只需把 utils/mock.js 换成 wx.request 封装，页面代码不动。
 */

const materials = [
  {
    id: 31,
    title: '2026 篮球赛 · 决赛第三节',
    type: '视频',
    college: '传媒学院',
    shotDate: '2026-10-18',
    duration: '00:48',
    size: '182 MB',
    downloads: 24,
    likes: 12,
    tags: ['篮球赛', '校运会', '混剪'],
    tone: 'ph-1',
    ratio: 'b',
  },
  {
    id: 23,
    title: '三下乡 · 支教第一天',
    type: '图片',
    college: '数字治理学院',
    shotDate: '2026-07-16',
    duration: '',
    size: '2.1 MB',
    downloads: 6,
    likes: 3,
    tags: ['三下乡'],
    tone: 'ph-2',
    ratio: 'a',
  },
  {
    id: 18,
    title: '2025.11.26 迎新晚会 · 舞台全景',
    type: '视频',
    college: '人文学院',
    shotDate: '2025-11-26',
    duration: '02:14',
    size: '498 MB',
    downloads: 41,
    likes: 27,
    tags: ['迎新晚会', '活动', '素材'],
    tone: 'ph-3',
    ratio: 'a',
  },
  {
    id: 15,
    title: '2025.4 运动会 · 开幕式方阵',
    type: '视频',
    college: '人文学院',
    shotDate: '2025-04-12',
    duration: '01:36',
    size: '264 MB',
    downloads: 33,
    likes: 19,
    tags: ['校运会', '活动记录', '混剪'],
    tone: 'ph-4',
    ratio: 'c',
  },
  {
    id: 27,
    title: '教师节 · 采访花絮合集',
    type: '视频',
    college: '融媒体中心',
    shotDate: '2026-09-10',
    duration: '03:02',
    size: '612 MB',
    downloads: 18,
    likes: 9,
    tags: ['教师节', '采访'],
    tone: 'ph-1',
    ratio: 'a',
  },
  {
    id: 29,
    title: '校园四季 · 秋日银杏',
    type: '图片',
    college: '设计学院',
    shotDate: '2026-10-25',
    duration: '',
    size: '3.4 MB',
    downloads: 52,
    likes: 44,
    tags: ['校园四季', '摄影'],
    tone: 'ph-3',
    ratio: 'c',
  },
  {
    id: 32,
    title: '军训汇演 · 方阵航拍',
    type: '视频',
    college: '融媒体中心',
    shotDate: '2026-09-14',
    duration: '03:20',
    size: '620 MB',
    downloads: 38,
    likes: 31,
    tags: ['军训', '航拍', '混剪'],
    tone: 'ph-5',
    ratio: 'c',
  },
  {
    id: 33,
    title: '图书馆 · 自习光影',
    type: '图片',
    college: '人文学院',
    shotDate: '2026-11-02',
    duration: '',
    size: '4.8 MB',
    downloads: 12,
    likes: 9,
    tags: ['摄影', '图书馆', '校园四季'],
    tone: 'ph-6',
    ratio: 'a',
  },
  {
    id: 34,
    title: '2026 春季运动会 · 4×100 米决赛',
    type: '视频',
    college: '传媒学院',
    shotDate: '2026-04-11',
    duration: '01:12',
    size: '264 MB',
    downloads: 19,
    likes: 15,
    tags: ['校运会', '混剪'],
    tone: 'ph-7',
    ratio: 'b',
  },
  {
    id: 35,
    title: '荷花池的清晨',
    type: '图片',
    college: '设计学院',
    shotDate: '2026-06-20',
    duration: '',
    size: '3.1 MB',
    downloads: 33,
    likes: 41,
    tags: ['校园四季', '摄影'],
    tone: 'ph-2',
    ratio: 'c',
  },
  {
    id: 36,
    title: '春樱 · 教学楼前',
    type: '图片',
    college: '数字媒体技术',
    shotDate: '2026-03-28',
    duration: '',
    size: '2.7 MB',
    downloads: 27,
    likes: 35,
    tags: ['校园四季', '摄影'],
    tone: 'ph-3',
    ratio: 'b',
  },
  {
    id: 37,
    title: '校庆 20 周年 · 主舞台灯光',
    type: '视频',
    college: '融媒体中心',
    shotDate: '2026-10-08',
    duration: '02:35',
    size: '512 MB',
    downloads: 46,
    likes: 29,
    tags: ['活动', '校庆', '素材'],
    tone: 'ph-8',
    ratio: 'a',
  },
  {
    id: 38,
    title: '招聘会现场 · 企业洽谈',
    type: '图片',
    college: '数字治理学院',
    shotDate: '2026-10-22',
    duration: '',
    size: '2.2 MB',
    downloads: 8,
    likes: 4,
    tags: ['活动', '招聘'],
    tone: 'ph-1',
    ratio: 'c',
  },
  {
    id: 39,
    title: '实验室的一天',
    type: '视频',
    college: '数字媒体技术',
    shotDate: '2026-09-30',
    duration: '04:02',
    size: '780 MB',
    downloads: 14,
    likes: 11,
    tags: ['纪录片', '实验室'],
    tone: 'ph-4',
    ratio: 'b',
  },
  {
    id: 40,
    title: '辩论赛决赛 · 自由辩论',
    type: '视频',
    college: '人文学院',
    shotDate: '2026-05-16',
    duration: '02:48',
    size: '430 MB',
    downloads: 21,
    likes: 18,
    tags: ['活动', '辩论赛'],
    tone: 'ph-5',
    ratio: 'a',
  },
  {
    id: 41,
    title: '食堂的午间十分钟',
    type: '图片',
    college: '设计学院',
    shotDate: '2026-10-12',
    duration: '',
    size: '1.9 MB',
    downloads: 16,
    likes: 22,
    tags: ['纪实', '食堂'],
    tone: 'ph-6',
    ratio: 'b',
  },
  {
    id: 42,
    title: '志愿者 · 社区支教合影',
    type: '图片',
    college: '融媒体中心',
    shotDate: '2026-07-18',
    duration: '',
    size: '3.6 MB',
    downloads: 9,
    likes: 12,
    tags: ['三下乡', '志愿者'],
    tone: 'ph-2',
    ratio: 'c',
  },
  {
    id: 43,
    title: '校园雪景 · 初雪清晨',
    type: '图片',
    college: '传媒学院',
    shotDate: '2026-01-09',
    duration: '',
    size: '4.1 MB',
    downloads: 58,
    likes: 63,
    tags: ['校园四季', '摄影'],
    tone: 'ph-7',
    ratio: 'a',
  },
  {
    id: 44,
    title: '创新创业大赛 · 路演现场',
    type: '视频',
    college: '数字治理学院',
    shotDate: '2026-06-05',
    duration: '01:35',
    size: '298 MB',
    downloads: 11,
    likes: 7,
    tags: ['活动', '比赛'],
    tone: 'ph-3',
    ratio: 'b',
  },
  {
    id: 45,
    title: '校园快闪 · 民乐与街舞',
    type: '视频',
    college: '传媒学院',
    shotDate: '2026-05-04',
    duration: '02:06',
    size: '356 MB',
    downloads: 34,
    likes: 26,
    tags: ['活动', '快闪', '混剪'],
    tone: 'ph-8',
    ratio: 'c',
  },
  {
    id: 46,
    title: '宿舍楼下的晚读',
    type: '图片',
    college: '人文学院',
    shotDate: '2026-09-25',
    duration: '',
    size: '2.4 MB',
    downloads: 13,
    likes: 10,
    tags: ['纪实', '摄影'],
    tone: 'ph-1',
    ratio: 'a',
  },
  {
    id: 47,
    title: '中心设备清单与借用须知',
    type: '文档',
    college: '融媒体中心',
    shotDate: '2026-09-01',
    duration: '',
    size: '820 KB',
    downloads: 62,
    likes: 8,
    tags: ['文档', '设备'],
    tone: 'ph-4',
    ratio: 'b',
  },
  {
    id: 48,
    title: '大型活动拍摄流程 SOP',
    type: '文档',
    college: '融媒体中心',
    shotDate: '2026-09-05',
    duration: '',
    size: '1.1 MB',
    downloads: 41,
    likes: 6,
    tags: ['文档', '拍摄'],
    tone: 'ph-5',
    ratio: 'a',
  },
  {
    id: 49,
    title: '毕业季 · 抛帽瞬间',
    type: '图片',
    college: '设计学院',
    shotDate: '2026-06-28',
    duration: '',
    size: '3.9 MB',
    downloads: 49,
    likes: 57,
    tags: ['毕业季', '摄影'],
    tone: 'ph-2',
    ratio: 'b',
  },
];

const collections = [
  {
    id: 1,
    title: '迎新季专题',
    desc: '2026 级新生报到、开学典礼、迎新晚会全记录',
    count: 12,
    tone: 'ph-1',
  },
  {
    id: 2,
    title: '校运会影像档案',
    desc: '近三届田径运动会开幕式与精彩瞬间',
    count: 28,
    tone: 'ph-2',
  },
  {
    id: 3,
    title: '校园四季',
    desc: '用镜头记录江畔校区的春樱、夏荫、秋杏与冬雾',
    count: 9,
    tone: 'ph-3',
  },
];

const articles = [
  {
    id: 1,
    title: '在江畔的第三个秋天：我们拍下了什么',
    author: '融媒体中心 · 影像组',
    date: '2026-10-24',
    views: 386,
    excerpt: '从银杏大道到图书馆顶层，六个人的摄影小队用三周时间记录了这个季节。',
    tone: 'ph-1',
  },
  {
    id: 2,
    title: '一次 4K 现场直播背后的 72 小时',
    author: '融媒体中心 · 技术组',
    date: '2026-10-12',
    views: 512,
    excerpt: '三机位、两套备份链路、一次临时改场地——记开学典礼直播的技术复盘。',
    tone: 'ph-4',
  },
  {
    id: 3,
    title: '新生必读：如何申请使用中心设备',
    author: '融媒体中心',
    date: '2026-09-28',
    views: 1204,
    excerpt: '相机、稳定器、无线麦、补光灯的借用流程与归还规范。',
    tone: 'ph-2',
  },
];

const activities = [
  {
    id: 1,
    title: '2026 校园短视频大赛',
    time: '11-15 截止投稿',
    place: '线上投稿',
    joined: 128,
    capacity: 300,
    state: '可报名',
    tone: 'ph-1',
    kicker: 'CONTEST',
    organizer: '融媒体中心 · 影像组',
    points: 60,
    deadline: '2026-11-15 23:59',
    intro:
      '用 90 秒讲清一个校园故事。题材不限，纪录片、剧情、Vlog 均可，鼓励使用中心提供的素材库资源。获奖作品将在校官网与融媒体矩阵同步展播。',
    agenda: [
      { t: '11-01 → 11-15', d: '线上投稿，逾期不再接收' },
      { t: '11-16 → 11-20', d: '初审：格式与原创性核查' },
      { t: '11-22', d: '终审展映，评委现场打分' },
      { t: '11-25', d: '公布结果并发放贡献值' },
    ],
    notes: [
      '作品须为本人原创，引用他人素材须标注来源并取得授权。',
      '画面中的同学需知情同意，涉及未成年人须由监护人同意。',
      '分辨率不低于 1080p，成片时长 60–90 秒。',
    ],
  },
  {
    id: 2,
    title: '融媒体中心招新宣讲会',
    time: '11-08 19:00',
    place: '学术报告厅',
    joined: 86,
    capacity: 200,
    state: '可报名',
    tone: 'ph-2',
    kicker: 'RECRUIT',
    organizer: '融媒体中心',
    points: 10,
    deadline: '2026-11-08 18:00',
    intro:
      '影像组、技术组、运营组三个方向同时招新。现场会演示 4K 直播链路与后期工作流，并安排设备体验环节，欢迎带作品来交流。',
    agenda: [
      { t: '19:00', d: '中心介绍与作品混剪放映' },
      { t: '19:20', d: '三个小组分别讲解工作内容' },
      { t: '19:50', d: '设备体验与自由提问' },
      { t: '20:30', d: '现场登记意向，安排后续面试' },
    ],
    notes: ['无需携带设备，现场提供体验机位。', '宣讲会结束后一周内安排分组面试。'],
  },
  {
    id: 3,
    title: '摄影工作坊 · 人像布光',
    time: '10-30 已结束',
    place: '实训楼 B302',
    joined: 45,
    capacity: 45,
    state: '已结束',
    tone: 'ph-3',
    kicker: 'WORKSHOP',
    organizer: '融媒体中心 · 影像组',
    points: 20,
    deadline: '2026-10-30 14:00',
    intro:
      '从单灯到三灯的布光实操，覆盖证件照、访谈、情绪人像三种场景。现场提供柔光箱、反光板与背景纸。',
    agenda: [
      { t: '14:00', d: '布光基础与器材认识' },
      { t: '14:40', d: '单灯与双灯实操' },
      { t: '15:40', d: '学员互拍与点评' },
    ],
    notes: ['活动已结束，回放与课件可在专题页查看。'],
  },
  {
    id: 4,
    title: '光影校园 · 24 小时摄影马拉松',
    time: '11-22 开拍',
    place: '江畔校区全域',
    joined: 86,
    capacity: 150,
    state: '可报名',
    tone: 'ph-5',
    kicker: 'MARATHON',
    organizer: '融媒体中心 · 摄影组',
    points: 40,
    deadline: '2026-11-22 23:59',
    intro:
      '24 小时内围绕「我在这里的一天」自由拍摄，交付 8 张组图。不限器材，手机与相机同场评比，重点看叙事完整度而非设备参数。',
    agenda: [
      { t: '11-22 08:00', d: '开幕式领取拍摄证与任务卡' },
      { t: '11-23 08:00', d: '24 小时拍摄窗口关闭，统一导片' },
      { t: '11-24 → 11-26', d: '线上展映与公众投票' },
      { t: '11-28', d: '公布结果，作品入素材库' },
    ],
    notes: [
      '组图须为 8 张，围绕同一主题，不接受单张参赛。',
      '拍摄他人须取得口头同意，涉及宿舍、教室内部须提前报备。',
      '允许基础调色，禁止合成、禁止移除或添加主体。',
    ],
  },
  {
    id: 5,
    title: '校园主持人大赛 · 初赛',
    time: '11-18 初赛',
    place: '学术报告厅',
    joined: 64,
    capacity: 120,
    state: '可报名',
    tone: 'ph-6',
    kicker: 'CONTEST',
    organizer: '融媒体中心 · 播音组',
    points: 30,
    deadline: '2026-11-18 20:00',
    intro:
      '初赛为 3 分钟自选稿件播报加 1 分钟即兴评述。优秀选手将进入决赛，并有机会参与校庆晚会与大型活动主持。',
    agenda: [
      { t: '11-18 19:00', d: '初赛第一场（1–30 号）' },
      { t: '11-18 20:30', d: '初赛第二场（31 号起）' },
      { t: '11-20', d: '公布决赛名单（取前 12 名）' },
      { t: '11-28', d: '决赛与颁奖' },
    ],
    notes: [
      '自选稿件需提前一天提交，逾期视为放弃。',
      '现场提供手持话筒与立式话筒，耳返需自备。',
      '着装整洁即可，不做硬性正装要求。',
    ],
  },
  {
    id: 6,
    title: '秋季运动会 · 志愿服务',
    time: '10-20 已结束',
    place: '田径场',
    joined: 112,
    capacity: 120,
    state: '已结束',
    tone: 'ph-7',
    kicker: 'VOLUNTEER',
    organizer: '融媒体中心 · 综合组',
    points: 15,
    deadline: '2026-10-20 12:00',
    intro:
      '为运动会提供器材搬运、检录协助与看台引导。已完成服务并录入志愿时长，贡献值已发放至个人账户。',
    agenda: [
      { t: '10-19 18:00', d: '志愿者培训与分组' },
      { t: '10-20 07:30', d: '到岗签到，领取工牌' },
      { t: '10-20 17:30', d: '收尾与器材清点' },
    ],
    notes: [
      '本次活动已结束，仅保留记录供查询。',
      '志愿时长已同步至学生事务系统。',
    ],
  },
  {
    id: 7,
    title: '冬日暖阳 · 寒假返乡影像征集',
    time: '01-10 截止',
    place: '线上投稿',
    joined: 0,
    capacity: 200,
    state: '草稿',
    tone: 'ph-6',
    kicker: 'CALL FOR WORKS',
    organizer: '融媒体中心 · 影像组',
    points: 30,
    deadline: '2027-01-10 23:59',
    intro:
      '记录寒假返乡途中的年味与变化：车站、集市、家里的年夜饭。每人可投 3 组，鼓励手机拍摄。',
    agenda: [
      { t: '12-20 → 01-10', d: '线上投稿' },
      { t: '01-12 → 01-16', d: '初审与线上展映' },
      { t: '01-18', d: '公布结果' },
    ],
    notes: [
      '组图不超过 9 张，须为本人拍摄。',
      '涉及他人正面须取得同意。',
    ],
  },
  {
    id: 8,
    title: '春季摄影工作坊 · 人像进阶',
    time: '待定',
    place: '实训楼 B302',
    joined: 0,
    capacity: 30,
    state: '草稿',
    tone: 'ph-8',
    kicker: 'WORKSHOP',
    organizer: '融媒体中心 · 摄影组',
    points: 20,
    deadline: '2027-03-05 18:00',
    intro:
      '两小时工作坊：眼神光、轮廓光与自然光补光。需自带相机或可手动模式的手机。',
    agenda: [
      { t: '上半场', d: '布光原理与三种经典人像光位' },
      { t: '下半场', d: '分组实拍与即时讲评' },
    ],
    notes: ['限 30 人，报满即止。', '场地设备由中心提供，相机需自备。'],
  },
];

const tasks = [
  {
    id: 5,
    title: '迎新晚会现场记录',
    type: '视频',
    points: 50,
    slots: '3 人',
    deadline: '11-30',
    deadlineFull: '2026-11-30 23:59',
    desc: '拍摄 3 段不少于 60 秒的现场素材，含舞台全景与观众反应。',
    deliver: '3 段 1080p 视频 + 1 段 15 秒竖版精简（用于视频号）',
    claimedCount: 2,
    state: '进行中',
    requirements: [
      '素材为原始机位文件，不做剪辑、不加水印，保留拍摄时间信息。',
      '舞台全景需覆盖主屏与两侧灯光，观众反应不少于 2 个机位角度。',
      '拍摄前到后台登记设备与机位，结束后当天回传。',
    ],
    demo: true,
    claimed: false,
  },
  {
    id: 6,
    title: '校园四季 · 秋日摄影征集',
    type: '照片',
    points: 30,
    slots: '10 人',
    deadline: '12-15',
    deadlineFull: '2026-12-15 23:59',
    desc: '提交 5 张以上竖幅照片，分辨率不低于 3000px，需为本人原创。',
    deliver: '5 张以上竖幅原图（JPG，长边 ≥ 3000px）',
    claimedCount: 6,
    state: '进行中',
    requirements: [
      '拍摄地点限江畔校区，题材为秋季校园，鼓励早晚黄金时段。',
      '仅做基础曝光与色彩调整，不做合成、不添加或删减主体。',
      '画面中出现可识别的同学需取得本人同意。',
    ],
    demo: true,
    claimed: false,
  },
  {
    id: 7,
    title: '学院宣传片剪辑',
    type: '设计',
    points: 80,
    slots: '2 人',
    deadline: '12-31',
    deadlineFull: '2026-12-31 23:59',
    desc: '根据提供的素材剪辑 90 秒宣传片，需包含字幕与配乐。',
    deliver: '90 秒成片（1080p / H.264）+ 工程文件 + 字幕文件',
    claimedCount: 2,
    state: '进行中',
    requirements: [
      '素材由中心统一提供，成片需过审后再对外发布。',
      '配乐须使用无版权或已授权曲目，字幕使用规范字体。',
      '交付时附工程文件，便于后续修改。',
    ],
    demo: true,
    claimed: true,
  },
  {
    id: 8,
    title: '运动会精彩瞬间',
    type: '照片',
    points: 40,
    slots: '5 人',
    deadline: '11-15',
    deadlineFull: '2026-11-15 23:59',
    desc: '抓拍至少 8 个比赛瞬间，含冲刺与颁奖环节。',
    deliver: '8 张以上横版照片（长边 ≥ 2400px）+ 简要画面说明',
    claimedCount: 3,
    state: '进行中',
    requirements: [
      '不得进入赛道与裁判区，服从现场工作人员指挥。',
      '连拍素材仅提交精选结果，单张不超过 8MB。',
    ],
    demo: true,
    claimed: false,
  },
  {
    id: 9,
    title: '校庆宣传片 · 空镜补拍',
    type: '视频',
    points: 60,
    slots: '2 人',
    deadline: '11-25',
    deadlineFull: '2026-11-25 23:59',
    desc: '按分镜表补拍 6 组空镜：校门晨光、图书馆旋转楼梯、实验室特写、操场跑道、教学楼走廊、荷花池倒影。',
    deliver: '6 组空镜原始素材（4K 25p，Log 或标准色彩均可）',
    claimedCount: 1,
    state: '进行中',
    requirements: [
      '严格按分镜表构图，同一场景至少给出一稳一移两种方案。',
      '晨光组需在 07:00 前完成，光线过曝不做补救。',
      '素材不做剪辑，保留全部原始片段与拍摄时间信息。',
    ],
    demo: true,
    claimed: false,
  },
  {
    id: 10,
    title: '中心设备盘点 · 图文说明',
    type: '设计',
    points: 25,
    slots: '1 人',
    deadline: '11-20',
    deadlineFull: '2026-11-20 23:59',
    desc: '整理现有 12 台相机与 8 支镜头的实拍样张，每台一张，配 50 字以内的适用场景说明，用于更新设备借用页。',
    deliver: '12 张样张 + 说明文案（表格提交）',
    claimedCount: 2,
    state: '进行中',
    requirements: [
      '同一场景、同一光线下拍摄，便于横向对比。',
      '说明写清适用场景与短板，不写营销话术。',
      '设备编号须与借用登记表一致。',
    ],
    demo: true,
    claimed: false,
  },
  {
    id: 11,
    title: '图书馆闭馆前半小时 · 纪实组图',
    type: '照片',
    points: 35,
    slots: '3 人',
    deadline: '12-10',
    deadlineFull: '2026-12-10 23:59',
    desc: '记录闭馆前 30 分钟的真实状态：还书、收拾书包、管理员关灯。要求 6 张以上，有人物的至少 3 张。',
    deliver: '6 张以上原图（长边 ≥ 3000px）+ 100 字说明',
    claimedCount: 4,
    state: '进行中',
    requirements: [
      '须提前向图书馆值班老师报备，不影响读者。',
      '人物正面须取得同意，可拍背影与侧影规避。',
      '不摆拍、不引导，保持现场原状。',
    ],
    demo: true,
    claimed: false,
  },
  {
    id: 12,
    title: '招生宣传 · 学院风采图文',
    type: '设计',
    points: 45,
    slots: '4 人',
    deadline: '12-05',
    deadlineFull: '2026-12-05 23:59',
    desc: '为所在学院产出一组招生宣传图文（3 张图 + 300 字），突出专业特色与实训条件，风格统一。',
    deliver: '3 张横版图（1920×1080）+ 300 字文案',
    claimedCount: 3,
    state: '进行中',
    requirements: [
      '内容须真实，不夸大设备与就业数据。',
      '人物出镜需取得同意，可优先使用已入库素材。',
      '文案避免空泛形容，写具体场景与课程。',
    ],
    demo: true,
    claimed: false,
  },
  {
    id: 13,
    title: '寒假返乡 · 家乡年味组图',
    type: '照片',
    points: 40,
    slots: '不限',
    deadline: '01-10',
    deadlineFull: '2027-01-10 23:59',
    desc: '拍摄家乡春节相关场景 6 张以上，含至少 2 张人物活动画面。',
    deliver: '6 张以上原图 + 100 字说明',
    claimedCount: 0,
    state: '草稿',
    requirements: [
      '须为本人拍摄，不接受网络图片。',
      '人物正面须取得同意。',
    ],
    demo: true,
    claimed: false,
  },
  {
    id: 14,
    title: '新学期 · 校园第一缕晨光',
    type: '照片',
    points: 30,
    slots: '5 人',
    deadline: '03-01',
    deadlineFull: '2027-03-01 23:59',
    desc: '开学首周拍摄校园晨光场景，重点拍教学楼与操场方向。',
    deliver: '3 张原图（长边 ≥ 3000px）',
    claimedCount: 0,
    state: '草稿',
    requirements: ['07:00 前完成拍摄。'],
    demo: true,
    claimed: false,
  },
];

/* ───────── 社区：博客 / 论坛 / 表白墙 ─────────
 * 三者的差异是「内容形态」而不是「列表结构」：
 *   博客 = 长文 + 封面 + 阅读量        → 有摘要与作者署名
 *   论坛 = 分板块的主题帖 + 回复        → 有板块归属与置顶
 *   表白墙 = 短文本 + 匿名              → 无标题、无封面
 * 所以社区页做成 3 个 tab 共用一个列表容器，详情页一页三模式。
 */

const blogPosts = [
  {
    id: 101,
    title: '把 4K 素材从 900MB 压到 180MB，我们踩过的坑',
    excerpt: '码率、关键帧间隔、CRF 三个参数怎么搭配，才能既保住暗部细节又不撑爆存储。',
    author: '技术组 · 陈斯远',
    date: '2026-10-28',
    readMin: 6,
    views: 342,
    likes: 28,
    comments: 6,
    tone: 'ph-1',
    body: [
      '运动会那次拍了 46 分钟 4K 素材，原始文件 62GB。传到服务器只用了十分钟，但接下来一周的存储告警让我们不得不重新算一遍码率。',
      '结论是：CRF 20 + 关键帧间隔 2 秒，对校园活动这类中高运动量素材，能在主观画质几乎无差别的前提下把体积压到原来的 28%。再往下压（CRF 24 以上）暗部会先崩，舞台黑场里的观众脸会糊成一片。',
      '另一个容易忽略的点是音频。AAC 192kbps 对现场扩声素材其实不够，鼓点会有金属感；我们最后用了 256kbps，体积增加不到 3%。',
    ],
  },
  {
    id: 102,
    title: '一次校园直播的 72 小时：三机位、双链路、一次临时改场地',
    excerpt: '开学典礼直播的技术复盘——开播前 40 分钟备用链路抖动，证明冗余不是浪费。',
    author: '技术组 · 团队',
    date: '2026-10-12',
    readMin: 8,
    views: 512,
    likes: 41,
    comments: 11,
    tone: 'ph-4',
    body: [
      '原定在田径场，前一天下午通知改到体育馆。这意味着机位、电源、网络全部重排——三脚架的位置、导播台的朝向、甚至摄像师的走位都要重新画一遍。',
      '我们把主备两条网络链路同时接到导播台，编码器做双路推流。开播前 40 分钟，备用链路出现了一次 2 秒的抖动，主链路没有受影响，但如果当时只有一条链路，那就是一次播出事故。',
      '峰值在线 1,240 人，全程无中断。复盘文档已归档，下一届可以直接复用这套配置。',
    ],
  },
  {
    id: 103,
    title: '新生必读：设备借用流程与三个最容易踩的坑',
    excerpt: '相机、稳定器、无线麦、补光灯怎么借、借多久、还的时候要注意什么。',
    author: '融媒体中心',
    date: '2026-09-28',
    readMin: 4,
    views: 1204,
    likes: 96,
    comments: 23,
    tone: 'ph-2',
    body: [
      '中心现有全画幅相机 4 台、稳定器 3 套、无线麦克风 6 组、补光灯 2 套，以及一套 4K 三机位直播设备，全部对校内师生开放借用。',
      '流程：平台提交申请 → 说明用途与时长 → 管理员审核 → 到实训楼 B302 签字领取。单次借用一般不超过 72 小时。',
      '三个坑：① 忘记清空存储卡，交回来时满卡导致下一位同学无法拍摄；② 无线麦电池没充，现场才发现只剩一格；③ 镜头没擦，指纹在逆光下会形成明显眩光。',
    ],
  },
];

const forumBoards = [
  { id: 1, name: '器材交流', desc: '机身镜头灯光', threads: 24, tone: 'ph-1' },
  { id: 2, name: '后期技巧', desc: '剪辑调色特效', threads: 18, tone: 'ph-2' },
  { id: 3, name: '约拍组队', desc: '找搭档找模特', threads: 31, tone: 'ph-3' },
  { id: 4, name: '活动通告', desc: '校内拍摄招募', threads: 9, tone: 'ph-4' },
];

const forumThreads = [
  {
    id: 201,
    boardId: 4,
    title: '本周六校运会需要 2 位摄影同学（有补贴）',
    excerpt: '上午 8:00–12:00，田径场。主要拍冲刺和颁奖，中心提供长焦。',
    author: '影像组 · 周奕',
    date: '2026-10-31',
    replies: 12,
    likes: 8,
    pinned: true,
    tone: 'ph-4',
    body: [
      '时间：本周六 8:00–12:00（可只来半天）',
      '地点：江畔校区田径场',
      '需求：2 位同学，负责冲刺瞬间与颁奖环节，中心提供 70-200 长焦与备用电池。',
      '回报：按实际时长计入贡献值，另提供午餐。有作品可直接归档进素材库并署名。',
    ],
  },
  {
    id: 202,
    boardId: 1,
    title: '新手第一台相机，预算 5000 该买什么？',
    excerpt: '主要拍校园活动和社团记录，纠结二手全画幅还是新半画幅。',
    author: '数媒 2026 · 小林',
    date: '2026-10-30',
    replies: 21,
    likes: 15,
    pinned: false,
    tone: 'ph-1',
    body: [
      '预算 5000 左右，主要拍社团活动和晚会，偶尔拍人像。看了二手 5D3 和新的半画幅，不知道怎么选。',
      '另外想问一下，中心的长焦平时能借吗？如果借得到，我是不是可以先只买机身加标变。',
    ],
  },
  {
    id: 203,
    boardId: 2,
    title: '分享一个把室内晚会素材救回来的调色思路',
    excerpt: '高 ISO 噪点 + 舞台混色光，用降噪节点分离 + 分离色调压回去。',
    author: '技术组 · 陈斯远',
    date: '2026-10-29',
    replies: 6,
    likes: 34,
    pinned: false,
    tone: 'ph-3',
    body: [
      '晚会素材最常见的问题是：ISO 3200 以上噪点多，舞台又是红蓝混光，直接拉曲线会把肤色拉成塑料。',
      '我的做法是先在节点里做一次轻度降噪（不要把噪点完全抹平，留一点颗粒更自然），然后用限定器把肤色单独选出来保护，再调整体对比。',
      '如果混光太脏，可以整体降饱和 10–15%，观感反而更干净。',
    ],
  },
  {
    id: 204,
    boardId: 3,
    title: '想拍一组「图书馆闭馆前半小时」，找模特',
    excerpt: '晚上 9:30–10:00，自然光 + 台灯，安静纪实风格。',
    author: '数媒 2025 · 阿岚',
    date: '2026-10-27',
    replies: 9,
    likes: 12,
    pinned: false,
    tone: 'ph-2',
    body: [
      '想拍闭馆前那段安静的时间：收拾书包、合上书、走廊灯一盏盏关掉。',
      '需要 1–2 位同学出镜，不需要表演，正常自习就好。成片会先给你看，同意后才归档。',
    ],
  },
  {
    id: 205,
    boardId: 1,
    title: '中心的稳定器电池是不是该换了',
    excerpt: '上周拍的时候第三块电池只撑了 20 分钟。',
    author: '影像组 · 周奕',
    date: '2026-10-25',
    replies: 4,
    likes: 3,
    pinned: false,
    tone: 'ph-2',
    body: [
      '上周外拍，第三块电池上机只撑了 20 分钟就掉到一格，前两块都正常。',
      '已经报给管理员，先记一笔，避免别的同学踩坑。如果确认是电池老化，建议这学期换两块。',
    ],
  },
];

const wallPosts = [
  {
    id: 301,
    content: '想谢谢上周三在图书馆帮我捡起一地笔记的那位同学，你走得很快，我没来得及说谢谢。',
    author: '匿名',
    date: '2026-11-01',
    likes: 47,
    comments: 5,
    tone: 'ph-3',
    body: [
      '想谢谢上周三在图书馆三楼帮我捡起一地笔记的那位同学。当时风把窗吹开，我的资料全飞了，你蹲下来帮我一张张捡，还按页码排好了。',
      '你走得很快，我抱着资料没来得及说谢谢。如果你看到这条，真的很感谢。',
    ],
  },
  {
    id: 302,
    content: '连续三周在操场遇到同一个跑步的人，想打个招呼又怕认错。',
    author: '匿名',
    date: '2026-10-31',
    likes: 32,
    comments: 8,
    tone: 'ph-1',
    body: [
      '连续三周，每周二四晚上八点左右，在操场东南角遇到同一个跑步的人。灰色帽子，总是跑外道。',
      '想打个招呼，又怕认错人尴尬。如果你也刷到这条，就当我说过了。',
    ],
  },
  {
    id: 303,
    content: '给所有在实训楼 B302 通宵剪片的同学：记得吃饭。',
    author: '匿名',
    date: '2026-10-30',
    likes: 61,
    comments: 12,
    tone: 'ph-4',
    body: [
      '给所有在实训楼 B302 通宵剪片的同学：记得吃饭，记得回宿舍睡一觉。',
      '片子永远剪不完，但身体只有一个。楼下便利店 24 小时，别只喝咖啡。',
    ],
  },
  {
    id: 304,
    content: '第一次投稿被退回，改完之后入库了，想说其实被退回没那么可怕。',
    author: '数媒 2026 · 小林',
    date: '2026-10-28',
    likes: 25,
    comments: 6,
    tone: 'ph-2',
    body: [
      '第一次投稿被退回，原因是画面偏暗、人物面部没处理。当时挺受挫的，觉得是不是自己不适合。',
      '按退回原因重拍了一次，补了授权说明，再提交就入库了。现在能在素材库里搜到自己的名字。',
      '想说，被退回不是否定，是有人认真看了你的东西。',
    ],
  },
];

/* 评论：postKey = 类型 + id，便于一页三模式共用 */
const comments = {
  'blog-101': [
    { id: 1, author: '影像组 · 周奕', text: '关键帧间隔这个点太重要了，我们之前一直用默认值。', date: '10-29', likes: 6 },
    { id: 2, author: '数媒 2025 · 阿岚', text: '音频那段有同感，鼓点确实会金属化。', date: '10-29', likes: 3 },
    { id: 3, author: '匿名', text: '想问一下 CRF 20 对航拍素材也适用吗？', date: '10-30', likes: 1 },
  ],
  'blog-102': [
    { id: 1, author: '技术组 · 陈斯远', text: '补充一句：备用链路那次抖动后我们加了一个心跳检测。', date: '10-13', likes: 9 },
    { id: 2, author: '匿名', text: '1240 人峰值，比想象中多。', date: '10-13', likes: 4 },
  ],
  'blog-103': [
    { id: 1, author: '数媒 2026 · 小林', text: '第三条我真的踩过，逆光眩光很明显。', date: '09-29', likes: 12 },
    { id: 2, author: '匿名', text: '请问假期能借吗？', date: '10-02', likes: 2 },
  ],
  'thread-201': [
    { id: 1, author: '数媒 2026 · 小林', text: '报名！周六上午有空，之前拍过两届运动会。', date: '10-31', likes: 3 },
    { id: 2, author: '数媒 2025 · 阿岚', text: '下午可以来，上午有课。', date: '11-01', likes: 1 },
  ],
  'thread-202': [
    { id: 1, author: '技术组 · 陈斯远', text: '先借中心的长焦，机身买半画幅新的更稳，二手全画幅的维修成本你可能扛不住。', date: '10-30', likes: 14 },
    { id: 2, author: '匿名', text: '同意楼上，镜头比机身重要。', date: '10-31', likes: 6 },
  ],
  'thread-203': [
    { id: 1, author: '数媒 2026 · 小林', text: '限定器选肤色这招学到了，之前一直是整体调。', date: '10-29', likes: 5 },
  ],
  'thread-204': [
    { id: 1, author: '匿名', text: '可以当模特，晚上九点半我在图书馆。', date: '10-28', likes: 4 },
  ],
  'thread-205': [
    { id: 1, author: '匿名', text: '我上周也遇到了，第三块确实不行。', date: '10-26', likes: 2 },
  ],
  'wall-301': [
    { id: 1, author: '匿名', text: '是我（大概）。不用谢，别把笔记再吹跑了。', date: '11-01', likes: 22 },
    { id: 2, author: '匿名', text: '这条好感人。', date: '11-01', likes: 8 },
  ],
  'wall-302': [
    { id: 1, author: '匿名', text: '灰色帽子跑外道，感觉我也见过。', date: '10-31', likes: 7 },
  ],
  'wall-303': [
    { id: 1, author: '匿名', text: '谢谢，正在 B302 通宵。', date: '10-31', likes: 19 },
    { id: 2, author: '匿名', text: '便利店的三明治救过我。', date: '10-31', likes: 5 },
  ],
  'wall-304': [
    { id: 1, author: '匿名', text: '「被退回不是否定，是有人认真看了你的东西」这句真好。', date: '10-29', likes: 31 },
  ],
};

/* ───────── 消息与通知 ─────────
 * conversations  = 私信会话列表（GET /api/messages/conversations）
 * messages[conv] = 某会话的消息流（GET /api/messages/chat/:partner）
 * notifications  = 系统通知（GET /api/community/notifications）
 */

const conversations = [
  {
    id: 1,
    name: '影像组 · 周奕',
    initial: '周',
    last: '周六上午可以，我带长焦过去',
    time: '21:42',
    unread: 2,
    tone: 'q-1',
  },
  {
    id: 2,
    name: '数媒 2026 · 小林',
    initial: '林',
    last: '谢谢老师，我把降噪节点截图发你了',
    time: '18:05',
    unread: 0,
    tone: 'q-2',
  },
  {
    id: 3,
    name: '技术组 · 陈斯远',
    initial: '陈',
    last: '直播回放已经传到素材库了，标题里带了 4K',
    time: '昨天',
    unread: 0,
    tone: 'q-3',
  },
];

const messages = {
  1: [
    { id: 11, from: 'peer', text: '看到你报的名了，周六校运会拍摄还来得吗？', time: '21:30' },
    { id: 12, from: 'me', text: '可以的，上午 8 点前到田径场。', time: '21:35' },
    { id: 13, from: 'peer', text: '那太好了，中心有两支 70-200，你直接用。', time: '21:38' },
    { id: 14, from: 'peer', text: '周六上午可以，我带长焦过去', time: '21:42' },
  ],
  2: [
    { id: 21, from: 'peer', text: '老师，晚会素材那个噪点问题有办法吗？ISO 3200 拍的。', time: '17:52' },
    { id: 22, from: 'me', text: '先在节点里做一次轻度降噪，别抹太平，然后用限定器把肤色选出来保护。', time: '17:58' },
    { id: 23, from: 'peer', text: '谢谢老师，我把降噪节点截图发你了', time: '18:05' },
  ],
  3: [
    { id: 31, from: 'peer', text: '直播回放已经传到素材库了，标题里带了 4K', time: '昨天 16:20' },
    { id: 32, from: 'me', text: '收到，我把它加进「开学典礼」专题集。', time: '昨天 16:41' },
  ],
};

const notifications = [
  {
    id: 1,
    kind: 'review',
    title: '投稿已通过',
    body: '你的「图书馆 · 自习光影」已通过审核并归档进素材库。',
    time: '10-18 14:22',
    read: false,
    linkType: 'myUploads',
  },
  {
    id: 2,
    kind: 'comment',
    title: '有人评论了你的帖子',
    body: '匿名：被退回不是否定，是有人认真看了你的东西。',
    time: '10-29 09:10',
    read: false,
    linkType: 'wall',
    linkId: 304,
  },
  {
    id: 3,
    kind: 'review',
    title: '投稿被退回',
    body: '「2026 迎新晚会 · 后台纪实」：画面偏暗，且人物面部未做处理。',
    time: '10-30 11:05',
    read: true,
    linkType: 'myUploads',
  },
  {
    id: 4,
    kind: 'system',
    title: '任务大厅开放',
    body: '第一批校园拍摄与设计任务已开放，可在大厅领取。',
    time: '10-31 09:00',
    read: true,
    linkType: 'tasks',
  },
  {
    id: 5,
    kind: 'like',
    title: '你的表白墙收到了 22 个赞',
    body: '「谢谢上周三在图书馆帮我捡起一地笔记的那位同学」',
    time: '11-01 08:15',
    read: false,
    linkType: 'wall',
    linkId: 301,
  },
];

const profile = {
  name: '芜宇乐',
  sid: '20260000001',
  // 原型演示账号设为管理员：小程序端要能走通审核→入库的完整链路
  role: 'admin',
  college: '数字媒体技术 · 2026 级',
  // 占位：真实分数在下方由 pointOverview 回填，避免同一事实写两遍又改漏一处
  points: 0,
  rank: 0,
  stats: { favorites: 0, downloads: 0, uploads: 0 },
};

/* ───────── 我的：收藏 / 下载 / 投稿 ─────────
 * 收藏与下载直接由 materials 派生（只存 id + 时间），避免与素材字段重复维护。
 * 投稿是本人作品，可能尚未公开（待审核），所以字段独立。
 */

const myFavorites = [
  { id: 18, at: '2026-10-28' },
  { id: 29, at: '2026-10-26' },
  { id: 15, at: '2026-10-20' },
  { id: 27, at: '2026-10-11' },
].map(function (x) {
  return Object.assign({}, byId(materials, x.id), { at: x.at });
});

const myDownloads = [
  { id: 31, at: '2026-10-30' },
  { id: 29, at: '2026-10-27' },
  { id: 23, at: '2026-10-15' },
].map(function (x) {
  return Object.assign({}, byId(materials, x.id), { at: x.at });
});

const myUploads = [
  {
    id: 41,
    title: '2026 迎新晚会 · 后台纪实',
    type: '图片',
    college: '数字媒体技术 · 2026 级',
    size: '18.4 MB',
    status: 'rejected',
    reason: '画面偏暗，且人物面部未做处理。请调整曝光后重新提交，涉及同学肖像需附授权说明。',
    at: '2026-10-30',
    tone: 'ph-2',
  },
  {
    id: 40,
    title: '军训汇演 · 方阵航拍',
    type: '视频',
    college: '数字媒体技术 · 2026 级',
    size: '320 MB',
    status: 'pending',
    reason: '',
    at: '2026-10-29',
    tone: 'ph-4',
  },
  {
    id: 39,
    title: '图书馆 · 自习光影',
    type: '图片',
    college: '数字媒体技术 · 2026 级',
    size: '4.2 MB',
    status: 'published',
    reason: '',
    at: '2026-10-18',
    tone: 'ph-1',
  },
];

/* 统计由列表派生：数字与列表条数永远一致 */
profile.stats = {
  favorites: myFavorites.length,
  downloads: myDownloads.length,
  uploads: myUploads.length,
};

/* ───────── 贡献值 ─────────
 * pointOverview = 我的贡献值总览（GET /api/points/me）
 * pointRules    = 赚取规则（GET /api/points/rules）
 * pointRank     = 排行榜（GET /api/points/rank）
 * pointLogs     = 收支流水（GET /api/points/logs）
 * 注：total 与 pointLogs 求和保持相等，避免页面上数字对不上被看出是假数据
 */

const pointOverview = {
  total: 32,
  rank: 1,
  totalUsers: 466,
  month: 2,        // 本月（11 月）新增
  nextLevel: 50,   // 距下一档
};

/* ⚠️ profile 与 pointOverview 必须同源
 * 之前 profile 写死 points: 120 / rank: 7，而贡献值页读的是 total: 32 / rank: 1，
 * 于是「我的」显示 120 分第 7 名，点进贡献值中心变成 32 分第 1 名 —— 同一用户两套数字。
 * 这里用 pointOverview 覆盖，保证登录态、个人中心、贡献值页读到的完全一致。 */
profile.points = pointOverview.total;
profile.rank = pointOverview.rank;

const pointRules = [
  { key: 'image', text: '图片素材通过审核', points: 2, ico: 'ico-image-g' },
  { key: 'video', text: '视频素材通过审核', points: 5, ico: 'ico-video-g' },
  { key: 'doc', text: '文档 / 音频通过审核', points: 3, ico: 'ico-file-g' },
  { key: 'featured', text: '被管理员精选', points: 10, ico: 'ico-award-g' },
  { key: 'blog', text: '发布博客文章', points: 10, ico: 'ico-chat-g' },
];

const pointRank = [
  { id: 1, name: '芜宇乐', initial: '芜', points: 32, college: '数字媒体技术 2026 级', mine: true },
  { id: 2, name: '陈屿', initial: '陈', points: 7, college: '传媒学院' },
  { id: 3, name: '周聿', initial: '周', points: 2, college: '人文学院' },
  { id: 4, name: '林知远', initial: '林', points: 0, college: '数字媒体技术 2026 级' },
];

const pointLogs = [
  { id: 1, text: '上传素材《图书馆 · 自习光影》', sub: '审核通过 · 图片', points: 2, time: '11-02 09:31' },
  { id: 2, text: '完成任务「迎新晚会现场记录」', sub: '成果已采纳', points: 5, time: '10-30 19:05' },
  { id: 3, text: '素材被精选进「校园四季 · 影像志」', sub: '管理员精选', points: 10, time: '10-28 16:00' },
  { id: 4, text: '上传素材《军训汇演 · 方阵航拍》', sub: '审核通过 · 视频', points: 5, time: '10-26 14:22' },
  { id: 5, text: '发布博客《我在融媒体中心的第一年》', sub: '文章通过审核', points: 10, time: '10-15 21:40' },
];

/* 前台可见集合：草稿只出现在管理后台，C 端列表/首页/图谱都不该看到 */
function publicActivities() {
  return activities.filter((a) => a.state !== '草稿');
}

function publicTasks() {
  return tasks.filter((t) => t.state !== '草稿');
}

/* 模拟网络延迟，用于验证 loading 态 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms || 380));
}

function byId(list, id) {
  const target = Number(id);
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === target) return list[i];
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════
   管理员后台数据
   ───────────────────────────────────────────────────────────
   对齐 Web 后台的 11 个模块，但小程序端只保留「手机上真会做」的：
     总览 / 审核队列 / 内容管理 / 成员管理 / 通知发布
   Web 端的「招新管理 / 审计日志 / 访问统计 / 媒体矩阵 / 文章工作台」
   都是需要大表格或长流程的操作，手机上做反而低效，故不搬（页面里会写明）。
   ═══════════════════════════════════════════════════════════ */

/* 待审队列：真实后台里由 POST /api/materials 写入，这里给人工构造的样本 */
const reviewQueue = [
  {
    id: 1841,
    title: '2026 迎新晚会 · 后台花絮',
    type: '视频',
    college: '传媒学院',
    author: '陈屿',
    sidMask: '2026****0033',
    size: '412 MB',
    at: '11-03 14:20',
    duration: '02:36',
    tone: 'ph-5',
    ratio: 'b',
    /* 系统预检提示：给审核员看，不代替人判断 */
    hints: ['画面含 3 处可识别面孔', '时长超 2 分钟，建议截取竖版精简'],
  },
  {
    id: 1840,
    title: '社团招新 · 街舞社快闪',
    type: '视频',
    college: '设计学院',
    author: '周聿',
    sidMask: '2026****0058',
    size: '268 MB',
    at: '11-03 11:07',
    duration: '01:18',
    tone: 'ph-8',
    ratio: 'c',
    hints: ['背景音乐疑似版权曲目，需确认授权'],
  },
  {
    id: 1839,
    title: '图书馆四楼 · 靠窗自习位',
    type: '图片',
    college: '人文学院',
    author: '林知远',
    sidMask: '2026****0071',
    size: '3.2 MB',
    at: '11-03 09:45',
    duration: '',
    tone: 'ph-6',
    ratio: 'a',
    hints: [],
  },
  {
    id: 1838,
    title: '实验楼走廊 · 夜景延时',
    type: '视频',
    college: '数字媒体技术',
    author: '芜宇乐',
    sidMask: '2026****0001',
    size: '186 MB',
    at: '11-02 21:30',
    duration: '00:42',
    tone: 'ph-4',
    ratio: 'b',
    hints: ['帧率 24fps，低于建议的 25fps'],
  },
  {
    id: 1837,
    title: '食堂三楼 · 冬季新菜品',
    type: '图片',
    college: '设计学院',
    author: '苏见',
    sidMask: '2026****0092',
    size: '2.4 MB',
    at: '11-02 17:12',
    duration: '',
    tone: 'ph-7',
    ratio: 'c',
    hints: ['画面无明显人脸，可直接入库'],
  },
  {
    id: 1836,
    title: '校运会秩序册 · 电子版',
    type: '文档',
    college: '融媒体中心',
    author: '芜宇乐',
    sidMask: '2026****0001',
    size: '1.6 MB',
    at: '11-02 10:05',
    duration: '',
    tone: 'ph-1',
    ratio: 'a',
    hints: [],
  },
];

/* 退回原因预置：与 Web 后台的口径一致，避免同一个人在两端看到不同理由 */
const rejectReasons = [
  '画面清晰度不足，无法用于正式发布',
  '含未授权的可识别肖像，需取得同意后重传',
  '疑似使用未授权背景音乐',
  '与库中已有素材高度重复',
  '标题与描述信息不完整',
  '内容与校园宣传主题无关',
];

/* 成员列表：学号一律只存脱敏形式。
   Web 后台的用户页曾完整显示 13 位真实学号（含本人），截图外流风险太高，
   小程序端从数据层就不存完整值，页面没有"取消脱敏"这条路可点。 */
const adminUsers = [
  { id: 1, name: '芜宇乐', sidMask: '2026****0001', college: '数字媒体技术', role: 'admin', status: '正常', uploads: 3, joinedAt: '2026-09-01' },
  { id: 2, name: '陈屿', sidMask: '2026****0033', college: '传媒学院', role: 'reviewer', status: '正常', uploads: 7, joinedAt: '2026-09-03' },
  { id: 3, name: '周聿', sidMask: '2026****0058', college: '设计学院', role: 'member', status: '正常', uploads: 2, joinedAt: '2026-09-05' },
  { id: 4, name: '林知远', sidMask: '2026****0071', college: '人文学院', role: 'member', status: '正常', uploads: 5, joinedAt: '2026-09-08' },
  { id: 5, name: '苏见', sidMask: '2026****0092', college: '设计学院', role: 'member', status: '限制上传', uploads: 1, joinedAt: '2026-09-12' },
  { id: 6, name: '唐知宸', sidMask: '2025****0114', college: '数字治理学院', role: 'member', status: '正常', uploads: 4, joinedAt: '2025-09-02' },
];

const ROLE_TEXT = { admin: '管理员', reviewer: '审核员', member: '成员' };

/* 各学院开通账号数：合计必须等于 pointOverview.totalUsers（466），
   否则「发通知触达 466 人」和「按学院相加」会对不上。
   check-mock-consistency.cjs 里有一条断言在守这个和。 */
const collegeUsers = [
  { name: '数字治理学院', n: 122 },
  { name: '传媒学院', n: 96 },
  { name: '人文学院', n: 88 },
  { name: '设计学院', n: 72 },
  { name: '数字媒体技术', n: 64 },
  { name: '融媒体中心', n: 24 },
];

/* 已发布通知：给「通知发布」页显示发送结果，避免发完就没有下文 */
const adminNotices = [
  { id: 3, title: '素材上传规范更新（11 月版）', scope: '全体成员', at: '11-02 10:12', read: 412, total: 466 },
  { id: 2, title: '校运会素材征集截止时间调整', scope: '传媒学院', at: '10-28 16:40', read: 96, total: 112 },
  { id: 1, title: '关于寒假期间账号使用的说明', scope: '全体成员', at: '10-15 09:05', read: 451, total: 466 },
];

module.exports = {
  materials,
  collections,
  articles,
  activities,
  tasks,
  profile,
  myFavorites,
  myDownloads,
  myUploads,
  blogPosts,
  forumBoards,
  forumThreads,
  wallPosts,
  comments,
  conversations,
  messages,
  notifications,
  pointOverview,
  pointRules,
  pointRank,
  pointLogs,
  publicActivities,
  publicTasks,
  reviewQueue,
  rejectReasons,
  adminUsers,
  adminNotices,
  collegeUsers,
  ROLE_TEXT,
  delay,
  byId,
};
