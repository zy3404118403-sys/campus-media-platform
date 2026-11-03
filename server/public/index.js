/* ═════════════════ 状态 ═════════════ */
let currentUser = null
let colleges = []
let pendingDownloadId = null
const typeIcons = { 图片:'IMG', 视频:'VID', 文档:'DOC', 音频:'AUD', 其他:'FILE' }

/* ═════════════════ i18n 国际化 ═════════════ */
let curLang = localStorage.getItem('lang') || 'zh'
const I18N = {
  // Nav
  'nav.home':{zh:'首页',en:'Home'}, 'nav.library':{zh:'素材库',en:'Library'}, 'nav.colleges':{zh:'学院活动',en:'College & Activities'},
  'nav.articles':{zh:'文稿工作台',en:'Articles'},
  'nav.community':{zh:'校园社区',en:'Community'},
  'nav.tasks':{zh:'任务中心',en:'Tasks'},
  'um.tasks':{zh:'任务中心',en:'Tasks'}, 'um.studio':{zh:'创作中心',en:'Creative Studio'}, 'um.profile':{zh:'个人中心',en:'Profile'}, 'um.admin':{zh:'管理后台',en:'Admin'}, 'um.logout':{zh:'退出登录',en:'Sign Out'},
  'drawer.join':{zh:'加入我们',en:'Join Us'},
  'nav.studio':{zh:'创作中心',en:'Creative Studio'},
  'nav.collections':{zh:'专题',en:'Collections'},
  'sec.collections':{zh:'专题合集',en:'Collections'}, 'sec.collections.sub':{zh:'策展 · 校园记忆 · 一览',en:'Curated · Memories · At a glance'},
  'col.items':{zh:'件作品',en:'item(s)'}, 'col.enter':{zh:'点击进入专题',en:'Enter collection'}, 'col.curated':{zh:'策展合集',en:'Curated collection'},
  'col.none':{zh:'暂无专题',en:'No collections yet'}, 'col.noneDesc':{zh:'管理员可在后台「专题管理」中创建',en:'Admins can create collections in Admin → Collections'},
  'col.notFound':{zh:'专题不存在或已隐藏',en:'Collection not found or hidden'}, 'col.created':{zh:'创建',en:'Created'},
  'col.emptyItems':{zh:'该专题暂无已发布的素材',en:'No published materials in this collection yet'},
  'btn.backCollections':{zh:'← 返回专题列表',en:'← Back to Collections'}, 'btn.download':{zh:'下载',en:'Download'},
  'g.loading':{zh:'加载中...',en:'Loading...'},
  'ph.navSearch':{zh:'搜索素材 / 学院 / 标签…',en:'Search materials / colleges / tags…'},
  'ph.heroSearch':{zh:'搜索素材、学院、活动…',en:'Search materials, colleges, activities…'},
  'ph.libSearch':{zh:' 搜索素材标题 / 作者 / 标签...',en:' Search by title / author / tag...'},
  'nav.profile':{zh:'个人主页',en:'Profile'}, 'nav.messages':{zh:'消息',en:'Messages'}, 'nav.admin':{zh:'后台管理',en:'Admin'},
  'nav.login':{zh:'登录',en:'Login'},
  // Top bar
  'top.welcome':{zh:'欢迎访问芜宇乐的融媒体中心 · 素材共建平台',en:'Welcome to CCIBE Media Center · Material Platform'},
  'top.join':{zh:'加入我们',en:'Join Us'}, 'top.about':{zh:'关于我们',en:'About'}, 'top.admin':{zh:'后台管理',en:'Admin Panel'},
  // Hero
  'hero.badge':{zh:'校园素材共建共享平台',en:'Campus Material Sharing Platform'},
  'hero.title1':{zh:'汇聚学院精彩',en:'Gathering Brilliance'}, 'hero.title2':{zh:'共享光影校园',en:'Sharing Campus Light'},
  'hero.desc':{zh:'面向全校 <b>12 个二级学院</b>的素材资源库——上传你的作品，发现他人的精彩，共建属于我们的校园记忆。图片 · 视频 · 文档 · 音频，<b>每一份创意都被看见</b>。',en:'The material library serving all <b>12 colleges</b> \u2014 upload your work, discover others\u2019 highlights, and build our shared campus memory. Photos \u00b7 Video \u00b7 Documents \u00b7 Audio \u2014 <b>every creative work deserves to be seen</b>.'},
  'hero.upload':{zh:'上传素材',en:'Upload'}, 'hero.browse':{zh:'浏览素材',en:'Browse'},
  'hero.stat1':{zh:'素材总数',en:'Materials'}, 'hero.stat2':{zh:'学院专栏',en:'Colleges'}, 'hero.stat3':{zh:'累计下载',en:'Downloads'},
  'lb.title':{zh:'本周贡献 TOP',en:'Weekly Top Contributors'}, 'lb.all':{zh:'总榜',en:'All Time'},
  'lb.uploads':{zh:'上传',en:'uploads'}, 'lb.dl':{zh:'下载',en:'dl'},
  'misc.retry':{zh:'重新加载',en:'Retry'},
  // Sections
  'sec.colleges':{zh:'学院专栏',en:'Colleges'}, 'sec.colleges.sub':{zh:'按学院分类浏览素材',en:'Browse by college'},
  'sec.library':{zh:'素材库',en:'Library'}, 'sec.library.sub':{zh:'搜索 · 筛选 · 下载',en:'Search · Filter · Download'},
  'sec.library.pageSub':{zh:'搜索 · 筛选 · 标签 · 下载',en:'Search · Filter · Tags · Download'},
  'sec.library.upload':{zh:'上传素材',en:'Upload'},
  'sec.gallery':{zh:'校园风光',en:'Scenery'}, 'sec.gallery.sub':{zh:'航拍视角 · 记录校园之美',en:'Aerial · Campus Beauty'},
  'sec.activities':{zh:'部门活动',en:'Activities'}, 'sec.activities.sub':{zh:'融媒体中心主办',en:'Hosted by Media Center'},
  'sec.highlights':{zh:'活动风采',en:'Highlights'}, 'sec.highlights.sub':{zh:'精彩瞬间 · 悬停浏览',en:'Moments · Hover to Browse'},
  'sec.viewAll':{zh:'查看全部',en:'View All'}, 'sec.viewAllAct':{zh:'查看全部活动',en:'All Activities'},
  'sec.mediaAct':{zh:'部门活动',en:'Department Activities'},
  // Library UI
  'lib.search':{zh:'搜索素材标题 / 作者...',en:'Search title / author...'},
  'lib.allTypes':{zh:'全部类型',en:'All Types'}, 'lib.image':{zh:'图片',en:'Image'}, 'lib.video':{zh:'视频',en:'Video'},
  'lib.doc':{zh:'文档',en:'Document'}, 'lib.audio':{zh:'音频',en:'Audio'}, 'lib.other':{zh:'其他',en:'Other'},
  'lib.newest':{zh:'最新发布',en:'Latest'}, 'lib.mostDl':{zh:'下载最多',en:'Most Downloaded'}, 'lib.mostLike':{zh:'点赞最多',en:'Most Liked'},
  'lib.allColleges':{zh:'全部学院',en:'All Colleges'}, 'lib.search':{zh:'搜索素材标题 / 作者...',en:'Search title / author...'},
  // Buttons
  'btn.backHome':{zh:'← 返回首页',en:'← Home'}, 'btn.backColleges':{zh:'← 返回专栏列表',en:'← Back to Colleges'},
  'btn.cancel':{zh:'取消',en:'Cancel'}, 'btn.save':{zh:'保存',en:'Save'}, 'btn.close':{zh:'关闭',en:'Close'},
  'btn.draft':{zh:'保存草稿',en:'Save Draft'}, 'btn.submit':{zh:'提交审核',en:'Submit'},
  'btn.editProfile':{zh:'编辑资料',en:'Edit Profile'}, 'btn.changeAvatar':{zh:'更换头像',en:'Change Avatar'},
  // Profile
  'profile.student':{zh:'同学',en:'Student'}, 'profile.sid':{zh:'学号: -',en:'Student ID: -'},
  'profile.uploaded':{zh:'已上传',en:'Uploaded'}, 'profile.approved':{zh:'已通过',en:'Approved'},
  'profile.reviewing':{zh:'审核中',en:'Reviewing'}, 'profile.likes':{zh:'获赞',en:'Likes'},
  'profile.myMat':{zh:'我的素材',en:'My Materials'}, 'profile.drafts':{zh:'草稿箱',en:'Drafts'},
  'profile.favs':{zh:'我的收藏',en:'Favorites'}, 'profile.myAct':{zh:'参与的活动',en:'Activities'},
  'profile.changePwd':{zh:'修改密码',en:'Change Password'}, 'profile.curPwd':{zh:'当前密码',en:'Current Password'},
  'profile.curPwdPh':{zh:'输入当前密码',en:'Enter current password'}, 'profile.newPwd':{zh:'新密码',en:'New Password'},
  'profile.newPwdPh':{zh:'至少8位，含大小写字母和数字',en:'Min 8 chars, with upper/lower case and digits'},
  'profile.confirmPwd':{zh:'确认新密码',en:'Confirm New Password'}, 'profile.confirmPwdPh':{zh:'再次输入新密码',en:'Re-enter new password'},
  'profile.changePwdBtn':{zh:'确认修改',en:'Change Password'}, 'profile.pwdMismatch':{zh:'两次密码不一致',en:'Passwords do not match'},
  'profile.pwdChanged':{zh:'密码已修改',en:'Password changed'}, 'profile.pwdChangeFail':{zh:'密码修改失败',en:'Password change failed'},
  // Messages
  'msg.center':{zh:'消息中心',en:'Messages'}, 'msg.empty':{zh:'暂无消息',en:'No messages'}, 'msg.login':{zh:'请登录后查看消息',en:'Please login to view messages'},
  // Upload modal
  'upload.title':{zh:'上传素材',en:'Upload Material'},
  'upload.tip':{zh:'提交审核后将由管理员审核，通过后公开展示；也可先保存为草稿。',en:'Submissions are reviewed by admin. Approved materials are displayed publicly. You can also save as draft.'},
  'upload.mtitle':{zh:'素材标题',en:'Title'}, 'upload.mtitlePh':{zh:'给你的素材起个名字',en:'Name your material'},
  'upload.college':{zh:'所属学院',en:'College'}, 'upload.type':{zh:'素材类型',en:'Type'},
  'upload.desc':{zh:'素材描述',en:'Description'}, 'upload.descPh':{zh:'简单描述素材内容、拍摄时间、场景等',en:'Describe content, time, scene, etc.'},
  'upload.link':{zh:'网盘链接',en:'Cloud Link'}, 'upload.linkPh':{zh:'百度网盘 / 阿里云盘/ 夸克网盘等链接',en:'Baidu / Aliyun / Quark Drive link'},
  'upload.linkNote':{zh:'（大文件可填写网盘链接）',en:'(For large files)'},
  'upload.date':{zh:'拍摄 / 创作时间',en:'Date'}, 'upload.datePh':{zh:'如：2026年8月',en:'e.g., Aug 2026'},
  'upload.tags':{zh:'标签（逗号分隔，最多6个）',en:'Tags (comma-separated, max 6)'}, 'upload.tagsPh':{zh:'如：校园,风景,活动',en:'e.g., campus, scenery'},
  'upload.file':{zh:'上传文件',en:'File'}, 'upload.drop':{zh:'点击选择文件，或将文件拖到此处',en:'Click or drag file here'},
  'upload.fmt':{zh:'支持 JPG / PNG / MP4 / PDF / MP3 等格式 · 大文件自动分片上传，视频最大 20GB',en:'JPG / PNG / MP4 / PDF / MP3 · Large files auto-split, video up to 20GB'},
  'upload.subFormat':{zh:'照片格式',en:'Image Format'},
  'upload.subScene':{zh:'拍摄场景',en:'Scene Type'},
  'upload.subDoc':{zh:'文档类型',en:'Document Type'},
  'upload.subAudio':{zh:'音频类型',en:'Audio Type'},
  'upload.subOther':{zh:'自定义标签',en:'Custom Tag'},
  'upload.subSelect':{zh:'-- 请选择 --',en:'-- Select --'},
  'upload.subOtherPh':{zh:'输入自定义标签...',en:'Enter custom tag...'},
  // Edit profile modal
  'edit.title':{zh:'编辑个人资料',en:'Edit Profile'},
  'edit.name':{zh:'姓名',en:'Name'}, 'edit.college':{zh:'学院',en:'College'}, 'edit.grade':{zh:'年级',en:'Grade'},
  'edit.bio':{zh:'个人简介',en:'Bio'}, 'edit.bioPh':{zh:'介绍一下自己（200字以内）',en:'Introduce yourself (max 200 chars)'},
  // Join modal
  'join.title':{zh:'加入融媒体中心',en:'Join Media Center'},
  'join.desc':{zh:'欢迎加入芜宇乐的融媒体中心！请填写以下信息，我们会尽快与你联系。',en:'Welcome to CCIBE Media Center! Fill in the info below and we will contact you.'},
  'join.name':{zh:'姓名',en:'Name'}, 'join.namePh':{zh:'请输入你的姓名',en:'Enter your name'},
  'join.sid':{zh:'学号',en:'Student ID'}, 'join.sidPh':{zh:'请输入学号',en:'Enter your student ID'},
  'join.grade':{zh:'年级',en:'Grade'}, 'join.email':{zh:'邮箱',en:'Email'}, 'join.emailPh':{zh:'请输入邮箱',en:'Enter your email'},
  'join.resume':{zh:'电子简历（选填）',en:'Resume (Optional)'}, 'join.uploadResume':{zh:'点击上传简历（支持 PDF / Word）',en:'Upload resume (PDF / Word)'},
  'join.resumeFmt':{zh:'支持 PDF / Word · 不超过 10MB',en:'PDF / Word · Max 10MB'}, 'join.submit':{zh:'提交申请',en:'Submit'},
  // Detail modal
  'detail.title':{zh:'素材详情',en:'Details'}, 'detail.size':{zh:'大小:',en:'Size:'}, 'detail.dims':{zh:'尺寸:',en:'Dims:'}, 'detail.dur':{zh:'时长:',en:'Duration:'},
  'detail.history':{zh:'状态历史',en:'History'}, 'detail.notice':{zh:'本素材仅供校内学习使用，严禁商业用途。使用请保留原作者署名。',en:'For internal learning only. No commercial use. Retain author attribution.'},
  'detail.dl':{zh:'下载素材',en:'Download'}, 'detail.noFile':{zh:'该素材暂无文件',en:'No file available'},
  'detail.noDesc':{zh:'该素材暂无描述',en:'No description'}, 'detail.views':{zh:'浏览',en:'Views'}, 'detail.likes':{zh:'点赞',en:'Likes'}, 'detail.downloads':{zh:'下载',en:'Downloads'},
  'detail.link':{zh:'网盘链接：',en:'Cloud Link:'}, 'detail.rejectPh':{zh:'请输入拒绝原因（可留空）：',en:'Rejection reason (optional):'},
  'detail.submit':{zh:'提交审核',en:'Submit'}, 'detail.resubmit':{zh:'重新提交',en:'Resubmit'}, 'detail.approve':{zh:'通过',en:'Approve'}, 'detail.reject':{zh:'拒绝',en:'Reject'},
  'detail.publish':{zh:'发布',en:'Publish'}, 'detail.archive':{zh:'归档',en:'Archive'}, 'detail.unarchive':{zh:'取消归档',en:'Unarchive'},
  // Download disclaimer
  'dl.title':{zh:'素材使用责任声明',en:'Usage Agreement'}, 'dl.notice':{zh:'重要声明',en:'Important'},
  'dl.r1':{zh:'1. 本平台所有素材仅供校内师生学习、教学、宣传使用，严禁用于任何商业用途。',en:'1. Materials are for internal learning, teaching, and promotion only. Commercial use prohibited.'},
  'dl.r2':{zh:'2. 下载使用素材时，请保留原作者的署名信息，尊重知识产权。',en:'2. Retain original author attribution. Respect intellectual property.'},
  'dl.r3':{zh:'3. 不得对素材进行恶意篡改、歪曲原意，或用于不当用途。',en:'3. Do not maliciously alter or misuse materials.'},
  'dl.r4':{zh:'4. 若因违规使用素材产生的版权纠纷、法律责任，由使用者自行承担。',en:'4. Users bear all liability for misuse.'},
  'dl.r5':{zh:'5. 芜宇乐的融媒体中心保留对素材使用的最终解释权。',en:'5. CCIBE Media Center reserves right of final interpretation.'},
  'dl.agree':{zh:'我已仔细阅读并同意以上《素材使用责任声明》，承诺遵守相关规定。',en:'I have read and agree to the above terms.'},
  'dl.confirm':{zh:'确认下载',en:'Confirm Download'},
  /* ── 全站 i18n 补全（2026-09-08 hero/footer/区块/弹窗/排版） ── */
  'aria.skip':{zh:'跳过导航',en:'Skip to content'},
  'btn.search':{zh:'搜索',en:'Search'}, 'btn.backAct':{zh:'← 返回活动列表',en:'← Back to Activities'},
  'hero.hotLabel':{zh:'热门搜索',en:'Trending Searches'}, 'hero.scrollCue':{zh:'向下探索',en:'Scroll to Explore'},
  'tag.military':{zh:'军训纪实',en:'Military Training'}, 'tag.graduation':{zh:'毕业季',en:'Graduation'},
  'tag.aerial':{zh:'校园航拍',en:'Campus Aerial'}, 'tag.gala':{zh:'迎新晚会',en:'Gala Night'},
  'tag.sports':{zh:'运动会',en:'Sports Meet'}, 'tag.lecture':{zh:'学术讲座',en:'Lectures'},
  'tag.landscape':{zh:'风光',en:'Landscape'}, 'tag.timelapse':{zh:'延时摄影',en:'Timelapse'},
  'tag.documentary':{zh:'纪实',en:'Documentary'}, 'tag.bts':{zh:'幕后花絮',en:'Behind the Scenes'}, 'tag.season':{zh:'四季时序',en:'Seasons'},
  'gp.title':{zh:'素材总览',en:'Overview'}, 'gp.live':{zh:'实时',en:'Live'},
  'gp.total':{zh:'共 <b>0</b> 份素材',en:'<b>0</b> materials in total'}, 'gp.weekNew':{zh:'本周 +0',en:'+0 this week'},
  'type.photo':{zh:'图片',en:'Photo'}, 'type.video':{zh:'视频',en:'Video'}, 'type.doc':{zh:'文档',en:'Document'},
  'type.audio':{zh:'音频',en:'Audio'}, 'type.other':{zh:'其他',en:'Other'}, 'type.colleges':{zh:'学院专栏',en:'Colleges'},
  'eyebrow.cats':{zh:'快捷分类',en:'Categories'}, 'eyebrow.collections':{zh:'精选专题',en:'Featured'},
  'eyebrow.hot':{zh:'热门素材',en:'Trending'}, 'eyebrow.leaderboard':{zh:'贡献排行榜',en:'Leaderboard'},
  'eyebrow.colRec':{zh:'专题推荐',en:'Collections'}, 'eyebrow.safeguard':{zh:'平台保障',en:'Platform'},
  'cat.title':{zh:'按类型直达<span class="sec-sub"> · 六大入口覆盖全部素材形态</span>',en:'Browse by Type<span class="sec-sub"> · Six gateways to every material type</span>'},
  'cat.go':{zh:'进入 →',en:'Enter →'}, 'cat.communityCnt':{zh:'博文 · 论坛 · 墙贴',en:'Posts · Forum · Wall'},
  'more.enterLib':{zh:'进入素材库',en:'Open Library'}, 'more.browseLib':{zh:'浏览素材库',en:'Browse Library'}, 'more.fullBoard':{zh:'完整榜单',en:'Full Board'},
  'col.secTitle':{zh:'策展式内容组织<span class="sec-sub"> · 后台 CMS 可配置</span>',en:'Curated Content Organization<span class="sec-sub"> · Configurable via CMS</span>'},
  'col.badge':{zh:'专题',en:'Collection'},
  'hot.title':{zh:'大家都在下载<span class="sec-sub"> · 按下载量排序 · 类型即时筛选</span>',en:'Most Downloaded<span class="sec-sub"> · Sorted by downloads · Instant type filter</span>'},
  'filter.current':{zh:'当前筛选：',en:'Filter: '}, 'filter.all':{zh:'全部',en:'All'},
  'filter.clear':{zh:'清空筛选',en:'Clear all'}, 'filter.results':{zh:'条素材',en:'materials'},
  'filter.date':{zh:'日期',en:'Date'}, 'filter.to':{zh:'至',en:'–'}, 'filter.type':{zh:'类型',en:'Type'}, 'filter.college':{zh:'学院',en:'College'}, 'filter.tag':{zh:'标签',en:'Tag'},
  'hotbar.title':{zh:'个人上传热榜<span class="sec-sub"> · 近 7 天 · 全站贡献 TOP 5</span>',en:'Top Contributors<span class="sec-sub"> · Last 7 days · All-time TOP 5</span>'},
  'hotbar.weekly':{zh:'近 7 天',en:'Last 7 days'}, 'hotbar.alltime':{zh:'历史累计',en:'All time'},
  'hotbar.uploads':{zh:'上传',en:'uploads'}, 'hotbar.downloads':{zh:'获下载',en:'downloads'},
  'rank.title':{zh:'学院贡献榜<span class="sec-sub"> · 按通过审核的素材数排序 · 每周一刷新</span>',en:'College Leaderboard<span class="sec-sub"> · Ranked by approved materials · Refreshed weekly</span>'},
  'rank.champion':{zh:'冠军',en:'Champion'}, 'rank.runnerup':{zh:'亚军',en:'Runner-up'}, 'rank.third':{zh:'季军',en:'Third'},
  'rank.uploaded':{zh:'已上传',en:'uploaded'}, 'rank.downloads':{zh:'获下载',en:'downloads'},
  'feat.title':{zh:'深度策划<span class="sec-sub"> · 大画幅运营位 · 校园风光与部门活动精选</span>',en:'Editorial Picks<span class="sec-sub"> · Large-format features · Campus highlights</span>'},
  'feat.f1k':{zh:'航拍视角 · Campus From Above',en:'Aerial · Campus From Above'},
  'feat.f1t':{zh:'俯瞰 · 校园航拍集',en:'Above · Campus Aerial Collection'},
  'feat.f1d':{zh:'融媒体中心无人机小组历时一学年的航拍档案：从清晨的教学楼群到夜幕下的操场灯光，换个高度重新认识校园。',en:'A full school year of drone archives by the Media Center aerial team: from morning academic buildings to floodlit night fields — see the campus from a new height.'},
  'feat.f2k':{zh:'盛夏机位 · Summer Pond',en:'Seasonal Spot · Summer Pond'},
  'feat.f2t':{zh:'荷塘 · 一年一度的固定机位',en:'The Lotus Pond · A Returning Vantage'},
  'feat.f2d':{zh:'六月，荷塘是融媒体中心的公共机位：清晨的侧光、午后的风、傍晚的天际线。同一片水，被拍成了四季。',en:'Every June the lotus pond becomes our shared vantage: morning side-light, afternoon breeze, dusk skyline — the same water, filmed through the seasons.'},
  'mini.drill':{zh:'场馆 · 体育馆',en:'Gymnasium'}, 'mini.grad':{zh:'地标 · 校门',en:'The Main Gate'},
  'mini.sports':{zh:'学院楼 · 数计学院',en:'School of Math & Computing'}, 'mini.lecture':{zh:'学院楼 · 文创学院',en:'School of Literature & Creative Communication'},
  'why.title':{zh:'为什么选择这里<span class="sec-sub"> · 内容质量与使用体验的五重保障</span>',en:'Why Choose Us<span class="sec-sub"> · Five guarantees of quality and experience</span>'},
  'why.a1t':{zh:'三级审核机制',en:'Triple Review'}, 'why.a1d':{zh:'敏感词过滤 + 管理员人工审核 + 举报处理，全部素材审核通过后公开展示',en:'Sensitive-word filtering + admin review + report handling. Materials go public only after approval.'},
  'why.a2t':{zh:'版权保障',en:'Copyright Care'}, 'why.a2d':{zh:'校内署名使用规范，下载前责任声明确认，尊重每一份原创',en:'On-campus attribution norms and a responsibility notice before download. Every original work is respected.'},
  'why.a3t':{zh:'高速下载',en:'Fast Download'}, 'why.a3d':{zh:'校园网直连下载，大文件自动分片直传云端，视频最高支持 20GB',en:'Direct campus-network download; large files auto-split to cloud storage, video up to 20GB.'},
  'why.a4t':{zh:'收藏管理',en:'Collections'}, 'why.a4d':{zh:'个人收藏夹云端同步，下载记录可追溯，喜欢的素材随时找回',en:'Favorites synced to the cloud with traceable download history — find saved materials anytime.'},
  'why.a5t':{zh:'多端适配',en:'Multi-Device'}, 'why.a5d':{zh:'手机 / 平板 / 桌面一致体验，支持 PWA 添加到主屏幕',en:'Consistent experience across phone, tablet and desktop. PWA add-to-home-screen supported.'},
  'misc.pleaseSelect':{zh:'--请选择--',en:'-- Select --'},
  'nav.bottom.colleges':{zh:'学院',en:'Colleges'},
  'nav.bottom.tasks':{zh:'任务',en:'Tasks'},
  'sec.mediaAct.sub':{zh:'融媒体中心主办',en:'Hosted by Media Center'},
  'up.name':{zh:'素材标题',en:'Title'}, 'up.namePh':{zh:'给你的素材起个名字',en:'Name your material'},
  'up.college':{zh:'所属学院',en:'College'}, 'up.type':{zh:'素材类型',en:'Type'},
  'up.desc':{zh:'素材描述',en:'Description'}, 'up.descPh':{zh:'简单描述素材内容、拍摄时间、场景等',en:'Describe content, time, scene…'},
  'up.drive':{zh:'网盘链接',en:'Cloud Drive Link'}, 'up.driveHint':{zh:'（大文件可填写网盘链接）',en:'(optional, for large files)'},
  'up.drivePh':{zh:'百度网盘 / 阿里云盘/ 夸克网盘等链接',en:'Baidu / Aliyun / Quark drive link'},
  'up.date':{zh:'拍摄 / 创作时间',en:'Shot / Created On'}, 'up.datePh':{zh:'如：2026年8月',en:'e.g. Aug 2026'},
  'up.tags':{zh:'标签（逗号分隔，最多6个）',en:'Tags (comma-separated, max 6)'}, 'up.tagsPh':{zh:'如：校园,风景,活动',en:'e.g. campus,scenery,event'},
  'up.file':{zh:'上传文件',en:'Upload File'},
  // Footer
  'footer.name':{zh:'芜宇乐的融媒体中心',en:'CCIBE Media Center'},
  'footer.desc':{zh:'致力于打造校园优质素材资源共享平台',en:'Dedicated to a premium campus material platform'},
  'footer.links':{zh:'快速链接',en:'Quick Links'}, 'footer.upload':{zh:'上传素材',en:'Upload'}, 'footer.join':{zh:'加入我们',en:'Join Us'},
  'footer.community':{zh:'校园社区',en:'Community'}, 'footer.tasks':{zh:'任务中心',en:'Task Center'}, 'footer.studio':{zh:'创作中心',en:'Creative Studio'}, 'footer.graph':{zh:'记忆图谱',en:'Memory Graph'},
  'footer.contact':{zh:'联系我们',en:'Contact'}, 'footer.addr':{zh:'芜宇乐的融媒体中心办公室',en:'CCIBE · Media Center Office'},
  'footer.bottom':{zh:'芜宇乐的融媒体中心 · 素材共建平台 · 仅供校内使用',en:'CCIBE · Media Center · Material Platform · Internal Use Only'},
  // Status labels
  'st.draft':{zh:'草稿',en:'Draft'}, 'st.review':{zh:'审核中',en:'Reviewing'}, 'st.approved':{zh:'已通过',en:'Approved'},
  'st.published':{zh:'已发布',en:'Published'}, 'st.archived':{zh:'已归档',en:'Archived'}, 'st.rejected':{zh:'已拒绝',en:'Rejected'},
  'st.unknown':{zh:'未知',en:'Unknown'}, 'st.uncat':{zh:'未分类',en:'Uncategorized'}, 'st.noFile':{zh:'无文件',en:'No File'},
  'st.descOnly':{zh:'纯描述',en:'Desc Only'}, 'st.system':{zh:'系统',en:'System'},
  // Activity status
  'act.ongoing':{zh:'进行中',en:'Ongoing'}, 'act.upcoming':{zh:'即将开始',en:'Upcoming'}, 'act.ended':{zh:'已结束',en:'Ended'},
  'act.register':{zh:'立即报名',en:'Register'}, 'act.preregister':{zh:'预约报名',en:'Pre-register'}, 'act.registered':{zh:'已报名',en:'Registered'},
  'act.empty':{zh:'暂无活动',en:'No activities'},
  // Empty states
  'empty.college':{zh:'暂无素材，快来上传第一个吧',en:'No materials yet. Be the first to upload!'},
  'empty.search':{zh:'未找到相关素材',en:'No materials found'},
  'empty.myMat':{zh:'还没有上传任何素材，点击首页"上传素材"分享你的作品吧',en:'No uploads yet. Click "Upload" on homepage to share!'},
  'empty.drafts':{zh:'草稿箱为空。上传素材时选择"保存草稿"可稍后再提交审核',en:'Drafts empty. Choose "Save Draft" when uploading to submit later.'},
  'empty.favs':{zh:'还没有收藏任何素材，看到喜欢的点收藏吧',en:'No favorites yet. Tap to save materials you like.'},
  'empty.joined':{zh:'还没有参与任何活动，去看看吧',en:'No activities joined yet. Go explore!'},
  'empty.noHistory':{zh:'暂无状态变更记录',en:'No status history'},
  // Toasts
  't.logout':{zh:'已退出登录',en:'Logged out'}, 't.fav':{zh:'已收藏',en:'Favorited'}, 't.unfav':{zh:'已取消收藏',en:'Unfavorited'},
  't.fail':{zh:'操作失败',en:'Operation failed'}, 't.liked':{zh:'已点赞',en:'Liked'}, 't.unliked':{zh:'已取消点赞',en:'Unliked'},
  't.noExist':{zh:'素材不存在',en:'Material not found'}, 't.dlStart':{zh:'已开始下载',en:'Download started'},
  't.registered':{zh:'你已经报过名啦',en:'Already registered'}, 't.regOk':{zh:'报名成功！',en:'Registered!'}, 't.regFail':{zh:'报名失败',en:'Registration failed'},
  't.needTitle':{zh:'请填写素材标题',en:'Please enter a title'}, 't.saving':{zh:'保存中...',en:'Saving...'}, 't.submitting':{zh:'提交中...',en:'Submitting...'},
  't.draftOk':{zh:'草稿已保存',en:'Draft saved'}, 't.submitOk':{zh:'提交成功，等待管理员审核',en:'Submitted, awaiting review'},
  't.retry':{zh:'操作失败，请重试',en:'Failed, please retry'}, 't.needName':{zh:'请填写姓名',en:'Please enter name'},
  't.needSid':{zh:'请填写学号',en:'Please enter student ID'}, 't.needEmail':{zh:'请填写邮箱',en:'Please enter email'},
  't.submitFail':{zh:'提交失败',en:'Submission failed'}, 't.applyOk':{zh:'申请已提交！我们将尽快与你联系',en:'Application submitted!'},
  't.nameEmpty':{zh:'姓名不能为空',en:'Name required'}, 't.profileOk':{zh:'资料已保存',en:'Profile saved'}, 't.profileFail':{zh:'保存失败',en:'Save failed'},
  't.imgOnly':{zh:'请上传图片文件',en:'Please upload an image'}, 't.avatarOk':{zh:'头像已更新',en:'Avatar updated'}, 't.avatarFail':{zh:'头像上传失败',en:'Avatar upload failed'},
  't.needAdmin':{zh:'需要管理员权限',en:'Admin access required'}, 't.netFail':{zh:'网络连接失败，请检查网络后重试',en:'Network failed. Check connection.'},
  't.netFail2':{zh:'网络连接失败',en:'Network failed'}, 'dir.boo':{zh:'导航',en:'Directory'}, 'dl.box':{zh:'下载',en:'Download'}, 't.badResp':{zh:'返回数据异常',en:'Bad response'},
  // Misc
  'misc.loading':{zh:'加载中...',en:'Loading...'}, 'misc.dl':{zh:'下载',en:'Download'}, 'misc.cloud':{zh:'网盘',en:'Cloud'},
  'misc.loadMore':{zh:'加载更多',en:'Load More'}, 'misc.noMore':{zh:'没有更多了',en:'No More'},
  'misc.fav':{zh:'收藏',en:'Favorite'}, 'misc.faved':{zh:'已藏',en:'Saved'}, 'misc.sid':{zh:'学号:',en:'Student ID:'},
  'misc.liked':{zh:'点赞了',en:'liked'}, 'misc.dled':{zh:'下载了',en:'downloaded'}, 'misc.yourMat':{zh:'你的素材',en:'your material'},
  'misc.matCount':{zh:'个素材',en:'materials'}, 'misc.author':{zh:'未知',en:'Unknown'},
  'misc.grade26':{zh:'2026级',en:'Class 2026'}, 'misc.grade25':{zh:'2025级',en:'Class 2025'}, 'misc.grade24':{zh:'2024级',en:'Class 2024'},
  'misc.grade23':{zh:'2023级',en:'Class 2023'}, 'misc.grade22':{zh:'2022级',en:'Class 2022'}, 'misc.grade21':{zh:'2021级',en:'Class 2021'},
  // Gallery（P0-2 CMS 化：画廊数据来自 /api/home-gallery，标题直存数据库）
  'g.empty':{zh:'暂无校园风光图片',en:'No campus photos yet'},
  'g.loadFail':{zh:'画廊加载失败',en:'Failed to load gallery'},
  'g.retry':{zh:'重试',en:'Retry'},
  // Accordion labels
  'acc.1':{zh:'光影校园',en:'Light & Shadow'}, 'acc.2':{zh:'青春视界',en:'Youth Vision'}, 'acc.3':{zh:'创意无限',en:'Creativity'},
  'acc.4':{zh:'声动校园',en:'Voice'}, 'acc.5':{zh:'映像校园',en:'Reflections'},
  // Slider captions
  'slider.1':{zh:'校园全景',en:'Panorama'}, 'slider.2':{zh:'教学楼群',en:'Teaching Buildings'}, 'slider.3':{zh:'运动场馆',en:'Sports Venues'},
  'slider.4':{zh:'校园黄昏',en:'Sunset'}, 'slider.5':{zh:'航拍全景',en:'Aerial'}, 'slider.6':{zh:'建筑细节',en:'Architecture'}, 'slider.7':{zh:'远眺校园',en:'Distant View'},
  // ARIA
  'aria.gallery':{zh:'活动风采图片画廊',en:'Highlights Gallery'}, 'aria.slider':{zh:'校园风光形变轮播',en:'Campus Slider'},
  'aria.prev':{zh:'上一张',en:'Previous'}, 'aria.next':{zh:'下一张',en:'Next'}, 'aria.menu':{zh:'打开菜单',en:'Open Menu'},
  // Nav brand
  'nav.brandCn':{zh:'芜宇乐的融媒体中心',en:'CCIBE Media Center'}, 'nav.brandEn':{zh:'CCIBE Media Center',en:'CCIBE Media Center'},
  // Additional toast keys
  't.needCollege':{zh:'请选择所属学院',en:'Please select college'}, 't.needType':{zh:'请选择素材类型',en:'Please select type'},
  // Library tag suggestions
  'lib.common':{zh:'常用',en:'Common'}, 'lib.recommend':{zh:'推荐',en:'Recommended'},
  // Upload sub-option items
  'sub.air':{zh:'空镜',en:'B-Roll'}, 'sub.aerial':{zh:'航拍',en:'Aerial'}, 'sub.ground':{zh:'地拍',en:'Ground'},
  'sub.timelapse':{zh:'延时摄影',en:'Timelapse'}, 'sub.slowmo':{zh:'慢动作',en:'Slow Motion'}, 'sub.transition':{zh:'转场',en:'Transition'},
  'sub.interview':{zh:'采访',en:'Interview'}, 'sub.event':{zh:'活动记录',en:'Event Record'}, 'sub.vlog':{zh:'Vlog',en:'Vlog'}, 'sub.promo':{zh:'宣传片',en:'Promo'},
  'sub.ppt':{zh:'课件PPT',en:'Slides'}, 'sub.paper':{zh:'论文',en:'Paper'}, 'sub.notes':{zh:'笔记',en:'Notes'},
  'sub.template':{zh:'模板',en:'Template'}, 'sub.report':{zh:'报告',en:'Report'}, 'sub.lesson':{zh:'教案',en:'Lesson Plan'},
  'sub.plan':{zh:'策划案',en:'Proposal'}, 'sub.script':{zh:'脚本',en:'Script'},
  'sub.bgm':{zh:'配乐',en:'Score'}, 'sub.sfx':{zh:'音效',en:'SFX'}, 'sub.voiceover':{zh:'旁白配音',en:'Voiceover'},
  'sub.live':{zh:'现场录音',en:'Live Recording'}, 'sub.intro':{zh:'片头音乐',en:'Intro Music'}, 'sub.background':{zh:'背景音乐',en:'Background Music'},
  // College names
  'col.kuajing':{zh:'商学院',en:'Cross-border Commerce'}, 'col.guanli':{zh:'管理学院',en:'School of Management'},
  'col.waiyu':{zh:'外语外贸学院',en:'Foreign Languages & Trade'}, 'col.wenxue':{zh:'人文学院',en:'Literature & Creative Media'},
  'col.shuxue':{zh:'计算机学院',en:'Math & Computer Science'}, 'col.dashuju':{zh:'智能工程学院',en:'Big Data & Intelligent Engineering'},
  'col.chaoda':{zh:'数字治理学院',en:'Chongqing Digital Governance'}, 'col.yishu':{zh:'设计学院',en:'Art & Design'},
  'col.yinyue':{zh:'音乐学院',en:'Music & Dance'}, 'col.jiaoyu':{zh:'教育学院',en:'Education'},
  'col.tiyu':{zh:'体育学院',en:'Sports & Health'}, 'col.makesi':{zh:'通识教育学院',en:'Marxism Studies'},
  'col.guoji':{zh:'国际学院',en:'International College'}, 'col.rongmeiti':{zh:'传媒学院',en:'Film, TV & Media'},
  // College descriptions
  'colDesc.kuajing':{zh:'跨商融合，链接全球',en:'Commerce meets the world'}, 'colDesc.guanli':{zh:'管以修身，理以治业',en:'Manage self, lead business'},
  'colDesc.waiyu':{zh:'语通世界，贸连八方',en:'Language connects the world'}, 'colDesc.wenxue':{zh:'文以载道，创以致远',en:'Words carry truth, creativity reaches far'},
  'colDesc.shuxue':{zh:'数启智慧，计算未来',en:'Math inspires, computing shapes the future'}, 'colDesc.dashuju':{zh:'数据驱动，智创未来',en:'Data-driven innovation'},
  'colDesc.chaoda':{zh:'数治超大城市，智绘美好生活',en:'Smart governance for better cities'}, 'colDesc.yishu':{zh:'艺海无涯，设计有道',en:'Art without limits, design with purpose'},
  'colDesc.yinyue':{zh:'弦歌不辍，舞动青春',en:'Music and dance forever young'}, 'colDesc.jiaoyu':{zh:'立德树人，育人为本',en:'Cultivating virtue, nurturing talent'},
  'colDesc.tiyu':{zh:'野蛮体魄，文明精神',en:'Strong body, civilised mind'}, 'colDesc.makesi':{zh:'信仰坚定，理论先行',en:'Firm faith, theory first'},
  'colDesc.guoji':{zh:'融通中外，兼济天下',en:'Bridging East and West'}, 'colDesc.rongmeiti':{zh:'光影叙事，融媒传播',en:'Visual storytelling, media convergence'},
}

function t(key){ const e=I18N[key]; if(!e){ console.warn('[i18n] missing key:', key); return key } return e[curLang]||e.zh }

/* College name/desc translation helpers */
const COLLEGE_NAME_MAP = {
  '商学院':'col.kuajing', '管理学院':'col.guanli', '外语外贸学院':'col.waiyu',
  '人文学院':'col.wenxue', '计算机学院':'col.shuxue',
  '智能工程学院':'col.dashuju', '数字治理学院':'col.chaoda',
  '设计学院':'col.yishu', '音乐学院':'col.yinyue', '教育学院':'col.jiaoyu',
  '体育学院':'col.tiyu', '通识教育学院':'col.makesi', '国际学院':'col.guoji',
  '传媒学院':'col.rongmeiti'
}
const COLLEGE_DESC_MAP = {
  '商学院':'colDesc.kuajing', '管理学院':'colDesc.guanli', '外语外贸学院':'colDesc.waiyu',
  '人文学院':'colDesc.wenxue', '计算机学院':'colDesc.shuxue',
  '智能工程学院':'colDesc.dashuju', '数字治理学院':'colDesc.chaoda',
  '设计学院':'colDesc.yishu', '音乐学院':'colDesc.yinyue', '教育学院':'colDesc.jiaoyu',
  '体育学院':'colDesc.tiyu', '通识教育学院':'colDesc.makesi', '国际学院':'colDesc.guoji',
  '影视融媒学院':'colDesc.rongmeiti'
}
function collegeName(name){ if(!name) return t('st.uncat'); const key=COLLEGE_NAME_MAP[name]; return key ? t(key) : name }
function collegeDesc(name){ if(!name) return ''; const key=COLLEGE_DESC_MAP[name]; return key ? t(key) : name }

/* Material type translation */
const TYPE_MAP = {'图片':'lib.image','视频':'lib.video','文档':'lib.doc','音频':'lib.audio','其他':'lib.other'}
function typeLabel(type){ if(!type) return ''; const key=TYPE_MAP[type]; return key ? t(key) : type }

/* Material title/desc translation (database content) */
const MATERIAL_TITLE_MAP = {
  '校园春日樱花摄影集':'Campus Cherry Blossom Photography',
  '校运会精彩瞬间混剪':'Sports Day Highlights Mix',
  '大创答辩PPT模板':'Innovation Competition PPT Template',
  '校园广播片头音乐':'Campus Radio Intro Music',
  '图书馆建筑摄影组图':'Library Architecture Photography',
  '校园微电影《青春序曲》':'Campus Micro-film "Youth Overture"',
  '校园文化节海报设计稿':'Culture Festival Poster Design',
  '模拟法庭辩论赛录像':'Mock Court Debate Recording',
  '数据结构课程笔记整理':'Data Structures Course Notes',
  '校园Vlog - 一日生活':'Campus Vlog - A Day in Life',
  '毕业季纪念视频素材包':'Graduation Memorial Video Pack',
  '校园植物图鉴手册':'Campus Plant Illustrated Handbook',
  '网盘测试素材':'Cloud Drive Test Material',
}
const MATERIAL_DESC_MAP = {
  '校园春日樱花摄影集':'A collection of cherry blossom photography on campus during spring.',
  '校运会精彩瞬间混剪':'Highlights mix from the campus sports day.',
  '大创答辩PPT模板':'A clean PPT template for innovation competition defense presentations.',
  '校园广播片头音乐':'Intro music for the campus radio station.',
  '图书馆建筑摄影组图':'Architectural photography of the campus library.',
  '校园微电影《青春序曲》':'A campus micro-film about youth and dreams.',
  '校园文化节海报设计稿':'Poster design for the campus culture festival.',
  '模拟法庭辩论赛录像':'Recording of the mock court debate competition.',
  '数据结构课程笔记整理':'Organized course notes for Data Structures.',
  '校园Vlog - 一日生活':'A vlog capturing a day of campus life.',
  '毕业季纪念视频素材包':'Video material pack for graduation memories.',
  '校园植物图鉴手册':'An illustrated handbook of plants found on campus.',
  '网盘测试素材':'Test material with cloud drive link.',
}
function materialTitle(title){ if(!title) return ''; return curLang==='en' ? (MATERIAL_TITLE_MAP[title]||title) : title }
function materialDesc(desc){ if(!desc) return ''; return curLang==='en' ? (MATERIAL_DESC_MAP[desc]||desc) : desc }

/* Activity title translation (database content) */
const ACTIVITY_TITLE_MAP = {
  '「光影校园」摄影大赛':'"Light & Shadow" Photography Contest',
  '「青春视界」短视频大赛':'"Youth Vision" Short Video Contest',
  '「创意无限」平面设计大赛':'"Creativity" Graphic Design Contest',
  '「声动校园」配音大赛':'"Voice" Dubbing Contest',
  '「笔墨校园」新闻采写大赛':'"Pen & Ink" News Writing Contest',
  '「映像校园」微电影展映周':'"Reflections" Micro-film Week',
}
function activityTitle(title){ if(!title) return ''; return curLang==='en' ? (ACTIVITY_TITLE_MAP[title]||title) : title }

/* Activity description translation (database content) */
const ACTIVITY_DESC_MAP = {
  '用镜头记录校园之美。优秀作品将在校史馆展出并在官微推送。':'Capture the beauty of campus with your lens. Outstanding works will be exhibited in the school museum and featured on official social media.',
  '围绕「青春·校园·梦想」主题创作短视频，最佳作品将推荐参加省级比赛。':'Create short videos around the theme "Youth · Campus · Dreams". Best works will be nominated for provincial competitions.',
  '设计校园文创产品图案，入选作品将制成实物发售。':'Design campus cultural product patterns. Selected works will be produced and sold as merchandise.',
  '影视片段配音、纪录片旁白皆可参加，单人组和团体组分别评奖。':'Dubbing for film clips or documentary narration. Solo and group categories judged separately.',
  '围绕校园新闻事件进行采访与写作，优秀稿件将在校报刊登。':'Conduct interviews and write about campus news events. Outstanding articles will be published in the school newspaper.',
  '征集校园微电影作品，评审后在学术报告厅进行为期一周的展映。':'Submit campus micro-film works. After review, selected films will be screened for a week at the academic lecture hall.',
}
function activityDesc(desc){ if(!desc) return ''; return curLang==='en' ? (ACTIVITY_DESC_MAP[desc]||desc) : desc }
function setLang(lang){
  curLang = lang
  localStorage.setItem('lang', lang)
  document.documentElement.lang = lang==='en'?'en':'zh-CN'
  // toggle button UI
  document.querySelectorAll('#langToggle span').forEach(s=>s.classList.toggle('active', s.dataset.lang===lang))
  // data-i18n: textContent
  try{
    document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent = t(el.dataset.i18n) })
  // data-i18n-ph: placeholder
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{ el.placeholder = t(el.dataset.i18nPh) })
  }catch(e){ console.warn('i18n text error:',e) }
  // data-i18n-html: innerHTML (for elements with <br> etc.)
  try{
    document.querySelectorAll('[data-i18n-html]').forEach(el=>{ el.innerHTML = t(el.dataset.i18nHtml) })
  }catch(e){ console.warn('i18n html error:',e) }
  // data-i18n-aria: aria-label
  try{
    document.querySelectorAll('[data-i18n-aria]').forEach(el=>{ el.setAttribute('aria-label', t(el.dataset.i18nAria)) })
  }catch(e){ console.warn('i18n aria error:',e) }
  // section titles & subtitles
  try{ applySectionI18N() }catch(e){ console.warn('i18n section error:',e) }
  // buttons with specific text
  try{ applyButtonI18N() }catch(e){ console.warn('i18n button error:',e) }
  // form labels & placeholders
  try{ applyFormI18N() }catch(e){ console.warn('i18n form error:',e) }
  // footer
  try{ applyFooterI18N() }catch(e){ console.warn('i18n footer error:',e) }
  // select options
  try{ applySelectI18N() }catch(e){ console.warn('i18n select error:',e) }
  // re-render dynamic content — only if data already loaded
  try{
    if(typeof loadMaterials==='function') loadMaterials()
    if(typeof loadActivities==='function') loadActivities()
    if(typeof colleges!=='undefined' && colleges.length){
      if(typeof renderColleges==='function') renderColleges()
    }
    // 专题卡片为 JS 动态渲染，语言切换后需按新语言重渲染（仅在数据就绪时）
    if(typeof renderHomeCollections==='function' && $('collectionsHome') && window.__hbData) renderHomeCollections()
    if(typeof loadCollectionsPage==='function' && $('page-collections')?.classList.contains('active')) loadCollectionsPage()
    if(currentUser && typeof renderStudentPage==='function') renderStudentPage()
    if(typeof loadMessages==='function' && $('page-messages')?.classList.contains('active')) loadMessages()
  }catch(e){ console.warn('i18n re-render error:',e) }
  // 重新渲染上传子选项
  try{
    const sel = $('uploadType')
    if(sel && sel.value && typeof updateUploadSubOptions==='function') updateUploadSubOptions(sel.value)
  }catch(e){ console.warn('i18n sub-options error:',e) }
  // re-render accordion gallery captions
  try{
    document.querySelectorAll('select.cs-custom').forEach(sel=>{
      if(sel.dataset.csInit){
        const wrapper=sel.closest('.cs-wrapper')
        if(wrapper){
          const trigger=wrapper.querySelector('.cs-trigger')
          const dropdown=wrapper.querySelector('.cs-dropdown')
          if(trigger){
            const opt=sel.options[sel.selectedIndex]
            trigger.firstChild.textContent = opt ? opt.textContent : ''
          }
          if(dropdown){
            Array.from(dropdown.querySelectorAll('.cs-option')).forEach((optEl,i)=>{
              if(sel.options[i]) optEl.textContent = sel.options[i].textContent
            })
          }
        }
      }
    })
  }catch(e){ console.warn('i18n custom select refresh error:',e) }
  // update document title
  document.title = lang==='en' ? 'CCIBE Media Center · Material Platform' : '芜宇乐的融媒体中心 · 素材共建平台'
  // 移动端底部快捷导航（polish.js 渲染，语言切换后同步）
  try{
    const bn = document.getElementById('polishBottomNav')
    if(bn){
      const labs = [t('nav.home'), t('nav.library'), t('nav.bottom.colleges'), t('nav.community'), t('nav.bottom.tasks')]
      bn.querySelectorAll('a > span').forEach((s2,i)=>{ if(labs[i]) s2.textContent = labs[i] })
    }
  }catch(e){}
  // 通知 home-v3.js 等模块按新语言重渲染动态文案
  try{ window.dispatchEvent(new CustomEvent('wb:lang')) }catch(e){}
}

function applySectionI18N(){
  const secMap = [
    ['#colleges-section .section-title','sec.colleges','sec.colleges.sub'],
    ['#library .section-title','sec.library','sec.library.sub'],
    ['#campus-gallery-section .section-title','sec.gallery','sec.gallery.sub'],
    ['#activities-section .section-title','sec.activities','sec.activities.sub'],
    ['#page-library .section-title','sec.library','sec.library.pageSub'],
    ['#page-collections .section-title','sec.collections','sec.collections.sub'],
  ]
  secMap.forEach(([sel,titleKey,subKey])=>{
    const el = document.querySelector(sel)
    if(!el) return
    const small = el.querySelector('small')
    if(small) small.textContent = t(subKey)
    el.childNodes.forEach(n=>{ if(n.nodeType===3&&n.textContent.trim()) n.textContent = t(titleKey)+' ' })
  })
  // 查看全部 buttons
  document.querySelectorAll('.specular-button').forEach(btn=>{
    const lbl = btn.querySelector('.specular-button__label')
    if(!lbl) return
    const txt = lbl.textContent.trim()
    if((txt.startsWith('查看全部') && txt.includes('活动')) || txt.startsWith('All Activities')) lbl.textContent = t('sec.viewAllAct')+' ->'
    else if(txt.startsWith('查看全部') || txt.startsWith('View All')) lbl.textContent = t('sec.viewAll')+' ->'
    else if(txt.includes('返回首页') || txt.includes('← Home')) lbl.textContent = t('btn.backHome')
    else if(txt.includes('返回专题列表') || txt.includes('Back to Collections')) lbl.textContent = t('btn.backCollections')
    else if(txt.includes('返回专栏') || txt.includes('Back to Colleges')) lbl.textContent = t('btn.backColleges')
    else if(txt==='上传素材' || txt==='Upload') lbl.textContent = t('hero.upload')
    else if(txt.includes('上传素材') || txt==='Upload') lbl.textContent = t('sec.library.upload')
    else if(txt==='关闭' || txt==='Close') lbl.textContent = t('btn.close')
    else if(txt==='保存草稿' || txt==='Save Draft') lbl.textContent = t('btn.draft')
    else if(txt==='提交审核' || txt==='Submit') lbl.textContent = t('btn.submit')
    else if(!currentUser && (txt==='登录' || txt==='Login')) lbl.textContent = t('nav.login')
  })
  // 学院专栏 full page title
  const collegesTitle = document.querySelector('#page-colleges .section-title')
  if(collegesTitle) collegesTitle.childNodes.forEach(n=>{ if(n.nodeType===3&&n.textContent.trim()) n.textContent = ' '+t('sec.colleges')+' ' })
  // 部门活动 title (合并到学院活动页的第二个 section)
  const actTitles = document.querySelectorAll('#page-colleges .section-title')
  if(actTitles.length>1) actTitles[1].childNodes.forEach(n=>{ if(n.nodeType===3&&n.textContent.trim()) n.textContent = ' '+t('sec.mediaAct')+' ' })
  // 消息中心 title
  const msgTitle = document.querySelector('#page-messages .section-title')
  if(msgTitle){ msgTitle.childNodes.forEach(n=>{ if(n.nodeType===3&&n.textContent.trim()) n.textContent = ' '+t('msg.center')+' ' }) }
  // 上传素材 hero button
  const heroBtn = document.querySelector('.hero-actions .specular-button__label')
  if(heroBtn && heroBtn.textContent.includes('上传')) heroBtn.textContent = t('hero.upload')
}

function applyButtonI18N(){
  const btnMap = {
    '取消':t('btn.cancel'), 'Cancel':t('btn.cancel'),
    '保存':t('btn.save'), 'Save':t('btn.save'),
    '关闭':t('btn.close'), 'Close':t('btn.close'),
    '保存草稿':t('btn.draft'), 'Save Draft':t('btn.draft'),
    '提交审核':t('btn.submit'),
    '编辑资料':t('btn.editProfile'), 'Edit Profile':t('btn.editProfile'),
    '更换头像':t('btn.changeAvatar'), 'Change Avatar':t('btn.changeAvatar'),
    '确认下载':t('dl.confirm'), 'Confirm Download':t('dl.confirm'),
    '提交申请':t('join.submit'), 'Submit':t('join.submit'),
    '上传素材':t('sec.library.upload'), 'Upload':t('sec.library.upload'),
    '加载更多':t('misc.loadMore'), 'Load More':t('misc.loadMore'),
  }
  document.querySelectorAll('button, a').forEach(el=>{
    if(el.classList.contains('specular-button')) return // 跳过 WebGL 按钮，由 applySectionI18N 处理
    const txt = el.textContent.trim()
    if(btnMap[txt]) el.textContent = btnMap[txt]
  })
}

function applyFormI18N(){
  const phMap = {
    'searchInput':'lib.search',
    'materialTitle':'upload.mtitlePh', 'materialDesc':'upload.descPh',
    'materialLink':'upload.linkPh', 'materialDate':'upload.datePh', 'materialTags':'upload.tagsPh',
    'joinName':'join.namePh', 'joinSid':'join.sidPh', 'joinEmail':'join.emailPh',
    'profileBio':'edit.bioPh',
  }
  for(const id in phMap){
    const el = $(id)
    if(el) el.placeholder = t(phMap[id])
  }
  // labels
  const labelMap = {
    'materialTitle':'upload.mtitle', 'materialCollege':'upload.college', 'materialType':'upload.type',
    'materialDesc':'upload.desc', 'materialLinkLabel':'upload.link',
    'materialDate':'upload.date', 'materialTags':'upload.tags', 'materialFile':'upload.file',
  }
  // upload modal labels
  const uploadLabels = document.querySelectorAll('#uploadModal label')
  // Try by text content
  const labelTextMap = {
    '素材标题':t('upload.mtitle'), 'Title':t('upload.mtitle'),
    '素材类型':t('upload.type'), 'Type':t('upload.type'),
    '素材描述':t('upload.desc'), 'Description':t('upload.desc'),
    '网盘链接':t('upload.link'), 'Cloud Link':t('upload.link'),
    '拍摄 / 创作时间':t('upload.date'), 'Date':t('upload.date'),
    '标签（逗号分隔，最多6个）':t('upload.tags'), 'Tags (comma-separated, max 6)':t('upload.tags'),
    '上传文件':t('upload.file'), 'File':t('upload.file'),
    '所属学院':t('upload.college'),
    '姓名':t('edit.name'), 'Name':t('edit.name'),
    '学院':t('edit.college'),
    '年级':t('edit.grade'), 'Grade':t('edit.grade'),
    '个人简介':t('edit.bio'), 'Bio':t('edit.bio'),
  }
  document.querySelectorAll('label').forEach(lbl=>{
    const txt = lbl.textContent.trim()
    if(labelTextMap[txt]) lbl.textContent = labelTextMap[txt]
    else if(txt==='College'){
      if(lbl.closest('#uploadModal')) lbl.textContent = t('upload.college')
      else lbl.textContent = t('edit.college')
    }
  })
  // upload tip
  const tip = document.querySelector('#uploadModal .upload-tip')
  if(tip) tip.textContent = t('upload.tip')
  // upload dropzone
  const drop = document.querySelector('#uploadModal .file-upload-area')
  if(drop){ const fn=drop.querySelector('#uploadFileName'); if(fn) fn.textContent = t('upload.drop'); const h=drop.querySelector('.hint'); if(h) h.textContent = t('upload.fmt') }
  // link note
  document.querySelectorAll('#uploadModal span').forEach(s=>{
    if(s.textContent.includes('大文件') || s.textContent.includes('For large')) s.textContent = t('upload.linkNote')
  })
  // modal titles
  const modalTitles = {
    '上传素材':t('upload.title'), 'Upload Material':t('upload.title'),
    '编辑个人资料':t('edit.title'), 'Edit Profile':t('edit.title'),
    '加入融媒体中心':t('join.title'), 'Join Media Center':t('join.title'),
    '素材详情':t('detail.title'), 'Details':t('detail.title'),
    '素材使用责任声明':t('dl.title'), 'Usage Agreement':t('dl.title'),
  }
  document.querySelectorAll('.modal-title, .modal h2, h2').forEach(h=>{
    const txt = h.textContent.trim()
    if(modalTitles[txt]) h.textContent = modalTitles[txt]
  })
  // disclaimer
  const dlNotice = document.querySelector('#disclaimerModal .modal-body strong')
  if(dlNotice && (dlNotice.textContent.includes('重要') || dlNotice.textContent.includes('Important'))) dlNotice.textContent = t('dl.notice')
  document.querySelectorAll('#disclaimerModal .modal-body li, #disclaimerModal .modal-body p').forEach((el,i)=>{
    const keys = ['dl.r1','dl.r2','dl.r3','dl.r4','dl.r5']
    if(el.tagName==='LI' && i<5) el.textContent = t(keys[i])
    if(el.tagName==='P' && (el.textContent.includes('我已仔细') || el.textContent.includes('I have read'))) el.textContent = t('dl.agree')
  })
  // join modal desc
  const joinDesc = document.querySelector('#joinModal p')
  if(joinDesc && (joinDesc.textContent.includes('欢迎加入') || joinDesc.textContent.includes('Welcome to'))) joinDesc.textContent = t('join.desc')
  // join resume labels
  const jrName = document.querySelector('#joinResumeName')
  if(jrName && (jrName.textContent.includes('点击上传') || jrName.textContent.includes('Upload resume'))) jrName.textContent = t('join.uploadResume')
  const jrHint = document.querySelector('#joinModal .file-upload-area .hint')
  if(jrHint && jrHint.textContent.includes('PDF')) jrHint.textContent = t('join.resumeFmt')
  // profile labels
  const profileLabels = {
    '已上传':t('profile.uploaded'), 'Uploaded':t('profile.uploaded'),
    '已通过':t('profile.approved'), 'Approved':t('profile.approved'),
    '审核中':t('profile.reviewing'), 'Reviewing':t('profile.reviewing'),
    '获赞':t('profile.likes'), 'Likes':t('profile.likes'),
    '我的素材':t('profile.myMat'), 'My Materials':t('profile.myMat'),
    '草稿箱':t('profile.drafts'), 'Drafts':t('profile.drafts'),
    '我的收藏':t('profile.favs'), 'Favorites':t('profile.favs'),
    '参与的活动':t('profile.myAct'), 'Activities':t('profile.myAct'),
  }
  document.querySelectorAll('#page-student .student-stat-label, #page-student .student-tab, #page-student .stat-label, #page-student .profile-tab').forEach(el=>{
    const txt = el.textContent.trim()
    if(profileLabels[txt]) el.textContent = profileLabels[txt]
  })
  // profile defaults
  const sName = $('studentName'), sId = $('studentIdDisplay')
  if(sName && (sName.textContent==='同学' || sName.textContent==='Student')) sName.textContent = t('profile.student')
  if(sId && (sId.textContent==='学号: -' || sId.textContent==='Student ID: -')) sId.textContent = t('profile.sid')
  // grade options
  const gradeOpts = {
    '2026级':t('misc.grade26'),'Class 2026':t('misc.grade26'),
    '2025级':t('misc.grade25'),'Class 2025':t('misc.grade25'),
    '2024级':t('misc.grade24'),'Class 2024':t('misc.grade24'),
    '2023级':t('misc.grade23'),'Class 2023':t('misc.grade23'),
    '2022级':t('misc.grade22'),'Class 2022':t('misc.grade22'),
    '2021级':t('misc.grade21'),'Class 2021':t('misc.grade21'),
  }
  document.querySelectorAll('select option').forEach(opt=>{
    const txt = opt.textContent.trim()
    if(gradeOpts[txt]) opt.textContent = gradeOpts[txt]
  })
}

function applySelectI18N(){
  const optMap = {
    '最新发布':t('lib.newest'), 'Latest':t('lib.newest'),
    '下载最多':t('lib.mostDl'), 'Most Downloaded':t('lib.mostDl'),
    '点赞最多':t('lib.mostLike'), 'Most Liked':t('lib.mostLike'),
  }
  document.querySelectorAll('select option').forEach(opt=>{
    const txt = opt.textContent.trim()
    if(optMap[txt]) opt.textContent = optMap[txt]
  })
  const fs = $('filterSort')
  if(fs){
    Array.from(fs.options).forEach((o,i)=>{
      const map=['lib.newest','lib.mostDl','lib.mostLike']; if(map[i]) o.textContent = t(map[i])
    })
  }
  // library type tabs
  const tabMap = {'':t('lib.allTypes'),'图片':t('lib.image'),'视频':t('lib.video'),'文档':t('lib.doc'),'音频':t('lib.audio'),'其他':t('lib.other')}
  document.querySelectorAll('#libTabs .lib-tab').forEach(tab=>{
    const type = tab.dataset.type
    if(tabMap[type]!==undefined) tab.textContent = tabMap[type]
  })
  // library college tabs
  document.querySelectorAll('#libCollegeTabs .lib-tab').forEach(tab=>{
    const college = tab.dataset.college
    if(!college) tab.textContent = t('lib.allColleges')
  })
}

function applyFooterI18N(){
  document.querySelectorAll('footer .footer-col h3, footer .footer-col h4').forEach(h=>{
    if(h.textContent.includes('快速') || h.textContent.includes('Quick')) h.textContent = t('footer.links')
    if(h.textContent.includes('联系我们') || h.textContent.includes('Contact')) h.textContent = t('footer.contact')
  })
  document.querySelectorAll('footer .footer-brand p').forEach(p=>{
    if(p.textContent.includes('致力于') || p.textContent.includes('Dedicated')) p.textContent = t('footer.desc')
  })
  document.querySelectorAll('footer a').forEach(a=>{
    const txt = a.textContent.trim()
    if(txt==='学院活动' || txt==='College & Activities') a.textContent = t('nav.colleges')
    else if(txt==='上传素材' || txt==='Upload') a.textContent = t('footer.upload')
    else if(txt==='加入我们' || txt==='Join Us') a.textContent = t('footer.join')
    else if(txt==='校园社区' || txt==='Community') a.textContent = t('footer.community')
    else if(txt==='任务中心' || txt==='Task Center') a.textContent = t('footer.tasks')
    else if(txt==='创作中心' || txt==='Creative Studio') a.textContent = t('footer.studio')
    else if(txt==='记忆图谱' || txt==='Memory Graph') a.textContent = t('footer.graph')
    else if(txt.includes('融媒体中心办公室') || txt.includes('Media Center Office')) a.textContent = t('footer.addr')
  })
  const fb = document.querySelector('.footer-bottom')
  if(fb){
    // 只更新文本节点，不重建 innerHTML 以免破坏 #year 等元素
    const y=$('year')
    let updated=false
    fb.childNodes.forEach(n=>{
      if(n.nodeType===3 && n.textContent.includes('©')){
        n.textContent = ' © '
        updated=true
      }
    })
    if(!updated){
      // fallback: 重建但保留 year span
      fb.innerHTML = '© <span id="year">'+(y?y.textContent:new Date().getFullYear())+'</span> '+t('footer.bottom')
    } else if(y){
      // 确保 year 后面的文本正确
      let afterYear=false
      fb.childNodes.forEach(n=>{
        if(n===y || (n.tagName && n.id==='year')) afterYear=true
        else if(afterYear && n.nodeType===3) n.textContent=' '+t('footer.bottom')+' '
      })
    }
  }
  const fn = document.querySelector('footer .footer-brand .cn')
  if(fn) fn.textContent = t('footer.name')
}

function toggleLang(){ setLang(curLang==='zh'?'en':'zh') }

/* ═════════════════ 工具 ═════════════ */
function fmtSize(b){ if(!b) return '0B'; if(b>1048576) return (b/1048576).toFixed(1)+'MB'; if(b>1024) return (b/1024).toFixed(1)+'KB'; return b+'B' }
function colorOf(str){ let h=0; for(const ch of String(str)) h=(h*31+ch.charCodeAt(0))%360; return `hsl(${h},65%,52%)` }


/* ═════════════════ 标签智能提示 ═════════════════ */
var _tagDB = null
async function loadTagDB(){
  if(_tagDB) return _tagDB
  var hb = window.__hbData
  var d = (hb && hb.tags) ? { ok:true, data:hb.tags } : await api('/api/tags')
  _tagDB = (d.data||[]).map(function(t){ return t.tag })
  return _tagDB
}
function initTagInput(input){
  if(input.dataset.tagInit) return
  input.dataset.tagInit = '1'
  var wrap = document.createElement('div')
  wrap.className = 'tag-input-wrap'
  input.parentNode.insertBefore(wrap, input)
  wrap.appendChild(input)
  var suggest = document.createElement('div')
  suggest.className = 'tag-suggest'
  wrap.appendChild(suggest)
  var cursorPos = 0, currentQuery = ''
  function getActiveTag(val, pos){
    var before = val.substring(0, pos)
    var hashIdx = before.lastIndexOf('#')
    if(hashIdx === -1) return null
    var afterHash = before.substring(hashIdx + 1)
    if(afterHash.includes(',') || afterHash.includes(' ')) return null
    return { start: hashIdx, query: afterHash }
  }
  input.addEventListener('input', async function(){
    var val = input.value
    cursorPos = input.selectionStart
    var active = getActiveTag(val, cursorPos)
    if(!active){ suggest.classList.remove('show'); return }
    currentQuery = active.query.toLowerCase()
    if(!_tagDB) await loadTagDB()
    var matches = _tagDB.filter(function(t){ return t.toLowerCase().includes(currentQuery) }).slice(0, 8)
    if(!matches.length){ suggest.classList.remove('show'); return }
    suggest.innerHTML = matches.map(function(tag){
      return '<div class="tag-suggest-item" data-tag="'+esc(tag)+'"><span class="tag-hash">#</span>'+esc(tag)+'<span class="tag-count">'+(currentQuery?t('lib.common'):t('lib.recommend'))+'</span></div>'
    }).join('')
    suggest.classList.add('show')
    suggest.querySelectorAll('.tag-suggest-item').forEach(function(item){
      item.addEventListener('click', function(){
        var tag = item.dataset.tag
        var val = input.value
        var before = val.substring(0, active.start)
        var after = val.substring(cursorPos)
        var sep = (before && !before.endsWith(',') && !before.endsWith('#')) ? ',' : ''
        input.value = before + sep + tag + after
        input.focus()
        var newPos = (before + sep + tag).length
        setTimeout(function(){ input.setSelectionRange(newPos, newPos) }, 0)
        suggest.classList.remove('show')
        input.dispatchEvent(new Event('input'))
      })
    })
  })
  input.addEventListener('blur', function(){
    setTimeout(function(){ suggest.classList.remove('show') }, 200)
  })
  input.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){ suggest.classList.remove('show') }
  })
}
let debounceT; function debouncedLoadMaterials(){ clearTimeout(debounceT); debounceT=setTimeout(loadMaterials, 350) }

// 分页状态
var _matPage = 0
var _matPageSize = 12
var _matTotal = 0
var _curQ = ''
var _matLoading = false
var _matHasMore = false
var _matIO = null // IntersectionObserver for infinite scroll

/* ═════════════════ 导航 ═════════════ */
var _spaNav=false
function showPage(page,skipHistory){
  const old=document.querySelector('.page-section.active')
  const el=document.getElementById('page-'+page)
  if(!el||el===old) return
  if(!skipHistory){
    history.pushState({page:page,type:'page'},'','#'+page)
  }
  if(old){
    old.style.transition='opacity .3s ease,transform .3s ease,filter .3s ease'
    old.style.opacity='0';old.style.transform='scale(.97)';old.style.filter='blur(4px)'
    setTimeout(function(){
      old.classList.remove('active');old.style.removeProperty('opacity');old.style.removeProperty('transform');old.style.removeProperty('filter')
      el.classList.add('active');el.style.opacity='0';el.style.transform='scale(1.02)'
      requestAnimationFrame(function(){el.style.transition='opacity .4s cubic-bezier(.22,1,.36,1),transform .5s cubic-bezier(.22,1,.36,1),filter .4s cubic-bezier(.22,1,.36,1)';el.style.opacity='1';el.style.transform='scale(1)';el.style.filter='blur(0)'})
      if(page==='library')loadMaterials()
    },280)
  } else {el.classList.add('active')}
  document.querySelectorAll('.header-nav a').forEach(function(a){a.classList.remove('active');a.removeAttribute('aria-current')})
  var nav=document.querySelector('.header-nav a[data-page="'+page+'"]');if(nav){nav.classList.add('active');nav.setAttribute('aria-current','page')}
  if(page==='student'&&currentUser)renderStudentPage()
  if(page==='messages')loadMessages()
  if(page==='library'&&!old)loadMaterials()
  closeMenu();window.scrollTo({top:0,behavior:'smooth'})
  setTimeout(function(){ el.setAttribute('tabindex','-1'); el.focus({preventScroll:true}) },300)
}
function scrollToSection(id){
  var home=document.getElementById('page-home')
  if(home&&!home.classList.contains('active')){
    showPage('home')
    setTimeout(function(){ var el=document.getElementById(id); if(el) el.scrollIntoView({behavior:'smooth'}) },400)
  } else {
    var el=document.getElementById(id); if(el) el.scrollIntoView({behavior:'smooth'})
  }
}
function toggleMenu(){ const n=$('mainNav'),o=$('navOverlay'),t=$('menuToggle'); const open=n.classList.toggle('mobile-show'); o.classList.toggle('show',open); t.classList.toggle('active',open) }
function closeMenu(){ $('mainNav').classList.remove('mobile-show'); $('navOverlay').classList.remove('show'); $('menuToggle').classList.remove('active') }

var _modalPrevFocus=null,_modalEscHandler=null,_modalTrapHandler=null
function openModal(id){
  var el=$(id)
  _modalPrevFocus=document.activeElement
  el.classList.add('active'); document.body.style.overflow='hidden'
  var f=el.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')
  if(f.length) f[0].focus(); else { el.setAttribute('tabindex','0'); el.focus() }
  _modalEscHandler=function(e){ if(e.key==='Escape') closeModal(id) }
  _modalTrapHandler=function(e){
    if(e.key!=='Tab') return
    var fl=el.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')
    if(!fl.length) return
    var first=fl[0],last=fl[fl.length-1]
    if(e.shiftKey){ if(document.activeElement===first){ e.preventDefault(); last.focus() } }
    else { if(document.activeElement===last){ e.preventDefault(); first.focus() } }
  }
  document.addEventListener('keydown',_modalEscHandler)
  el.addEventListener('keydown',_modalTrapHandler)
  if(window._modalOnOpen) window._modalOnOpen(el)
}
function closeModal(id){
  $(id).classList.remove('active'); document.body.style.overflow=''
  if(_modalEscHandler){ document.removeEventListener('keydown',_modalEscHandler); _modalEscHandler=null }
  if(_modalTrapHandler){ $(id).removeEventListener('keydown',_modalTrapHandler); _modalTrapHandler=null }
  if(_modalPrevFocus){ try{_modalPrevFocus.focus()}catch(e){}; _modalPrevFocus=null }
  if(window._modalOnClose) window._modalOnClose($(id))
  if(id==='detailModal' && !_spaNav){ history.back() }
}
document.querySelectorAll('.modal-overlay').forEach(el=>el.addEventListener('click',e=>{ if(e.target===el){ closeModal(el.id) } }))

/* 登录态兜底（2026-10-23）：currentUser 可能因页面加载时序或单点登录失效，
   先复查一次 /api/me 再决定，避免"明明登录了却被踢去登录页" */
async function ensureLogin(){
  if(currentUser) return currentUser
  try{
    const me = await api('/api/me')
    if(me && me.user){
      currentUser = me.user
      try{ refreshUserUI() }catch(e){}
      return currentUser
    }
  }catch(e){}
  return null
}
/* 未登录时先给提示再跳转（避免无提示直接跳走） */
function goLogin(msg){
  if(msg) toast(msg)
  setTimeout(function(){ location.href = '/login.html' }, msg ? 1200 : 0)
}
function requireLogin(fn){ ensureLogin().then(function(u){ if(!u){ goLogin('请先登录'); return } fn() }) }

/* ═════════════════ 登录 ═════════════ */
function handleLoginBtn(){
  if(currentUser){
    if(currentUser.is_admin) window.location.href='/admin.html'
    else window.location.href='/user.html'
  } else location.href='/login.html'
}

async function doLogout(){
  await api('/api/logout',{method:'POST'})
  currentUser=null
  toast(t('t.logout'))
  refreshUserUI()
  showPage('home')
}
function refreshUserUI(){
  const btn=$('loginBtn')
  const lbl=btn.querySelector('.specular-button__label')
  const userLinks=document.querySelectorAll('.user-only'), adminLinks=document.querySelectorAll('.admin-only')
  const topAdmin=$('topAdminLink')
  // 首页导航始终不显示个人主页、消息、后台管理
  userLinks.forEach(a=>a.classList.add('hidden'))
  adminLinks.forEach(a=>a.classList.add('hidden'))
  topAdmin.classList.add('hidden')
  $('navMsgBadge').style.display='none'
  const um=$('userMenu')
  if(currentUser){
    lbl.textContent=esc(currentUser.name)
    // B1：登录后登录按钮换头像下拉菜单（内部事务统一入口）
    btn.style.display='none'
    if(um){
      um.style.display=''
      const av=$('userAvatar'), dn=$('userDdName')
      if(av) av.textContent=esc((currentUser.name||'U').charAt(0).toUpperCase())
      if(dn) dn.textContent=esc(currentUser.name||currentUser.id)
      const dd=$('ddAdminLink')
      if(dd) dd.style.display=(currentUser.is_admin||currentUser.role==='admin')?'':'none'
      positionUserMenu()
    }
    loadMsgBadge()
  } else {
    lbl.textContent=t('nav.login')
    btn.style.display=''
    if(um){ um.style.display='none'; um.classList.remove('open') }
  }
}
// B1：用户菜单开合（点击外部关闭）
function toggleUserMenu(e){
  if(e){e.stopPropagation()}
  const um=$('userMenu')
  if(!um)return
  um.classList.toggle('open')
  const btn=$('userMenuBtn')
  if(btn) btn.setAttribute('aria-expanded', um.classList.contains('open')?'true':'false')
}
document.addEventListener('click',function(e){
  const um=$('userMenu')
  if(um&&um.classList.contains('open')&&!um.contains(e.target)){um.classList.remove('open')}
})
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){const um=$('userMenu');if(um)um.classList.remove('open')}
})
function positionUserMenu(){
  const btn=$('userMenuBtn'), dd=$('userDropdown')
  if(!btn||!dd)return
  const r=btn.getBoundingClientRect()
  dd.style.top=(r.bottom+10)+'px'
  dd.style.right=Math.max(12, innerWidth-r.right)+'px'
}
addEventListener('scroll',function(){const um=$('userMenu');if(um&&um.classList.contains('open'))um.classList.remove('open')},{passive:true})
addEventListener('resize',function(){const um=$('userMenu');if(um&&um.classList.contains('open'))positionUserMenu()})

/* ═════════════════ 数据加载 ═════════════ */
async function init(){
  $('year').textContent = new Date().getFullYear()
  // P1 性能:优先消费首页聚合数据(与 home-v3.js 共用 index.html 内联脚本发起的同一请求)
  let hb = null
  try { if (window.__homeBundle) { const j = await window.__homeBundle; if (j && j.ok) hb = j.data } } catch (e) { }
  window.__hbData = hb
  renderHotBar()
  // 登录态
  const me = await api('/api/me')
  currentUser = me.user
  refreshUserUI()
  // 设计审计 A2（2026-09-22）：内部事务入口（任务中心/创作中心/移动端任务 tab）仅登录后显示
  if (currentUser) {
    document.querySelectorAll('[data-auth-only]').forEach(function (a) { a.style.display = '' })
  }
  // 学院
  if (hb && hb.colleges) { colleges = hb.colleges }
  else { const c = await api('/api/colleges'); colleges = c.data || [] }
  renderColleges()
  initCustomSelects(document)
  initUploadDropzone()
  initTagInput($('uploadTags'))
  loadTagDB()
  // 数据
  await Promise.all([loadMaterials(), loadActivities()])
  renderHomeCollections()
  // Hash 深链接页面导航
  var hashPage = location.hash ? location.hash.slice(1) : ''
  if(hashPage && hashPage!=='home' && document.getElementById('page-'+hashPage)){
    showPage(hashPage, true)
  }
  if(hashPage && hashPage.indexOf('collection-')===0){
    var cid=parseInt(location.hash.slice(1).split('-')[1],10)
    if(cid)openCollectionDetail(cid,true)
  }
  // 深链接自动打开素材详情
  const params = new URLSearchParams(window.location.search)
  const detailId = params.get('detail')
  if(detailId && /^\d+$/.test(detailId)){
    openDetail(parseInt(detailId), true)
  }
  // 初始化历史状态
  history.replaceState({page:hashPage||'home',type:'page'}, '', location.pathname+location.search+location.hash)
}
// 浏览器前进/后退处理
window.addEventListener('popstate', function(e){
  _spaNav = true
  var st = e.state
  if(st && st.type === 'page' && st.page === 'collection-detail' && st.detailId != null){
    // 前进/后退到专题详情历史条目：重开详情页（低危修复：replaceState 改 pushState 后返回栈可还原）
    openCollectionDetail(st.detailId, true)
  } else if(st && st.type === 'page' && st.page === 'activity-detail' && st.detailId != null){
    openActivityDetail(st.detailId, true)
  } else if(st && st.type === 'detail' && st.detail != null){
    openDetail(st.detail, true)
  } else {
    if($('detailModal').classList.contains('active')){ closeModal('detailModal') }
    if(st && st.page){
      showPage(st.page, true)
    }
  }
  _spaNav = false
})
/* ── 学院 ── */
function renderColleges(){
  const card = c=>`<div class="college-card" data-cid="${esc(c.id)}">
    <div class="college-icon" style="background:${c.color}1a;color:${c.color}"><span style="font-size:18px;font-weight:700">${esc(collegeName(c.name).charAt(0))}</span></div>
    <div class="college-name">${esc(collegeName(c.name))}</div>
    <div class="college-count"><span data-count="${c.material_count||0}">0</span> ${t('misc.matCount')}</div>
  </div>`
  const cgf = $('collegesGridFull')
  
  if(cgf){ cgf.innerHTML = colleges.map(card).join(''); countUpAll(cgf) }
  // 填充下拉（元素可能不存在于精简页面结构，需防护）
  const opts = '<option value="">'+t('upload.subSelect')+'</option>' + colleges.map(c=>`<option value="${esc(c.name)}">${esc(collegeName(c.name))}</option>`).join('')
  const uc=$('uploadCollege'), jc=$('joinCollege')
  if(uc) uc.innerHTML = opts
  if(jc) jc.innerHTML = opts
  // 填充素材库学院标签
  const ct = $('libCollegeTabs')
  if(ct){
    const current = $('filterCollege').value
    ct.innerHTML = `<button class="lib-tab${!current?' active':''}" data-college="" onclick="setCollegeTab(this)">${t('lib.allColleges')}</button>` +
      colleges.map(c=>`<button class="lib-tab${current===c.name?' active':''}" data-college="${esc(c.name)}" onclick="setCollegeTab(this)">${esc(collegeName(c.name))}</button>`).join('')
  }
}
async function showCollegeDetail(id){
  const c = colleges.find(x=>x.id===id)
  if(!c) return
  $('collegeDetailName').textContent = collegeName(c.name)
  $('collegeDetailDesc').textContent = collegeDesc(c.name)
  showPage('college-detail')
  renderMaterialsGrid($('collegeMaterialsGrid'), c.id)
}
async function renderMaterialsGrid(el, collegeId){
  el.innerHTML = '<div class="loading"><div class="spinner"></div><p>'+t('misc.loading')+'</p></div>'
  const c = colleges.find(x=>x.id===collegeId);if(!c)return;const d = await api('/api/materials?college='+encodeURIComponent(c.name)+'&page=1&pageSize=50')
  const list = d.data||[]
  el.innerHTML = list.length ? list.map(materialCard).join('') : emptyHTML(null,t('empty.college'))
  bindCards(el)
  countUpAll(el)
}

/* ── 素材 ── */
function setLibTab(btn){
  document.querySelectorAll('#libTabs .lib-tab').forEach(t=>t.classList.remove('active'))
  btn.classList.add('active')
  $('filterType').value = btn.dataset.type
  loadMaterials()
}
function setCollegeTab(btn){
  document.querySelectorAll('#libCollegeTabs .lib-tab').forEach(t=>t.classList.remove('active'))
  btn.classList.add('active')
  $('filterCollege').value = btn.dataset.college
  loadMaterials()
}
function setTagFilter(tag){
  const el = $('filterTag')
  if(el.value === tag){ el.value = ''; document.querySelectorAll('.lib-tag-chip').forEach(c=>c.classList.remove('active')) }
  else{ el.value = tag; document.querySelectorAll('.lib-tag-chip').forEach(c=>c.classList.toggle('active', c.dataset.tag === tag)) }
  loadMaterials()
}
/* 限流后重试：3 秒冷却，避免连点加剧限流（2026-10-23） */
function retryAfterCooldown(){
  var btns = document.querySelectorAll('[onclick*="retryAfterCooldown"]')
  btns.forEach(function(b){ b.disabled = true; b.style.opacity = '.55'; b.style.cursor = 'not-allowed' })
  toast('请稍等 3 秒…')
  setTimeout(function(){ loadMaterials(true) }, 3000)
}


/* ═══ 上传区拖拽支持（2026-10-23）═══
   原来只有 onchange（点击选择），文案却写着"或将文件拖到此处"——拖拽完全没实现。 */
function initUploadDropzone(){
  var area = document.querySelector('#uploadModal .file-upload-area')
  if(!area || area.dataset.dropBound === '1') return
  area.dataset.dropBound = '1'

  ;['dragenter','dragover'].forEach(function(ev){
    area.addEventListener(ev, function(e){ e.preventDefault(); e.stopPropagation(); area.classList.add('drag-over') })
  })
  ;['dragleave','drop'].forEach(function(ev){
    area.addEventListener(ev, function(e){ e.preventDefault(); e.stopPropagation(); area.classList.remove('drag-over') })
  })
  area.addEventListener('drop', function(e){
    e.preventDefault(); e.stopPropagation()
    var dt = e.dataTransfer
    if(!dt) return
    var files = dt.files
    if(files && files.length){ handleFilesSelect(files); return }
    // 兼容拖入文件夹/URL 的情况
    if(dt.items && dt.items.length){
      var arr = []
      for(var i = 0; i < dt.items.length; i++){
        var it = dt.items[i]
        if(it.kind === 'file'){ var f = it.getAsFile(); if(f) arr.push(f) }
      }
      if(arr.length) handleFilesSelect(arr)
    }
  })
  // 阻止浏览器默认打开文件
  ;['dragover','drop'].forEach(function(ev){
    document.addEventListener(ev, function(e){ if(e.target && e.target.closest && e.target.closest('#uploadModal')) e.preventDefault() })
  })
}

async function loadMaterials(forceLibrary){
  const isLibraryPage = forceLibrary || document.getElementById('page-library')?.classList.contains('active')
  const grid = isLibraryPage ? $('libraryGrid') : null
  if(!grid) return
  const q=$('searchInput')?.value.trim()||'', type=$('filterType')?.value||'', sort=$('filterSort')?.value||'newest', college=$('filterCollege')?.value||'', tag=$('filterTag')?.value||''
  const dateFrom=$('filterDateFrom')?.value||'', dateTo=$('filterDateTo')?.value||''
  _curQ=q

  if(isLibraryPage){
    // 素材库页：分页加载
    _matPage = 1
    grid.innerHTML = skeletonCardsHTML(8)
    const d = await fetchMaterialsPage(1, q, type, sort, college, tag, dateFrom, dateTo)
    if(!d || !d.ok){
      // 2026-10-23：区分 429 限流与真正的网络故障，避免误导
      var _rate = !!(d && d.rateLimited)
      grid.innerHTML = emptyStateHTML({
        icon: 'warn',
        title: _rate ? '请求过于频繁，请稍等几秒再点重试' : '内容加载失败',
        desc: _rate ? '' : '服务器暂时没有响应，稍等片刻会自动重试，或点击按钮立即重试',
        ctaText: t('misc.retry'),
        ctaOnclick: _rate ? 'retryAfterCooldown()' : 'loadMaterials(true)',   // 手动点击仍用 onclick 字符串（按钮 HTML 属性）
        ctaFn: _rate ? retryAfterCooldown : function(){ loadMaterials(true) },  // 自动重试用函数引用（无 eval）
        autoRetry: _rate ? 10 : 8
      })
      updateLoadMoreBtn()
      return
    }
    const list = d.data||[]
    _matTotal = d.total||0
    _matHasMore = !!d.hasMore
    renderFilterChips(_matTotal)
    if(!list.length){ grid.innerHTML = emptyStateHTML({icon:'search',title:t('empty.search')}); updateLoadMoreBtn(); return }
    grid.innerHTML = list.map(materialCard).join('')
    bindCards(grid)
    countUpAll(grid)
    applyStagger(grid)
    renderTagsCloud()
    updateLoadMoreBtn()
    setupInfiniteScroll()
  } else {
    // 首页：只取前8条
    let url='/api/materials?page=1&pageSize=8&'
    if(type) url+='type='+encodeURIComponent(type)+'&'
    if(college) url+='college='+encodeURIComponent(college)+'&'
    if(tag) url+='tag='+encodeURIComponent(tag)+'&'
    if(sort) url+='sort='+sort+'&'
    if(q) url+='q='+encodeURIComponent(q)
    const d = await api(url)
    if(!d.ok){ grid.innerHTML = emptyStateHTML({icon:'warn',title:t('t.netFail2')}); return }
    const list = d.data||[]
    if(!list.length){ grid.innerHTML = emptyStateHTML({icon:'search',title:t('empty.search')}); return }
    grid.innerHTML = list.map(materialCard).join('')
    bindCards(grid)
    countUpAll(grid)
    applyStagger(grid)
  }
}

function fetchMaterialsPage(page, q, type, sort, college, tag, dateFrom, dateTo){
  let url='/api/materials?page='+page+'&pageSize='+_matPageSize+'&'
  if(type) url+='type='+encodeURIComponent(type)+'&'
  if(college) url+='college='+encodeURIComponent(college)+'&'
  if(tag) url+='tag='+encodeURIComponent(tag)+'&'
  if(sort) url+='sort='+sort+'&'
  if(q) url+='q='+encodeURIComponent(q)+'&'
  // P2 阶段二 · F-3：日期区间参数透传
  if(dateFrom) url+='date_from='+encodeURIComponent(dateFrom)+'&'
  if(dateTo) url+='date_to='+encodeURIComponent(dateTo)+'&'
  return api(url)
}

async function loadMoreMaterials(){
  if(_matLoading || !_matHasMore) return
  _matLoading = true
  const btn = $('loadMoreBtn')
  if(btn) btn.textContent = t('misc.loading')||'加载中...'
  const q=$('searchInput')?.value.trim()||'', type=$('filterType')?.value||'', sort=$('filterSort')?.value||'newest', college=$('filterCollege')?.value||'', tag=$('filterTag')?.value||''
  const dateFrom=$('filterDateFrom')?.value||'', dateTo=$('filterDateTo')?.value||''
  _curQ=q
  _matPage++
  const d = await fetchMaterialsPage(_matPage, q, type, sort, college, tag, dateFrom, dateTo)
  _matLoading = false
  if(!d || !d.ok){ _matPage--; if(btn) btn.textContent = btnLabel(); return }
  const list = d.data||[]
  _matHasMore = !!d.hasMore
  if(list.length){
    const grid = $('libraryGrid')
    grid.insertAdjacentHTML('beforeend', list.map(materialCard).join(''))
    bindCards(grid)
    countUpAll(grid)
  }
  updateLoadMoreBtn()
}

function btnLabel(){ return _matHasMore ? (t('misc.loadMore')||'加载更多') : (t('misc.noMore')||'没有更多了') }

function updateLoadMoreBtn(){
  const wrap = $('loadMoreWrap')
  if(!wrap) return
  if(_matHasMore){
    wrap.style.display = 'block'
    const btn = $('loadMoreBtn')
    if(btn && !_matLoading){ btn.textContent = btnLabel(); btn.disabled = false; btn.style.opacity = '' }
  } else {
    if(_matTotal > _matPageSize){
      wrap.style.display = 'block'
      const btn = $('loadMoreBtn')
      if(btn){ btn.textContent = t('misc.noMore')||'没有更多了'; btn.disabled = true; btn.style.opacity = '0.5' }
    } else {
      wrap.style.display = 'none'
    }
  }
}

function setupInfiniteScroll(){
  if(_matIO) { _matIO.disconnect(); _matIO = null }
  const wrap = $('loadMoreWrap')
  if(!wrap) return
  _matIO = new IntersectionObserver(function(entries){
    if(entries[0] && entries[0].isIntersecting && _matHasMore && !_matLoading){
      loadMoreMaterials()
    }
  }, { rootMargin: '200px' })
  _matIO.observe(wrap)
}

/* ── F-3 · 关键词高亮（先 esc 再对 esc 后的 q 大小写不敏感替换，天然防 XSS）── */
function hl(text){
  const s = esc(text)
  if(!_curQ) return s
  const qEsc = esc(_curQ).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if(!qEsc) return s
  try{ return s.replace(new RegExp('('+qEsc+')','gi'), '<mark class="hl">$1</mark>') }catch(e){ return s }
}
/* ── F-3 · 组合筛选汇总条（chips 可视化 + 单项移除 + 一键清空 + 结果计数）── */
function renderFilterChips(total){
  const box = $('libFilterMeta')
  if(!box) return
  const type=$('filterType')?.value||'', college=$('filterCollege')?.value||'', tag=$('filterTag')?.value||''
  const dateFrom=$('filterDateFrom')?.value||'', dateTo=$('filterDateTo')?.value||''
  const q=$('searchInput')?.value.trim()||''
  const chips=[]
  if(type) chips.push({k:'type',v:type,label:t('filter.type')+'：'+typeLabel(type)})
  if(college) chips.push({k:'college',v:college,label:t('filter.college')+'：'+collegeName(college)})
  if(tag) chips.push({k:'tag',v:tag,label:'#'+tag})
  if(dateFrom||dateTo) chips.push({k:'date',v:dateFrom+'|'+dateTo,label:t('filter.date')+'：'+(dateFrom||'…')+' '+(t('filter.to'))+' '+(dateTo||'…')})
  if(q) chips.push({k:'q',v:q,label:'"'+q+'"'})
  const metaHtml = '<div class="filter-meta-row">'
    + '<div class="filter-chips" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:1;min-width:0">'
    + '<span style="font-size:12px;color:var(--text-3)">'+t('filter.current')+'</span>'
    + chips.map(c=>'<span class="filter-chip">'+esc(c.label)+'<button type="button" class="fc-x" data-fk="'+c.k+'" aria-label="移除条件">×</button></span>').join('')
    + '<button type="button" class="fc-clear" onclick="clearAllFilters()">'+t('filter.clear')+'</button>'
    + '</div>'
    + (typeof total==='number' ? '<span style="font-size:12px;color:var(--text-3);white-space:nowrap"><b style="color:var(--text-1)">'+total+'</b> '+t('filter.results')+'</span>' : '')
    + '</div>'
  box.innerHTML = metaHtml
  box.style.display = chips.length ? 'block' : 'none'
  box.querySelectorAll('.fc-x').forEach(btn=>{
    btn.addEventListener('click', function(){
      const k=this.dataset.fk
      if(k==='type'){ $('filterType').value=''; document.querySelectorAll('#libTabs .lib-tab').forEach(x=>x.classList.toggle('active', !x.dataset.type)) }
      else if(k==='college'){ $('filterCollege').value=''; document.querySelectorAll('#libCollegeTabs .lib-tab').forEach(x=>x.classList.toggle('active', !x.dataset.college)) }
      else if(k==='tag'){ $('filterTag').value=''; document.querySelectorAll('.lib-tag-chip').forEach(x=>x.classList.remove('active')) }
      else if(k==='date'){ if($('filterDateFrom')) $('filterDateFrom').value=''; if($('filterDateTo')) $('filterDateTo').value='' }
      else if(k==='q'){ if($('searchInput')) $('searchInput').value='' }
      loadMaterials()
    })
  })
}
function clearAllFilters(){
  $('filterType').value=''; $('filterCollege').value=''; $('filterTag').value=''
  document.querySelectorAll('#libTabs .lib-tab').forEach(x=>x.classList.toggle('active', !x.dataset.type))
  document.querySelectorAll('#libCollegeTabs .lib-tab').forEach(x=>x.classList.toggle('active', !x.dataset.college))
  document.querySelectorAll('.lib-tag-chip').forEach(x=>x.classList.remove('active'))
  if($('filterDateFrom')) $('filterDateFrom').value=''
  if($('filterDateTo')) $('filterDateTo').value=''
  if($('searchInput')) $('searchInput').value=''
  loadMaterials()
}
/* ── 热榜横滑条（个人上传 TOP，数据来自 home-bundle.leaderboard）── */
function renderHotBar(){
  const bar = $('hotBar')
  if(!bar) return
  const hb = window.__hbData
  const rows = (hb && hb.leaderboard) || []
  if(!rows.length){ bar.style.display='none'; return }
  const scope = hb.leaderboardScope==='alltime' ? t('hotbar.alltime') : t('hotbar.weekly')
  const medals = ['<svg width="13" height="13" viewBox="0 0 24 24" fill="#d4af37" stroke="none" stroke="#d4af37" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>','<svg width="13" height="13" viewBox="0 0 24 24" fill="#9ca3af" stroke="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>','<svg width="13" height="13" viewBox="0 0 24 24" fill="#b45309" stroke="none" stroke="#b45309" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>']
  bar.innerHTML = '<div class="hot-bar-head"><h3 data-i18n-html="hotbar.title">'+t('hotbar.title')+'</h3><span class="hot-scope">'+esc(scope)+'</span></div>'
    + '<div class="hot-bar-track">'
    + rows.map(function(r,i){
      const medal = medals[i] || '<span class="hot-rank">'+(i+1)+'</span>'
      return '<div class="hot-card">'
        + '<div class="hot-medal">'+medal+'</div>'
        + '<span class="avatar" style="background:'+colorOf(r.author)+';width:34px;height:34px;font-size:14px">'+esc((r.author||'?').charAt(0))+'</span>'
        + '<div class="hot-info"><div class="hot-name">'+esc(r.author||'—')+'</div>'
        + '<div class="hot-stats"><span><b>'+Number(r.uploads||0)+'</b> '+t('hotbar.uploads')+'</span><span><b>'+Number(r.downloads||0)+'</b> '+t('hotbar.downloads')+'</span></div></div>'
        + '</div>'
    }).join('')
    + '</div>'
  bar.style.display='block'
}
function renderTagsCloud(){
  const cloud = $('libTagsCloud')
  if(!cloud) return
  api('/api/tags').then(function(d){
    if(!d || !d.ok) return
    const tags = (d.data||[]).filter(function(t){return t.count>0}).slice(0,20)
    if(!tags.length){ cloud.innerHTML = ''; cloud.style.display = 'none'; return }
    cloud.style.display = 'flex'
    const activeTag = $('filterTag')?.value || ''
    cloud.innerHTML = tags.map(function(tg){
      return '<button class="lib-tag-chip'+(activeTag===tg.tag?' active':'')+'" data-tag="'+esc(tg.tag)+'">#'+esc(tg.tag)+' <span style="opacity:.5;font-size:11px" data-count="'+tg.count+'">0</span></button>'
    }).join('')
    countUpAll(cloud)
  })
}
function fmtFileSize(b){ if(!b) return ''; if(b>1048576) return (b/1048576).toFixed(1)+'MB'; if(b>1024) return (b/1024).toFixed(0)+'KB'; return b+'B' }
function fmtDuration(s){ if(!s) return ''; if(s>=3600){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h+(curLang==='en'?'h':'时')+m+(curLang==='en'?'m':'分')} if(s>=60){const m=Math.floor(s/60),sec=s%60; return m+(curLang==='en'?'m':'分')+sec+(curLang==='en'?'s':'秒')} return s+(curLang==='en'?'s':'秒') }
function fmtDim(w,h){ if(!w||!h) return ''; return w+'×'+h }
function getStatusLabels(){
  return {
    draft: [t('st.draft'),'#6b7280','rgba(107,114,128,.1)'],
    pending_review: [t('st.review'),'#d97706','rgba(217,119,6,.1)'],
    approved: [t('st.approved'),'#059669','rgba(5,150,105,.1)'],
    published: [t('st.published'),'#2563eb','rgba(37,99,235,.1)'],
    archived: [t('st.archived'),'#6b7280','rgba(107,114,128,.08)'],
    rejected: [t('st.rejected'),'#dc2626','rgba(220,38,38,.1)'],
  }
}
function statusTag(s){
  const sl = getStatusLabels()
  const [label,color,bg] = sl[s] || [t('st.unknown'),'#6b7280','rgba(0,0,0,.05)']
  return `<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;color:${color};background:${bg};border:1px solid ${color}22">${label}</span>`
}
function materialCard(m){
  const cc = (colleges.find(c=>c.name===m.college)||{}).color || '#4299e1'
  const thumbUrl = m.has_thumb ? `/api/thumbs/${m._thumb_filename||''}` : ''
  const meta = []
  if(m.file_size) meta.push(fmtFileSize(m.file_size))
  if(m.width && m.height) meta.push(fmtDim(m.width, m.height))
  if(m.duration) meta.push(fmtDuration(m.duration))
  const tags = (m.tags||[]).slice(0,3).map(tg=>`<span class="card-tag" data-tag="${esc(tg)}" style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;background:rgba(0,0,0,.04);color:var(--text-3);cursor:pointer;transition:all .2s">#${esc(tg)}</span>`).join('')
  return `<div class="material-card" data-id="${m.id}">
    <div class="material-thumb" style="background:linear-gradient(135deg,${cc}18,${cc}08)">
      ${m.has_thumb && m.thumb_filename ? `<img src="/api/thumbs/${m.thumb_filename}" style="width:100%;height:100%;object-fit:cover" alt="${esc(materialTitle(m.title))}" loading="lazy" decoding="async">` : `<span>${typeIcons[m.type]||'FILE'}</span>`}
      ${!m.has_file ? '<span style="position:absolute;top:8px;right:8px;font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(0,0,0,.5);color:#fff">'+t('st.noFile')+'</span>' : ''}
      <span class="material-type-badge">${typeLabel(m.type)}</span>
    </div>
    <div class="material-body">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px">
        <div class="material-title" style="flex:1;min-width:0">${hl(materialTitle(m.title))}</div>
        ${statusTag(m.status)}
      </div>
      <div class="material-meta" style="margin-bottom:6px">
        ${meta.length ? `<span style="color:var(--text-3)">${meta.join(' · ')}</span>` : ''}
        <span>${esc(collegeName(m.college))}</span>
      </div>
      ${tags ? `<div style="margin-bottom:6px;display:flex;gap:4px;flex-wrap:wrap">${tags}</div>` : ''}
      <div class="material-stats">
        <span data-count="${m.views||0}">0</span>
        <button class="like-btn${m._liked?' liked':''}" data-like="${m.id}"><span data-count="${m.likes||0}">0</span></button>
        <button class="like-btn fav-btn${m._fav?' liked':''}" data-fav="${m.id}"><span>${m._fav?t('misc.faved'):t('misc.fav')}</span></button>
      </div>
      <div class="material-footer">
        <div class="material-author"><span class="avatar" style="background:${colorOf(m.author)}">${esc((m.author||'?').charAt(0))}</span>${hl(m.author||t('misc.author'))}</div>
        <div style="display:flex;align-items:center;gap:8px">${m.drive_url?`<button type="button" class="download-btn drive-link" data-drive="${esc(m.drive_url)}" style="background:rgba(139,92,246,.1);border-color:#8b5cf6;color:#8b5cf6;cursor:pointer">${t('misc.cloud')}</button>`:''}${m.has_file?'<span class="download-btn">'+t('misc.dl')+'</span>':(m.drive_url?'':'<span style="font-size:11px;color:var(--text-3)">'+t('st.descOnly')+'</span>')}</div>
      </div>
    </div>
  </div>`
}
function emptyHTML(icon,msg){ return `<div class="empty" style="grid-column:1/-1"><div class="icon" style="opacity:.3;color:var(--text-3)">${icon||'<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'}</div><p>${msg}</p></div>` }
function errorHTML(msg){ return `<div class="empty" style="grid-column:1/-1"><div class="icon" style="color:#f87171"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><p style="color:#f87171">${msg||t('t.netFail2')}</p></div>` }
function loadingHTML(){ return `<div class="empty" style="grid-column:1/-1;opacity:.5"><div class="icon" style="animation:spin 1s linear infinite"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div><p>${t('misc.loading')}</p></div>` }
function bindCards(el){
  // .material-card 点击由容器事件委托统一处理（见文末事件委托区块）
  el.querySelectorAll('.like-btn').forEach(btn=>{
    const id = Number(btn.dataset.like)
    btn.addEventListener('click', async e=>{ e.stopPropagation(); await toggleLike(id, btn) })
  })
  el.querySelectorAll('.fav-btn').forEach(btn=>{
    const id = Number(btn.dataset.fav)
    btn.addEventListener('click', async e=>{ e.stopPropagation(); await toggleFav(id, btn) })
  })
  el.querySelectorAll('.drive-link').forEach(btn=>{
    btn.addEventListener('click', e=>{ e.stopPropagation(); openDriveLink(btn.dataset.drive) })
  })
}
function openDriveLink(raw){
  var urlMatch=String(raw).match(/https?:\/\/[^\s]+/i)
  var codeMatch=String(raw).match(/提取码[：:\s]*([a-zA-Z0-9]{4})/i)
  if(!urlMatch){ toast('网盘链接格式异常'); return }
  var url=urlMatch[0]
  var code=codeMatch?codeMatch[1]:''
  var msg='网盘链接已打开新标签页'
  if(code) msg+='，提取码：'+code+'（已复制）'
  try{ navigator.clipboard&&navigator.clipboard.writeText(code) }catch(e){}
  toast(msg, 4000)
  window.open(url, '_blank', 'noopener')
}
async function toggleFav(id, btn){
  const _u = await ensureLogin()
  if(!_u){ goLogin('登录状态已失效，请重新登录'); return }
  const d = await api('/api/materials/favorite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({material_id:id})})
  if(d.ok){
    const span=btn.querySelector('span')
    span.textContent = d.favorited?t('t.fav'):t('misc.fav')
    btn.classList.toggle('liked',d.favorited)
    toast(d.favorited?t('t.fav'):t('t.unfav'))
  } else toast(d.message||t('t.fail'))
}
async function toggleLike(id, btn){
  const _u = await ensureLogin()
  if(!_u){ goLogin('登录状态已失效，请重新登录'); return }
  const d = await api('/api/materials/like',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({material_id:id})})
  if(d.ok){
    const span=btn.querySelector('span')
    span.textContent = Math.max(0,(parseInt(span.textContent)||0) + (d.liked?1:-1))
    btn.classList.toggle('liked',d.liked)
    toast(d.liked?t('t.liked'):t('t.unliked'))
  } else toast(d.message||t('t.fail'))
}

/* ── 素材详情 + 下载 ── */
async function openDetail(id){
  // C2: 卡片点击跳转独立素材详情页（og 分享 + 相关推荐 + 沉浸预览）
  if(id) location.href = '/material.html?id=' + Number(id)
  return
}
async function changeMaterialStatus(id, action){
  const d = await api('/api/materials/'+id+'/status', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})})
  if(d.ok){ toast(d.message); closeModal('detailModal'); loadMaterials() }
  else toast(d.message || t('t.fail'))
}
async function adminReview(id, action){
  const reason = action==='reject' ? (prompt(t('detail.rejectPh')) || '') : ''
  const d = await api('/api/materials/review', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({material_id:id, action, reason})})
  if(d.ok){ toast(d.message); closeModal('detailModal'); loadMaterials() }
  else toast(d.message || t('t.fail'))
}
async function startDownload(id){
  closeModal('detailModal')
  const _u2 = await ensureLogin()
  if(!_u2){ goLogin('登录状态已失效，请重新登录'); return }
  pendingDownloadId = id
  $('disclaimerCheck').checked=false
  $('downloadConfirmBtn').disabled=true
  openModal('disclaimerModal')
}
function confirmDownload(){
  closeModal('disclaimerModal')
  const id=pendingDownloadId; pendingDownloadId=null
  if(!id) return
  // 触发下载(服务端自动 +1 下载数)
  const a=document.createElement('a')
  a.href='/api/materials/'+id+'/file'
  a.download=''
  document.body.appendChild(a); a.click(); a.remove()
  toast(t('t.dlStart'))
  setTimeout(loadMaterials,600)
}

/* ── 活动 ── */
async function loadActivities(){
  const hb = window.__hbData
  const d = (hb && hb.activities) ? { ok:true, data:hb.activities } : await api('/api/activities')
  const full = $('activitiesGridFull')
  if(!d.ok){ if(full) full.innerHTML = errorHTML(); return }
  const list = d.data||[]
  const card = a=>{
    var bannerStyle = a.poster ? 'background-image:url(/api/posters/'+esc(a.poster)+');background-size:cover;background-position:center' : 'background:'+a.color
    var bannerContent = a.poster ? '' : '<span style="font-size:13px;font-weight:700;letter-spacing:1px">'+esc(a.title.charAt(0))+'</span>'
    return '<div class="activity-card" role="button" tabindex="0" onclick="if(!event.target.closest(\'[data-join]\'))openActivityDetail('+a.id+')">'+
    '<div class="activity-banner" style="'+bannerStyle+'">'+bannerContent+'<span class="activity-status '+a.status+'">'+statusLabel(a.status)+'</span></div>'+
    '<div class="activity-body">'+
      '<div class="activity-date">'+esc(a.date)+'</div>'+
      '<div class="activity-title">'+esc(activityTitle(a.title))+'</div>'+
      '<div class="activity-desc">'+esc(activityDesc(a.description))+'</div>'+
      '<button class="btn btn-sm '+(a.status==='ended'?'btn-ghost':(a.status==='ongoing'?'btn-primary':'btn-outline'))+'" data-join="'+a.id+'" '+(a.status==='ended'?'disabled':'')+'>'+
        (a.status==='ongoing'?t('act.register'):(a.status==='upcoming'?t('act.preregister'):t('act.ended')))+
      '</button>'+
    '</div></div>'
  }
  if(full) full.innerHTML = list.length ? list.map(card).join('') : emptyHTML(null,t('act.empty'))
}
function statusLabel(s){ return {ongoing:t('act.ongoing'),upcoming:t('act.upcoming'),ended:t('act.ended')}[s]||s }
async function joinActivity(aid, btn){
  const _u = await ensureLogin()
  if(!_u){ goLogin('登录状态已失效，请重新登录'); return }
  const d = await api('/api/activities/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activity_id:aid})})
  if(d.ok){
    toast(d.already?t('t.registered'):t('t.regOk'))
    if(btn){ btn.disabled=true; btn.textContent=t('act.registered') }
  } else toast(d.message||t('t.regFail'))
}

/* ── 上传(支持多文件 + 拖拽) ── */

/* ═══ 大文件上传（2026-10-23）：OSS 分片直传优先，失败回退本地流式 ═══ */
function getCsrfToken(){
  try {
    // 必须取【最后一个】csrf，与服务端 parseCookies 一致（同名 cookie 可能有多份）
    var all = String(document.cookie || '').split(';')
    var val = ''
    for (var i = 0; i < all.length; i++) { var kv = all[i].trim(); if (kv.indexOf('csrf=') === 0) val = kv.slice(5) }
    return val ? decodeURIComponent(val) : ''
  } catch (e) { return '' }
}

function uploadBigFile(file, meta){
  return uploadViaOss(file, meta).then(function(r){
    if (r && r.ok) return r
    console.warn('[上传] OSS 直传未成功（' + ((r && r.message) || '未知') + '），回退本地上传')
    return uploadViaLocalBig(file, meta)
  }).catch(function(e){
    console.warn('[上传] OSS 异常，回退本地上传', e)
    return uploadViaLocalBig(file, meta)
  })
}

function bigUploadOverlay(name, totalParts, doneParts){
  try { var old = document.getElementById('bigUpMask'); if (old) old.remove() } catch (e) {}
  var el = document.createElement('div')
  el.id = 'bigUpMask'
  el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(8,10,16,.82);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)'
  el.innerHTML = '<div style="min-width:340px;max-width:90vw;background:#151a24;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px 26px;color:#e7ebf3">'
    + '<div style="font-size:14px;font-weight:800;margin-bottom:6px">正在上传大文件</div>'
    + '<div style="font-size:12.5px;color:#8a93a5;margin-bottom:14px;word-break:break-all">' + name + '</div>'
    + '<div style="height:8px;border-radius:6px;background:rgba(128,128,128,.18);overflow:hidden">'
    + '<div id="bigUpBar" style="height:100%;width:0%;background:linear-gradient(90deg,#D4AF37,#E5C558);transition:width .2s"></div></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:12px;color:#8a93a5;margin-top:8px">'
    + '<span id="bigUpPct">0%</span><span id="bigUpSize">0 MB</span></div>'
    + '<div id="bigUpSpeed" style="font-size:11.5px;color:#8a93a5;margin-top:5px;min-height:16px"></div>'
    + (totalParts ? '<div id="bigUpPart" style="font-size:11.5px;color:#8a93a5;margin-top:6px">分片 ' + (doneParts || 0) + ' / ' + totalParts + '</div>' : '')
    + '<div style="font-size:11.5px;color:#8a93a5;margin-top:12px;line-height:1.6">上传期间请勿关闭页面或切换网络</div>'
    + '</div>'
  document.body.appendChild(el)
  return el
}

async function uploadViaOss(file, meta){
  var csrf = getCsrfToken()
  var initRes = await fetch('/api/oss/multipart/init', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ size: file.size, name: file.name, mime: file.type || '' })
  })
  if (initRes.status === 503) return { ok: false, message: 'OSS 未配置' }
  var j1 = await initRes.json().catch(function(){ return null })
  if (!j1 || !j1.ok) return { ok: false, message: (j1 && j1.message) || ('初始化失败 HTTP ' + initRes.status) }

  var key = j1.data.key, uploadId = j1.data.uploadId, partSize = j1.data.partSize, total = j1.data.totalParts
  var done = {}
  try {
    var rp = await fetch('/api/oss/multipart/parts?key=' + encodeURIComponent(key) + '&uploadId=' + encodeURIComponent(uploadId), { credentials: 'same-origin' })
    var rj = await rp.json()
    if (rj && rj.ok && rj.data && rj.data.parts) rj.data.parts.forEach(function(p){ done[p.n] = p.etag })
  } catch (e) {}

  var mask = bigUploadOverlay(file.name, total, Object.keys(done).length)
  var bar = document.getElementById('bigUpBar')
  var pctEl = document.getElementById('bigUpPct')
  var szEl = document.getElementById('bigUpSize')
  var partEl = document.getElementById('bigUpPart')
  var uploadedBytes = 0
  Object.keys(done).forEach(function(n){ uploadedBytes += Math.min(partSize, file.size - (Number(n) - 1) * partSize) })

  // 速度与剩余时间（2026-10-25：滑动样本，避免瞬时抖动）
  var _spStart = Date.now(), _spBytes0 = uploadedBytes, _spText = ''
  function paint(){
    var p = Math.min(100, Math.round(uploadedBytes / file.size * 100))
    if (bar) bar.style.width = p + '%'
    if (pctEl) pctEl.textContent = p + '%'
    if (szEl) szEl.textContent = fmtFileSize(uploadedBytes) + ' / ' + fmtFileSize(file.size)
    if (partEl) partEl.textContent = '分片 ' + Object.keys(done).length + ' / ' + total

    // 速度 + 剩余时间（超过 1.5s 才开始估算，样本不足时不显示假数据）
    var el = (Date.now() - _spStart) / 1000
    if (el > 1.5 && uploadedBytes > _spBytes0) {
      var bps = (uploadedBytes - _spBytes0) / el
      if (bps > 1024) {
        _spText = fmtFileSize(Math.round(bps)) + '/s'
        var remain = Math.max(0, (file.size - uploadedBytes) / bps)
        _spText += ' · 剩余 ' + (remain >= 60 ? Math.round(remain / 60) + ' 分' : Math.max(1, Math.round(remain)) + ' 秒')
      }
    }
    var spEl = document.getElementById('bigUpSpeed')
    if (spEl) spEl.textContent = _spText || (p > 0 && p < 100 ? '正在估算速度…' : '')
  }
  paint()

  var queue = []
  for (var n = 1; n <= total; n++) if (!done[n]) queue.push(n)

  async function uploadPart(pn){
    var start = (pn - 1) * partSize
    var end = Math.min(start + partSize, file.size)
    var blob = file.slice(start, end)
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        var su = await fetch('/api/oss/multipart/part-url?key=' + encodeURIComponent(key) + '&uploadId=' + encodeURIComponent(uploadId) + '&partNumber=' + pn, { credentials: 'same-origin' })
        var sj = await su.json()
        if (!sj || !sj.ok) continue
        var res = await fetch(sj.data.url, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: blob })
        if (res.ok) {
          done[pn] = res.headers.get('ETag') || res.headers.get('etag') || ''
          uploadedBytes += blob.size
          paint()
          return true
        }
      } catch (e) {}
    }
    return false
  }

  var CONC = 3, cursor = 0, failed = false
  async function worker(){
    while (cursor < queue.length && !failed) {
      var pn = queue[cursor++]
      var ok = await uploadPart(pn)
      if (!ok) failed = true
    }
  }
  await Promise.all([worker(), worker(), worker()])

  if (failed) { try { mask.remove() } catch (e) {} return { ok: false, message: '部分分片上传失败，请重试（已传分片会保留，可续传）' } }

  var parts = Object.keys(done).map(function(n){ return { n: Number(n), etag: done[n] } })
  var cb = await fetch('/api/oss/multipart/complete', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify(Object.assign({}, meta, { key: key, uploadId: uploadId, parts: parts, size: file.size, name: file.name, mime: file.type || '' }))
  })
  var cj = await cb.json().catch(function(){ return null })
  try { mask.remove() } catch (e) {}
  if (cb.ok && cj && cj.ok) return cj
  return { ok: false, message: (cj && cj.message) || ('合并失败 HTTP ' + cb.status) }
}

function uploadViaLocalBig(file, meta){
  return new Promise(function(resolve){
    var mask = bigUploadOverlay((meta.__batchLabel || '') + (file.name || '未命名文件'), 0, 0)
    var bar = document.getElementById('bigUpBar')
    var pctEl = document.getElementById('bigUpPct')
    var szEl = document.getElementById('bigUpSize')
    var qs = new URLSearchParams({
      title: meta.title || '', type: meta.type || '其他', college: meta.college || '',
      description: meta.description || '', shot_date: meta.shot_date || '',
      tags: meta.tags || '', status: meta.status || 'pending_review', name: file.name || ''
    })
    var xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/materials/upload-big?' + qs.toString(), true)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    var _ct = getCsrfToken()
    if (_ct) xhr.setRequestHeader('X-CSRF-Token', _ct)
    xhr.upload.onprogress = function(e){
      if (!e.lengthComputable) return
      var p = Math.round(e.loaded / e.total * 100)
      if (bar) bar.style.width = p + '%'
      if (pctEl) pctEl.textContent = p + '%'
      if (szEl) szEl.textContent = fmtFileSize(e.loaded) + ' / ' + fmtFileSize(e.total)
    }
    xhr.onload = function(){
      try { mask.remove() } catch (e) {}
      var d = null; try { d = JSON.parse(xhr.responseText) } catch (e) {}
      if (!d) { resolve({ ok: false, message: '上传失败（HTTP ' + xhr.status + '）' }); return }
      resolve(d)
    }
    xhr.onerror = function(){ try { mask.remove() } catch (e) {} resolve({ ok: false, message: '网络中断，上传失败' }) }
    xhr.send(file)
  })
}

// pendingFile 已在新版文件上传模块中定义
// ── 文件上传：缩略图生成 + 元数据读取 ──
let pendingFiles=[], pendingFile = null      // 当前选择的单个文件
let pendingThumbBlob = null // 生成的缩略图 Blob
let pendingMeta = { width: 0, height: 0, duration: 0 } // 文件元数据

function handleFilesSelect(files){
  if(files && files.length > 1){
    // 多文件：全部接收，超限的跳过
    var _r = (currentUser && currentUser.is_admin) ? 'admin' : ((currentUser && currentUser.role) || 'student');
    var _mx = { admin: 20480, editor: 10240, reviewer: 10240, reporter: 5120, student: 1024 }[_r] || 1024;
    var _list = Array.prototype.slice.call(files);
    var _ok = [], _skip = 0;
    _list.forEach(function(x){ if(x.size <= _mx*1024*1024) _ok.push(x); else _skip++; });
    if(!_ok.length){ var _l = _mx >= 1024 ? (_mx/1024)+'GB' : _mx+'MB'; toast('文件超过上限（最大 ' + _l + '）'); return; }
    if(_skip) toast(_skip + ' 个文件超过上限，已跳过');
    pendingFiles = _ok;
    pendingFile = _ok[0];
    var _pv = $('uploadPreview'); if(_pv) _pv.style.display = 'block';
    var _nm = $('uploadPreviewName'); if(_nm) _nm.textContent = _ok.length + ' 个文件已选择';
    var _mt = $('uploadPreviewMeta'); if(_mt) _mt.textContent = _ok.slice(0,3).map(function(x){return x.name}).join('、') + (_ok.length > 3 ? ' 等' : '') + ' · 共 ' + fmtFileSize(_ok.reduce(function(a,x){return a+x.size},0));
    var _tw = $('uploadThumbWrap'); if(_tw) _tw.innerHTML = '<span style="font-size:13px;font-weight:800">×' + _ok.length + '</span>';
    return;
  }
  pendingFiles = files ? Array.prototype.slice.call(files) : [];
  var _orig = document.createElement('div'); _orig.innerHTML = '';
  // 单文件走原有逻辑（下面原样执行）

  if(!files || !files.length){ clearUploadFile(); return }
  var f = files[0]
  // 按角色上限校验（2026-10-23：admin 20GB / editor·reviewer 10GB / reporter 5GB / student 1GB）
  var _role = (currentUser && currentUser.is_admin) ? 'admin' : ((currentUser && currentUser.role) || 'student')
  var _maxMB = { admin: 20480, editor: 10240, reviewer: 10240, reporter: 5120, student: 1024 }[_role] || 1024
  if(f.size > _maxMB*1024*1024){
    var _lbl = _maxMB >= 1024 ? (_maxMB/1024) + 'GB' : _maxMB + 'MB'
    toast(curLang === 'en' ? ('File too large (max ' + _lbl + ')') : ('文件超过上限（最大 ' + _lbl + '）'))
    return
  }
  pendingFile = f  // 只取第一个文件
  generatePreview(pendingFile)
}

async function generatePreview(file){
  const preview = $('uploadPreview')
  const thumbWrap = $('uploadThumbWrap')
  const nameEl = $('uploadPreviewName')
  const metaEl = $('uploadPreviewMeta')
  preview.style.display = 'block'
  nameEl.textContent = file.name
  pendingMeta = { width: 0, height: 0, duration: 0 }
  pendingThumbBlob = null

  // 释放上一次的缩略图 blob URL
  if(thumbWrap._lastBlobUrl){ URL.revokeObjectURL(thumbWrap._lastBlobUrl); thumbWrap._lastBlobUrl = null }

  // 重置缩略图
  thumbWrap.innerHTML = `<span style="font-size:28px">${typeIcons[$('uploadType').value]||'FILE'}</span>`

  // 图片：生成缩略图 + 读取尺寸
  if(file.type.startsWith('image/')){
    try {
      const img = await loadImage(file)
      pendingMeta.width = img.naturalWidth
      pendingMeta.height = img.naturalHeight
      // 生成缩略图 (300px max)
      const canvas = document.createElement('canvas')
      const maxDim = 300
      const ratio = Math.min(maxDim/img.naturalWidth, maxDim/img.naturalHeight, 1)
      canvas.width = img.naturalWidth * ratio
      canvas.height = img.naturalHeight * ratio
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => { pendingThumbBlob = blob; const burl = URL.createObjectURL(blob); thumbWrap._lastBlobUrl = burl; thumbWrap.innerHTML = `<img src="${burl}" alt="缩略图预览" style="width:80px;height:80px;object-fit:cover">` }, 'image/jpeg', 0.82)
      metaEl.textContent = `${fmtFileSize(file.size)} · ${fmtDim(pendingMeta.width, pendingMeta.height)}`
    } catch(e){ metaEl.textContent = fmtFileSize(file.size) }
  }
  // 视频：读取宽高和时长
  else if(file.type.startsWith('video/')){
    try {
      const { width, height, duration } = await readVideoMeta(file)
      pendingMeta.width = width; pendingMeta.height = height; pendingMeta.duration = Math.round(duration)
      thumbWrap.innerHTML = `<span style="font-size:28px"></span>`
      metaEl.textContent = `${fmtFileSize(file.size)} · ${fmtDim(width,height)} · ${fmtDuration(pendingMeta.duration)}`
    } catch(e){ metaEl.textContent = `${fmtFileSize(file.size)} · ${t('lib.video')}` }
  }
  // 音频：读取时长
  else if(file.type.startsWith('audio/')){
    try {
      const duration = await readAudioDuration(file)
      pendingMeta.duration = Math.round(duration)
      metaEl.textContent = `${fmtFileSize(file.size)} · ${fmtDuration(pendingMeta.duration)}`
    } catch(e){ metaEl.textContent = fmtFileSize(file.size) }
  }
  // 其他文件
  else {
    metaEl.textContent = fmtFileSize(file.size)
  }

  $('uploadFileName').textContent = file.name
}

function clearUploadFile(){
  pendingFiles = [];
  pendingFiles = []; pendingFile = null; pendingThumbBlob = null; pendingMeta = { width:0, height:0, duration:0 }
  $('uploadPreview').style.display = 'none'
  $('uploadFileName').textContent = t('upload.drop')
  $('uploadFile').value = ''
}

function loadImage(file){
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject() }
    img.src = url
  })
}

function readVideoMeta(file){
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration })
      URL.revokeObjectURL(video.src)
    }
    video.onerror = reject
    video.src = URL.createObjectURL(file)
  })
}

function readAudioDuration(file){
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => { resolve(audio.duration); URL.revokeObjectURL(audio.src) }
    audio.onerror = reject
    audio.src = URL.createObjectURL(file)
  })
}

// 拖拽支持
const uploadArea = document.getElementById('uploadArea')
if(uploadArea){
  var _onDragOver=function(e){ e.preventDefault(); uploadArea.style.borderColor='var(--primary)' }
  var _onDragLeave=function(){ uploadArea.style.borderColor='' }
  var _onDrop=function(e){ e.preventDefault(); uploadArea.style.borderColor=''; if(e.dataTransfer.files.length) handleFilesSelect(e.dataTransfer.files) }
  uploadArea.addEventListener('dragover',_onDragOver)
  uploadArea.addEventListener('dragleave',_onDragLeave)
  uploadArea.addEventListener('drop',_onDrop)
  uploadArea._dragHandlers={over:_onDragOver,leave:_onDragLeave,drop:_onDrop}
}

/* ── 素材类型子选项 ── */
const UPLOAD_SUB_OPTIONS = {
  '图片': {
    label: { zh:'照片格式', en:'Image Format' },
    items: ['DNG','RAW','JPG','PNG','TIFF','PSD','HEIC','WEBP'],
    keys: null
  },
  '视频': {
    label: { zh:'拍摄场景', en:'Scene Type' },
    items: ['空镜','航拍','地拍','延时摄影','慢动作','转场','采访','活动记录','Vlog','宣传片'],
    keys: ['sub.air','sub.aerial','sub.ground','sub.timelapse','sub.slowmo','sub.transition','sub.interview','sub.event','sub.vlog','sub.promo']
  },
  '文档': {
    label: { zh:'文档类型', en:'Document Type' },
    items: ['课件PPT','论文','笔记','模板','报告','教案','策划案','脚本'],
    keys: ['sub.ppt','sub.paper','sub.notes','sub.template','sub.report','sub.lesson','sub.plan','sub.script']
  },
  '音频': {
    label: { zh:'音频类型', en:'Audio Type' },
    items: ['配乐','音效','旁白配音','现场录音','片头音乐','背景音乐'],
    keys: ['sub.bgm','sub.sfx','sub.voiceover','sub.live','sub.intro','sub.background']
  },
  '其他': {
    label: { zh:'自定义标签', en:'Custom Tag' },
    items: null,  // 自由输入
    keys: null
  }
}
function updateUploadSubOptions(type){
  const box = $('uploadSubOptions')
  if(!box) return
  const cfg = UPLOAD_SUB_OPTIONS[type]
  if(!cfg){
    // 收起动画
    box.classList.remove('open')
    setTimeout(()=>{ if(!box.classList.contains('open')) box.innerHTML='' }, 350)
    return
  }
  const labelMap = { '图片':'upload.subFormat', '视频':'upload.subScene', '文档':'upload.subDoc', '音频':'upload.subAudio', '其他':'upload.subOther' }
  const labelText = t(labelMap[type] || 'upload.subOther')
  const labelStyle = 'display:block;font-size:13px;color:var(--text-2);margin-bottom:6px'
  if(cfg.items){
    let html = '<label style="'+labelStyle+'">'+labelText+'</label>'
    html += '<select id="uploadSubSelect" class="cs-custom" aria-label="子类型">'
    html += '<option value="">'+t('upload.subSelect')+'</option>'
    cfg.items.forEach(function(it,i){ const disp = (cfg.keys && cfg.keys[i]) ? t(cfg.keys[i]) : it; html += '<option value="'+it+'">'+disp+'</option>' })
    html += '</select>'
    box.innerHTML = html
    initCustomSelect($('uploadSubSelect'))
  } else {
    let html = '<label style="'+labelStyle+'">'+labelText+'</label>'
    html += '<input id="uploadSubSelect" type="text" placeholder="'+t('upload.subOtherPh')+'" style="width:100%;padding:10px 14px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;outline:none">'
    box.innerHTML = html
  }
  // 下一帧触发展开动画
  requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ box.classList.add('open') }) })
}

async function doUpload(isDraft){
  if(pendingFiles && pendingFiles.length > 1){ return await doBatchUpload(isDraft) }
  const title=$('uploadTitle').value.trim(), college=$('uploadCollege').value, type=$('uploadType').value
  const desc=$('uploadDesc').value.trim(), date=$('uploadDate').value.trim(), tags=$('uploadTags').value.trim()
  if(!title){ toast(t('t.needTitle')); return }
  if(!college){ toast(t('t.needCollege')); return }
  if(!type){ toast(t('t.needType')); return }

  const btn = isDraft ? $('saveDraftBtn') : $('uploadBtn')
  const otherBtn = isDraft ? $('uploadBtn') : $('saveDraftBtn')
  btn.disabled=true; otherBtn.disabled=true
  const lbl = btn.querySelector('.specular-button__label')
  const origText = lbl.textContent
  lbl.textContent = isDraft ? t('t.saving') : t('t.submitting')

  const fd = new FormData()
  fd.append('title', title)
  fd.append('college', college)
  fd.append('type', type)
  fd.append('description', desc)
  fd.append('shot_date', date)
  fd.append('tags', tags)
  // 子选项作为独立字段 sub_type 发送,不与标签混淆
  const subSel = $('uploadSubSelect')
  if(subSel && subSel.value){ fd.append('sub_type', subSel.value) }
  var driveUrl=$('uploadDrive').value.trim();if(driveUrl)fd.append('drive_url',driveUrl)
  fd.append('status', isDraft ? 'draft' : 'pending_review')
  // 元数据
  fd.append('width', pendingMeta.width)
  fd.append('height', pendingMeta.height)
  fd.append('duration', pendingMeta.duration)
  // 文件
  if(pendingFile) fd.append('file', pendingFile)
  // 缩略图
  if(pendingThumbBlob) fd.append('thumb', pendingThumbBlob, 'thumb.jpg')

  // ═══ 大文件（>100MB）走 OSS 分片直传：浏览器直连 OSS，服务器不经手文件 ═══
  if (pendingFile && pendingFile.size > 100 * 1024 * 1024) {
    const big = await uploadBigFile(pendingFile, {
      title: title, type: type, college: college, description: desc,
      shot_date: date, tags: tags, status: (isDraft ? 'draft' : 'pending_review')
    })
    btn.disabled = false; otherBtn.disabled = false
    lbl.textContent = origText
    if (big && big.ok) {
      toast(big.message || (isDraft ? t('t.draftOk') : t('t.submitOk')))
      closeModal('uploadModal')
      $('uploadTitle').value=''; $('uploadDesc').value=''; $('uploadDate').value=''; $('uploadTags').value=''; $('uploadDrive').value=''
      clearUploadFile()
      await loadMaterials()
    } else {
      toast((big && big.message) || t('t.retry'))
    }
    return
  }

  const d = await api('/api/materials', { method:'POST', body: fd })

  btn.disabled=false; otherBtn.disabled=false
  lbl.textContent = origText

  if(d.ok){
    toast(isDraft ? t('t.draftOk') : t('t.submitOk'))
    closeModal('uploadModal')
    $('uploadTitle').value=''; $('uploadDesc').value=''; $('uploadDate').value=''; $('uploadTags').value=''; $('uploadDrive').value=''
    clearUploadFile()
    await loadMaterials()
  } else toast(d.message || t('t.retry'))
}

/* ── 加入我们 ── */
async function doJoin(){
  const name=$('joinName').value.trim(), sid=$('joinId').value.trim(), grade=$('joinGrade').value
  const college=$('joinCollege').value, email=$('joinEmail').value.trim(), resume=$('joinResume').files[0]
  if(!name){ toast(t('t.needName')); return }
  if(!sid){ toast(t('t.needSid')); return }
  if(!email){ toast(t('t.needEmail')); return }
  const fd=new FormData()
  fd.append('name',name); fd.append('sid',sid); fd.append('grade',grade); fd.append('college',college); fd.append('email',email)
  if(resume) fd.append('resume',resume)
  const d = await api('/api/recruit',{method:'POST',body:fd})
  if(!d.ok){ toast(d.message||t('t.submitFail')); return }
  toast(t('t.applyOk'))
  closeModal('joinModal')
  $('joinName').value=''; $('joinId').value=''; $('joinEmail').value=''; $('joinResume').value=''; $('joinResumeName').textContent=t('join.uploadResume')
}

/* ═════════════════ 个人中心 ═════════════ */
function switchStudentTab(tab,btn){
  document.querySelectorAll('.student-tab').forEach(t=>t.classList.remove('active'))
  btn.classList.add('active')
  document.querySelectorAll('.student-panel').forEach(p=>p.classList.remove('active'))
  $('panel-'+tab).classList.add('active')
}
async function renderStudentPage(){
  if(!currentUser) return
  const name=(currentUser.name||'?')
  $('studentAvatar').textContent=name.charAt(0).toUpperCase()
  // 头像
  const avatarImg=currentUser.avatar?`/api/avatars/${encodeURIComponent(currentUser.avatar)}`:null
  const av=$('studentAvatar')
  av.style.backgroundImage=avatarImg?`url("${avatarImg}")`:''
  av.style.backgroundSize='cover'
  av.style.color=avatarImg?'transparent':''
  $('studentName').textContent=currentUser.name
  $('studentIdDisplay').textContent=t('misc.sid')+' '+currentUser.id
  $('studentBio').textContent=currentUser.bio||''
  const [mats,acts,favs,stats] = await Promise.all([
    api('/api/me/materials'), api('/api/me/activities'),
    api('/api/me/favorites'), api('/api/me/stats')
  ])
  const allMats = mats.data||[]
  const draftMats = allMats.filter(m=>m.status==='draft' || m.status==='rejected')
  const publishedMats = allMats.filter(m=>m.status!=='draft' && m.status!=='rejected')
  const myActs=acts.data||[], myFavs=favs.data||[], st=stats.data||{}
  // 统计
  countUp($('statUploaded'), st.uploaded||0)
  countUp($('statApproved'), st.approved||0)
  countUp($('statPending'), st.pending||0)
  countUp($('statLikes'), st.totalLikes||0)
  // 我的素材(非草稿)
  const mg=$('myMaterialsGrid')
  mg.innerHTML = publishedMats.length ? publishedMats.map(materialCard).join('') : emptyHTML(null,t('empty.myMat'))
  bindCards(mg); countUpAll(mg)
  // 草稿箱
  const dg=$('myDraftsGrid')
  dg.innerHTML = draftMats.length ? draftMats.map(materialCard).join('') : emptyHTML(null,t('empty.drafts'))
  bindCards(dg); countUpAll(dg)
  // 我的收藏
  const fg=$('myFavoritesGrid')
  fg.innerHTML = myFavs.length ? myFavs.map(materialCard).join('') : emptyHTML(null,t('empty.favs'))
  bindCards(fg); countUpAll(fg)
  // 参与活动
  const al=$('myActivitiesList')
  al.innerHTML = myActs.length ? myActs.map(a=>`<div class="student-activity-item">
    <div class="student-activity-icon" style="background:${a.color};font-size:16px;font-weight:700">${esc(a.title.charAt(0))}</div>
    <div class="student-activity-info"><div class="student-activity-title">${esc(activityTitle(a.title))}</div><div class="student-activity-date">${esc(a.date)}</div></div>
    <span class="status-tag ${a.status}">${statusLabel(a.status)}</span>
  </div>`).join('') : emptyHTML(null,t('empty.joined'))
}

/* ── 编辑资料 ── */
function openProfileModal(){
  if(!currentUser) return
  $('pName').value=currentUser.name||''
  $('pBio').value=currentUser.bio||''
  const gradeSel=$('pGrade')
  for(const opt of gradeSel.options){ if(opt.value===currentUser.grade) opt.selected=true }
  const collegeSel=$('pCollege')
  collegeSel.innerHTML=colleges.map(c=>`<option value="${esc(c.name)}"${c.name===currentUser.college?' selected':''}>${esc(c.name)}</option>`).join('')
  const preview=$('profileAvatarPreview')
  if(currentUser.avatar){ preview.src=`/api/avatars/${encodeURIComponent(currentUser.avatar)}` }
  else { preview.src=''; preview.style.background='#eee' }
  openModal('profileModal')
}
async function saveProfile(){
  const name=$('pName').value.trim(), college=$('pCollege').value, grade=$('pGrade').value, bio=$('pBio').value.trim()
  if(!name){ toast(t('t.nameEmpty')); return }
  const d=await api('/api/me/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,college,grade,bio})})
  if(d.ok){ currentUser=d.user; toast(t('t.profileOk')); closeModal('profileModal'); renderStudentPage() }
  else toast(d.message||t('t.profileFail'))
}
async function changePassword(){
  var cur=$('curPwd').value,nw=$('newPwd').value,cfm=$('confirmPwd').value
  if(!cur||!nw){toast(t('profile.curPwdPh'));return}
  if(nw!==cfm){toast(t('profile.pwdMismatch'));return}
  var d=await api('/api/me/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:cur,newPassword:nw})})
  if(d.ok){toast(t('profile.pwdChanged'));$('curPwd').value='';$('newPwd').value='';$('confirmPwd').value=''}
  else toast(d.message||t('profile.pwdChangeFail'))
}
async function uploadAvatar(input){
  const file=input.files[0]
  if(!file) return
  if(!/^image\//.test(file.type)){ toast(t('t.imgOnly')); return }
  if(file.size>5*1024*1024){toast(curLang==='en'?'Avatar too large (max 5MB)':'头像文件过大（限制5MB）');return}
  const fd=new FormData(); fd.append('file',file)
  const d=await api('/api/me/avatar',{method:'POST',body:fd})
  if(d.ok){ currentUser=d.user; toast(t('t.avatarOk')); openProfileModal(); renderStudentPage() }
  else toast(d.message||t('t.avatarFail'))
}

/* ═════════════════ 消息 ═════════════ */
async function loadMessages(){
  if(!currentUser){ $('msgList').innerHTML=emptyHTML(null,t('msg.login')); return }
  const d = await api('/api/me/notifications')
  if(!d.ok){ $('msgList').innerHTML=errorHTML(); return }
  const list=d.data||[]
  $('msgList').innerHTML = list.length ? list.map(n=>`<div class="msg-item${n.read?'':' unread'}" data-nid="${n.id}">
    <div class="msg-avatar" style="background:${colorOf(n.actor)}">${esc((n.actor||'?').charAt(0))}</div>
    <div class="msg-body">
      <div class="msg-title">${esc(n.actor)} ${n.action==='like'?t('misc.liked'):t('misc.dled')} ${t('misc.yourMat')}</div>
      <div class="msg-desc">《${esc(n.material_title)}》</div>
    </div>
    <div class="msg-time">${esc(n.created_at)}</div>
  </div>`).join('') : emptyHTML(null,t('msg.empty'))
  loadMsgBadge()
}
async function markRead(id){
  await api('/api/notifications/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})})
  loadMessages()
}
async function loadMsgBadge(){
  if(!currentUser) return
  const d = await api('/api/me/notifications')
  const unread=(d.unread||0)
  const b=$('navMsgBadge')
  if(unread>0){ b.textContent='0'; b.style.display='inline-block'; if(unread<=99) countUp(b,unread,800) }
  else b.style.display='none'
}

/* ═════════════════ 后台管理 ═════════════ */
function goAdmin(){
  if(currentUser&&currentUser.is_admin) window.location.href='/admin.html'
  else { toast(t('t.needAdmin')); if(!currentUser) location.href='/login.html' }
}

const _origInit = init
init = async function(){
  initPillNav()


  // 等待 init() 完成（含 colleges 数据加载）再初始化漂移墙
  await _origInit.apply(this, arguments)
  // 语言初始化放在数据加载之后，避免空数据重渲染
  setLang(curLang)
}

/* ═════════════════ Pill Nav (高光药丸导航) ═════════════
   原生 JS 版, 复刻 React Bits PillNav: 黑色药丸条 + 白色药丸项 +
   悬停圆形扩散 + 标签上下切换, CSS transition 替代 GSAP */
function initPillNav(){
  const pills = document.querySelectorAll('.header-nav a')
  if(!pills.length) return

  function layoutPill(pill){
    const circle = pill.querySelector('.hover-circle')
    if(!circle) return
    const rect = pill.getBoundingClientRect()
    if(rect.width < 2) return  // hidden pill
    const w = rect.width, h = rect.height
    const R = ((w*w)/4 + h*h) / (2*h)
    const D = Math.ceil(2*R) + 2
    const delta = Math.ceil(R - Math.sqrt(Math.max(0, R*R - w*w/4))) + 1
    const originY = D - delta
    circle.style.width = D + 'px'
    circle.style.height = D + 'px'
    circle.style.bottom = '-' + delta + 'px'
    circle.style.setProperty('--circle-oy', originY + 'px')
  }

  function layoutAll(){ pills.forEach(layoutPill) }
  layoutAll()

  // Re-layout on resize and after fonts load
  let resizeTimer = null
  window.addEventListener('resize', () => {
    if(resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(layoutAll, 100)
  })
  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(layoutAll).catch(() => {})
  }

  // Re-layout when user-only/admin-only links become visible
  const ro = new ResizeObserver(() => layoutAll())
  pills.forEach(pill => {
    if(pill.classList.contains('user-only') || pill.classList.contains('admin-only')){
      ro.observe(pill)
    }
  })
}

/* ═════════════════ 事件委托（onclick模板拼接替代） ═════════════ */
// 学院卡片
['collegesGridFull'].forEach(function(gid){
  var el=$(gid)
  if(!el) return
  el.addEventListener('click', function(e){
    var card=e.target.closest('[data-cid]')
    if(card) showCollegeDetail(card.dataset.cid)
  })
});
// 素材卡片标签 + 素材库容器（closest 到 card-tag / material-card）
(function(){
  var containers=['libraryGrid','collegeMaterialsGrid','myMaterialsGrid','myDraftsGrid','myFavoritesGrid']
  containers.forEach(function(gid){
    var el=$(gid)
    if(!el) return
    el.addEventListener('click', function(e){
      if(e.target.closest('.drive-link')) return
      var tag=e.target.closest('[data-tag]')
      if(tag){ e.stopPropagation(); setTagFilter(tag.dataset.tag); return }
      var card=e.target.closest('.material-card')
      if(card) openDetail(Number(card.dataset.id))
    })
  })
})();
// 消息列表
(function(){
  var el=$('msgList')
  if(!el) return
  el.addEventListener('click', function(e){
    var item=e.target.closest('[data-nid]')
    if(item) markRead(Number(item.dataset.nid))
  })
})();
// 标签云 -> setTagFilter
(function(){
  var el=$('libTagsCloud')
  if(!el) return
  el.addEventListener('click', function(e){
    var chip=e.target.closest('[data-tag]')
    if(chip) setTagFilter(chip.dataset.tag)
  })
})();
// 活动卡片 -> 报名/预报名
['activitiesGridFull'].forEach(function(gid){
  var el=$(gid)
  if(!el) return
  el.addEventListener('click', function(e){
    var btn=e.target.closest('[data-join]')
    if(btn) joinActivity(Number(btn.dataset.join), btn)
  })
});
// 素材详情弹窗按钮
(function(){
  var el=$('detailBody')
  if(!el) return
  el.addEventListener('click', function(e){
    var btn=e.target.closest('[data-action]')
    if(!btn) return
    var id=Number(btn.dataset.id), sub=btn.dataset.sub
    if(btn.dataset.action==='change-status') changeMaterialStatus(id,sub)
    else if(btn.dataset.action==='admin-review') adminReview(id,sub)
    else if(btn.dataset.action==='download') startDownload(id)
  })
})()

/* ═════════════════ 启动 ═════════════ */
init()


;
/* ═══════════ Scroll Narrative + Parallax ═══════════ */
(function(){
  var observer=new IntersectionObserver(function(entries){
    entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}})
  },{threshold:.15,rootMargin:'0px 0px -40px 0px'})
  function observeAll(){
    document.querySelectorAll('.colleges-grid .college-card,.materials-grid .material-card,.activities-grid .activity-card,.section,.hero-stats').forEach(function(el,i){
      el.classList.add('scroll-reveal')
      var d=i%4;if(d>0)el.classList.add('scroll-reveal--d'+(d+1))
      observer.observe(el)
    })
  }
  setTimeout(observeAll,300)
  // hero parallax
  var hero=document.querySelector('.hero')
  if(hero){
    var heroInner=hero.querySelector('.hero-inner')
    if(heroInner){heroInner.classList.add('hero-parallax')
      window.addEventListener('scroll',function(){heroInner.style.transform='translateY('+(window.pageYOffset*.35)+'px)'},{passive:true})
    }
  }
})();

/* ═══ 专题系统（P2：首页精选专题 + 专题列表/详情）═══ */
function _colSvg(color, n) {
  const c = /^#[0-9A-Fa-f]{6}$/.test(color || '') ? color : '#1D3A6B'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#0E1A33"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><circle cx="${300 + (n % 3) * 20}" cy="${70 - (n % 4) * 10}" r="46" fill="none" stroke="rgba(240,208,96,.55)" stroke-width="2.5"/><circle cx="${300 + (n % 3) * 20}" cy="${70 - (n % 4) * 10}" r="58" fill="none" stroke="rgba(240,208,96,.25)" stroke-width="1" stroke-dasharray="4 6"/><rect x="24" y="252" width="352" height="2" fill="rgba(240,208,96,.4)"/></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}
function renderHomeCollections() {
  var el = document.getElementById('collectionsHome'); if (!el) return
  var hb = window.__hbData
  var rows = (hb && hb.collections) || []
  if (!rows.length) {
    var sec = el.closest('.block') || el.closest('section')
    if (sec) sec.style.display = 'none'
    return
  }
  el.innerHTML = rows.map(function (c, i) {
    return `<div class="topic-card reveal d${(i % 6) + 1}" role="button" tabindex="0" onclick="openCollectionDetail(${c.id})" onkeydown="if(event.key==='Enter')openCollectionDetail(${c.id})">
      <img loading="lazy" src="${_colSvg(c.color, c.id)}" alt="${esc(c.title)}">
      <span class="topic-badge${(c.item_count || 0) >= 5 ? ' hot' : ''}">${(c.item_count || 0)} ${t('col.items')}</span>
      <div class="topic-info"><div class="t">${esc(c.title)}</div><span class="c">${t('col.enter')} · ${esc((c.description || '').slice(0, 18)) || t('col.curated')}</span></div>
    </div>`
  }).join('')
}
function loadCollectionsPage() {
  var el = document.getElementById('collectionsGrid'); if (!el) return
  el.innerHTML = '<div class="empty-state"><div class="icon" style="animation:spin 1s linear infinite"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div><p>' + t('g.loading') + '</p></div>'
  api('/api/collections').then(function (r) {
    var rows = (r && r.ok && r.data) || []
    if (!rows.length) { el.innerHTML = emptyStateHTML ? emptyStateHTML({ icon: 'pen', title: t('col.none'), desc: t('col.noneDesc') }) : '<p>' + t('col.none') + '</p>'; return }
    el.innerHTML = rows.map(function (c, i) {
      return `<div class="topic-card reveal d${(i % 6) + 1}" role="button" tabindex="0" onclick="openCollectionDetail(${c.id})" onkeydown="if(event.key==='Enter')openCollectionDetail(${c.id})">
        <img loading="lazy" src="${_colSvg(c.color, c.id)}" alt="${esc(c.title)}">
        <span class="topic-badge${(c.item_count || 0) >= 5 ? ' hot' : ''}">${(c.item_count || 0)} ${t('col.items')}</span>
        <div class="topic-info"><div class="t">${esc(c.title)}</div><span class="c">${esc((c.description || '').slice(0, 24)) || t('col.curated')}</span></div>
      </div>`
    }).join('')
  })
}
function openCollectionDetail(id, skipHash) {
  showPage('collection-detail', true)
  if (!skipHash) history.pushState({page:'collection-detail',type:'page',detailId:id}, '', '#collection-' + id)
  loadCollectionDetail(id)
}
async function loadCollectionDetail(id) {
  var head = document.getElementById('collectionHead')
  var grid = document.getElementById('collectionItemsGrid')
  if (!head || !grid) return
  head.innerHTML = '<div style="text-align:center;opacity:.5;padding:30px">' + t('g.loading') + '</div>'
  grid.innerHTML = ''
  var r = await api('/api/collections/' + id)
  if (!r || !r.ok) { head.innerHTML = '<div class="empty-state"><p>' + t('col.notFound') + '</p></div>'; return }
  var c = r.data
  var col = /^#[0-9A-Fa-f]{6}$/.test(c.color || '') ? c.color : '#1D3A6B'
  head.innerHTML = `<div style="border-radius:18px;overflow:hidden;background:linear-gradient(135deg,${col},#0E1A33);padding:34px 30px;position:relative">
    <div style="position:relative;z-index:1">
      <div style="font-size:11px;letter-spacing:.3em;color:rgba(240,208,96,.95);margin-bottom:8px">专题 · COLLECTION</div>
      <h2 style="font-size:30px;font-weight:800;color:#F5F7FB;margin:0 0 8px">${esc(c.title)}</h2>
      <div style="font-size:14px;color:rgba(255,255,255,.75);max-width:640px">${esc(c.description || '')}</div>
      <div style="margin-top:12px;font-size:12.5px;color:rgba(240,208,96,.9)">${c.item_total || 0} ${t('col.items')} · ${esc((c.created_at || '').slice(0, 10))} ${t('col.created')}</div>
    </div></div>`
  var items = c.items || []
  grid.innerHTML = items.length ? items.map(function (m) {
    var cc = (colleges.find(function (x) { return x.name === m.college }) || {}).color || '#4299e1'
    var thumb = m.has_thumb && m.thumb_filename ? `<img src="/api/thumbs/${m.thumb_filename}" style="width:100%;height:100%;object-fit:cover" alt="${esc(m.title)}" loading="lazy">` : `<span>${typeIcons[m.type] || 'FILE'}</span>`
    return `<div class="material-card">
      <div class="material-thumb" style="background:linear-gradient(135deg,${cc}18,${cc}08)">${thumb}<span class="material-type-badge">${typeLabel(m.type)}</span></div>
      <div class="material-body">
        <div class="material-title" style="min-width:0">${esc(materialTitle(m.title))}</div>
        <div class="material-meta" style="margin-bottom:6px"><span>${esc(collegeName(m.college))}</span><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ${m.downloads || 0}</span><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ${m.likes || 0}</span></div>
        <div class="material-footer">
          <div class="material-author">${esc(m.author || '')}</div>
          ${m.has_file ? `<a href="/api/materials/${m.id}/file" class="btn btn-sm btn-primary" style="text-decoration:none">${t('btn.download')}</a>` : ''}
        </div>
      </div>
    </div>`
  }).join('') : '<div class="empty-state"><p>' + t('col.emptyItems') + '</p></div>'
}


/* ═══ 活动详情 + 签到（P2）═══ */
function openActivityDetail(id) {
  showPage('activity-detail', true)
  history.pushState({page:'activity-detail',type:'page',detailId:id}, '', '#activity-' + id)
  var body = document.getElementById('activityDetailBody')
  var sign = document.getElementById('activitySigninArea')
  if (!body || !sign) return
  body.innerHTML = '<div style="text-align:center;opacity:.5;padding:30px">加载中...</div>'
  sign.innerHTML = ''
  api('/api/activities/' + id).then(function (r) {
    if (!r || !r.ok) { body.innerHTML = '<div class="empty-state"><p>活动不存在或已删除</p></div>'; return }
    var a = r.data
    var banner = a.poster ? 'background-image:url(/api/posters/' + esc(a.poster) + ');background-size:cover;background-position:center' : 'background:linear-gradient(135deg,' + (a.color || '#1D3A6B') + ',#0E1A33)'
    var stZh = { ongoing: '进行中', upcoming: '未开始', ended: '已结束', completed: '已结束', cancelled: '已取消' }[a.status] || a.status
    var cap = a.capacity && a.capacity > 0 ? (a.registered_count + '/' + a.capacity) : (a.registered_count + ' 人（不限名额）')
    var myZh = { registered: '已报名 · 待签到', signed: '已签到 ✓', cancelled: '已取消' }[a.my_status] || ''
    // 报名按钮智能态（批九）：满员/截止/取消 不再可点（原版点了才被后端拒绝）
    var capFull = a.capacity > 0 && a.registered_count >= a.capacity
    var dlTime = a.reg_deadline ? new Date(a.reg_deadline) : null
    var dlPassed = dlTime && !isNaN(dlTime.getTime()) && Date.now() > dlTime.getTime()
    body.innerHTML =
      '<div style="border-radius:18px;overflow:hidden;background:linear-gradient(135deg,' + (a.color || '#1D3A6B') + ',#0E1A33)">' +
        '<div style="' + banner + ';height:240px;position:relative">' + (a.poster ? '' : '<div style="padding:60px 40px;font-size:40px;font-weight:800;color:rgba(255,255,255,.85)">' + esc(a.title) + '</div>') +
          '<span style="position:absolute;top:16px;right:16px;padding:4px 14px;border-radius:99px;background:rgba(0,0,0,.55);color:#fff;font-size:12.5px">' + stZh + '</span>' +
        '</div>' +
        '<div style="padding:26px 30px">' +
          '<h2 style="font-size:26px;font-weight:800;color:#F5F7FB;margin:0 0 10px">' + esc(a.title) + '</h2>' +
          '<div style="display:flex;gap:18px;flex-wrap:wrap;font-size:13.5px;color:rgba(255,255,255,.75);margin-bottom:14px">' +
            '<span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ' + esc(a.date || '时间待定') + '</span>' +
            (a.location ? '<span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ' + esc(a.location) + '</span>' : '') +
            (a.reg_deadline && dlTime && !isNaN(dlTime.getTime()) ? '<span>⏰ 报名截止 ' + esc(a.reg_deadline) + '</span>' : '') +
            '<span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> 已报名 ' + cap + '</span>' +
            '<span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 已签到 ' + (a.signed_count || 0) + ' 人</span>' +
          '</div>' +
          '<div style="font-size:14.5px;line-height:1.85;color:rgba(255,255,255,.85);white-space:pre-wrap">' + esc(a.description || '详情请关注后续通知。') + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
        '<span style="font-size:13px;color:var(--text-3)">' + (myZh ? '我的状态：' + myZh : '尚未报名') + '</span>' +
        (a.my_status === 'registered' && a.status === 'ongoing' ? '' :
          (a.my_status ? '' :
            (a.status === 'cancelled' ? '' :
              (a.status === 'ended' ? '<button class="btn btn-primary btn-sm" data-join="' + a.id + '" disabled>已结束</button>' :
                (capFull ? '<button class="btn btn-primary btn-sm" disabled>名额已满</button>' :
                  (dlPassed ? '<button class="btn btn-primary btn-sm" disabled>报名已截止</button>' :
                    '<button class="btn btn-primary btn-sm" data-join="' + a.id + '">' + (a.status === 'ongoing' ? '立即报名' : '预报名') + '</button>')))))) +
      '</div>'
    // 签到区：已报名 + 进行中
    if (a.my_status === 'registered' && a.status === 'ongoing') {
      sign.innerHTML =
        '<div class="card" style="padding:22px 26px"><h3 style="margin:0 0 10px;font-size:15px">活动签到</h3>' +
        '<p style="font-size:12.5px;color:var(--text-3);margin:0 0 12px">请向现场工作人员索取 6 位签到码，输入完成签到。</p>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
          '<input id="signinCode" maxlength="6" placeholder="签到码" style="width:140px;padding:9px 12px;border:1px solid var(--border-strong);border-radius:9px;background:var(--card-elev);color:var(--text);font-size:16px;letter-spacing:4px;text-transform:uppercase" onkeydown="if(event.key===&quot;Enter&quot;)submitActivitySignin(' + a.id + ')">' +
          '<button class="btn btn-gold btn-sm" onclick="submitActivitySignin(' + a.id + ')">完成签到</button>' +
        '</div></div>'
    } else if (a.my_status === 'signed') {
      sign.innerHTML = '<div class="card" style="padding:18px 26px;font-size:14px;color:var(--green,#2DD4BF)"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 你已完成签到，请留意活动后续通知。</div>'
    } else if (a.my_status === null) {
      sign.innerHTML = '<div class="card" style="padding:14px 26px;font-size:12.5px;color:var(--text-3)">报名成功后，活动进行期间可在此输入签到码完成签到。</div>'
    } else sign.innerHTML = ''
  })
}
async function submitActivitySignin(id) {
  var code = document.getElementById('signinCode') ? document.getElementById('signinCode').value.trim() : ''
  if (!code) { toast('请输入签到码'); return }
  var r = await api('/api/activities/' + id + '/signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code }) })
  toast(r && r.ok ? r.message : (r && r.message || '签到失败'))
  if (r && r.ok) openActivityDetail(id)
}

/* ═══ 多文件批量上传（2026-10-23）═══
   多选时：标题自动取文件名（去扩展名），学院/类型/描述/标签/日期共享；
   每个文件独立走 OSS 分片（>100MB）或本地流式，单个失败不影响其余。 */
async function doBatchUpload(isDraft){
  var college = ($('uploadCollege') || {}).value || ''
  var type = ($('uploadType') || {}).value || ''
  var desc = (($('uploadDesc') || {}).value || '').trim()
  var date = (($('uploadDate') || {}).value || '').trim()
  var tags = (($('uploadTags') || {}).value || '').trim()
  if(!college){ toast('请选择所属学院'); return }
  if(!type){ toast('请选择素材类型'); return }

  var btn = isDraft ? $('saveDraftBtn') : $('uploadBtn')
  var otherBtn = isDraft ? $('uploadBtn') : $('saveDraftBtn')
  if(btn) btn.disabled = true
  if(otherBtn) otherBtn.disabled = true

  var total = pendingFiles.length, okCount = 0, failCount = 0
  for(var i = 0; i < total; i++){
    var f = pendingFiles[i]
    var t = String(f.name || '未命名').replace(/\.[^.]+$/, '').slice(0, 100) || ('未命名' + (i + 1))
    var meta = {
      title: t, type: type, college: college, description: desc,
      shot_date: date, tags: tags, status: isDraft ? 'draft' : 'pending_review',
      __batchLabel: '[' + (i + 1) + '/' + total + '] '
    }
    try{
      var r = await uploadBigFile(f, meta)
      if(r && r.ok) okCount++
      else failCount++
    }catch(e){ failCount++ }
  }

  if(btn) btn.disabled = false
  if(otherBtn) otherBtn.disabled = false
  toast('批量上传完成：成功 ' + okCount + ' 个' + (failCount ? ('，失败 ' + failCount + ' 个') : ''))
  try { closeModal('uploadModal') } catch(e){}
  clearUploadFile()
  try { if(typeof loadMaterials === 'function') await loadMaterials() } catch(e){}
  try { if(typeof loadMyMaterials === 'function') await loadMyMaterials() } catch(e){}
  try { if(typeof loadDashboard === 'function') await loadDashboard() } catch(e){}
}
