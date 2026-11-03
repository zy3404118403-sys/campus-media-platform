let currentUser=null, colleges=[]
let curLang = localStorage.getItem('lang') || 'zh'

function rebuildCustomSelect(sel){
  if(!sel) return;
  if(!sel.dataset._csInit){ initCustomSelect(sel); return; }
  var wrap=sel.parentNode;
  if(!wrap||!wrap.classList||!wrap.classList.contains('cs-wrapper')) return;
  var parent=wrap.parentNode;
  if(!parent) return;
  /* 还原原生 select */
  parent.insertBefore(sel,wrap);
  parent.removeChild(wrap);
  delete sel.dataset._csInit;
  delete sel.dataset.csInit;
  sel.classList.remove('sr-only');
  sel.removeAttribute('aria-hidden');
  sel.removeAttribute('tabindex');
  sel.style.display='';
  initCustomSelect(sel);
}

const AI = {
  /* Brand / nav */
  'brand.name':{zh:'Creative Studio',en:'Creative Studio'},
  'brand.sub':{zh:'ADMIN CONSOLE',en:'ADMIN CONSOLE'},
  'nav.dashboard':{zh:'数据概览',en:'Dashboard'},
  'nav.review':{zh:'审核队列',en:'Review Queue'},
  'nav.materials':{zh:'素材库',en:'Materials'},
  'nav.activities':{zh:'活动管理',en:'Activities'},
  'nav.gallery':{zh:'首页画廊',en:'Home Gallery'},
  'nav.recruits':{zh:'招新管理',en:'Recruitment'},
  'nav.users':{zh:'用户管理',en:'Users'},
  'nav.audit':{zh:'操作日志',en:'Audit Log'},
  'nav.access':{zh:'访问日志',en:'Access Logs'},
  'nav.articleReview':{zh:'文稿审核',en:'Article Review'},
  'nav.mediaMatrix':{zh:'新媒体矩阵',en:'Media Matrix'},
  'nav.sensitiveWords':{zh:'敏感词库',en:'Sensitive Words'},
  'nav.articlesWorkbench':{zh:'文稿工作台',en:'Articles Workbench'},
  'nav.profile':{zh:'账号设置',en:'Account Settings'},
  'nav.group.overview':{zh:'概览',en:'Overview'},
  'nav.group.workbench':{zh:'素材工作台',en:'Workbench'},
  'nav.group.operations':{zh:'运营管理',en:'Operations'},
  'btn.logout':{zh:'退出登录',en:'Logout'},
  'profile.changePwd':{zh:'修改密码',en:'Change Password'},
  'profile.curPwd':{zh:'当前密码',en:'Current Password'},
  'profile.curPwdPh':{zh:'输入当前密码',en:'Enter current password'},
  'profile.newPwd':{zh:'新密码',en:'New Password'},
  'profile.newPwdPh':{zh:'至少8位，含大小写字母和数字',en:'Min 8 chars, with upper/lower case and digits'},
  'profile.confirmPwd':{zh:'确认新密码',en:'Confirm New Password'},
  'profile.confirmPwdPh':{zh:'再次输入新密码',en:'Re-enter new password'},
  'profile.changePwdBtn':{zh:'确认修改',en:'Change Password'},
  'profile.pwdMismatch':{zh:'两次密码不一致',en:'Passwords do not match'},
  'profile.pwdChanged':{zh:'密码已修改',en:'Password changed'},
  'profile.pwdChangeFail':{zh:'密码修改失败',en:'Password change failed'},
  'btn.home':{zh:'返回首页',en:'Home'},
  'sm.menu':{zh:'菜单',en:'Menu'},
  'sm.close':{zh:'关闭',en:'Close'},
  'sm.quickActions':{zh:'快捷操作',en:'Quick Actions'},
  'sec.upload':{zh:'上传素材',en:'Upload Material'},
  'upload.tip':{zh:'提交审核后将由管理员审核，通过后公开展示；也可先保存为草稿。',en:'Submissions are reviewed by admin. Approved materials are displayed publicly. You can also save as draft.'},
  'upload.title':{zh:'素材标题',en:'Title'},
  'upload.titlePh':{zh:'给你的素材起个名字',en:'Name your material'},
  'upload.college':{zh:'所属学院',en:'College'},
  'upload.selectCollege':{zh:'--请选择--',en:'-- Select --'},
  'upload.selectType':{zh:'--请选择类型--',en:'-- Select Type --'},
  'upload.subSelect':{zh:'--请选择--',en:'-- Select --'},
  'upload.type':{zh:'素材类型',en:'Type'},
  'upload.desc':{zh:'素材描述',en:'Description'},
  'upload.descPh':{zh:'简单描述素材内容、拍摄时间、场景等',en:'Describe content, time, scene, etc.'},
  'upload.link':{zh:'网盘链接',en:'Cloud Link'},
  'upload.linkNote':{zh:'（大文件可填写网盘链接）',en:'(For large files)'},
  'upload.linkPh':{zh:'百度网盘 / 阿里云盘 / 夸克网盘等链接',en:'Baidu / Aliyun / Quark Drive link'},
  'upload.date':{zh:'拍摄 / 创作时间',en:'Date'},
  'upload.datePh':{zh:'如：2026年8月',en:'e.g., Aug 2026'},
  'upload.tags':{zh:'标签（逗号分隔，最多6个）',en:'Tags (comma-separated, max 6)'},
  'upload.tagsPh':{zh:'如：校园,风景,活动',en:'e.g., campus, scenery'},
  'upload.file':{zh:'上传文件',en:'File'},
  'upload.fmt':{zh:'支持 JPG / PNG / MP4 / PDF / MP3 等格式 · 大文件自动分片上传，视频最大 20GB',en:'JPG / PNG / MP4 / PDF / MP3 · Large files auto-split, video up to 20GB'},
  'upload.subScene':{zh:'拍摄场景',en:'Scene Type'},
  'upload.subDoc':{zh:'文档类型',en:'Document Type'},
  'upload.subAudio':{zh:'音频类型',en:'Audio Type'},
  'upload.subFormat':{zh:'照片格式',en:'Image Format'},
  'upload.subOther':{zh:'自定义标签',en:'Custom Tag'},
  'upload.subOtherPh':{zh:'输入自定义标签',en:'Enter custom tag'},
  'upload.draft':{zh:'保存草稿',en:'Save Draft'},
  'upload.submit':{zh:'提交审核',en:'Submit'},
  't.needTitle':{zh:'请填写素材标题',en:'Please enter a title'},
  't.needCollege':{zh:'请选择所属学院',en:'Please select college'},
  't.needType':{zh:'请选择素材类型',en:'Please select type'},
  't.saving':{zh:'保存中...',en:'Saving...'},
  't.submitting':{zh:'提交中...',en:'Submitting...'},
  't.draftOk':{zh:'草稿已保存',en:'Draft saved'},
  't.submitOk':{zh:'提交成功，等待管理员审核',en:'Submitted, awaiting review'},
  't.retry':{zh:'操作失败，请重试',en:'Failed, please retry'},
  'dur.hour':{zh:'时',en:'h'},
  'dur.min':{zh:'分',en:'m'},
  'dur.sec':{zh:'秒',en:'s'},
  'sub.air':{zh:'空镜',en:'B-Roll'},'sub.aerial':{zh:'航拍',en:'Aerial'},'sub.ground':{zh:'地拍',en:'Ground'},'sub.timelapse':{zh:'延时摄影',en:'Timelapse'},'sub.slowmo':{zh:'慢动作',en:'Slow Motion'},'sub.transition':{zh:'转场',en:'Transition'},'sub.interview':{zh:'采访',en:'Interview'},'sub.event':{zh:'活动记录',en:'Event Record'},'sub.vlog':{zh:'Vlog',en:'Vlog'},'sub.promo':{zh:'宣传片',en:'Promo'},
  'sub.ppt':{zh:'课件PPT',en:'Courseware PPT'},'sub.thesis':{zh:'论文',en:'Thesis'},'sub.notes':{zh:'笔记',en:'Notes'},'sub.template':{zh:'模板',en:'Template'},'sub.report':{zh:'报告',en:'Report'},'sub.lesson':{zh:'教案',en:'Lesson Plan'},'sub.plan':{zh:'策划案',en:'Proposal'},'sub.script':{zh:'脚本',en:'Script'},
  'sub.music':{zh:'配乐',en:'Score'},'sub.sfx':{zh:'音效',en:'Sound Effect'},'sub.voiceover':{zh:'旁白配音',en:'Voiceover'},'sub.live':{zh:'现场录音',en:'Live Recording'},'sub.intro':{zh:'片头音乐',en:'Intro Music'},'sub.bgm':{zh:'背景音乐',en:'Background Music'},
  'hello':{zh:'你好, ',en:'Hello, '},
  /* Page titles */
  'tab.dashboard':{zh:'数据概览',en:'Dashboard'},
  'tab.review':{zh:'审核队列',en:'Review Queue'},
  'tab.materials':{zh:'素材库',en:'Materials'},
  'tab.gallery':{zh:'首页画廊',en:'Home Gallery'},
  'tab.activities':{zh:'活动管理',en:'Activities'},
  'tab.recruits':{zh:'招新管理',en:'Recruitment'},
  'tab.users':{zh:'用户管理',en:'Users'},
  'tab.audit':{zh:'操作日志',en:'Audit Log'},
  'tab.access':{zh:'访问日志',en:'Access Logs'},
  'tab.articleReview':{zh:'文稿审核',en:'Article Review'},
  'tab.mediaMatrix':{zh:'新媒体矩阵',en:'Media Matrix'},
  'tab.sensitiveWords':{zh:'敏感词库',en:'Sensitive Words'},
  'tab.ugcReview':{zh:'UGC审核',en:'UGC Review'},
  'tab.reports':{zh:'举报管理',en:'Reports'},
  'tab.forumManage':{zh:'论坛管理',en:'Forum Manage'},
  'tab.wallManage':{zh:'校园墙管理',en:'Wall Manage'},
  'tab.notifManage':{zh:'通知管理',en:'Notifications'},
  /* Access logs */
  'access.title':{zh:'访问日志',en:'Access Logs'},
  'access.regionStats':{zh:'区域访问统计',en:'Region Statistics'},
  'access.pageStats':{zh:'页面访问统计',en:'Page Statistics'},
  'access.days30':{zh:'近30天',en:'Last 30 days'},
  'access.days7':{zh:'近7天',en:'Last 7 days'},
  'access.today':{zh:'今天',en:'Today'},
  'access.ipPh':{zh:'IP 地址',en:'IP address'},
  'access.regionPh':{zh:'区域',en:'Region'},
  'access.thIP':{zh:'IP 地址',en:'IP Address'},
  'access.thRegion':{zh:'归属地',en:'Region'},
  'access.thPage':{zh:'访问页面',en:'Page'},
  'access.thUser':{zh:'用户',en:'User'},
  'access.thUA':{zh:'User-Agent',en:'User-Agent'},
  'access.thTime':{zh:'访问时间',en:'Time'},
  'access.totalVisits':{zh:'总访问量',en:'Total Visits'},
  'access.uniqueIPs':{zh:'独立IP',en:'Unique IPs'},
  'access.loggedInUsers':{zh:'登录用户',en:'Logged-in Users'},
  'access.visits':{zh:'次访问',en:'visits'},
  'access.uniqueIPsShort':{zh:'独立IP',en:'unique IPs'},
  'access.noData':{zh:'暂无访问记录',en:'No access logs'},
  'access.prev':{zh:'上一页',en:'Prev'},
  'access.next':{zh:'下一页',en:'Next'},
  'access.page':{zh:'第',en:'Page'},
  /* Dashboard stats */
  'stat.materials':{zh:'素材总数',en:'Materials'},
  'stat.drafts':{zh:'草稿',en:'Drafts'},
  'stat.pending':{zh:'待审核',en:'Pending'},
  'stat.approved':{zh:'已通过',en:'Approved'},
  'stat.published':{zh:'已发布',en:'Published'},
  'stat.archived':{zh:'已归档',en:'Archived'},
  'stat.downloads':{zh:'累计下载',en:'Downloads'},
  'stat.students':{zh:'学生',en:'Students'},
  'stat.activities':{zh:'活动',en:'Activities'},
  'stat.recruits':{zh:'招新',en:'Recruits'},
  /* Dashboard recent activity */
  'dash.recentActivity':{zh:'最近动态',en:'Recent Activity'},
  'dash.pendingMat':{zh:'待审核素材',en:'Pending Materials'},
  'dash.newRecruits':{zh:'新招申请',en:'New Applications'},
  'dash.noActivity':{zh:'暂无动态',en:'No recent activity'},
  /* Status names */
  'st.draft':{zh:'草稿',en:'Draft'},
  'st.pending_review':{zh:'待审核',en:'Pending'},
  'st.approved':{zh:'已通过',en:'Approved'},
  'st.published':{zh:'已发布',en:'Published'},
  'st.archived':{zh:'已归档',en:'Archived'},
  'st.rejected':{zh:'已拒绝',en:'Rejected'},
  /* Action labels */
  'act.submit':{zh:'提交',en:'Submit'},
  'act.approve':{zh:'通过',en:'Approve'},
  'act.reject':{zh:'拒绝',en:'Reject'},
  'act.publish':{zh:'发布',en:'Publish'},
  'act.archive':{zh:'归档',en:'Archive'},
  'act.restore':{zh:'恢复',en:'Restore'},
  'act.resubmit':{zh:'重新提交',en:'Resubmit'},
  'act.waiting':{zh:'等待作者提交',en:'Waiting for author'},
  'btn.delete':{zh:'删除',en:'Delete'},
  'btn.edit':{zh:'编辑',en:'Edit'},
  'btn.cancel':{zh:'取消',en:'Cancel'},
  'edit.matTitle':{zh:'编辑素材',en:'Edit Material'},
  'edit.actTitle':{zh:'编辑活动',en:'Edit Activity'},
  'edit.save':{zh:'保存修改',en:'Save Changes'},
  'edit.saving':{zh:'保存中...',en:'Saving...'},
  'edit.saved':{zh:'已更新',en:'Updated'},
  'edit.matDesc':{zh:'素材描述',en:'Description'},
  'edit.matTags':{zh:'标签（逗号分隔）',en:'Tags (comma separated)'},
  'edit.matDate':{zh:'拍摄日期',en:'Shoot Date'},
  'edit.matSubType':{zh:'子类型',en:'Sub-type'},
  'edit.matDriveUrl':{zh:'网盘链接',en:'Drive URL'},
  'edit.matCollege':{zh:'所属学院',en:'College'},
  'edit.matType':{zh:'素材类型',en:'Type'},
  'edit.actDesc':{zh:'活动描述',en:'Description'},
  'edit.posterCurrent':{zh:'当前海报',en:'Current Poster'},
  'edit.posterReplace':{zh:'替换海报（留空保持不变）',en:'Replace poster (leave empty to keep)'},
  'edit.noPoster':{zh:'无海报',en:'No poster'},
  'edit.coverCurrent':{zh:'当前封面',en:'Current Cover'},
  'edit.coverReplace':{zh:'替换封面（留空保持不变）',en:'Replace cover (leave empty to keep)'},
  'edit.noCover':{zh:'无封面',en:'No cover'},
  'edit.selectCollege':{zh:'--请选择--',en:'--Select--'},
  /* Review filter options */
  'review.pending':{zh:'待审核',en:'Pending'},
  'review.rejected':{zh:'已拒绝',en:'Rejected'},
  'review.approvedUnpub':{zh:'已通过(未发布)',en:'Approved (Unpublished)'},
  'review.published':{zh:'已发布',en:'Published'},
  'review.archived':{zh:'已归档',en:'Archived'},
  'review.draft':{zh:'草稿',en:'Draft'},
  /* Material filter options */
  'filter.allTypes':{zh:'全部类型',en:'All Types'},
  'filter.image':{zh:'图片',en:'Image'},
  'filter.video':{zh:'视频',en:'Video'},
  'filter.doc':{zh:'文档',en:'Document'},
  'filter.audio':{zh:'音频',en:'Audio'},
  'filter.other':{zh:'其他',en:'Other'},
  'filter.allColleges':{zh:'全部学院',en:'All Colleges'},
  'filter.allStatus':{zh:'全部状态',en:'All Status'},
  /* Table headers */
  'th.selectAll':{zh:'全选',en:'Select All'},
  'th.title':{zh:'标题',en:'Title'},
  'th.type':{zh:'类型',en:'Type'},
  'th.college':{zh:'学院',en:'College'},
  'th.uploader':{zh:'上传者',en:'Uploader'},
  'th.tags':{zh:'标签',en:'Tags'},
  'th.time':{zh:'时间',en:'Time'},
  'th.actions':{zh:'操作',en:'Actions'},
  'th.author':{zh:'作者',en:'Author'},
  'th.status':{zh:'状态',en:'Status'},
  'th.downloads':{zh:'下载',en:'Downloads'},
  'th.views':{zh:'浏览',en:'Views'},
  'th.date':{zh:'日期',en:'Date'},
  'th.name':{zh:'姓名',en:'Name'},
  'th.sid':{zh:'学号',en:'Student ID'},
  'th.grade':{zh:'年级',en:'Grade'},
  'th.email':{zh:'邮箱',en:'Email'},
  'th.resume':{zh:'简历',en:'Resume'},
  'th.submitTime':{zh:'提交时间',en:'Submitted'},
  'th.role':{zh:'角色',en:'Role'},
  'th.registerTime':{zh:'注册时间',en:'Registered'},
  'th.matId':{zh:'素材ID',en:'Material ID'},
  'th.matTitle':{zh:'素材标题',en:'Material Title'},
  'th.action':{zh:'动作',en:'Action'},
  'th.statusChange':{zh:'状态变更',en:'Status Change'},
  'th.operator':{zh:'操作者',en:'Operator'},
  'th.reason':{zh:'原因',en:'Reason'},
  /* View toggle */
  'view.list':{zh:'列表',en:'List'},
  'view.gallery':{zh:'▦ 画廊',en:'▦ Gallery'},
  /* Search placeholders */
  'search.review':{zh:'搜索审核中素材...',en:'Search pending materials...'},
  'search.materials':{zh:'搜索标题、描述、标签...',en:'Search title, desc, tags...'},
  /* Batch operations */
  'batch.selected':{zh:'已选',en:'Selected'},
  'batch.items':{zh:'项',en:'items'},
  'batch.approve':{zh:'批量通过',en:'Batch Approve'},
  'batch.publish':{zh:'批量发布',en:'Batch Publish'},
  'batch.archive':{zh:'批量归档',en:'Batch Archive'},
  'batch.delete':{zh:'批量删除',en:'Batch Delete'},
  /* Activities form */
  'actf.publish':{zh:'发布新活动',en:'Publish Activity'},
  'actf.title':{zh:'活动标题',en:'Title'},
  'actf.date':{zh:'活动日期',en:'Date'},
  'actf.datePh':{zh:'如：2026年9月1日 - 10月1日',en:'e.g., Sep 1 - Oct 1, 2026'},
  'actf.desc':{zh:'活动描述',en:'Description'},
  'actf.descPh':{zh:'描述活动内容',en:'Describe the activity'},
  'actf.status':{zh:'状态',en:'Status'},
  'actf.upcoming':{zh:'即将开始',en:'Upcoming'},
  'actf.ongoing':{zh:'进行中',en:'Ongoing'},
  'actf.ended':{zh:'已结束',en:'Ended'},
  'actf.publishBtn':{zh:'发布活动',en:'Publish'},
  'actf.poster':{zh:'活动海报',en:'Poster'},
  'actf.posterHint':{zh:'点击上传活动海报图片（JPG/PNG，建议 16:9 比例）',en:'Click to upload poster image (JPG/PNG, 16:9 recommended)'},
  'actf.needTitle':{zh:'请填写活动标题和日期',en:'Please enter title and date'},
  'actf.publishing':{zh:'发布中...',en:'Publishing...'},
  'actf.published':{zh:'活动已发布',en:'Activity published'},
  'actf.noPoster':{zh:'无海报',en:'No poster'},
  'th.poster':{zh:'海报',en:'Poster'},
  /* Gallery management (P0-2) */
  'gal.add':{zh:'新增画廊图片',en:'Add Gallery Image'},
  'gal.title':{zh:'图片标题',en:'Title'},
  'gal.titlePh':{zh:'如：校园全景',en:'e.g., Panorama'},
  'gal.layout':{zh:'布局',en:'Layout'},
  'gal.wide':{zh:'宽幅',en:'Wide'},
  'gal.tall':{zh:'竖幅',en:'Tall'},
  'gal.image':{zh:'图片文件',en:'Image File'},
  'gal.hint':{zh:'点击上传图片（JPG/PNG/WebP，不超过 2MB，建议压缩至 1000px 宽）',en:'Click to upload (JPG/PNG/WebP, max 2MB, 1000px width recommended)'},
  'gal.addBtn':{zh:'添加到画廊',en:'Add to Gallery'},
  'gal.manage':{zh:'画廊列表',en:'Gallery List'},
  'gal.needTitle':{zh:'请填写图片标题',en:'Please enter a title'},
  'gal.needFile':{zh:'请选择图片文件',en:'Please select an image'},
  'gal.added':{zh:'画廊图片已添加',en:'Added to gallery'},
  'gal.updated':{zh:'画廊项已更新',en:'Updated'},
  'gal.deleted':{zh:'画廊项已删除',en:'Deleted'},
  'gal.confirmDel':{zh:'确定删除这张画廊图片？',en:'Delete this gallery image?'},
  'gal.shown':{zh:'显示中',en:'Visible'},
  'gal.hidden':{zh:'已隐藏',en:'Hidden'},
  'gal.show':{zh:'显示',en:'Show'},
  'gal.hide':{zh:'隐藏',en:'Hide'},
  'gal.empty':{zh:'暂无画廊图片',en:'No gallery images'},
  'gal.save':{zh:'保存',en:'Save'},
  'gal.moveUp':{zh:'上移',en:'Move up'},
  'gal.moveDown':{zh:'下移',en:'Move down'},
  'gal.saving':{zh:'保存中...',en:'Saving...'},
  /* Activity status */
  'ast.ongoing':{zh:'进行中',en:'Ongoing'},
  'ast.upcoming':{zh:'即将开始',en:'Upcoming'},
  'ast.ended':{zh:'已结束',en:'Ended'},
  /* Recruits */
  'recruit.title':{zh:'报名申请',en:'Applications'},
  'recruit.hasResume':{zh:'已上传',en:'Uploaded'},
  'recruit.noResume':{zh:'未上传',en:'Not Uploaded'},
  'recruit.count':{zh:'人报名',en:'applicants'},
  'recruit.empty':{zh:'暂无报名',en:'No applications'},
  'recruit.download':{zh:'下载简历',en:'Download'},
  'recruit.deleteConfirm':{zh:'确定删除这条报名记录？',en:'Delete this application?'},
  /* Users */
  'users.title':{zh:'注册用户',en:'Registered Users'},
  'users.admin':{zh:'管理员',en:'Admin'},
  'users.student':{zh:'学生',en:'Student'},
  'users.count':{zh:'个账号',en:'accounts'},
  'users.empty':{zh:'暂无用户',en:'No users'},
  'users.locked':{zh:'已封禁',en:'Locked'},
  'users.promote':{zh:'设为管理',en:'Promote'},
  'users.demote':{zh:'降为普通',en:'Demote'},
  'users.lock':{zh:'封禁',en:'Lock'},
  'users.unlock':{zh:'解封',en:'Unlock'},
  'users.promoteConfirm':{zh:'确定将此用户设为管理员？',en:'Promote to admin?'},
  'users.demoteConfirm':{zh:'确定取消此用户的管理员权限？',en:'Demote this user?'},
  'users.lockConfirm':{zh:'确定封禁此用户？封禁后无法登录。',en:'Lock this user? They will be unable to login.'},
  'users.2faReset':{zh:'重置2FA',en:'Reset 2FA'}, 'users.2faResetConfirm':{zh:'确定重置该用户的两步验证？其下次登录仅需密码，请通知其重新绑定。',en:"Reset this user's 2FA? Password-only login on next sign-in. Notify them to re-enroll."},
  'users.unlockConfirm':{zh:'确定解封此用户？',en:'Unlock this user?'},
  'users.allRoles':{zh:'全部角色',en:'All roles'},
  /* Dashboard */
  'dash.uploadTrend':{zh:'近7天上传统计',en:'Upload Trend (7 days)'},
  'dash.userTrend':{zh:'近7天新用户',en:'New Users (7 days)'},
  'dash.quickExport':{zh:'数据导出',en:'Data Export'},
  /* Audit log */
  'audit.title':{zh:'素材状态操作日志',en:'Material Status Audit Log'},
  'audit.count':{zh:'条',en:'records'},
  'audit.empty':{zh:'暂无记录',en:'No records'},
  /* Count text */
  'count.total':{zh:'共',en:'Total '},
  'count.records':{zh:'条',en:'records'},
  /* Empty states */
  'empty.materials':{zh:'暂无素材',en:'No materials'},
  'empty.data':{zh:'暂无数据',en:'No data'},
  'empty.activities':{zh:'暂无活动',en:'No activities'},
  /* Toasts */
  't.netFail':{zh:'网络连接失败，请检查网络后重试',en:'Network failed. Check connection.'},
  't.netFail2':{zh:'网络连接失败',en:'Network failed'}, 'dir.boo':{zh:'导航',en:'Directory'}, 'dl.box':{zh:'下载',en:'Download'},
  't.badResp':{zh:'返回异常',en:'Bad response'},
  't.batchDone':{zh:'批量${action}完成: ${ok}成功${fail}失败',en:'Batch ${action} done: ${ok} ok, ${fail} failed'},
  't.confirmDel':{zh:'确定删除 ${n} 项素材？文件也会一起删除',en:'Delete ${n} materials? Files will also be deleted.'},
  't.confirmDelOne':{zh:'确定删除该素材？文件也会一并删除',en:'Delete this material? File will also be deleted.'},
  't.deleted':{zh:'已删除',en:'Deleted'},
  't.delFail':{zh:'删除失败',en:'Delete failed'},
  't.needTitleDate':{zh:'请填写标题和日期',en:'Please enter title and date'},
  't.actPublished':{zh:'已发布',en:'Published'},
  't.actFail':{zh:'发布失败',en:'Publish failed'},
  't.confirmDelAct':{zh:'确定删除？',en:'Confirm delete?'},
  't.reviewPrompt':{zh:'请输入${action}原因(可选):',en:'Enter ${action} reason (optional):'},
  't.reviewDone':{zh:'已${action}',en:'${action} done'},
  't.fail':{zh:'操作失败',en:'Operation failed'},
  /* Material types */
  'type.image':{zh:'图片',en:'Image'}, 'type.video':{zh:'视频',en:'Video'},
  'type.doc':{zh:'文档',en:'Document'}, 'type.audio':{zh:'音频',en:'Audio'}, 'type.other':{zh:'其他',en:'Other'},
  /* College names */
  'col.kuajing':{zh:'商学院',en:'Cross-border Commerce'}, 'col.guanli':{zh:'管理学院',en:'School of Management'},
  'col.waiyu':{zh:'外语外贸学院',en:'Foreign Languages & Trade'}, 'col.wenxue':{zh:'人文学院',en:'Literature & Creative Media'},
  'col.shuxue':{zh:'计算机学院',en:'Math & Computer Science'}, 'col.dashuju':{zh:'智能工程学院',en:'Big Data & Intelligent Engineering'},
  'col.chaoda':{zh:'数字治理学院',en:'Chongqing Digital Governance'}, 'col.yishu':{zh:'设计学院',en:'Art & Design'},
  'col.yinyue':{zh:'音乐学院',en:'Music & Dance'}, 'col.jiaoyu':{zh:'教育学院',en:'Education'},
  'col.tiyu':{zh:'体育学院',en:'Sports & Health'}, 'col.makesi':{zh:'通识教育学院',en:'Marxism Studies'},
  'col.guoji':{zh:'国际学院',en:'International College'}, 'col.rongmeiti':{zh:'传媒学院',en:'Film, TV & Media'},
}
function at(k,params){
  const e=AI[k]
  if(!e) return k
  let s=e[curLang]||e.zh
  if(params){
    for(const key in params){
      s=s.replace(new RegExp('\\$\\{'+key+'\\}','g'),params[key])
    }
  }
  return s
}
let currentTab='dashboard', langReady=false
/* College name & type translation */
const COLLEGE_NAME_MAP={'商学院':'col.kuajing','管理学院':'col.guanli','外语外贸学院':'col.waiyu','人文学院':'col.wenxue','计算机学院':'col.shuxue','智能工程学院':'col.dashuju','数字治理学院':'col.chaoda','设计学院':'col.yishu','音乐学院':'col.yinyue','教育学院':'col.jiaoyu','体育学院':'col.tiyu','通识教育学院':'col.makesi','国际学院':'col.guoji','传媒学院':'col.rongmeiti'}
function collegeName(n){if(!n)return'';const k=COLLEGE_NAME_MAP[n];return k?at(k):n}
const TYPE_MAP={'图片':'type.image','视频':'type.video','文档':'type.doc','音频':'type.audio','其他':'type.other'}
const TYPE_KEY_MAP={'图片':'image','视频':'video','文档':'doc','音频':'audio','其他':'other',image:'image',video:'video',doc:'doc',audio:'audio',other:'other'}
const typeIcons={image:'IMG',video:'VID',doc:'DOC',audio:'AUD',other:'FILE'}
function typeToKey(t){return TYPE_KEY_MAP[t]||'other'}
function typeLabel(t){if(!t)return'';const k=TYPE_MAP[t];return k?at(k):t}
/* Material title translation (database content) */
const MATERIAL_TITLE_MAP={'校园春日樱花摄影集':'Campus Cherry Blossom Photography','校运会精彩瞬间混剪':'Sports Day Highlights Mix','大创答辩PPT模板':'Innovation Competition PPT Template','校园广播片头音乐':'Campus Radio Intro Music','图书馆建筑摄影组图':'Library Architecture Photography','校园微电影《青春序曲》':'Campus Micro-film "Youth Overture"','校园文化节海报设计稿':'Culture Festival Poster Design','模拟法庭辩论赛录像':'Mock Court Debate Recording','数据结构课程笔记整理':'Data Structures Course Notes','校园Vlog - 一日生活':'Campus Vlog - A Day in Life','毕业季纪念视频素材包':'Graduation Memorial Video Pack','校园植物图鉴手册':'Campus Plant Illustrated Handbook','网盘测试素材':'Cloud Drive Test Material'}
function materialTitle(t){if(!t)return'';return curLang==='en'?(MATERIAL_TITLE_MAP[t]||t):t}
const MATERIAL_DESC_MAP={'校园春日樱花摄影集':'A collection of cherry blossom photography on campus during spring.','校运会精彩瞬间混剪':'Highlights mix from the campus sports day.','大创答辩PPT模板':'A clean PPT template for innovation competition defense presentations.','校园广播片头音乐':'Intro music for the campus radio station.','图书馆建筑摄影组图':'Architectural photography of the campus library.','校园微电影《青春序曲》':'A campus micro-film about youth and dreams.','校园文化节海报设计稿':'Poster design for the campus culture festival.','模拟法庭辩论赛录像':'Recording of the mock court debate competition.','数据结构课程笔记整理':'Organized course notes for Data Structures.','校园Vlog - 一日生活':'A vlog capturing a day of campus life.','毕业季纪念视频素材包':'Video material pack for graduation memories.','校园植物图鉴手册':'An illustrated handbook of plants found on campus.','网盘测试素材':'Test material with cloud drive link.'}
function materialDesc(d){if(!d)return'';return curLang==='en'?(MATERIAL_DESC_MAP[d]||d):d}
const ACTIVITY_TITLE_MAP={'「光影校园」摄影大赛':'"Light & Shadow" Photography Contest','「青春视界」短视频大赛':'"Youth Vision" Short Video Contest','「创意无限」平面设计大赛':'"Creativity" Graphic Design Contest','「声动校园」配音大赛':'"Voice" Dubbing Contest','「笔墨校园」新闻采写大赛':'"Pen & Ink" News Writing Contest','「映像校园」微电影展映周':'"Reflections" Micro-film Week'}
function activityTitle(t){if(!t)return'';return curLang==='en'?(ACTIVITY_TITLE_MAP[t]||t):t}
const ACTIVITY_DESC_MAP={'用镜头记录校园之美。优秀作品将在校史馆展出并在官微推送。':'Capture the beauty of campus with your lens. Outstanding works will be exhibited in the school museum and featured on official social media.','围绕「青春·校园·梦想」主题创作短视频，最佳作品将推荐参加省级比赛。':'Create short videos around the theme "Youth · Campus · Dreams". Best works will be nominated for provincial competitions.','设计校园文创产品图案，入选作品将制成实物发售。':'Design campus cultural product patterns. Selected works will be produced and sold as merchandise.','影视片段配音、纪录片旁白皆可参加，单人组和团体组分别评奖。':'Dubbing for film clips or documentary narration. Solo and group categories judged separately.','围绕校园新闻事件进行采访与写作，优秀稿件将在校报刊登。':'Conduct interviews and write about campus news events. Outstanding articles will be published in the school newspaper.','征集校园微电影作品，评审后在学术报告厅进行为期一周的展映。':'Submit campus micro-film works. After review, selected films will be screened for a week at the academic lecture hall.'}
function activityDesc(d){if(!d)return'';return curLang==='en'?(ACTIVITY_DESC_MAP[d]||d):d}
function syncCustomSelects(){
  document.querySelectorAll('select.cs-custom').forEach(sel=>{
    const wrap=sel.closest('.cs-wrapper')
    if(!wrap) return
    const trig=wrap.querySelector('.cs-trigger')
    if(trig){
      /* Update only the text node (child[1]), preserve hidden label (child[0]) and arrow (child[2]) */
      var textNode=trig.childNodes[1]
      if(textNode&&textNode.nodeType===3){
        textNode.textContent=sel.options[sel.selectedIndex]?sel.options[sel.selectedIndex].textContent:''
      }
    }
    const ddOpts=wrap.querySelectorAll('.cs-option')
    Array.from(sel.options).forEach((opt,i)=>{ if(ddOpts[i]) ddOpts[i].textContent=opt.textContent })
  })
}
function setAdminLang(lang){
  curLang=lang; localStorage.setItem('lang',lang)
  document.documentElement.lang=lang==='en'?'en':'zh-CN'
  document.querySelectorAll('#langToggle span').forEach(s=>s.classList.toggle('active',s.dataset.lang===lang))
  // update all data-i18n elements (textContent)
  document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent=at(el.dataset.i18n) })
  // update all data-i18n-ph elements (placeholder)
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{ el.placeholder=at(el.dataset.i18nPh) })
  // update all data-i18n-title elements (title)
  document.querySelectorAll('[data-i18n-title]').forEach(el=>{ el.title=at(el.dataset.i18nTitle) })
  // update all data-i18n-html elements (innerHTML)
  document.querySelectorAll('[data-i18n-html]').forEach(el=>{ el.innerHTML=at(el.dataset.i18nHtml) })
  // page title
  $('pageTitle').textContent=at(TAB_KEYS[currentTab]||currentTab)
  // admin name
  if(currentUser) $('adminName').textContent=at('hello')+currentUser.name
  // document title
  document.title=lang==='en'?'Creative Studio · Admin':'Creative Studio · 融媒体管理后台'
  // re-sync custom selects
  syncCustomSelects()
  // re-render staggered menu
  if(window.SM_ADMIN) SM_ADMIN.reRender()
  // update batch bar text
  updateBatchBar()
  // re-render current tab content (skip during initial setup)
  if(langReady){
    if(currentTab==='dashboard') loadDashboard()
    else if(currentTab==='review') loadReview()
    else if(currentTab==='materials') loadMaterials()
    else if(currentTab==='activities') loadActivities()
    else if(currentTab==='recruits') loadRecruits()
    else if(currentTab==='users') loadUsers()
    else if(currentTab==='audit') loadAuditLogs()
  }
}
function toggleLang(){setAdminLang(curLang==='zh'?'en':'zh')}

/* ── 移动端侧栏切换 ── */
function toggleMobileSidebar(){
  const sb=$('adminSidebar'),ov=$('sidebarOverlay')
  sb.classList.toggle('mobile-show')
  ov.classList.toggle('show')
}
function closeMobileSidebar(){
  const sb=$('adminSidebar'),ov=$('sidebarOverlay')
  sb.classList.remove('mobile-show')
  ov.classList.remove('show')
}

/* ── 全局状态 ── */
const statusKeys={draft:'st.draft',pending_review:'st.pending_review',approved:'st.approved',published:'st.published',archived:'st.archived',rejected:'st.rejected'}
const actionKeyMap={submit:'act.submit',approve:'act.approve',reject:'act.reject',publish:'act.publish',archive:'act.archive',unarchive:'act.restore',resubmit:'act.resubmit'}
function statusLabel(s){return statusKeys[s]?at(statusKeys[s]):s}
function actionLabel(a){return actionKeyMap[a]?at(actionKeyMap[a]):a}
const statusOrder={pending_review:0, approved:1, published:2, draft:3, rejected:4, archived:5}
let currentMatView='list', currentReviewView='list'
let selectedMats=new Set(), selectedReviews=new Set()
async function doLogout(){await api('/api/logout',{method:'POST'});location.href='/login.html'}
async function changePassword(){
  var cur=$('curPwd').value,nw=$('newPwd').value,cfm=$('confirmPwd').value
  if(!cur||!nw){toast(at('profile.curPwdPh'));return}
  if(nw!==cfm){toast(at('profile.pwdMismatch'));return}
  var d=await api('/api/me/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:cur,newPassword:nw})})
  if(d.ok){toast(at('profile.pwdChanged'));$('curPwd').value='';$('newPwd').value='';$('confirmPwd').value='';closeModal('pwdModal')}
  else toast(d.message||at('profile.pwdChangeFail'))
}
function showLogin(){currentUser=null;location.href='/login.html'}
async function showMain(){
  $('mainLayout').classList.remove('hidden')
  $('adminName').textContent=at('hello')+currentUser.name
  setAdminLang(curLang)
  $('adminAvatar').textContent=(currentUser.name||'A').charAt(0)
  const cl=await api('/api/colleges');colleges=cl.data||[]
  const sel=$('materialCollegeFilter')
  sel.innerHTML='<option value="" data-i18n="filter.allColleges">'+at('filter.allColleges')+'</option>'+colleges.map(c=>`<option value="${esc(c.name)}">${esc(collegeName(c.name))}</option>`).join('')
  initCustomSelects(document)
  langReady=true
  switchTab('dashboard')
}

/* ── 页面切换 ── */
const TAB_KEYS={profile:'账号设置',dashboard:'tab.dashboard',review:'tab.review',materials:'tab.materials',gallery:'tab.gallery',activities:'tab.activities',recruits:'tab.recruits',users:'tab.users',audit:'tab.audit',access:'tab.access',articleReview:'tab.articleReview',mediaMatrix:'tab.mediaMatrix',sensitiveWords:'tab.sensitiveWords',ugcReview:'tab.ugcReview',reports:'tab.reports',forumManage:'tab.forumManage',wallManage:'tab.wallManage',notifManage:'tab.notifManage',collections:'专题管理'}
async function switchTab(tab){
  currentTab=tab
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'))
  if(ROLE_NAV[_myRole]&&!ROLE_NAV[_myRole].includes(tab)){toast('当前角色无权访问此模块');return}
  var navEl=document.querySelector(`.nav-item[data-tab="${tab}"]`)
  if(navEl) navEl.classList.add('active')
  document.querySelectorAll('.tab-pane').forEach(t=>t.classList.add('hidden'))
  $('tab-'+tab).classList.remove('hidden')
  $('pageTitle').textContent=at(TAB_KEYS[tab]||tab)
  selectedMats.clear();selectedReviews.clear();updateBatchBar()
  closeMobileSidebar()
  if(window.SM_ADMIN) SM_ADMIN.updateActive()
  if(tab==='profile') loadAccountForm()
  if(tab==='dashboard') loadDashboard()
  if(tab==='review') loadReview()
  if(tab==='materials') loadMaterials()
  if(tab==='gallery') loadGallery()
  if(tab==='activities') loadActivities()
  if(tab==='recruits') loadRecruits()
  if(tab==='users') loadUsers()
  if(tab==='audit') loadAuditLogs()
  if(tab==='access') loadAccessLogs()
  if(tab==='articleReview') loadArticleReviewQueue()
  if(tab==='mediaMatrix') loadMediaAccounts()
  if(tab==='sensitiveWords') loadSensitiveWords()
  if(tab==='ugcReview') loadUgcReview()
  if(tab==='reports') loadReports()
  if(tab==='forumManage') loadForumManage()
  if(tab==='wallManage') loadWallManage()
  if(tab==='notifManage') loadNotifManage()
  if(tab==='collections') loadCollectionsAdmin()
}

/* ── 数据概览 ── */
function loadingHTML(){return '<div class="empty-state"><div class="icon" style="animation:spin 1s linear infinite"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div><p>'+at('misc.loading')+'</p></div>'}
function errorHTML(msg){return '<div class="empty-state"><div class="icon" style="color:#f87171"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><p style="color:#f87171">'+(msg||at('t.netFail2'))+'</p></div>'}
async function loadDashboard(){
  const d=await api('/api/admin/stats')
  if(!d.ok){$('dashKpis').innerHTML=errorHTML();return}
  const s=d.data||{}
  // 侧栏待审徽章（保留原行为）
  $('pendingBadge').textContent='0';countUp($('pendingBadge'),s.pending_review||0,800)
  $('pendingBadge').style.display=(s.pending_review>0)?'inline-block':'none'
  renderKpis(s)
  renderTrendCharts(s)
  renderDonut(s.by_type||[])
  renderCollegeBars(s.by_college_top||[])
  renderHeat(s.uploadTrend30||[])
  renderHot(s.hot||[])
  renderHealth(s.storage)
  renderActiveUsers(s.active_users||[])
  renderTodos(s)
  renderGovernance()
  renderMetrics()
  /* 最近动态（保留原逻辑） */
  const[rev,rec]=await Promise.all([api('/api/materials?status=pending_review'),api('/api/recruits')])
  const pend=(rev.data||[]).slice(0,5),rs=(rec.data||[]).slice(0,3)
  let html=''
  if(pend.length) html+=`<div style="margin-bottom:4px;font-size:12px;color:var(--text-2)">${at('dash.pendingMat')}</div>`+pend.map(m=>`<div class="recent-item"><span style="color:var(--gold);font-size:11px">●</span><span>《${esc(materialTitle(m.title))}》</span><span style="color:var(--text-3)">${esc(m.author)}</span><span class="time">${esc(m.created_at)}</span></div>`).join('')
  if(rs.length) html+=`<div style="margin:12px 0 4px;font-size:12px;color:var(--text-2)">${at('dash.newRecruits')}</div>`+rs.map(r=>`<div class="recent-item"><span style="color:var(--primary);font-size:11px">●</span><span>${esc(r.name)} (${esc(r.sid)})</span><span class="time">${esc(r.created_at)}</span></div>`).join('')
  $('recentActivity').innerHTML=html||emptyStateHTML({icon:'chart',title:at('dash.noActivity'),sm:true})
}

/* ═══ 数据工作台渲染辅助（P1 重构）═══ */
function trendArrow(cur,prev){
  if(prev==null||prev===0) return cur>0?'<span class="kpi-up">↑ 新增</span>':'<span style="color:var(--text-3,#8a93a5)">—</span>'
  const pct=Math.round((cur-prev)/prev*100)
  if(pct===0) return '<span style="color:var(--text-3,#8a93a5)">持平</span>'
  return pct>0?`<span class="kpi-up">↑ ${pct}% 较上周</span>`:`<span class="kpi-down">↓ ${Math.abs(pct)}% 较上周</span>`
}
function sparkSVG(values,w,h,color){
  w=w||120;h=h||30;values=values||[]
  if(!values.length) return ''
  const max=Math.max.apply(null,values)||1
  const step=values.length>1?w/(values.length-1):w
  const pts=values.map((v,i)=>`${(i*step).toFixed(1)},${(h-2-(v/max)*(h-6)).toFixed(1)}`).join(' ')
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" style="vertical-align:middle"><polyline points="${pts}" fill="none" stroke="${color||'#D4AF37'}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`
}
function renderKpis(s){
  const upSpark=(s.uploadTrend||[]).map(x=>x.count)
  const dlSpark=(s.dlTrend||[]).map(x=>x.count)
  const uSpark=(s.userTrend||[]).map(x=>x.count)
  const st=[['pending_review','待审核','#fbbf24'],['approved','已通过','var(--status-info)'],['published','已发布','#8FB0FF'],['archived','已归档','#8a93a5'],['draft','草稿','#A78BFA'],['rejected','已拒绝','#f87171']]
  const totalMat=Math.max(1,s.materials||0)
  const segs=st.filter(x=>(s[x[0]]||0)>0).map(x=>`<i style="width:${((s[x[0]]||0)/totalMat*100).toFixed(1)}%;background:${x[2]}"></i>`).join('')
  const legend=st.map(x=>`<span><i style="background:${x[2]}"></i>${x[1]} ${s[x[0]]||0}</span>`).join('')
  $('dashKpis').innerHTML=[
    `<div class="kpi-card"><div class="k-label">素材资产</div><div class="k-num">${s.materials||0}</div><div class="k-sub">${trendArrow((s.uploadTrend||[]).reduce((a,x)=>a+x.count,0),s.uploads_prev7)}</div><div class="funnel-bar">${segs||'<i style="width:100%;background:rgba(128,128,128,.2)"></i>'}</div><div class="funnel-legend">${legend}</div></div>`,
    `<div class="kpi-card"><div class="k-label">下载总量</div><div class="k-num">${s.downloads||0}</div><div class="k-sub">${trendArrow((s.dlTrend||[]).reduce((a,x)=>a+x.count,0),s.downloads_prev7)} ${sparkSVG(dlSpark,110,26,'#2DD4BF')}</div></div>`,
    `<div class="kpi-card"><div class="k-label">注册学生</div><div class="k-num">${s.users||0}</div><div class="k-sub">${trendArrow((s.userTrend||[]).reduce((a,x)=>a+x.count,0),s.users_prev7)} ${sparkSVG(uSpark,110,26,'#8FB0FF')}</div></div>`,
    `<div class="kpi-card"><div class="k-label">活动 / 招新</div><div class="k-num">${s.activities||0} <span style="font-size:14px;color:var(--text-3,#8a93a5)">/</span> ${s.recruits||0}</div><div class="k-sub">点击下方待办直达管理</div></div>`
  ].join('')
}
function renderTrendCharts(s){
  if(!window.Chart) return
  var chartOpts={responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,labels:{font:{size:10},boxWidth:10}}},scales:{x:{ticks:{font:{size:10},maxRotation:0},grid:{display:false}},y:{beginAtZero:true,ticks:{font:{size:10},precision:0},grid:{color:'rgba(128,128,128,.06)'}}}}
  /* 上传 vs 下载 双线（补画闲置的 dlTrend） */
  ;(function(){
    var ctx=document.getElementById('chartUD');if(!ctx||!ctx.getContext)return
    var days7=[],mapU={},mapD={}
    ;(s.uploadTrend||[]).forEach(x=>{mapU[x.date]=x.count})
    ;(s.dlTrend||[]).forEach(x=>{mapD[x.date]=x.count})
    for(var i=6;i>=0;i--){var dt=new Date(Date.now()-i*864e5).toISOString().slice(0,10);days7.push(dt)}
    var uVals=days7.map(dt=>mapU[dt]||0),dVals=days7.map(dt=>mapD[dt]||0)
    var labels=days7.map(dt=>dt.slice(5))
    if(window._chartUD){window._chartUD.destroy()}
    window._chartUD=new Chart(ctx.getContext('2d'),{type:'line',data:{labels:labels,datasets:[
      {label:'上传',data:uVals,borderColor:'rgba(212,175,55,.9)',backgroundColor:'rgba(212,175,55,.12)',fill:true,tension:.35,pointRadius:3},
      {label:'下载',data:dVals,borderColor:'rgba(45,212,191,.9)',backgroundColor:'rgba(45,212,191,.1)',fill:true,tension:.35,pointRadius:3}
    ]},options:chartOpts})
  })()
  /* 访问趋势（PV + 独立IP） */
  ;(async function(){
    var ctx=document.getElementById('chartVisit');if(!ctx||!ctx.getContext)return
    var emptyMsg='<div class="dash-empty">近 7 日暂无访问记录</div>'
    try{
      var r=await api('/api/admin/access-logs/stats?days=7')
      var trend=(r.ok&&r.data&&r.data.trend||[]).slice().reverse()
      if(!trend.length){ctx.parentNode.insertAdjacentHTML('beforeend','') ;ctx.style.display='none';if(!ctx.parentNode.querySelector('.dash-empty'))ctx.insertAdjacentHTML('afterend',emptyMsg);return}
      ctx.style.display='';var ex=ctx.parentNode.querySelector('.dash-empty');if(ex)ex.remove()
      if(window._chartVisit){window._chartVisit.destroy()}
      window._chartVisit=new Chart(ctx.getContext('2d'),{type:'bar',data:{labels:trend.map(x=>x.date.slice(5)),datasets:[
        {label:'访问量',data:trend.map(x=>x.visits),backgroundColor:'rgba(139,176,255,.55)',borderRadius:4},
        {label:'独立IP',data:trend.map(x=>x.unique_ips),type:'line',borderColor:'rgba(45,212,191,.9)',tension:.35,pointRadius:2.5}
      ]},options:chartOpts})
    }catch(e){ if(!ctx.parentNode.querySelector('.dash-empty'))ctx.insertAdjacentHTML('afterend',emptyMsg);ctx.style.display='none' }
  })()
}
function renderDonut(byType){
  var el=$('dashTypeDonut');if(!el)return
  var colors={'图片':'#D4AF37','视频':'#2DD4BF','文档':'#8FB0FF','音频':'#A78BFA','其他':'#8a93a5'}
  var total=byType.reduce((a,x)=>a+x.c,0)
  if(!total){el.innerHTML='<div class="dash-empty">暂无已发布素材</div>';return}
  var R=52,C=2*Math.PI*R,off=0
  var segs=byType.map(x=>{
    var len=x.c/total*C
    var s=`<circle r="${R}" cx="70" cy="70" fill="none" stroke="${colors[x.type]||'#8a93a5'}" stroke-width="16" stroke-dasharray="${len.toFixed(1)} ${(C-len).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 70 70)"/>`
    off+=len;return s
  }).join('')
  var legend=byType.map(x=>`<span style="display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0;font-size:11.5px;color:var(--text-2,#9AA3B5)"><i style="width:8px;height:8px;border-radius:2px;background:${colors[x.type]||'#8a93a5'}"></i>${x.type} ${x.c}（${Math.round(x.c/total*100)}%）</span>`).join('')
  el.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;padding:8px 0"><svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="素材类型分布环形图">${segs}<text x="70" y="66" text-anchor="middle" fill="currentColor" font-size="20" font-weight="800">${total}</text><text x="70" y="84" text-anchor="middle" fill="currentColor" opacity=".55" font-size="10">已发布素材</text></svg><div style="margin-top:8px">${legend}</div></div>`
}
function renderCollegeBars(rows){
  var el=$('dashCollegeBars');if(!el)return
  if(!rows.length){el.innerHTML='<div class="dash-empty">暂无学院数据</div>';return}
  var max=Math.max.apply(null,rows.map(r=>r.c))||1
  el.innerHTML=rows.map(function(r,i){
    var w=Math.round(r.c/max*100)
    return `<div style="margin:9px 0"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i+1}. ${esc(r.college)}</span><span style="color:var(--text-3,#8a93a5);flex-shrink:0;margin-left:8px">${r.c} 份 · ${r.d||0} 下载</span></div><div style="height:9px;border-radius:5px;background:rgba(128,128,128,.12);overflow:hidden"><div style="width:${w}%;height:100%;border-radius:5px;background:linear-gradient(90deg,#D4AF37,#F0D060);transition:width .6s cubic-bezier(.22,1,.36,1)"></div></div></div>`
  }).join('')
}
function renderHeat(trend30){
  var el=$('dashHeat');if(!el)return
  var map={};(trend30||[]).forEach(x=>{map[x.date]=x.count})
  var max=Math.max.apply(null,trend30.map(x=>x.count))||1
  var cells=''
  for(var i=29;i>=0;i--){
    var dt=new Date(Date.now()-i*864e5).toISOString().slice(0,10)
    var v=map[dt]||0
    var alpha=v? (0.25+0.75*v/max).toFixed(2) : 0.07
    var gold=v?'212,175,55':'128,128,128'
    cells+=`<rect x="${((29-i)%10)*26+2}" y="${Math.floor((29-i)/10)*26+2}" width="22" height="22" rx="5" fill="rgba(${gold},${alpha})"><title>${dt}：上传 ${v} 份</title></rect>`
  }
  el.innerHTML=`<svg width="270" height="86" viewBox="0 0 264 84" role="img" aria-label="近30天上传热力图">${cells}</svg><div style="font-size:11px;color:var(--text-3,#8a93a5);margin-top:4px">30 天共上传 ${(trend30||[]).reduce((a,x)=>a+x.count,0)} 份 · 颜色越深越活跃</div>`
}
async function renderTodos(s){
  var el=$('dashTodos');if(!el)return
  var todos=[{label:'待审素材',n:(s.pending_review||0),tab:'review',warn:true}]
  try{var rs=await api('/api/admin/review-stats');var pn=((rs.ok&&rs.data&&rs.data.byStatus)||[]).filter(x=>['pending_l1','pending_l2','pending_l3'].includes(x.status)).reduce((a,x)=>a+x.c,0);todos.push({label:'待审文章',n:pn,tab:'articleReview',warn:true})}catch(e){}
  try{var ug=await api('/api/admin/ugc-review');var ugList=Array.isArray(ug.data)?ug.data:((ug.data&&ug.data.items)||[]);var ugN=ugList.filter?ugList.filter(x=>x.status==='pending').length:((ug.data&&ug.data.total)||0);todos.push({label:'待审UGC',n:ugN,tab:'ugcReview',warn:true})}catch(e){}
  try{var rp=await api('/api/admin/reports');todos.push({label:'待处理举报',n:((rp.ok&&rp.data)||[]).filter(x=>x.status==='pending').length,tab:'reports',warn:true})}catch(e){}
  el.innerHTML=todos.map(t=>`<div class="todo-pill ${t.n?'warn':'zero'}" role="button" tabindex="0" data-todo-tab="${t.tab}" data-todo-label="${t.label}" onclick="openTodoPreview('${t.tab}','${t.label}')" onkeydown="if(event.key==='Enter')openTodoPreview('${t.tab}','${t.label}')"><span>${t.label}</span><span class="n">${t.n}</span></div>`).join('')
}
function renderHot(rows){
  var el=$('dashHot');if(!el)return
  if(!rows.length){el.innerHTML='<div class="dash-empty">暂无已发布素材</div>';return}
  var typeColors={'图片':'#D4AF37','视频':'#2DD4BF','文档':'#8FB0FF','音频':'#A78BFA'}
  el.innerHTML=rows.map(function(m,i){
    return `<div class="hot-row"><span class="hot-rank" style="${i===0?'background:#D4AF37;color:#0A0D14':''}">${i+1}</span><span class="t" title="${esc(m.title)}">${esc(materialTitle(m.title))}</span><span style="font-size:11px;color:${typeColors[m.type]||'#8a93a5'};flex-shrink:0">${esc(m.type)}</span><span style="font-size:12px;color:var(--text-2,#9AA3B5);flex-shrink:0;width:52px;text-align:right"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ${m.downloads||0}</span></div>`
  }).join('')
}
function renderHealth(st){
  var el=$('dashHealth');if(!el)return
  if(!st){el.innerHTML='<div class="dash-empty">健康数据不可用</div>';return}
  el.innerHTML=[
    ['上传目录占用',st.uploadsMB+' MB'],
    ['数据库大小',st.dbMB+' MB'],
    ['服务已运行',st.uptimeH+' 小时'],
    ['服务状态','正常']
  ].map(r=>`<div class="health-row"><span style="color:var(--text-3,#8a93a5)">${r[0]}</span><b>${r[1]}</b></div>`).join('')
}
function renderActiveUsers(rows){
  var el=$('dashActive');if(!el)return
  if(!rows||!rows.length){el.innerHTML='<div class="dash-empty">近 7 日暂无用户活跃记录</div>';return}
  el.innerHTML=rows.map(function(u,i){
    var score=(u.uploads||0)+(u.downloads||0)
    return `<div class="active-row"><span class="active-rank" style="${i===0?'background:#2DD4BF;color:#0A0D14':''}">${i+1}</span><span class="t" title="${esc(u.name||('用户 '+u.id))}">${esc(u.name||('用户 '+u.id))}</span><span class="score">上传 ${u.uploads||0} · 被下载 ${u.downloads||0} · 活跃 ${score}</span></div>`
  }).join('')
}
var _todoPreviewMeta=null
async function renderMetrics(){
  var el=$('dashMetrics');if(!el)return
  el.innerHTML='<div style="text-align:center;opacity:.5;padding:14px;font-size:12px">计算中...</div>'
  var r=await api('/api/admin/metrics')
  if(!r||!r.ok){el.innerHTML='<div class="dash-empty">指标加载失败</div>';return}
  var d=r.data||{}
  var items=[
    {l:'审核平均耗时',v:d.avgReviewHours==null?'—':d.avgReviewHours+' 小时',s:'近 30 天通过素材'},
    {l:'素材下载率',v:d.dlRate+'%',s:'有下载的发布素材 '+d.pubTotal+' 中占比'},
    {l:'7 日回访率',v:d.revisitRate==null?'—':d.revisitRate+'%',s:'按独立 IP 去重'},
    {l:'本周新增',v:(d.newMats7||0)+' 素材 · '+(d.newUsers7||0)+' 用户',s:'较上周见 KPI 卡环比'}
  ]
  el.innerHTML=items.map(function(it){
    return '<div class="health-row"><span style="color:var(--text-3,#8a93a5)">'+it.l+'<span style="display:block;font-size:11px;opacity:.7">'+it.s+'</span></span><b style="font-size:14px">'+it.v+'</b></div>'
  }).join('')
}
async function renderGovernance(){
  var el=$('dashGovernance');if(!el)return
  el.innerHTML='<div style="text-align:center;opacity:.5;padding:14px;font-size:12px">统计中...</div>'
  var r=await api('/api/admin/governance')
  if(!r||!r.ok){el.innerHTML='<div class="dash-empty">治理数据加载失败</div>';return}
  var d=r.data||{}
  var rows=[
    {k:'noCover',label:'素材缺封面',total:d.noCoverTotal||0,items:(d.noCover||[]).slice(0,5),tab:'materials'},
    {k:'noPoster',label:'活动缺海报',total:d.noPosterTotal||0,items:(d.noPoster||[]).slice(0,5),tab:'activities'},
    {k:'noTags',label:'素材缺标签',total:d.noTagsTotal||0,items:(d.noTags||[]).slice(0,5),tab:'materials'}
  ]
  el.innerHTML=rows.map(function(g){
    return '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;margin-bottom:5px"><span style="color:var(--text-2,#9AA3B5)">'+g.label+'</span><span style="font-weight:800;'+(g.total>0?'color:#fbbf24':'color:var(--text-3,#8a93a5)')+'">'+g.total+'</span></div>'
      +(g.items.length?g.items.map(function(it){return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:3px 0;border-bottom:1px dashed rgba(128,128,128,.12)"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(it.title)+'">'+esc(it.title)+'</span></div>'}).join('')
        :'<div style="font-size:11.5px;color:var(--text-3,#8a93a5)">全部达标 ✓</div>')
      +'</div>'
  }).join('')
}
async function openTodoPreview(tab,label){
  var ov=$('todoPreview');if(!ov)return
  _todoPreviewMeta={tab:tab,label:label}
  $('tpTitle').textContent=label+' · 明细预览'
  var go=$('tpGo');go.onclick=function(){closeTodoPreview();switchTab(tab)}
  $('tpBody').innerHTML=loadingHTML()
  ov.classList.remove('hidden')
  var rows=[],timeKey='created_at'
  try{
    if(tab==='review'){
      var r=await api('/api/materials?status=pending_review');rows=(r.data||[]).slice(0,6).map(m=>({t:'《'+materialTitle(m.title)+'》 · '+esc(m.author||''),time:m.created_at}))
    }else if(tab==='articleReview'){
      var r2=await api('/api/review-queue');rows=(r2.data||[]).filter(x=>String(x.status||'').indexOf('pending')>-1).slice(0,6).map(a=>({t:esc(a.title||'无题文稿')+' · '+esc(a.author_name||a.author||''),time:a.created_at||a.submitted_at}))
    }else if(tab==='ugcReview'){
      var r3=await api('/api/admin/ugc-review');var list=Array.isArray(r3.data)?r3.data:((r3.data&&r3.data.items)||[])
      rows=list.filter(x=>x.status==='pending').slice(0,6).map(x=>({t:esc(x.title||x.content||x.type||'UGC 内容')+' · '+esc(x.author_name||x.user_id||''),time:x.created_at}))
    }else if(tab==='reports'){
      var r4=await api('/api/admin/reports');rows=((r4.data||[]).filter(x=>x.status==='pending')).slice(0,6).map(x=>({t:esc(x.reason||x.target_type||'举报')+' · '+(x.target_title?('《'+esc(x.target_title)+'》'):''),time:x.created_at}))
    }
  }catch(e){rows=[]}
  $('tpBody').innerHTML=rows.length
    ? rows.map(r=>`<div class="tp-row"><span style="color:var(--gold,#D4AF37);font-size:11px">●</span><span class="t">${r.t||'—'}</span><span class="time">${esc(String(r.time||'').slice(0,16).replace('T',' '))}</span></div>`).join('')
    : '<div class="dash-empty">当前没有待处理项，干得漂亮</div>'
}
function closeTodoPreview(){
  var ov=$('todoPreview');if(ov)ov.classList.add('hidden')
  _todoPreviewMeta=null
}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('todoPreview').classList.contains('hidden'))closeTodoPreview()})
async function copyWeeklyReport(){
  try{
    var s=(await api('/api/admin/stats')).data||{}
    var acc=null
    try{acc=(await api('/api/admin/access-logs/stats?days=7')).data||{}}catch(e){}
    var up7=(s.uploadTrend||[]).reduce((a,x)=>a+x.count,0),dl7=(s.dlTrend||[]).reduce((a,x)=>a+x.count,0)
    var u7=(s.userTrend||[]).reduce((a,x)=>a+x.count,0)
    var lines=[
      '【融媒体中心素材平台 · 周报】',
      '统计周期：近 7 日（'+new Date(Date.now()-7*864e5).toISOString().slice(0,10)+' ~ '+new Date().toISOString().slice(0,10)+'）','',
      '一、素材供给：新增上传 '+up7+' 份，素材总量 '+s.materials+' 份；待审核 '+(s.pending_review||0)+' 份。',
      '二、使用情况：下载 '+dl7+' 次，累计下载 '+s.downloads+' 次。',
      '三、用户增长：新增注册 '+u7+' 人，学生总数 '+s.users+' 人。'
    ]
    if(acc&&acc.overview){lines.push('四、平台访问：访问 '+acc.overview.total_visits+' 次，独立访客 '+acc.overview.unique_ips+' 人。')}
    lines.push('','—— 由管理后台一键生成')
    var text=lines.join('\n')
    if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text);toast('周报已复制到剪贴板')}
    else{var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('周报已复制到剪贴板')}
  }catch(e){toast('生成失败：网络异常')}
}

/* ── 审核队列 ── */
function setReviewView(v){currentReviewView=v;$('reviewViewToggle').children[0].classList.toggle('active',v==='list');$('reviewViewToggle').children[1].classList.toggle('active',v==='gallery');$('reviewListView').classList.toggle('hidden',v!=='list');$('reviewGalleryView').classList.toggle('hidden',v!=='gallery');loadReview()}

function wfButtons(m){
  let btns=''
  if(m.status==='pending_review') btns=`<button class="btn btn-success btn-sm" data-action="review" data-id="${m.id}" data-sub="approve"> ${at('act.approve')}</button> <button class="btn btn-danger btn-sm" data-action="review" data-id="${m.id}" data-sub="reject"> ${at('act.reject')}</button>`
  else if(m.status==='rejected') btns=`<button class="btn btn-success btn-sm" data-action="review" data-id="${m.id}" data-sub="approve"> ${at('act.approve')}</button>`
  else if(m.status==='approved') btns=`<button class="btn btn-gold btn-sm" data-action="review" data-id="${m.id}" data-sub="publish"> ${at('act.publish')}</button> <button class="btn btn-outline btn-sm" data-action="review" data-id="${m.id}" data-sub="archive"> ${at('act.archive')}</button>`
  else if(m.status==='published') btns=`<button class="btn btn-outline btn-sm" data-action="review" data-id="${m.id}" data-sub="archive"> ${at('act.archive')}</button>`
  else if(m.status==='archived') btns=`<button class="btn btn-gold btn-sm" data-action="review" data-id="${m.id}" data-sub="publish"> ${at('act.publish')}</button> <button class="btn btn-success btn-sm" data-action="review" data-id="${m.id}" data-sub="unarchive"> ${at('act.restore')}</button>`
  else if(m.status==='draft') btns=`<span style="font-size:11px;color:var(--text-3)">${at('act.waiting')}</span>`
  // 运营批（2026-09-22）：精选切换（已通过/已发布素材可用；featured 位独立于状态机）
  if(m.status==='published'||m.status==='approved'){
    btns += m.featured
      ? ` <button class="btn btn-outline btn-sm" data-action="review" data-id="${m.id}" data-sub="unfeature" title="取消精选" style="color:#d4af37;border-color:#d4af37"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> 已精选</button>`
      : ` <button class="btn btn-outline btn-sm" data-action="review" data-id="${m.id}" data-sub="feature" title="设为精选（作者 +10 贡献值）" style="color:var(--text-2)"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> 精选</button>`
  }
  return btns
}

function thumbHTML(m){
  if(m.has_thumb && m.thumb_filename) return `<img src="/api/thumbs/${m.thumb_filename}" alt="" loading="lazy" decoding="async">`
  return `<span style="font-size:40px;opacity:.5">${typeIcons[typeToKey(m.type)]||'FILE'}</span>`
}

function buildGalleryCards(list, isReview){
  if(!list.length) return '<div style="grid-column:1/-1">'+emptyStateHTML({icon:'folder',title:at('empty.materials'),sm:true})+'</div>'
  return list.map(m=>{
    const sel=isReview?selectedReviews:selectedMats
    return `<div class="gallery-card${sel.has(m.id)?' selected':''}" data-sel="${isReview?'review':'mat'}" data-id="${m.id}">
      <div class="select-box" data-selbox="1"></div>
      <div class="thumb">
        ${thumbHTML(m)}
        <span class="status-badge status-pill ${m.status}">${statusLabel(m.status)}</span>
        <span class="type-tag">${typeLabel(m.type)}</span>
      </div>
      <div class="meta">
        <div class="title" title="${esc(materialTitle(m.title))}">${esc(materialTitle(m.title))}</div>
        <div class="info"><span> ${esc(collegeName(m.college).slice(0,6))}</span><span class="dot"></span><span> ${esc(m.author)}</span></div>
      </div>
      <div class="actions">${wfButtons(m)}</div>
    </div>`
  }).join('')
}

function toggleAllReview(){
  const ck=$('reviewSelectAll'), rows=document.querySelectorAll('#reviewBody .row-check')
  rows.forEach(r=>{r.checked=ck.checked
    const id=Number(r.dataset.id)
    ck.checked?selectedReviews.add(id):selectedReviews.delete(id)
  })
  updateBatchBar()
}

function toggleAllMat(){
  const ck=$('matSelectAll'), rows=document.querySelectorAll('#materialBody .row-check')
  rows.forEach(r=>{r.checked=ck.checked
    const id=Number(r.dataset.id)
    ck.checked?selectedMats.add(id):selectedMats.delete(id)
  })
  if(currentMatView==='gallery') loadMaterials()
  updateBatchBar()
}

function toggleReviewSelect(id,ev){
  if(ev&&ev.target.closest('button')) return
  selectedReviews.has(id)?selectedReviews.delete(id):selectedReviews.add(id)
  updateBatchBar()
  if(currentReviewView==='list'){const cb=document.querySelector(`#reviewBody .row-check[data-id="${id}"]`);if(cb)cb.checked=selectedReviews.has(id)}
  else{const card=document.querySelector(`#reviewGalleryView .gallery-card[data-id="${id}"]`);if(card)card.classList.toggle('selected',selectedReviews.has(id))}
}

function toggleMatSelect(id,ev){
  if(ev&&ev.target.closest('button')) return
  selectedMats.has(id)?selectedMats.delete(id):selectedMats.add(id)
  updateBatchBar()
  if(currentMatView==='list'){const cb=document.querySelector(`#materialBody .row-check[data-id="${id}"]`);if(cb)cb.checked=selectedMats.has(id)}
  else{const card=document.querySelector(`#matGalleryView .gallery-card[data-id="${id}"]`);if(card)card.classList.toggle('selected',selectedMats.has(id))}
}

function updateBatchBar(){
  const total=selectedMats.size+selectedReviews.size
  $('batchCount').textContent=at('batch.selected')+' '+total+' '+at('batch.items')
  $('batchBar').classList.toggle('active',total>0)
}

async function batchAction(action, reason){
  const ids=[...selectedMats,...selectedReviews]
  if(!ids.length) return
  if(action==='delete'&&!confirm(at('t.confirmDel',{n:ids.length})))return
  if(action==='reject'&&!reason) { openBatchReject(); return }
  let ok=0,err=0
  for(const id of ids){
    const a=action==='delete'?{method:'DELETE',path:`/api/materials/${id}`}:{method:'POST',path:'/api/materials/review',body:{material_id:id,action,reason:reason||''}}
    const d=action==='delete'?await api(a.path,{method:'DELETE'}):await api(a.path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a.body)})
    d.ok?ok++:err++
  }
  toast(at('t.batchDone',{action:actionLabel(action),ok:ok,fail:err}))
  selectedMats.clear();selectedReviews.clear();updateBatchBar()
  if(document.querySelector('#tab-review:not(.hidden)')) loadReview()
  if(document.querySelector('#tab-materials:not(.hidden)')) loadMaterials()
  loadDashboard()
}

function openBatchReject(){
  var ids=[...selectedMats,...selectedReviews]
  if(!ids.length){toast('请先勾选要退回的素材');return}
  $('brCount').textContent='（已选 '+ids.length+' 条）'
  $('brReason').value=''
  var m=$('batchRejectModal');m.style.display='flex'
}
function closeBatchReject(){
  var m=$('batchRejectModal');if(m)m.style.display='none'
  articleRejectMode=false
}
async function confirmBatchReject(){
  var reason=$('brReason').value.trim()
  if(!reason){toast('请填写退回原因');return}
  closeBatchReject()
  if(articleRejectMode){ batchArticleReview('reject', reason); return }
  batchAction('reject', reason)
}

async function loadReview(){
  const st=$('reviewFilter').value,q=$('reviewSearch').value.trim()
  let url='/api/materials?status='+st
  if(q) url+='&q='+encodeURIComponent(q)
  $('reviewBody').innerHTML='<tr><td colspan="9">'+loadingHTML()+'</td></tr>'
  const d=await api(url)
  if(!d.ok){$('reviewBody').innerHTML='<tr><td colspan="9">'+errorHTML()+'</td></tr>';$('reviewGalleryView').innerHTML=errorHTML();return}
  const list=d.data||[]
  $('reviewCount').innerHTML=(at('count.total')?at('count.total')+' ':'')+'<span data-count="'+list.length+'">0</span> '+at('count.records');countUpAll($('reviewCount'))
  // 运营批（2026-09-22）：审核 SLA 提醒——pending_review 超过 24 小时计数横幅
  var slaBox=$('reviewSlaBanner')
  if(slaBox){
    var overdue=list.filter(function(m){return m.status==='pending_review'&&m.created_at&&(Date.now()-new Date(m.created_at.replace(' ','T')))>24*3600*1000}).length
    if(overdue>0){slaBox.style.display='';slaBox.innerHTML='⏰ <b>'+overdue+'</b> 条待审素材已超过 24 小时未处理，请尽快审核（承诺 SLA：24 小时内）'}
    else slaBox.style.display='none'
  }
  // 列表视图
  $('reviewBody').innerHTML=list.length?list.map(m=>`<tr>
    <td><input type="checkbox" class="row-check" data-id="${m.id}" ${selectedReviews.has(m.id)?'checked':''}></td>
    <td>${m.id}</td><td><b>${esc(materialTitle(m.title))}</b></td><td>${typeLabel(m.type)}</td><td>${esc(collegeName(m.college))}</td><td>${esc(m.author)}</td>
    <td>${(m.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</td>
    <td style="font-size:11px;color:var(--text-3)">${esc((m.created_at||'').slice(0,10))}</td>
    <td class="cell-actions">${wfButtons(m)}</td></tr>`).join(''):`<tr><td colspan="9">${emptyStateHTML({icon:'search',title:at('empty.data'),sm:true})}</td></tr>`
  // 画廊视图
  $('reviewGalleryView').innerHTML=buildGalleryCards(list,true)
}

async function reviewMaterial(id,action){
  let reason=''
  if(action==='reject'||action==='archive'){
    reason=(prompt(at('t.reviewPrompt',{action:actionLabel(action)}))||'').trim()
    if(action==='reject'&&!reason){toast('退回必须填写原因');return}
  }
  const d=await api('/api/materials/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({material_id:id,action,reason})})
  if(d.ok){toast(d.message||at('t.reviewDone',{action:actionLabel(action)}));loadReview();loadDashboard();if(typeof loadMaterials==='function')loadMaterials()}
  else toast(d.message||at('t.fail'))
}

/* ── 素材库 ── */
function setMaterialsView(v){currentMatView=v;$('btnViewList').classList.toggle('active',v==='list');$('btnViewList').setAttribute('aria-pressed',v==='list');$('btnViewGallery').classList.toggle('active',v==='gallery');$('btnViewGallery').setAttribute('aria-pressed',v==='gallery');$('matListView').classList.toggle('hidden',v!=='list');$('matGalleryView').classList.toggle('hidden',v!=='gallery');loadMaterials()}

let matSearchT
function debounceLoad(){clearTimeout(matSearchT);matSearchT=setTimeout(loadMaterials,350)}
let reviewSearchT
function debounceLoadReview(){clearTimeout(reviewSearchT);reviewSearchT=setTimeout(loadReview,350)}

async function loadMaterials(){
  const q=$('materialSearch').value.trim(),st=$('materialStatusFilter').value
  const type=$('materialTypeFilter').value,college=$('materialCollegeFilter').value
  let url='/api/materials?'
  if(st!=='all') url+='status='+st+'&'
  if(type) url+='type='+encodeURIComponent(type)+'&'
  if(college) url+='college='+encodeURIComponent(college)+'&'
  if(q) url+='q='+encodeURIComponent(q)
  $('materialBody').innerHTML='<tr><td colspan="9">'+loadingHTML()+'</td></tr>'
  const d=await api(url)
  if(!d.ok){$('materialBody').innerHTML='<tr><td colspan="9">'+errorHTML()+'</td></tr>';$('matGalleryView').innerHTML=errorHTML();return}
  const list=d.data||[]
  $('materialCount').innerHTML=(at('count.total')?at('count.total')+' ':'')+'<span data-count="'+list.length+'">0</span> '+at('count.records');countUpAll($('materialCount'))
  // 列表视图
  $('materialBody').innerHTML=list.length?list.map(m=>{
    const stLabel=statusLabel(m.status)
    return `<tr>
    <td><input type="checkbox" class="row-check" data-id="${m.id}" ${selectedMats.has(m.id)?'checked':''}></td>
    <td>${m.id}</td><td><b>${esc(materialTitle(m.title))}</b></td><td>${typeLabel(m.type)}</td><td>${esc(collegeName(m.college))}</td><td>${esc(m.author)}</td>
    <td><span class="status-pill ${m.status}">${stLabel}</span></td>
    <td><span data-count="${m.downloads||0}">0</span></td><td><span data-count="${m.views||0}">0</span></td>
    <td class="cell-actions"><button class="btn btn-gold btn-sm" data-action="edit" data-id="${m.id}">${at('btn.edit')}</button>${wfButtons(m)}</td></tr>`
  }).join(''):`<tr><td colspan="10">${emptyStateHTML({icon:'folder',title:at('empty.materials'),sm:true})}</td></tr>`
  countUpAll($('materialBody'))
  // 画廊视图
  $('matGalleryView').innerHTML=buildGalleryCards(list,false)
}

async function deleteMaterial(id){
  if(!confirm(at('t.confirmDelOne')))return
  const d=await api('/api/materials/'+id,{method:'DELETE'})
  if(d.ok){toast(at('t.deleted'));loadMaterials();loadDashboard()}
  else toast(d.message||at('t.delFail'))
}

/* ── 活动管理 ── */
var pendingPosterFile=null
function handlePosterSelect(files){
  if(!files||!files.length) return
  pendingPosterFile=files[0]
  var preview=$('actPosterPreview'),img=$('actPosterImg'),nameEl=$('actPosterName'),sizeEl=$('actPosterSize')
  preview.style.display='block'
  if(img._lastUrl)URL.revokeObjectURL(img._lastUrl);var newUrl=URL.createObjectURL(pendingPosterFile);img._lastUrl=newUrl;img.src=newUrl
  nameEl.textContent=pendingPosterFile.name
  sizeEl.textContent=fmtFileSize(pendingPosterFile.size)
}
function clearPosterFile(){
  pendingPosterFile=null
  $('actPosterPreview').style.display='none'
  $('actPosterFile').value=''
}
async function loadActivities(){
  $('activityBody').innerHTML='<tr><td colspan="6">'+loadingHTML()+'</td></tr>'
  const d=await api('/api/activities')
  if(!d.ok){$('activityBody').innerHTML='<tr><td colspan="6">'+errorHTML()+'</td></tr>';return}
  const list=d.data||[]
  const stl={ongoing:at('ast.ongoing'),upcoming:at('ast.upcoming'),ended:at('ast.ended')}
  $('activityBody').innerHTML=list.length?list.map(a=>{
    var posterHtml=a.poster?'<img src="/api/posters/'+esc(a.poster)+'" style="width:80px;height:45px;object-fit:cover;border-radius:4px" loading="lazy" decoding="async">':'<span style="font-size:11px;color:var(--text-3)">'+at('actf.noPoster')+'</span>'
    return '<tr><td>'+a.id+'</td><td>'+posterHtml+'</td><td><b>'+esc(activityTitle(a.title))+'</b></td><td>'+esc(a.date)+'</td><td><span class="status-pill '+esc(a.status)+'">'+(stl[a.status]||a.status)+'</span></td><td class="cell-actions"><button class="btn btn-outline btn-sm" data-action="act-signcode" data-id="'+esc(a.id)+'" data-title="'+esc(a.title)+'">签到码</button><button class="btn btn-outline btn-sm" data-action="act-joins" data-id="'+esc(a.id)+'" data-title="'+esc(a.title)+'">报名名单</button><button class="btn btn-gold btn-sm" data-action="edit-activity" data-id="'+esc(a.id)+'">'+at('btn.edit')+'</button><button class="btn btn-danger btn-sm" data-action="del-activity" data-id="'+esc(a.id)+'">'+at('btn.delete')+'</button></td></tr>'
  }).join(''):'<tr><td colspan="6">'+emptyStateHTML({icon:'check',title:at('empty.activities'),sm:true})+'</td></tr>'
}
async function publishActivity(){
  const title=$('actTitle').value.trim(),date=$('actDate').value.trim(),desc=$('actDesc').value.trim(),status=$('actStatus').value
  if(!title||!date){toast(at('actf.needTitle'));return}
  var btn=event.target
  var origText=btn.textContent
  btn.disabled=true;btn.textContent=at('actf.publishing')
  var fd=new FormData()
  fd.append('title',title);fd.append('date',date);fd.append('description',desc);fd.append('status',status)
  if(pendingPosterFile) fd.append('poster',pendingPosterFile)
  var d=await api('/api/activities',{method:'POST',body:fd})
  btn.disabled=false;btn.textContent=origText
  if(d.ok){toast(at('actf.published'));$('actTitle').value='';$('actDate').value='';$('actDesc').value='';clearPosterFile();loadActivities();loadDashboard()}
  else toast(d.message||at('t.retry'))
}
async function deleteActivity(id){
  if(!confirm(at('t.confirmDelAct')))return
  const d=await api('/api/activities',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})})
  if(d.ok){toast(at('t.deleted'));loadActivities()}
  else toast(d.message||at('t.delFail'))
}

/* ═══════════ 首页画廊管理（P0-2 CMS 化） ═══════════ */
var pendingGalleryFile=null
var _galList=[]
function handleGallerySelect(files){
  if(!files||!files.length) return
  pendingGalleryFile=files[0]
  var preview=$('galPreview'),img=$('galPreviewImg'),nameEl=$('galPreviewName'),sizeEl=$('galPreviewSize')
  preview.style.display='block'
  if(img._lastUrl)URL.revokeObjectURL(img._lastUrl)
  var newUrl=URL.createObjectURL(pendingGalleryFile);img._lastUrl=newUrl;img.src=newUrl
  nameEl.textContent=pendingGalleryFile.name
  sizeEl.textContent=fmtFileSize(pendingGalleryFile.size)
}
function clearGalleryFile(){
  pendingGalleryFile=null
  $('galPreview').style.display='none'
  $('galFile').value=''
}
async function loadGallery(){
  $('galList').innerHTML=skeletonCardsHTML(4)
  const d=await api('/api/admin/home-gallery')
  if(!d.ok){$('galList').innerHTML=errorHTML();return}
  _galList=d.data||[]
  $('galCount').textContent=_galList.length
  $('galList').innerHTML=_galList.length?_galList.map(galItemHTML).join(''):emptyStateHTML({icon:'image',title:at('gal.empty'),sm:true})
}
function galItemHTML(g,i){
  var pill=g.is_visible?'<span class="status-pill published">'+at('gal.shown')+'</span>':'<span class="status-pill draft">'+at('gal.hidden')+'</span>'
  var upDisabled=i===0?' disabled':''
  var downDisabled=i===_galList.length-1?' disabled':''
  return '<div class="gal-card'+(g.is_visible?'':' gal-off')+'" data-gid="'+g.id+'">'
    +'<div class="gal-thumb"><img src="'+esc(g.image)+'" alt="'+esc(g.title)+'" loading="lazy" decoding="async">'
    +'<span class="gal-order">'+(i+1)+'</span>'+pill+'</div>'
    +'<div class="gal-fields">'
    +'<input type="text" class="gal-title-input" id="galTitle_'+g.id+'" value="'+esc(g.title)+'" maxlength="30" aria-label="'+at('gal.title')+'">'
    +'<div class="gal-chk-row">'
    +'<label class="gal-chk"><input type="checkbox" id="galWide_'+g.id+'"'+(g.wide?' checked':'')+'> '+at('gal.wide')+'</label>'
    +'<label class="gal-chk"><input type="checkbox" id="galTall_'+g.id+'"'+(g.tall?' checked':'')+'> '+at('gal.tall')+'</label>'
    +'</div>'
    +'<div class="gal-actions">'
    +'<button class="btn btn-sm" onclick="moveGalleryItem('+g.id+',-1)" title="'+at('gal.moveUp')+'" aria-label="'+at('gal.moveUp')+'"'+upDisabled+'>↑</button>'
    +'<button class="btn btn-sm" onclick="moveGalleryItem('+g.id+',1)" title="'+at('gal.moveDown')+'" aria-label="'+at('gal.moveDown')+'"'+downDisabled+'>↓</button>'
    +'<button class="btn btn-sm" onclick="toggleGalleryItem('+g.id+')">'+(g.is_visible?at('gal.hide'):at('gal.show'))+'</button>'
    +'<button class="btn btn-gold btn-sm" id="galSaveBtn_'+g.id+'" onclick="saveGalleryItem('+g.id+')">'+at('gal.save')+'</button>'
    +'<button class="btn btn-danger btn-sm" onclick="deleteGalleryItem('+g.id+')">'+at('btn.delete')+'</button>'
    +'</div>'
    +'</div></div>'
}
async function addGalleryItem(btn){
  var title=$('galTitle').value.trim()
  if(!title){toast(at('gal.needTitle'));return}
  if(!pendingGalleryFile){toast(at('gal.needFile'));return}
  var origText=btn.textContent
  btn.disabled=true;btn.textContent=at('gal.saving')
  var fd=new FormData()
  fd.append('title',title)
  fd.append('wide',$('galWide').checked?'1':'0')
  fd.append('tall',$('galTall').checked?'1':'0')
  fd.append('image',pendingGalleryFile)
  var d=await api('/api/admin/home-gallery',{method:'POST',body:fd})
  btn.disabled=false;btn.textContent=origText
  if(d.ok){
    toast(at('gal.added'))
    $('galTitle').value='';$('galWide').checked=false;$('galTall').checked=false
    clearGalleryFile();loadGallery()
  } else toast(d.message||at('t.retry'))
}
async function saveGalleryItem(id){
  var btn=$('galSaveBtn_'+id)
  var origText=btn.textContent
  btn.disabled=true;btn.textContent=at('gal.saving')
  var fd=new FormData()
  fd.append('title',$('galTitle_'+id).value.trim())
  fd.append('wide',$('galWide_'+id).checked?'1':'0')
  fd.append('tall',$('galTall_'+id).checked?'1':'0')
  var d=await api('/api/admin/home-gallery/'+id,{method:'PUT',body:fd})
  btn.disabled=false;btn.textContent=origText
  if(d.ok){toast(at('gal.updated'));loadGallery()}
  else toast(d.message||at('t.retry'))
}
async function toggleGalleryItem(id){
  const d=await api('/api/admin/home-gallery/'+id+'/toggle',{method:'POST'})
  if(d.ok) loadGallery()
  else toast(d.message||at('t.retry'))
}
async function moveGalleryItem(id,dir){
  var idx=-1
  for(var i=0;i<_galList.length;i++){ if(_galList[i].id===id){idx=i;break} }
  if(idx<0) return
  var ni=idx+dir
  if(ni<0||ni>=_galList.length) return
  var arr=_galList.slice()
  var tmp=arr[idx];arr[idx]=arr[ni];arr[ni]=tmp
  var items=arr.map(function(x,i){ return {id:x.id,sort_order:i} })
  const d=await api('/api/admin/home-gallery/reorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(items)})
  if(d.ok) loadGallery()
  else toast(d.message||at('t.retry'))
}
async function deleteGalleryItem(id){
  if(!confirm(at('gal.confirmDel'))) return
  const d=await api('/api/admin/home-gallery/'+id,{method:'DELETE'})
  if(d.ok){toast(at('gal.deleted'));loadGallery()}
  else toast(d.message||at('t.retry'))
}

/* ── 编辑活动 ── */
var pendingEditPosterFile=null
function handleEditPosterSelect(files){
  if(!files||!files.length) return
  pendingEditPosterFile=files[0]
  var preview=$('editActPosterPreview'),img=$('editActPosterImg'),nameEl=$('editActPosterName'),sizeEl=$('editActPosterSize')
  preview.style.display='block'
  if(img._lastUrl)URL.revokeObjectURL(img._lastUrl);var newUrl=URL.createObjectURL(pendingEditPosterFile);img._lastUrl=newUrl;img.src=newUrl
  nameEl.textContent=pendingEditPosterFile.name
  sizeEl.textContent=fmtFileSize(pendingEditPosterFile.size)
}
function clearEditPosterFile(){
  pendingEditPosterFile=null
  $('editActPosterPreview').style.display='none'
  $('editActPosterFile').value=''
}
async function openEditActivity(id){
  const d=await api('/api/activities')
  const a=(d.data||[]).find(function(x){return x.id===id})
  if(!a){toast(at('t.retry'));return}
  $('editActId').value=a.id
  $('editActTitle').value=a.title||''
  $('editActDate').value=a.date||''
  $('editActDesc').value=a.description||''
  var sel=$('editActStatus')
  for(var i=0;i<sel.options.length;i++){if(sel.options[i].value===a.status){sel.selectedIndex=i;break}}
  rebuildCustomSelect(sel)
  var posterDiv=$('editActPosterCurrent')
  if(a.poster){
    posterDiv.innerHTML='<img src="/api/posters/'+esc(a.poster)+'" style="width:160px;height:90px;object-fit:cover;border-radius:8px;border:1px solid var(--border)" loading="lazy" decoding="async">'
  } else {
    posterDiv.innerHTML='<span style="font-size:12px;color:var(--text-3)">'+at('edit.noPoster')+'</span>'
  }
  clearEditPosterFile()
  $('editActModal').style.display='flex'
}
function closeEditAct(){
  $('editActModal').style.display='none'
  pendingEditPosterFile=null
}
async function saveEditAct(){
  var id=$('editActId').value
  if(!id) return
  var btn=$('editActSaveBtn')
  var orig=btn.textContent
  btn.disabled=true;btn.textContent=at('edit.saving')
  try{
    var fd=new FormData()
    fd.append('title',$('editActTitle').value.trim())
    fd.append('date',$('editActDate').value.trim())
    fd.append('description',$('editActDesc').value.trim())
    fd.append('status',$('editActStatus').value)
    if(pendingEditPosterFile) fd.append('poster',pendingEditPosterFile)
    var d=await api('/api/activities/'+id,{method:'PUT',body:fd})
    btn.disabled=false;btn.textContent=orig
    if(d.ok){toast(at('edit.saved'));closeEditAct();loadActivities();loadDashboard()}
    else toast(d.message||at('t.retry'))
  }catch(e){btn.disabled=false;btn.textContent=orig;toast(at('t.retry'))}
}

/* ── 编辑素材 ── */
var pendingEditCoverFile=null
function handleEditCoverSelect(files){
  if(!files||!files.length) return
  pendingEditCoverFile=files[0]
  var preview=$('editMatCoverPreview'),img=$('editMatCoverImg'),nameEl=$('editMatCoverName'),sizeEl=$('editMatCoverSize')
  preview.style.display='block'
  if(img._lastUrl)URL.revokeObjectURL(img._lastUrl);var newUrl=URL.createObjectURL(pendingEditCoverFile);img._lastUrl=newUrl;img.src=newUrl
  nameEl.textContent=pendingEditCoverFile.name
  sizeEl.textContent=fmtFileSize(pendingEditCoverFile.size)
}
function clearEditCoverFile(){
  pendingEditCoverFile=null
  $('editMatCoverPreview').style.display='none'
  $('editMatCoverFile').value=''
}
function updateEditSubOptions(type){
  var box=$('editMatSubOptions')
  if(!box)return
  var cfg=UPLOAD_SUB_OPTIONS[type]
  if(!cfg){
    box.classList.remove('open')
    setTimeout(function(){ if(!box.classList.contains('open')) box.innerHTML='' },350)
    return
  }
  var labelText=at(cfg.labelKey)
  var labelStyle='display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--text-2)'
  if(cfg.items){
    var html='<label for="editMatSubSelect" style="'+labelStyle+'">'+labelText+'</label>'
    html+='<select id="editMatSubSelect" class="cs-custom" aria-label="子类型"><option value="">'+at('edit.selectCollege')+'</option>'
    cfg.items.forEach(function(it){ html+='<option value="'+it+'">'+it+'</option>' })
    html+='</select>'
    box.innerHTML=html
    initCustomSelect($('editMatSubSelect'))
  } else if(cfg.itemKeys){
    var html='<label for="editMatSubSelect" style="'+labelStyle+'">'+labelText+'</label>'
    html+='<select id="editMatSubSelect" class="cs-custom" aria-label="子类型"><option value="">'+at('edit.selectCollege')+'</option>'
    cfg.itemKeys.forEach(function(k){ html+='<option value="'+at(k)+'">'+at(k)+'</option>' })
    html+='</select>'
    box.innerHTML=html
    initCustomSelect($('editMatSubSelect'))
  } else {
    var html='<label for="editMatSubSelect" style="'+labelStyle+'">'+labelText+'</label>'
    html+='<input id="editMatSubSelect" type="text" placeholder="'+at('upload.subOtherPh')+'" class="modal-input">'
    box.innerHTML=html
  }
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ box.classList.add('open') }) })
}
function setEditSubTypeValue(val){
  var sel=$('editMatSubSelect')
  if(!sel) return
  if(sel.tagName==='SELECT'){
    for(var i=0;i<sel.options.length;i++){
      if(sel.options[i].value===val||sel.options[i].textContent===val){ sel.selectedIndex=i; break }
    }
    rebuildCustomSelect(sel)
  } else {
    sel.value=val||''
  }
}
function getEditSubTypeValue(){
  var sel=$('editMatSubSelect')
  if(!sel) return ''
  if(sel.tagName==='SELECT'){ return sel.value } else { return sel.value.trim() }
}
async function openEditMaterial(id){
  const d=await api('/api/materials/'+id)
  var m=d.data||d
  if(!m||!m.id){toast(at('t.retry'));return}
  $('editMatId').value=m.id
  $('editMatTitle').value=m.title||''
  // 素材类型下拉（数据库与首页均用中文value）
  var typeSel=$('editMatType')
  var typeVal=m.type||''
  if(typeVal==='document') typeVal='文档' // 兼容历史英文值
  if(typeVal==='image') typeVal='图片'
  if(typeVal==='video') typeVal='视频'
  if(typeVal==='audio') typeVal='音频'
  if(typeVal==='other') typeVal='其他'
  for(var i=0;i<typeSel.options.length;i++){ if(typeSel.options[i].value===typeVal){ typeSel.selectedIndex=i; break } }
  rebuildCustomSelect(typeSel)
  // 触发子类型选项渲染
  updateEditSubOptions(typeVal)
  // 延迟设置子类型值（等渲染完成）
  setTimeout(function(){ setEditSubTypeValue(m.sub_type||'') },100)
  // 学院下拉
  var colSel=$('editMatCollege')
  colSel.innerHTML='<option value="">'+at('edit.selectCollege')+'</option>'+colleges.map(function(c){return '<option value="'+esc(c.name)+'">'+esc(collegeName(c.name))+'</option>'}).join('')
  if(m.college){
    for(var i=0;i<colSel.options.length;i++){ if(colSel.options[i].value===m.college){ colSel.selectedIndex=i; break } }
  }
  rebuildCustomSelect(colSel)
  $('editMatDesc').value=m.description||''
  $('editMatShotDate').value=m.shot_date||''
  $('editMatDriveUrl').value=m.drive_url||''
  $('editMatTags').value=Array.isArray(m.tags)?m.tags.join(','):m.tags||''
  // 当前封面
  var coverDiv=$('editMatCoverCurrent')
  if(m.has_thumb&&m.thumb_filename){
    coverDiv.innerHTML='<img src="/api/thumbs/'+esc(m.thumb_filename)+'" style="width:160px;height:90px;object-fit:cover;border-radius:8px;border:1px solid var(--border)" loading="lazy" decoding="async">'
  } else {
    coverDiv.innerHTML='<span style="font-size:12px;color:var(--text-3)">'+at('edit.noCover')+'</span>'
  }
  clearEditCoverFile()
  $('editMatModal').style.display='flex'
}
function closeEditMat(){
  $('editMatModal').style.display='none'
  pendingEditCoverFile=null
}
async function saveEditMat(){
  var id=$('editMatId').value
  if(!id) return
  var btn=$('editMatSaveBtn')
  var orig=btn.textContent
  btn.disabled=true;btn.textContent=at('edit.saving')
  try{
    if(pendingEditCoverFile){
      var fd=new FormData()
      fd.append('title',$('editMatTitle').value.trim())
      fd.append('college',$('editMatCollege').value)
      fd.append('type',$('editMatType').value)
      fd.append('description',$('editMatDesc').value.trim())
      fd.append('shot_date',$('editMatShotDate').value.trim())
      fd.append('drive_url',$('editMatDriveUrl').value.trim())
      fd.append('tags',$('editMatTags').value.trim())
      fd.append('sub_type',getEditSubTypeValue())
      fd.append('thumb',pendingEditCoverFile)
      var d=await api('/api/materials/'+id,{method:'PUT',body:fd})
    } else {
      var body={
        title:$('editMatTitle').value.trim(),
        college:$('editMatCollege').value,
        type:$('editMatType').value,
        description:$('editMatDesc').value.trim(),
        shot_date:$('editMatShotDate').value.trim(),
        drive_url:$('editMatDriveUrl').value.trim(),
        tags:$('editMatTags').value.trim(),
        sub_type:getEditSubTypeValue()
      }
      var d=await api('/api/materials/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    }
    btn.disabled=false;btn.textContent=orig
    if(d.ok){toast(at('edit.saved'));closeEditMat();loadMaterials()}
    else toast(d.message||at('t.retry'))
  }catch(e){btn.disabled=false;btn.textContent=orig;toast(at('t.retry'))}
}

/* ── 招新 / 用户 / 审计 ── */
async function loadRecruits(){
  $('recruitBody').innerHTML='<tr><td colspan="8">'+loadingHTML()+'</td></tr>'
  const d=await api('/api/recruits')
  if(!d.ok){$('recruitBody').innerHTML='<tr><td colspan="8">'+errorHTML()+'</td></tr>';return}
  const list=d.data||[]
  $('recruitCount').innerHTML=(at('count.total')?at('count.total')+' ':'')+'<span data-count="'+list.length+'">0</span> '+at('recruit.count');countUpAll($('recruitCount'))
  $('recruitBody').innerHTML=list.length?list.map(r=>`<tr><td><b>${esc(r.name)}</b></td><td>${esc(r.sid)}</td><td>${esc(r.grade)}</td><td>${esc(collegeName(r.college))}</td><td>${esc(r.email)}</td><td>${r.resume_file?`<a href="/api/recruits/${r.id}/resume" class="download-link" style="color:var(--primary);text-decoration:underline;cursor:pointer">${at('recruit.download')}</a>`:at('recruit.noResume')}</td><td>${esc(r.created_at)}</td><td class="cell-actions"><button class="btn btn-danger btn-sm" data-action="del-recruit" data-id="${r.id}" title="${at('act.delete')}">${at('act.delete')}</button></td></tr>`).join(''):`<tr><td colspan="8">${emptyStateHTML({icon:'mail',title:at('recruit.empty'),sm:true})}</td></tr>`
}
async function deleteRecruit(id){
  if(!confirm(at('recruit.deleteConfirm'))) return
  const r=await api('/api/recruits/'+id,{method:'DELETE'})
  if(r.ok){ toast(at('msg.deleted')); loadRecruits(); loadDashboard() }
  else toast(r.message||at('t.netFail'))
}
async function loadUsers(){
  const q=$('userSearch')?$('userSearch').value.trim():''
  const role=$('userRoleFilter')?$('userRoleFilter').value:''
  let url='/api/admin/users'
  if(q||role){const p=[];if(q)p.push('q='+encodeURIComponent(q));if(role)p.push('role='+encodeURIComponent(role));url+='?'+p.join('&')}
  $('userBody').innerHTML='<tr><td colspan="7">'+loadingHTML()+'</td></tr>'
  const d=await api(url)
  if(!d.ok){$('userBody').innerHTML='<tr><td colspan="7">'+errorHTML()+'</td></tr>';return}
  const list=d.data||[]
  $('userCount').innerHTML=(at('count.total')?at('count.total')+' ':'')+'<span data-count="'+list.length+'">0</span> '+at('users.count');countUpAll($('userCount'))
  $('userBody').innerHTML=list.length?list.map(u=>`<tr><td>${esc(u.id)}</td><td><b>${esc(u.name)}</b></td><td>${esc(collegeName(u.college)||'-')}</td><td>${esc(u.grade||'-')}</td><td><span class="status-pill ${u.is_admin?'published':'draft'}">${u.is_admin?at('users.admin'):at('users.student')}</span>${u.is_locked?' <span class="status-pill rejected">'+at('users.locked')+'</span>':''}</td><td>${esc(u.created_at||'-')}</td><td class="cell-actions">
    <select data-action="user-role-select" data-uid="${esc(u.id)}" onchange="setUserRole(this)" style="padding:4px 6px;font-size:12px;border:1px solid var(--border-strong);border-radius:7px;background:var(--card-elev);color:var(--text)" aria-label="设置角色">${['student','reporter','reviewer','editor','admin'].map(function(r){var cur=u.role||(u.is_admin?'admin':'student');return '<option value="'+r+'"'+(cur===r?' selected':'')+'>'+({admin:'管理员',editor:'学院编辑',reviewer:'审核员',reporter:'学生记者',student:'学生'}[r])+'</option>'}).join('')}</select>
    <button class="btn ${u.is_locked?'btn-success':'btn-danger'} btn-sm" data-action="user-lock" data-uid="${esc(u.id)}" data-val="${u.is_locked?1:0}">${u.is_locked?at('users.unlock'):at('users.lock')}</button>
    ${u.totp_enabled?'<button class="btn btn-sm" data-action="user-2fa-reset" data-uid="'+esc(u.id)+'" style="border:1px solid var(--border-strong);color:var(--warning,#d97706)">'+at('users.2faReset')+'</button>':''}
    <button class="btn btn-sm" data-action="user-reset-pwd" data-uid="${esc(u.id)}" data-name="${esc(u.name||'')}" title="生成随机临时密码" style="border:1px solid var(--border-strong)">重置密码</button>
  </td></tr>`).join(''):`<tr><td colspan="7">${emptyStateHTML({icon:'search',title:at('users.empty'),sm:true})}</td></tr>`
}
async function toggleUserRole(uid, isAdmin){
  if(!confirm(at(isAdmin?'users.demoteConfirm':'users.promoteConfirm'))) return
  const r=await api('/api/admin/users/'+encodeURIComponent(uid),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_admin:Number(!isAdmin)})})
  if(r.ok){ toast(at('msg.saved')); loadUsers() }
  else toast(r.message||at('t.netFail'))
}
async function toggleUserLock(uid, isLocked){
  if(!confirm(at(isLocked?'users.unlockConfirm':'users.lockConfirm'))) return
  const r=await api('/api/admin/users/'+encodeURIComponent(uid),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_locked:Number(!isLocked)})})
  if(r.ok){ toast(at('msg.saved')); loadUsers() }
  else toast(r.message||at('t.netFail'))
}
async function resetUser2FA(uid){
  if(!confirm(at('users.2faResetConfirm'))) return
  const r=await api('/api/admin/2fa/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:uid})})
  if(r.ok){ toast(r.message||at('msg.saved')); loadUsers() }
  else toast(r.message||at('t.netFail'))
}
async function loadAuditLogs(){
  $('auditBody').innerHTML='<tr><td colspan="8">'+loadingHTML()+'</td></tr>'
  const d=await api('/api/admin/audit-logs?limit=200')
  if(!d.ok){$('auditBody').innerHTML='<tr><td colspan="8">'+errorHTML()+'</td></tr>';return}
  const list=d.data||[]
  $('auditCount').innerHTML=(at('count.total')?at('count.total')+' ':'')+'<span data-count="'+list.length+'">0</span> '+at('audit.count');countUpAll($('auditCount'))
  $('auditBody').innerHTML=list.length?list.map(l=>`<tr><td>${l.id}</td><td>${l.material_id}</td><td>${esc(l.material_title||'')}</td><td><span class="tag">${esc(actionLabel(l.action))}</span></td><td>${esc(l.from_status?(statusLabel(l.from_status)):'—')} → <b>${esc(statusLabel(l.to_status))}</b></td><td>${esc(l.operator_name||'')}</td><td>${esc(l.reason||'—')}</td><td>${esc(l.created_at||'')}</td></tr>`).join(''):`<tr><td colspan="8">${emptyStateHTML({icon:'doc',title:at('audit.empty'),sm:true})}</td></tr>`
}

/* ── 访问日志 ── */
var accessPage=1, accessSearchT
function debounceLoadAccess(){clearTimeout(accessSearchT);accessSearchT=setTimeout(function(){accessPage=1;loadAccessLogs()},300)}

async function loadAccessLogs(){
  var days=$('accessDateFilter')?$('accessDateFilter').value:'30'
  var ipQ=$('accessIPSearch')?$('accessIPSearch').value.trim():''
  var regionQ=$('accessRegionSearch')?$('accessRegionSearch').value.trim():''
  var statsApi=api('/api/admin/access-logs/stats?days='+encodeURIComponent(days))
  var listApi=api('/api/admin/access-logs?page='+accessPage+'&pageSize=50'+(ipQ?'&ip='+encodeURIComponent(ipQ):'')+(regionQ?'&region='+encodeURIComponent(regionQ):''))
  var sd=await statsApi, ld=await listApi
  if(!sd.ok||!ld.ok){toast(at('t.netFail'));return}
  var stats=sd.data||{}, logs=ld.data||[], total=ld.total||0
  /* 概览卡片 */
  var ov=stats.overview||{}
  $('accessStatsRow').innerHTML=[
    ['access.totalVisits',ov.total_visits||0,'highlight'],
    ['access.uniqueIPs',ov.unique_ips||0,'success'],
    ['access.loggedInUsers',ov.logged_in_users||0,'']
  ].map(function(c){return '<div class="stat-card '+c[2]+'"><div class="num" data-count="'+c[1]+'">0</div><div class="label">'+at(c[0])+'</div></div>'}).join('')
  countUpAll($('accessStatsRow'))
  /* 区域统计 */
  var rs=stats.regionStats||[]
  $('accessRegionStats').innerHTML=rs.length?rs.map(function(r){
    var pct=ov.total_visits?Math.round(r.visits/ov.total_visits*100):0
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">'+
      '<span style="flex:1;font-weight:600">'+esc(r.region||at('access.noData'))+'</span>'+
      '<span style="color:var(--gold);font-weight:700">'+r.visits+'</span>'+
      '<span style="color:var(--text-3);font-size:11px">'+at('access.uniqueIPsShort')+': '+r.unique_ips+'</span>'+
      '<div style="width:60px;height:4px;background:var(--card);border-radius:2px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:var(--gold);transition:width .6s"></div></div>'+
    '</div>'
  }).join(''):emptyStateHTML({icon:'chart',title:at('access.noData'),sm:true})
  /* 页面统计 */
  var ps=stats.pageStats||[]
  $('accessPageStats').innerHTML=ps.length?ps.map(function(p){
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">'+
      '<span style="flex:1;font-weight:600">'+esc(p.path)+'</span>'+
      '<span style="color:var(--gold);font-weight:700">'+p.visits+'</span>'+
    '</div>'
  }).join(''):emptyStateHTML({icon:'chart',title:at('access.noData'),sm:true})
  /* 日志列表 */
  $('accessCount').innerHTML='<span data-count="'+total+'">0</span> '+at('count.records')
  countUpAll($('accessCount'))
  var pageNames={'/':'首页','/index.html':'首页','/admin.html':'管理后台','/user.html':'个人中心','/login.html':'登录'}
  $('accessBody').innerHTML=logs.length?logs.map(function(l){
    var regionText=l.region?(esc(l.region)+(l.city?' / '+esc(l.city):'')):'-'
    var pageText=pageNames[l.path]||l.path
    var uaShort=l.user_agent?esc(l.user_agent.slice(0,60)+(l.user_agent.length>60?'...':'')):'-'
    var userText=l.user_name?esc(l.user_name)+' ('+esc(l.user_id||'')+')':'<span style="color:var(--text-3)">游客</span>'
    return '<tr><td>'+l.id+'</td><td style="font-family:monospace;font-size:12px">'+esc(l.ip||'')+'</td><td>'+regionText+'</td><td>'+esc(pageText)+'</td><td>'+userText+'</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--text-3)" title="'+esc(l.user_agent||'')+'">'+uaShort+'</td><td style="white-space:nowrap;font-size:12px">'+esc(l.created_at||'')+'</td></tr>'
  }).join(''):'<tr><td colspan="7">'+emptyStateHTML({icon:'search',title:at('access.noData'),sm:true})+'</td></tr>'
  /* 分页 */
  var totalPages=Math.ceil(total/50)
  var pager=$('accessPager')
  if(totalPages>1){
    pager.innerHTML='<button class="btn btn-outline btn-sm" '+(accessPage<=1?'disabled':'')+' onclick="accessPage--; loadAccessLogs()">'+at('access.prev')+'</button>'+
      '<span style="font-size:13px;color:var(--text-2)">'+at('access.page')+' '+accessPage+' / '+totalPages+'</span>'+
      '<button class="btn btn-outline btn-sm" '+(accessPage>=totalPages?'disabled':'')+' onclick="accessPage++; loadAccessLogs()">'+at('access.next')+'</button>'
  } else { pager.innerHTML='' }
}

/* ── 启动 ── */
/* ═════════════════ 事件委托（onclick模板拼接替代） ═════════════ */
(function(){
  // 统计卡片 -> switchTab
  var sg=$('statsGrid')
  if(sg) sg.addEventListener('click',function(e){
    var c=e.target.closest('[data-tab]')
    if(c) switchTab(c.dataset.tab)
  })
  // 审核列表/素材表格 -> 审核/编辑按钮 + checkbox 选择
  ;['reviewBody','materialBody'].forEach(function(gid){
    var tb=$(gid)
    if(!tb) return
    tb.addEventListener('click',function(e){
      var b=e.target.closest('[data-action]')
      if(b){
        e.stopPropagation()
        var id=Number(b.dataset.id), sub=b.dataset.sub
        if(b.dataset.action==='review') reviewMaterial(id,sub)
        else if(b.dataset.action==='edit') openEditMaterial(id)
        return
      }
    })
    tb.addEventListener('change',function(e){
      if(!e.isTrusted) return
      var cb=e.target.closest('.row-check[data-id]')
      if(!cb) return
      var id=Number(cb.dataset.id)
      if(tb.id==='reviewBody') toggleReviewSelect(id)
      else toggleMatSelect(id)
    })
  })
  // 图库视图 -> 选择卡片
  ;['reviewGalleryView','matGalleryView'].forEach(function(gid){
    var gv=$(gid)
    if(!gv) return
    gv.addEventListener('click',function(e){
      var b=e.target.closest('[data-action]')
      if(b){
        e.stopPropagation()
        var bid=Number(b.dataset.id), sub=b.dataset.sub
        if(b.dataset.action==='review') reviewMaterial(bid,sub)
        else if(b.dataset.action==='edit') openEditMaterial(bid)
        return
      }
      var card=e.target.closest('[data-sel]')
      if(!card) return
      var id=Number(card.dataset.id)
      var isReview=card.dataset.sel==='review'
      if(isReview) toggleReviewSelect(id,e)
      else toggleMatSelect(id,e)
    })
  })
  // 招新记录 -> 删除
  var rb=$('recruitBody')
  if(rb) rb.addEventListener('click',function(e){
    var b=e.target.closest('[data-action="del-recruit"]')
    if(!b) return
    e.stopPropagation()
    deleteRecruit(Number(b.dataset.id))
  })
  // 活动管理 -> 编辑/删除
  var ab=$('activityBody')
  if(ab) ab.addEventListener('click',function(e){
    var b=e.target.closest('[data-action]')
    if(!b) return
    e.stopPropagation()
    var id=Number(b.dataset.id)
    if(b.dataset.action==='edit-activity') openEditActivity(id)
    else if(b.dataset.action==='act-signcode') showSignCode(Number(b.dataset.id), b.dataset.title)
    else if(b.dataset.action==='act-joins') showActJoins(Number(b.dataset.id), b.dataset.title)
    else if(b.dataset.action==='del-activity') deleteActivity(id)
  })
  // 用户管理 -> 角色切换/封禁
  var ub=$('userBody')
  if(ub) ub.addEventListener('click',function(e){
    var b=e.target.closest('[data-action]')
    if(!b) return
    e.stopPropagation()
    var uid=b.dataset.uid, val=b.dataset.val==='1'?1:0
    if(b.dataset.action==='user-role') toggleUserRole(uid,val)
    else if(b.dataset.action==='user-lock') toggleUserLock(uid,val)
    else if(b.dataset.action==='user-2fa-reset') resetUser2FA(uid)
    else if(b.dataset.action==='user-reset-pwd') resetUserPassword(uid, b.dataset.name)
  })
})()

var _myRole='admin'
var ROLE_NAV={
  admin:null,
  editor:['dashboard','review','materials','collections','activities','profile'],
  reviewer:['dashboard','review','articleReview','wallManage','ugcReview','reports','notifManage','profile'],
  reporter:[], student:[]
}
var ROLE_ZH={admin:'管理员',editor:'学院编辑',reviewer:'审核员',reporter:'学生记者',student:'普通用户'}
function applyRoleNav(role){
  var allow=ROLE_NAV[role]
  if(!allow) return
  document.querySelectorAll('.sidebar .nav-item[data-tab]').forEach(function(n){
    var t=n.getAttribute('data-tab')
    n.style.display=allow.includes(t)?'':'none'
  })
}
async function init(){
  const me=await api('/api/me')
  if(me.user&&(me.user.is_admin||['editor','reviewer'].includes(me.user.role))){currentUser=me.user;_myRole=me.user.role||(me.user.is_admin?'admin':'student');showMain();applyRoleNav(_myRole)}
  else if(me.user){location.href='/user.html'}
  else showLogin()
}
init()

/* ═════════════════ 上传素材功能 ═════════════════ */
var pendingFiles=[], pendingFile=null, pendingThumbBlob=null, pendingMeta={width:0,height:0,duration:0}
var UPLOAD_TYPE_ICONS={'图片':'IMG','视频':'VID','文档':'DOC','音频':'AUD','其他':'FILE'}

function openModal(id){ var el=$(id); el.classList.remove('hidden'); if(window._modalOnOpen) window._modalOnOpen(el) }
function closeModal(id){
  var el=$(id)
  var box=el.querySelector('.modal-box')
  if(box) box.classList.add('closing')
  el.classList.add('closing')
  if(window._modalOnClose) window._modalOnClose(el)
  setTimeout(function(){ el.classList.add('hidden'); el.classList.remove('closing'); if(box) box.classList.remove('closing') },180)
}

var UPLOAD_SUB_OPTIONS = {
  '图片': { labelKey:'upload.subFormat', items:['DNG','RAW','JPG','PNG','TIFF','PSD','HEIC','WEBP'] },
  '视频': { labelKey:'upload.subScene', itemKeys:['sub.air','sub.aerial','sub.ground','sub.timelapse','sub.slowmo','sub.transition','sub.interview','sub.event','sub.vlog','sub.promo'] },
  '文档': { labelKey:'upload.subDoc', itemKeys:['sub.ppt','sub.thesis','sub.notes','sub.template','sub.report','sub.lesson','sub.plan','sub.script'] },
  '音频': { labelKey:'upload.subAudio', itemKeys:['sub.music','sub.sfx','sub.voiceover','sub.live','sub.intro','sub.bgm'] },
  '其他': { labelKey:'upload.subOther', items:null }
}

function updateUploadSubOptions(type){
  var box=$('uploadSubOptions')
  if(!box)return
  var cfg=UPLOAD_SUB_OPTIONS[type]
  if(!cfg){
    box.classList.remove('open')
    setTimeout(function(){ if(!box.classList.contains('open')) box.innerHTML='' },350)
    return
  }
  var labelText=at(cfg.labelKey)
  var labelStyle='display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--text-2)'
  if(cfg.items){
    var html='<label for="uploadSubSelect" style="'+labelStyle+'">'+labelText+'</label>'
    html+='<select id="uploadSubSelect" class="cs-custom" aria-label="子类型"><option value="">'+at('upload.selectCollege')+'</option>'
    cfg.items.forEach(function(it){ html+='<option value="'+it+'">'+it+'</option>' })
    html+='</select>'
    box.innerHTML=html
    initCustomSelect($('uploadSubSelect'))
  } else if(cfg.itemKeys){
    var html='<label for="uploadSubSelect" style="'+labelStyle+'">'+labelText+'</label>'
    html+='<select id="uploadSubSelect" class="cs-custom" aria-label="子类型"><option value="">'+at('upload.selectCollege')+'</option>'
    cfg.itemKeys.forEach(function(k){ html+='<option value="'+at(k)+'">'+at(k)+'</option>' })
    html+='</select>'
    box.innerHTML=html
    initCustomSelect($('uploadSubSelect'))
  } else {
    var html='<label for="uploadSubSelect" style="'+labelStyle+'">'+labelText+'</label>'
    html+='<input id="uploadSubSelect" type="text" placeholder="'+at('upload.subOtherPh')+'" style="width:100%;padding:10px 14px;background:var(--card);border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;outline:none">'
    box.innerHTML=html
  }
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ box.classList.add('open') }) })
}

function openUploadModal(){
  pendingFiles=[];pendingFile=null;pendingThumbBlob=null;pendingMeta={width:0,height:0,duration:0}
  $('uploadPreview').style.display='none'
  $('uploadTitle').value='';$('uploadDesc').value='';$('uploadDate').value='';$('uploadTags').value='';$('uploadDrive').value=''
  $('uploadType').value=''
  rebuildCustomSelect($('uploadType'))
  $('uploadSubOptions').classList.remove('open')
  setTimeout(function(){ $('uploadSubOptions').innerHTML='' },350)
  $('uploadFile').value=''
  var sel=$('uploadCollege')
  sel.innerHTML='<option value="" data-i18n="upload.selectCollege">'+at('upload.selectCollege')+'</option>'+colleges.map(function(c){return '<option value="'+esc(c.name)+'">'+esc(collegeName(c.name))+'</option>'}).join('')
  rebuildCustomSelect(sel)
  openModal('uploadModal')
  startSpecularButtons()
}

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

  if(!files||!files.length){ clearUploadFile();return }
  var f=files[0]
  // 按角色上限校验（2026-10-23：管理员 20GB / 编辑·审核员 10GB / 学生记者 5GB / 普通 1GB）
  var _role = (currentUser && currentUser.is_admin) ? 'admin' : ((currentUser && currentUser.role) || 'student');
  var _maxMB = { admin: 20480, editor: 10240, reviewer: 10240, reporter: 5120, student: 1024 }[_role] || 1024;
  if(f.size > _maxMB*1024*1024){
    var _lbl = _maxMB >= 1024 ? (_maxMB/1024) + 'GB' : _maxMB + 'MB';
    toast(curLang === 'en' ? ('File too large (max ' + _lbl + ')') : ('文件超过上限（最大 ' + _lbl + '）'));
    return;
  }
  pendingFile=f
  generatePreview(pendingFile)
}

function fmtFileSize(b){if(!b)return'';if(b>1048576)return(b/1048576).toFixed(1)+'MB';if(b>1024)return(b/1024).toFixed(0)+'KB';return b+'B'}
function fmtDim(w,h){ if(!w||!h)return''; return w+'×'+h }
function fmtDuration(s){ if(!s)return''; if(s>=3600){var h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h+at('dur.hour')+m+at('dur.min')} if(s>=60){var m=Math.floor(s/60),sec=s%60;return m+at('dur.min')+sec+at('dur.sec')} return s+at('dur.sec') }

function loadImage(file){
  return new Promise(function(resolve,reject){
    var img=new Image();var url=URL.createObjectURL(file)
    img.onload=function(){URL.revokeObjectURL(url);resolve(img)}
    img.onerror=function(){URL.revokeObjectURL(url);reject()}
    img.src=url
  })
}
function readVideoMeta(file){
  return new Promise(function(resolve,reject){
    var video=document.createElement('video')
    video.preload='metadata'
    video.onloadedmetadata=function(){ resolve({width:video.videoWidth,height:video.videoHeight,duration:video.duration}); URL.revokeObjectURL(video.src) }
    video.onerror=reject
    video.src=URL.createObjectURL(file)
  })
}
function readAudioDuration(file){
  return new Promise(function(resolve,reject){
    var audio=document.createElement('audio')
    audio.preload='metadata'
    audio.onloadedmetadata=function(){ resolve(audio.duration); URL.revokeObjectURL(audio.src) }
    audio.onerror=reject
    audio.src=URL.createObjectURL(file)
  })
}

async function generatePreview(file){
  var preview=$('uploadPreview'),thumbWrap=$('uploadThumbWrap'),nameEl=$('uploadPreviewName'),metaEl=$('uploadPreviewMeta')
  preview.style.display='block'
  nameEl.textContent=file.name
  pendingMeta={width:0,height:0,duration:0}
  pendingThumbBlob=null
  var tv=$('uploadType').value
  if(thumbWrap._lastBlobUrl){URL.revokeObjectURL(thumbWrap._lastBlobUrl);thumbWrap._lastBlobUrl=null}
  thumbWrap.innerHTML='<span style="font-size:13px;font-weight:700">'+(UPLOAD_TYPE_ICONS[tv]||'FILE')+'</span>'
  if(file.type.startsWith('image/')){
    try{
      var img=await loadImage(file)
      pendingMeta.width=img.naturalWidth;pendingMeta.height=img.naturalHeight
      var canvas=document.createElement('canvas')
      var maxDim=300,ratio=Math.min(maxDim/img.naturalWidth,maxDim/img.naturalHeight,1)
      canvas.width=img.naturalWidth*ratio;canvas.height=img.naturalHeight*ratio
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height)
      canvas.toBlob(function(blob){ if(thumbWrap._lastBlobUrl)URL.revokeObjectURL(thumbWrap._lastBlobUrl);var burl=URL.createObjectURL(blob);thumbWrap._lastBlobUrl=burl;pendingThumbBlob=blob;thumbWrap.innerHTML='<img src="'+burl+'" style="width:80px;height:80px;object-fit:cover">' },'image/jpeg',0.82)
      metaEl.textContent=fmtFileSize(file.size)+' · '+fmtDim(pendingMeta.width,pendingMeta.height)
    }catch(e){ metaEl.textContent=fmtFileSize(file.size) }
  } else if(file.type.startsWith('video/')){
    try{
      var v=await readVideoMeta(file)
      pendingMeta.width=v.width;pendingMeta.height=v.height;pendingMeta.duration=Math.round(v.duration)
      thumbWrap.innerHTML='<span style="font-size:13px;font-weight:700">VID</span>'
      metaEl.textContent=fmtFileSize(file.size)+' · '+fmtDim(v.width,v.height)+' · '+fmtDuration(pendingMeta.duration)
    }catch(e){ metaEl.textContent=fmtFileSize(file.size)+' · '+at('type.video') }
  } else if(file.type.startsWith('audio/')){
    try{
      var dur=await readAudioDuration(file)
      pendingMeta.duration=Math.round(dur)
      thumbWrap.innerHTML='<span style="font-size:13px;font-weight:700">AUD</span>'
      metaEl.textContent=fmtFileSize(file.size)+' · '+fmtDuration(pendingMeta.duration)
    }catch(e){ metaEl.textContent=fmtFileSize(file.size) }
  } else {
    thumbWrap.innerHTML='<span style="font-size:13px;font-weight:700">DOC</span>'
    metaEl.textContent=fmtFileSize(file.size)
  }
}

function clearUploadFile(){
  pendingFiles = [];
  pendingFile=null;pendingThumbBlob=null;pendingMeta={width:0,height:0,duration:0}
  $('uploadPreview').style.display='none'
  $('uploadFile').value=''
}

async function doUpload(isDraft){
  if(pendingFiles && pendingFiles.length > 1){ return await doBatchUpload(isDraft) }
  var title=$('uploadTitle').value.trim(),college=$('uploadCollege').value,type=$('uploadType').value
  var desc=$('uploadDesc').value.trim(),date=$('uploadDate').value.trim(),tags=$('uploadTags').value.trim()
  if(!title){ toast(at('t.needTitle'));return }
  if(!college){ toast(at('t.needCollege'));return }
  if(!type){ toast(at('t.needType'));return }
  var btn=isDraft?$('saveDraftBtn'):$('uploadBtn')
  var otherBtn=isDraft?$('uploadBtn'):$('saveDraftBtn')
  btn.disabled=true;otherBtn.disabled=true
  var lbl=btn.querySelector('span')
  lbl.textContent=isDraft?at('t.saving'):at('t.submitting')
  var fd=new FormData()
  fd.append('title',title);fd.append('college',college);fd.append('type',type)
  fd.append('description',desc);fd.append('shot_date',date);fd.append('tags',tags)
  var subSel=$('uploadSubSelect')
  if(subSel&&subSel.value) fd.append('sub_type',subSel.value)
  var driveUrl=$('uploadDrive').value.trim();if(driveUrl)fd.append('drive_url',driveUrl)
  fd.append('status',isDraft?'draft':'pending_review')
  fd.append('width',pendingMeta.width);fd.append('height',pendingMeta.height);fd.append('duration',pendingMeta.duration)
  if(pendingFile) fd.append('file',pendingFile)
  if(pendingThumbBlob) fd.append('thumb',pendingThumbBlob,'thumb.jpg')
  // ═══ 大文件（>100MB）走流式端点：multipart 会把整个文件读进内存，2GB 会打爆服务 ═══
  if (pendingFile && pendingFile.size > 100 * 1024 * 1024) {
    var _big = await uploadBigFile(pendingFile, {
      title: title, type: type, college: college,
      description: desc, shot_date: date, tags: tags,
      status: (isDraft ? 'draft' : 'pending_review')
    })
    btn.disabled = false; otherBtn.disabled = false
    if (lbl) lbl.textContent = isDraft ? at('upload.draft') : at('upload.submit')
    if (_big && _big.ok) {
      toast(_big.message || at('t.submitOk'))
      closeModal('uploadModal')
      $('uploadTitle').value = ''; $('uploadDesc').value = ''; $('uploadDate').value = ''; $('uploadTags').value = ''; $('uploadDrive').value = ''
      clearUploadFile(); loadMaterials(); loadDashboard()
    } else {
      toast((_big && _big.message) || at('t.retry'))
    }
    return
  }
  var d=await api('/api/materials',{method:'POST',body:fd})
  btn.disabled=false;otherBtn.disabled=false
  lbl.textContent=isDraft?at('upload.draft'):at('upload.submit')
  if(d.ok){
    toast(isDraft?at('t.draftOk'):at('t.submitOk'))
    closeModal('uploadModal')
    $('uploadTitle').value='';$('uploadDesc').value='';$('uploadDate').value='';$('uploadTags').value='';$('uploadDrive').value=''
    clearUploadFile()
    loadMaterials()
    loadDashboard()
  } else toast(d.message||at('t.retry'))
}

/* 拖拽上传 */
(function(){
  var ua=document.getElementById('uploadArea')
  if(ua){
    var _onDragOver=function(e){ e.preventDefault(); ua.style.borderColor='var(--gold)' }
    var _onDragLeave=function(){ ua.style.borderColor='' }
    var _onDrop=function(e){ e.preventDefault(); ua.style.borderColor=''; if(e.dataTransfer.files.length) handleFilesSelect(e.dataTransfer.files) }
    ua.addEventListener('dragover',_onDragOver)
    ua.addEventListener('dragleave',_onDragLeave)
    ua.addEventListener('drop',_onDrop)
    // store refs for potential cleanup
    ua._dragHandlers={over:_onDragOver,leave:_onDragLeave,drop:_onDrop}
  }
})()

/* ═══════════════════════════════════════════════════════════════
   融媒体中心：文稿审核 / 新媒体矩阵 / 敏感词库
   ═══════════════════════════════════════════════════════════════ */

var AR_STATUS_MAP={'draft':{t:'草稿',c:'draft'},'pending_l1':{t:'一审中',c:'pending_l1'},'pending_l2':{t:'二审中',c:'pending_l2'},'pending_l3':{t:'三审中',c:'pending_l3'},'published_ready':{t:'待发布',c:'published_ready'},'published':{t:'已发布',c:'published'},'rejected':{t:'已拒绝',c:'rejected'}}
var AR_CAT_MAP={'news':'校园新闻','notice':'通知公告','feature':'专题报道','activity':'活动宣传','culture':'文化生活','academic':'学术科研'}
var AR_PLATFORM_MAP={'website':'官方网站','wechat':'微信公众号','weibo':'微博','douyin':'抖音','bilibili':'B站','xhs':'小红书'}
var AR_PLATFORM_ICONS={'website':'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>','wechat':'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>','weibo':'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>','douyin':'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>','bilibili':'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>','xhs':'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'}
var _arPendingId=null

function _arFmt(s){if(!s)return '';var d=new Date(s.replace(' ','T'));if(isNaN(d))return s;var n=new Date();var df=(n-d)/1000;if(df<3600)return Math.floor(df/60)+'分钟前';if(df<86400)return Math.floor(df/3600)+'小时前';return (d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}

/* ── 文稿审核队列 ── */
var selectedArticles=new Set()
var articleRejectMode=false
function toggleArticleSelect(id){
  selectedArticles.has(id)?selectedArticles.delete(id):selectedArticles.add(id)
  updateArticleBatchBar()
}
function toggleAllArticleSelect(cb){
  document.querySelectorAll('#articleReviewBody .row-check[data-aid]').forEach(function(c){
    if(cb.checked)selectedArticles.add(c.getAttribute('data-aid'));else selectedArticles.delete(c.getAttribute('data-aid'))
    c.checked=cb.checked
  })
  updateArticleBatchBar()
}
function updateArticleBatchBar(){
  var bar=document.getElementById('articleBatchBar')
  if(!bar)return
  document.getElementById('articleBatchCount').textContent=selectedArticles.size
  bar.style.display=selectedArticles.size>0?'flex':'none'
}
async function batchArticleReview(action, reason){
  var ids=[...selectedArticles].map(Number)
  if(!ids.length) return
  var r=await api('/api/articles/batch-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:ids,action:action,comment:reason||''})})
  if(r&&r.ok){
    toast(r.message||'批量审核完成')
    selectedArticles.clear();updateArticleBatchBar()
    loadArticleReviewQueue()
    loadDashboard()
  }else{
    toast(r&&r.message||'批量审核失败')
  }
}
function openArticleBatchReject(){
  if(!selectedArticles.size){toast('请先勾选要退回的文稿');return}
  articleRejectMode=true
  $('brCount').textContent='（已选 '+selectedArticles.size+' 篇）'
  $('brReason').value=''
  $('batchRejectModal').style.display='flex'
}

async function loadArticleReviewQueue(){
  var filterVal=document.getElementById('articleReviewFilter')?document.getElementById('articleReviewFilter').value:''
  var url='/api/review-queue'
  if(filterVal) url+='?status='+encodeURIComponent(filterVal)
  var res=await api(url)
  if(!res||!res.ok){$('articleReviewBody').innerHTML='<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-3)">'+(res&&res.message||'加载失败')+'</td></tr>';return}

  // 统计
  var statsRes=await api('/api/admin/review-stats')
  if(statsRes&&statsRes.ok){
    var s=statsRes.data
    var statsHtml=[
      {label:'文稿总数',val:s.total,color:'#3b82f6'},
      {label:'待审核',val:(s.byStatus||[]).filter(function(x){return['pending_l1','pending_l2','pending_l3'].includes(x.status)}).reduce(function(a,x){return a+x.c},0),color:'#f59e0b'},
      {label:'已发布',val:s.published||0,color:'#22c55e'},
      {label:'已拒绝',val:(s.byStatus||[]).filter(function(x){return x.status==='rejected'}).reduce(function(a,x){return a+x.c},0),color:'var(--status-bad)'},
    ].map(function(x){return '<div class="card" style="text-align:center;padding:14px"><div style="font-size:24px;font-weight:700;color:'+x.color+'">'+x.val+'</div><div style="font-size:12px;color:var(--text-3);margin-top:4px">'+x.label+'</div></div>'}).join('')
    // 社区 UGC 统计
    if(s.community){
      var c=s.community
      statsHtml+=['<div style="grid-column:1/-1;height:1px;background:var(--border);margin:4px 0"></div>',
        {label:'博客待审',val:c.blogPending,color:'#f59e0b'},
        {label:'论坛待审',val:c.forumPending,color:'#f59e0b'},
        {label:'校园墙待审',val:c.wallPending,color:'#f59e0b'},
        {label:'评论/回复待审',val:c.blogCommentPending+c.forumReplyPending,color:'#f59e0b'},
        {label:'社区已发布',val:c.communityPublished,color:'#22c55e'},
        {label:'社区总待审',val:c.communityPending,color:'var(--status-bad)'},
      ].map(function(x,i){return typeof x==='string'?x:'<div class="card" style="text-align:center;padding:14px"><div style="font-size:24px;font-weight:700;color:'+x.color+'">'+x.val+'</div><div style="font-size:12px;color:var(--text-3);margin-top:4px">'+x.label+'</div></div>'}).join('')
    }
    $('reviewStatsRow').innerHTML=statsHtml

    // badge
    var pendingCount=(s.byStatus||[]).filter(function(x){return['pending_l1','pending_l2','pending_l3'].includes(x.status)}).reduce(function(a,x){return a+x.c},0)
    var badge=$('articlePendingBadge')
    if(badge){if(pendingCount>0){badge.textContent=pendingCount;badge.style.display='inline-block'}else{badge.style.display='none'}}
  }

  var rows=res.data||[]
  if(rows.length===0){
    $('articleReviewBody').innerHTML='<tr><td colspan="8">'+emptyStateHTML({icon:'doc',title:'暂无待审核文稿',sm:true})+'</td></tr>'
    return
  }
  $('articleReviewBody').innerHTML=rows.map(function(a){
    var st=AR_STATUS_MAP[a.status]||AR_STATUS_MAP['draft']
    var cat=AR_CAT_MAP[a.category]||'未分类'
    var levelText=a.review_level===1?'一级':a.review_level===2?'二级':'三级'
    return '<tr>'+
      '<td><input type="checkbox" class="row-check" data-aid="'+a.id+'" '+(selectedArticles.has(String(a.id))||selectedArticles.has(a.id)?'checked':'')+' onclick="event.stopPropagation();toggleArticleSelect(\''+a.id+'\')"></td>'+
      '<td>'+a.id+'</td>'+
      '<td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">'+esc(a.title)+'</td>'+
      '<td>'+esc(a.author_name||a.author_id||'')+'</td>'+
      '<td>'+esc(cat)+'</td>'+
      '<td>'+levelText+'</td>'+
      '<td><span class="article-status '+st.c+'">'+st.t+'</span></td>'+
      '<td style="font-size:12px;color:var(--text-3)">'+_arFmt(a.updated_at)+'</td>'+
      '<td class="cell-actions"><button class="btn btn-primary btn-sm" onclick="openArticleReviewModal('+a.id+')">审核</button></td>'+
    '</tr>'
  }).join('')
}

function openArticleReviewModal(id){
  _arPendingId=id
  $('arComment').value=''
  openModal('articleReviewModal')
}

async function doArticleReview(action){
  if(!_arPendingId)return
  var comment=$('arComment').value.trim()
  var res=await api('/api/articles/'+_arPendingId+'/review',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:action,comment:comment})
  })
  closeModal('articleReviewModal')
  if(res&&res.ok){
    toast(res.message||'操作成功')
    loadArticleReviewQueue()
  }else{
    toast(res&&res.message||'操作失败')
  }
  _arPendingId=null
}

/* ── 新媒体矩阵 ── */
async function loadMediaAccounts(){
  var res=await api('/api/media-accounts')
  if(!res||!res.ok){$('mediaAccountGrid').innerHTML='<div class="empty-state"><div class="empty-text">'+(res&&res.message||'加载失败')+'</div></div>';return}
  var rows=res.data||[]
  if(rows.length===0){
    $('mediaAccountGrid').innerHTML='<div class="empty-state" style="grid-column:1/-1"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><div class="empty-text">暂无新媒体账号，点击右上角添加</div></div>'
    return
  }
  $('mediaAccountGrid').innerHTML=rows.map(function(a){
    var icon=AR_PLATFORM_ICONS[a.platform]||'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'
    var platformName=AR_PLATFORM_MAP[a.platform]||a.platform
    return '<div class="media-card">'+
      '<div class="media-icon '+a.platform+'">'+icon+'</div>'+
      '<div class="media-info">'+
        '<div class="media-name">'+esc(a.account_name)+'</div>'+
        '<div class="media-detail">'+esc(platformName)+(a.owner_name?' · 负责人：'+esc(a.owner_name):'')+(a.department?' · '+esc(a.department):'')+'</div>'+
      '</div>'+
      '<span class="media-status '+(a.status==='active'?'active':'inactive')+'">'+(a.status==='active'?'运营中':'已停用')+'</span>'+
      '<div style="display:flex;gap:4px">'+
        '<button class="btn btn-outline btn-sm" onclick="editMediaAccount('+a.id+')">编辑</button>'+
        '<button class="btn btn-outline btn-sm" style="color:#ef4444" onclick="deleteMediaAccount('+a.id+')">删除</button>'+
      '</div>'+
    '</div>'
  }).join('')
}

function openMediaAccountModal(){
  $('maId').value=''
  $('maPlatform').value='wechat'
  $('maAccountName').value=''
  $('maAccountId').value=''
  $('maOwnerName').value=''
  $('maDepartment').value=''
  $('maQrCode').value=''
  $('maModalTitle').textContent='添加新媒体账号'
  openModal('mediaAccountModal')
}

async function editMediaAccount(id){
  var res=await api('/api/media-accounts')
  if(!res||!res.ok)return
  var acc=(res.data||[]).find(function(x){return x.id===id})
  if(!acc)return
  $('maId').value=acc.id
  $('maPlatform').value=acc.platform
  $('maAccountName').value=acc.account_name||''
  $('maAccountId').value=acc.account_id||''
  $('maOwnerName').value=acc.owner_name||''
  $('maDepartment').value=acc.department||''
  $('maQrCode').value=acc.qr_code||''
  $('maModalTitle').textContent='编辑账号'
  openModal('mediaAccountModal')
}

async function saveMediaAccount(){
  var id=$('maId').value
  var data={
    platform:$('maPlatform').value,
    account_name:$('maAccountName').value.trim(),
    account_id:$('maAccountId').value.trim(),
    owner_name:$('maOwnerName').value.trim(),
    department:$('maDepartment').value.trim(),
    qr_code:$('maQrCode').value.trim(),
    status:'active'
  }
  if(!data.account_name){toast('账号名称不能为空');return}
  var res
  if(id){
    res=await api('/api/admin/media-accounts/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
  }else{
    res=await api('/api/admin/media-accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
  }
  if(res&&res.ok){
    toast(res.message||'保存成功')
    closeModal('mediaAccountModal')
    loadMediaAccounts()
  }else{
    toast(res&&res.message||'保存失败')
  }
}

async function deleteMediaAccount(id){
  if(!confirm('确认删除这个账号？'))return
  var res=await api('/api/admin/media-accounts/'+id,{method:'DELETE'})
  if(res&&res.ok){toast('已删除');loadMediaAccounts()}else{toast(res&&res.message||'删除失败')}
}

/* ── 敏感词库 ── */
var _swDebounce=null
function debounceLoadSW(){clearTimeout(_swDebounce);_swDebounce=setTimeout(loadSensitiveWords,300)}

async function loadSensitiveWords(){
  var search=$('swSearch').value.trim()
  var level=$('swLevelFilter').value
  var url='/api/sensitive-words?'
  if(search)url+='q='+encodeURIComponent(search)+'&'
  if(level)url+='level='+encodeURIComponent(level)+'&'
  var res=await api(url)
  if(!res||!res.ok){$('swList').innerHTML='<div style="color:var(--text-3);padding:20px">'+(res&&res.message||'加载失败')+'</div>';return}
  var rows=res.data||[]
  $('swCount').textContent='共 '+rows.length+' 条'
  if(rows.length===0){
    $('swList').innerHTML='<div style="color:var(--text-3);padding:20px">暂无敏感词</div>'
    return
  }
  $('swList').innerHTML=rows.map(function(w){
    return '<span class="sw-tag '+w.level+'" style="cursor:default">'+
      esc(w.word)+
      (w.category?' <span style="opacity:.6;font-size:11px">'+esc(w.category)+'</span>':'')+
      ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="cursor:pointer;margin-left:2px;opacity:.6" onclick="deleteSw('+w.id+')" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'+
    '</span>'
  }).join('')
}

function openSwAddModal(){
  $('swWord').value=''
  $('swLevel').value='medium'
  $('swCategory').value=''
  openModal('swAddModal')
}

async function addSensitiveWord(){
  var word=$('swWord').value.trim()
  if(!word){toast('敏感词不能为空');return}
  var data={word:word,level:$('swLevel').value,category:$('swCategory').value.trim()}
  var res=await api('/api/admin/sensitive-words',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
  if(res&&res.ok){
    toast(res.message||'添加成功')
    closeModal('swAddModal')
    loadSensitiveWords()
  }else{
    toast(res&&res.message||'添加失败')
  }
}

async function deleteSw(id){
  if(!confirm('确认删除这个敏感词？'))return
  var res=await api('/api/admin/sensitive-words/'+id,{method:'DELETE'})
  if(res&&res.ok){toast('已删除');loadSensitiveWords()}else{toast(res&&res.message||'删除失败')}
}

function openSwImportModal(){
  $('swImportText').value=''
  $('swImportLevel').value='medium'
  openModal('swImportModal')
}

async function importSensitiveWords(){
  var text=$('swImportText').value.trim()
  if(!text){toast('请输入敏感词内容');return}
  var res=await api('/api/admin/sensitive-words/import',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text:text,level:$('swImportLevel').value})
  })
  if(res&&res.ok){
    toast(res.message||'导入完成')
    closeModal('swImportModal')
    loadSensitiveWords()
  }else{
    toast(res&&res.message||'导入失败')
  }
}

/* ── UGC审核 ── */
async function loadUgcReview(){
  const el=$('ugcReviewContent')
  el.innerHTML=loadingHTML()
  const res=await api('/api/admin/ugc-review')
  if(!res||!res.ok){el.innerHTML=errorHTML();return}
  const d=res.data
  let html=''
  const sections=[
    {key:'blog',label:'博客',items:d.blog,fields:['title']},
    {key:'thread',label:'论坛帖子',items:d.threads,fields:['title']},
    {key:'wall',label:'校园墙',items:d.wall,fields:['content']},
    {key:'comment',label:'评论',items:d.comments,fields:['content']},
  ]
  let total=0
  sections.forEach(s=>{
    if(s.items&&s.items.length>0){
      total+=s.items.length
      html+='<div style="margin-bottom:20px"><h4 style="color:var(--text-2);margin-bottom:10px">'+s.label+' ('+s.items.length+')</h4>'
      html+=s.items.map(item=>{
        const content=esc(item[s.fields[0]]||'')
        let imagesHtml=''
        if(s.key==='wall'&&item.images){
          try{var imgs=JSON.parse(item.images||'[]');if(imgs.length>0)imagesHtml='<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">'+imgs.map(src=>'<img src="'+esc(src)+'" style="width:50px;height:50px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="previewImage(\''+esc(src)+'\')" alt="墙贴图片">').join('')+'</div>'}catch(e){}
        }
        return '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-start">'+
          '<div style="flex:1;min-width:0"><div style="font-weight:600;margin-bottom:4px;word-break:break-word">'+content+'</div>'+
          imagesHtml+
          '<div style="font-size:12px;color:var(--text-3);margin-top:'+(imagesHtml?'6px':'4px')+'"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> '+esc(item.author_name||'匿名')+(item.tag?' · <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> '+esc(item.tag):'')+' · '+esc(item.created_at||'')+'</div></div>'+
          '<div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px">'+
          '<button class="btn btn-success btn-sm" onclick="reviewUgc(\''+s.key+'\','+item.id+',\'approve\')">通过</button>'+
          '<button class="btn btn-danger btn-sm" onclick="reviewUgc(\''+s.key+'\','+item.id+',\'reject\')">拒绝</button></div></div>'
      }).join('')
      html+='</div>'
    }
  })
  if(total===0) html='<div class="empty-state"><div class="icon"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div class="text">暂无待审核内容</div></div>'
  el.innerHTML=html
  const badge=$('ugcPendingBadge')
  if(badge){badge.textContent=total;badge.style.display=total>0?'inline-block':'none'}
}
async function reviewUgc(type,id,action){
  const res=await api('/api/admin/ugc-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,id,action})})
  toast(res&&res.ok?res.message:'操作失败')
  if(res&&res.ok)loadUgcReview()
}

/* ── 举报管理 ── */
async function loadReports(){
  const el=$('reportsContent')
  el.innerHTML=loadingHTML()
  const res=await api('/api/admin/reports?status=pending')
  if(!res||!res.ok){el.innerHTML=errorHTML();return}
  const items=res.data||[]
  let html=''
  if(items.length===0){
    html='<div class="empty-state"><div class="icon"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div class="text">暂无待处理举报</div></div>'
  }else{
    const typeMap={blog:'博客',thread:'论坛帖子',reply:'论坛回复',wall:'校园墙'}
    html=items.map(r=>'<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">'+
      '<div style="flex:1"><div style="font-weight:600;margin-bottom:4px">举报 '+typeMap[r.target_type]+' #'+r.target_id+'</div>'+
      '<div style="font-size:13px;color:var(--text-2)">原因：'+esc(r.reason||'未填写')+'</div>'+
      '<div style="font-size:12px;color:var(--text-3)">举报人：'+esc(r.reporter_name||'')+' · '+esc(r.created_at||'')+'</div></div>'+
      '<div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px">'+
      '<button class="btn btn-success btn-sm" onclick="handleReport('+r.id+',\'handled\')">处理</button>'+
      '<button class="btn btn-outline btn-sm" onclick="handleReport('+r.id+',\'dismissed\')">驳回</button></div></div>'
    ).join('')
  }
  el.innerHTML=html
  const badge=$('reportPendingBadge')
  if(badge){badge.textContent=items.length;badge.style.display=items.length>0?'inline-block':'none'}
}
async function handleReport(id,action){
  const res=await api('/api/admin/reports/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})})
  toast(res&&res.ok?res.message:'操作失败')
  if(res&&res.ok)loadReports()
}

/* ── 论坛管理 ── */
async function loadForumManage(){
  const el=$('forumManageContent')
  el.innerHTML=loadingHTML()
  const res=await api('/api/forum/boards')
  if(!res||!res.ok){el.innerHTML=errorHTML();return}
  const boards=res.data||[]
  let html='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:24px">'
  html+=boards.map(b=>'<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;cursor:pointer" onclick="loadForumBoard('+b.id+')">'+
    '<div style="font-size:28px;margin-bottom:8px">'+b.icon+'</div>'+
    '<div style="font-weight:600;margin-bottom:4px">'+esc(b.name)+'</div>'+
    '<div style="font-size:12px;color:var(--text-3);margin-bottom:8px">'+esc(b.description||'')+'</div>'+
    '<div style="font-size:13px;color:var(--primary-light)">帖子数：'+b.post_count+'</div></div>'
  ).join('')
  html+='</div>'
  html+='<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">'
  html+='<h4 style="color:var(--text-2);margin:0">帖子管理</h4>'
  html+='<select id="forumBoardSelect" class="cs-custom" style="max-width:200px" onchange="loadForumBoard(this.value)" aria-label="选择版块">'
  html+='<option value="">全部版块</option>'
  boards.forEach(b=>{html+='<option value="'+b.id+'">'+esc(b.icon+' '+b.name)+'</option>'})
  html+='</select></div>'
  html+='<div id="forumThreadsList"></div>'
  el.innerHTML=html
  loadForumBoard('')
}
async function loadForumBoard(boardId){
  const listEl=$('forumThreadsList')
  if(!listEl)return
  listEl.innerHTML=loadingHTML()
  let url,threadsRes
  if(boardId){
    url='/api/forum/boards/'+boardId+'/threads?page=1&limit=50'
    threadsRes=await api(url)
  }else{
    url='/api/admin/forum/threads?page=1&limit=50'
    threadsRes=await api(url)
  }
  if(!threadsRes||!threadsRes.ok||!threadsRes.data){listEl.innerHTML='<div class="empty-state"><div class="text">暂无帖子</div></div>';return}
  const threads=threadsRes.data||[]
  if(threads.length===0){listEl.innerHTML='<div class="empty-state"><div class="text">暂无帖子</div></div>';return}
  listEl.innerHTML=threads.map(t=>'<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">'+
    '<div style="min-width:0"><div style="font-weight:600">'+(t.is_pinned?'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> ':'')+esc(t.title)+'</div>'+
    '<div style="font-size:12px;color:var(--text-3)"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> '+(t.is_anonymous?'匿名':esc(t.author_name))+' · <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> '+t.views+' · <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> '+t.replies+(t.board_name?' · <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> '+esc(t.board_name):'')+'</div></div>'+
    '<div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px">'+
    (t.is_pinned?'<button class="btn btn-outline btn-sm" onclick="manageThread('+t.id+',\'unpin\')">取消置顶</button>':'<button class="btn btn-outline btn-sm" onclick="manageThread('+t.id+',\'pin\')">置顶</button>')+
    '<button class="btn btn-danger btn-sm" onclick="manageThread('+t.id+',\'delete\')">删除</button></div></div>'
  ).join('')
}
async function manageThread(id,action){
  const res=await api('/api/admin/forum/threads/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})})
  toast(res&&res.ok?res.message:'操作失败')
  if(res&&res.ok)loadForumManage()
}

/* ── 校园墙管理 ── */
async function loadWallManage(){
  const el=$('wallManageContent')
  el.innerHTML=loadingHTML()
  const res=await api('/api/wall/posts?page=1&limit=20')
  if(!res||!res.ok){el.innerHTML=errorHTML();return}
  const items=res.data||[]
  let html=''
  if(items.length===0){
    html='<div class="empty-state"><div class="icon"><svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div><div class="text">暂无墙贴</div></div>'
  }else{
    html=items.map(w=>{
      let imagesHtml=''
      try{var imgs=JSON.parse(w.images||'[]');if(imgs.length>0)imagesHtml='<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">'+imgs.map(src=>'<img src="'+esc(src)+'" style="width:60px;height:60px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="previewImage(\''+esc(src)+'\')" alt="墙贴图片">').join('')+'</div>'}catch(e){}
      return '<div style="background:var(--card);border:1px solid '+(w.is_featured?'var(--gold)':'var(--border)')+';border-radius:10px;padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-start">'+
        '<div style="flex:1;min-width:0"><div style="margin-bottom:6px;word-break:break-word">'+esc(w.content)+'</div>'+
        imagesHtml+
        '<div style="font-size:12px;color:var(--text-3);margin-top:6px"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> '+esc(w.tag)+' · <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> '+(w.is_anonymous?'匿名':esc(w.author_name))+' · <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> '+w.likes+' · <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> '+esc(w.created_at||'')+'</div></div>'+
        '<div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px">'+
        (w.is_featured?'<button class="btn btn-outline btn-sm" onclick="manageWall('+w.id+',\'unfeature\')">取消精选</button>':'<button class="btn btn-gold btn-sm" onclick="manageWall('+w.id+',\'feature\')">精选</button>')+
        '<button class="btn btn-danger btn-sm" onclick="manageWall('+w.id+',\'delete\')">删除</button></div></div>'
    }).join('')
  }
  el.innerHTML=html
}
async function manageWall(id,action){
  const res=await api('/api/admin/wall/posts/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})})
  toast(res&&res.ok?res.message:'操作失败')
  if(res&&res.ok)loadWallManage()
}
function previewImage(src){
  var modal=document.createElement('div')
  modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:40px'
  modal.innerHTML='<img src="'+src+'" style="max-width:90%;max-height:90%;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.4)">'
  modal.onclick=function(){document.body.removeChild(modal)}
  document.body.appendChild(modal)
}

/* ── 通知管理 ── */
async function loadNotifManage(){
  const el=$('notifManageContent')
  el.innerHTML=loadingHTML()
  const res=await api('/api/admin/notifications?page=1&limit=50')
  if(!res||!res.ok){el.innerHTML=errorHTML();return}
  const items=res.data||[]
  const total=res.total||0
  const typeMap={'blog_comment':'博客评论','forum_reply':'论坛回复','like':'点赞','follow':'关注','system':'系统'}
  let html='<div style="margin-bottom:12px;font-size:13px;color:var(--text-3)">共 '+total+' 条通知</div>'
  if(items.length===0){
    html+='<div class="empty-state"><div class="icon"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><div class="text">暂无通知</div></div>'
  }else{
    html+=items.map(n=>'<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">'+
      '<div style="flex:1;min-width:0"><div style="margin-bottom:4px">'+esc(typeMap[n.type]||n.type)+' · '+esc(n.target_title||'#'+(n.target_id||''))+'</div>'+
      '<div style="font-size:12px;color:var(--text-3)"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> '+esc(n.actor_name||'系统')+' → '+esc(n.recipient_name||n.user_id)+(n.is_read?' · ✓ 已读':' · <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg> 未读')+' · <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> '+esc(n.created_at||'')+'</div></div>'+
      '<div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px">'+
      '<button class="btn btn-danger btn-sm" onclick="deleteNotif('+n.id+')">删除</button></div></div>'
    ).join('')
  }
  el.innerHTML=html
}
async function deleteNotif(id){
  const res=await api('/api/admin/notifications/'+id,{method:'DELETE'})
  toast(res&&res.ok?res.message:'操作失败')
  if(res&&res.ok)loadNotifManage()
}

;
var SM_ADMIN=(function(){
  var wrapper,backdrop,prelayers,prelayerEls,panel,listEl,socialsEl,brandEl;
  var triggerZone,closeTimer=null,handleBtn=null;
  var isOpen=false,isAnimating=false,openTl=null,closeTl=null;
  var badgeObserver=null;

  function getItems(){
    return [
      {tab:'dashboard',i18n:'nav.dashboard'},
      {tab:'review',i18n:'nav.review',badge:'pendingBadge'},
      {tab:'materials',i18n:'nav.materials'},
      {tab:'activities',i18n:'nav.activities'},
      {tab:'recruits',i18n:'nav.recruits'},
      {tab:'users',i18n:'nav.users'},
      {tab:'audit',i18n:'nav.audit'},
      {tab:'access',i18n:'nav.access'},
      {tab:'mediaMatrix',i18n:'nav.mediaMatrix'},
      {tab:'articlesWorkbench',i18n:'nav.articlesWorkbench',href:'/articles.html'},
      {tab:'profile',i18n:'nav.profile'}
    ];
  }

  function create(){
    wrapper=document.createElement('div');
    wrapper.className='sm-wrapper';
    wrapper.id='smWrapper';

    backdrop=document.createElement('div');
    backdrop.className='sm-backdrop';
    backdrop.addEventListener('click',close);

    prelayers=document.createElement('div');
    prelayers.className='sm-prelayers';
    (document.documentElement.getAttribute('data-theme')==='light'?['#f0f1f5','#e8e9ed']:['#0d0d12','#131318']).forEach(function(c){
      var l=document.createElement('div');
      l.className='sm-prelayer';
      l.style.background=c;
      prelayers.appendChild(l);
    });
    prelayerEls=Array.prototype.slice.call(prelayers.querySelectorAll('.sm-prelayer'));

    panel=document.createElement('aside');
    panel.className='sm-panel';
    panel.setAttribute('aria-hidden','true');

    renderContent();

    wrapper.appendChild(backdrop);
    wrapper.appendChild(prelayers);
    wrapper.appendChild(panel);
    document.body.appendChild(wrapper);

    // Trigger zone: invisible strip on left edge
    triggerZone=document.createElement('div');
    triggerZone.className='sm-trigger-zone';
    triggerZone.addEventListener('mouseenter',function(){
      cancelClose();
      if(!isOpen) open();
    });
    triggerZone.addEventListener('touchstart',function(e){
      e.preventDefault();
      if(!isOpen) open();
    },{passive:false});
    document.body.appendChild(triggerZone);

    // Visible handle: always-visible menu button (discoverability fix)
    handleBtn=document.createElement('button');
    handleBtn.className='sm-handle';
    handleBtn.type='button';
    handleBtn.setAttribute('aria-label',at('nav.menu')||'打开管理菜单');
    handleBtn.innerHTML='<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg><span class="sm-handleBadge" style="display:none"></span>';
    handleBtn.addEventListener('click',function(){cancelClose();if(!isOpen)open();});
    handleBtn.addEventListener('mouseenter',function(){cancelClose();if(!isOpen)open();});
    document.body.appendChild(handleBtn);

    // Auto-close when mouse leaves panel
    panel.addEventListener('mouseenter',cancelClose);
    panel.addEventListener('mouseleave',function(){scheduleClose(300)});

    initGsap();

    // Sync badges from hidden sidebar
    syncBadges();
    var origBadge=document.getElementById('pendingBadge');
    if(origBadge && window.MutationObserver){
      badgeObserver=new MutationObserver(function(){syncBadges()});
      badgeObserver.observe(origBadge,{attributes:true,childList:true,characterData:true,subtree:true});
    }

    // Close on Escape
    var _onKeyDown=function(e){
      if(e.key==='Escape'&&isOpen) close();
    }
    document.addEventListener('keydown',_onKeyDown);

    // Init specular buttons now that they're in the document
    if(typeof startSpecularButtons==='function') startSpecularButtons();
  }

  function scheduleClose(delay){
    clearTimeout(closeTimer);
    closeTimer=setTimeout(function(){close()},delay||300);
  }

  function cancelClose(){
    clearTimeout(closeTimer);
  }

  function renderContent(){
    var h='';
    h+='<div class="sm-brand">';
    h+='<div class="logo">融</div>';
    h+='<div><div class="name">'+esc(at('brand.name'))+'</div>';
    h+='<div class="sub">'+esc(at('brand.sub'))+'</div></div>';
    h+='</div>';

    h+='<ul class="sm-panel-list">';
    getItems().forEach(function(item,i){
      h+='<li class="sm-panel-itemWrap">';
      h+='<a class="sm-panel-item" data-tab="'+item.tab+'"'+(item.href?' data-href="'+item.href+'"':'')+'>';
      h+='<span class="sm-panel-itemLabel">'+esc(at(item.i18n))+'</span>';
      if(item.badge){
        h+='<span class="sm-panel-itemBadge" data-sm-badge="'+item.badge+'"></span>';
      }
      h+='<span class="sm-panel-itemNum">0'+(i+1)+'</span>';
      h+='</a></li>';
    });
    h+='</ul>';

    h+='<div class="sm-socials">';
    h+='<div class="sm-socials-buttons">';
    h+='<button class="btn btn-dark" id="smLogout" style="width:100%;border-radius:14px"><span>'+esc(at('btn.logout'))+'</span></button>';
    h+='<button class="btn btn-dark" id="smHome" style="width:100%;margin-top:6px;border-radius:14px"><span>'+esc(at('btn.home'))+'</span></button>';
    h+='</div></div>';

    panel.innerHTML=h;
    brandEl=panel.querySelector('.sm-brand');
    listEl=panel.querySelector('.sm-panel-list');
    socialsEl=panel.querySelector('.sm-socials');

    panel.querySelectorAll('.sm-panel-item').forEach(function(el){
      el.addEventListener('click',function(){
        var tab=this.getAttribute('data-tab');
        var href=this.getAttribute('data-href');
        close();
        if(href){
          setTimeout(function(){location.href=href},200);
        } else {
          setTimeout(function(){switchTab(tab)},200);
        }
      });
    });

    var lo=panel.querySelector('#smLogout'),hm=panel.querySelector('#smHome');
    if(lo)lo.addEventListener('click',function(){close();setTimeout(doLogout,200)});
    if(hm)hm.addEventListener('click',function(){close();setTimeout(function(){location.href='/'},200)});

    updateActive();
  }

  function updateActive(){
    if(!panel)return;
    panel.querySelectorAll('.sm-panel-item').forEach(function(el){
      el.classList.toggle('sm-active',el.getAttribute('data-tab')===currentTab);
    });
  }

  function syncBadges(){
    if(!panel)return;
    panel.querySelectorAll('[data-sm-badge]').forEach(function(el){
      var origId=el.getAttribute('data-sm-badge');
      var orig=document.getElementById(origId);
      if(orig){
        el.textContent=orig.textContent;
        el.style.display=orig.style.display==='none'?'none':'';
      }
    });
    // 同步待审徽标到侧栏把手
    if(handleBtn){
      var pb=document.getElementById('pendingBadge');
      var hb=handleBtn.querySelector('.sm-handleBadge');
      if(pb&&hb){
        var n=parseInt(pb.textContent,10)||0;
        hb.textContent=n>9?'9+':String(n);
        hb.style.display=(pb.style.display==='none'||n<=0)?'none':'flex';
      }
    }
  }

  function initGsap(){
    if(!window.gsap)return;
    gsap.set(prelayerEls,{xPercent:-100});
    gsap.set(panel,{xPercent:-100});
    gsap.set(panel.querySelectorAll('.sm-panel-itemWrap'),{y:30,opacity:0});
    gsap.set(panel.querySelectorAll('.sm-panel-itemLabel'),{yPercent:100,rotate:8});
    gsap.set(panel.querySelectorAll('.sm-panel-itemNum'),{opacity:0});
    if(brandEl)gsap.set(brandEl,{opacity:0,y:10});
    if(socialsEl)gsap.set(socialsEl,{opacity:0,y:10});
    var badges=panel.querySelectorAll('.sm-panel-itemBadge');
    if(badges.length)gsap.set(badges,{opacity:0,scale:0.5});
  }

  function buildOpenTimeline(){
    var tl=gsap.timeline();
    tl.to(prelayerEls,{xPercent:0,duration:0.35,ease:'power3.out',stagger:0.06});
    tl.to(panel,{xPercent:0,duration:0.4,ease:'power3.out'},'-=0.2');
    if(brandEl)tl.to(brandEl,{opacity:1,y:0,duration:0.3,ease:'power2.out'},'-=0.15');
    tl.to(panel.querySelectorAll('.sm-panel-itemWrap'),{y:0,opacity:1,duration:0.35,ease:'power3.out',stagger:0.04},'-=0.1');
    tl.to(panel.querySelectorAll('.sm-panel-itemLabel'),{yPercent:0,rotate:0,duration:0.4,ease:'power3.out',stagger:0.04},'<');
    tl.to(panel.querySelectorAll('.sm-panel-itemNum'),{opacity:0.5,duration:0.3,stagger:0.04},'-=0.2');
    var badges=panel.querySelectorAll('.sm-panel-itemBadge');
    if(badges.length)tl.to(badges,{opacity:1,scale:1,duration:0.25,stagger:0.04},'-=0.2');
    if(socialsEl)tl.to(socialsEl,{opacity:1,y:0,duration:0.3,ease:'power2.out'},'-=0.15');
    return tl;
  }

  function playClose(){
    var tl=gsap.timeline();
    if(socialsEl)tl.to(socialsEl,{opacity:0,y:10,duration:0.15});
    tl.to(panel.querySelectorAll('.sm-panel-itemWrap'),{y:20,opacity:0,duration:0.2,stagger:0.02},'<');
    tl.to(panel.querySelectorAll('.sm-panel-itemLabel'),{yPercent:100,rotate:8,duration:0.2,stagger:0.02},'<');
    if(brandEl)tl.to(brandEl,{opacity:0,y:10,duration:0.15},'<');
    tl.to(panel,{xPercent:-100,duration:0.3,ease:'power3.in'},'-=0.05');
    tl.to(prelayerEls,{xPercent:-100,duration:0.25,ease:'power3.in',stagger:0.04},'-=0.2');
    return tl;
  }

  function open(){
    if(isOpen||!window.gsap)return;
    if(closeTl)closeTl.kill();
    isAnimating=true;
    isOpen=true;
    wrapper.classList.add('sm-open');
    panel.setAttribute('aria-hidden','false');
    initGsap();
    openTl=buildOpenTimeline();
    openTl.eventCallback('onComplete',function(){isAnimating=false;syncBadges()});
  }

  function close(){
    if(!isOpen||!window.gsap)return;
    if(openTl)openTl.kill();
    isAnimating=true;
    isOpen=false;
    closeTl=playClose();
    closeTl.eventCallback('onComplete',function(){
      wrapper.classList.remove('sm-open');
      panel.setAttribute('aria-hidden','true');
      isAnimating=false;
    });
  }

  function reRender(){
    if(!panel)return;
    var wasOpen=isOpen;
    renderContent();
    if(typeof startSpecularButtons==='function') startSpecularButtons();
    if(wasOpen&&window.gsap){
      gsap.set(prelayerEls,{xPercent:0});
      gsap.set(panel,{xPercent:0});
      gsap.set(panel.querySelectorAll('.sm-panel-itemWrap'),{y:0,opacity:1});
      gsap.set(panel.querySelectorAll('.sm-panel-itemLabel'),{yPercent:0,rotate:0});
      gsap.set(panel.querySelectorAll('.sm-panel-itemNum'),{opacity:0.5});
      if(brandEl)gsap.set(brandEl,{opacity:1,y:0});
      if(socialsEl)gsap.set(socialsEl,{opacity:1,y:0});
      var badges=panel.querySelectorAll('.sm-panel-itemBadge');
      if(badges.length)gsap.set(badges,{opacity:1,scale:1});
      syncBadges();
    }
  }

  return{create:create,open:open,close:close,reRender:reRender,updateActive:updateActive,isOpen:function(){return isOpen}};
})();

(function initSM(){
  function tryInit(){
    if(window.gsap){
      SM_ADMIN.create();
    }else{
      setTimeout(tryInit,50);
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',tryInit);
  }else{
    tryInit();
  }
})();

/* ═══ 专题管理（P2 专题系统）═══ */
async function loadCollectionsAdmin(){
  var el=$('collectionsAdminList');if(!el)return
  el.innerHTML=loadingHTML()
  var r=await api('/api/collections?all=1')
  if(!r||!r.ok){el.innerHTML=errorHTML();return}
  var rows=r.data||[]
  if(!rows.length){el.innerHTML='<div class="empty-state"><div class="icon"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3 3h7z"/></svg></div><p>还没有专题，用上方表单创建第一个</p></div>';return}
  el.innerHTML=rows.map(function(c){
    return '<div style="border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:12px">'+
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
        '<span style="width:14px;height:14px;border-radius:4px;background:'+esc(c.color)+';flex-shrink:0"></span>'+
        '<b style="font-size:14px">'+esc(c.title)+'</b>'+
        (c.is_visible?'':'<span class="tag" style="color:var(--text-3)">已隐藏</span>')+
        '<span style="font-size:12px;color:var(--text-3)">'+(c.item_count||0)+' 个素材</span>'+
        '<span style="flex:1"></span>'+
        '<button class="btn btn-outline btn-sm" onclick="collectionAddMat('+c.id+')">+ 添加素材</button>'+
        '<button class="btn btn-outline btn-sm" onclick="collectionRename('+c.id+',\''+esc(c.title).replace(/'/g,'\\\'')+'\',\''+esc(c.description||'').replace(/'/g,'\\\'')+'\')">编辑</button>'+
        '<button class="btn btn-outline btn-sm" onclick="collectionToggleVisible('+c.id+','+(c.is_visible?0:1)+')">'+(c.is_visible?'隐藏':'显示')+'</button>'+
        '<button class="btn btn-outline btn-sm" style="color:#f87171" onclick="collectionDelete('+c.id+',\''+esc(c.title).replace(/'/g,'\\\'')+'\')">删除</button>'+
      '</div>'+
      (c.description?'<div style="font-size:12.5px;color:var(--text-3);margin-top:6px">'+esc(c.description)+'</div>':'')+
      '<div id="colItems-'+c.id+'" style="margin-top:10px"></div>'+
    '</div>'
  }).join('')
  rows.forEach(function(c){ loadColItems(c.id) })
}
async function loadColItems(cid){
  var el=$('colItems-'+cid);if(!el)return
  var r=await api('/api/collections/'+cid)
  var items=(r&&r.ok&&r.data&&r.data.items)||[]
  el.innerHTML=items.length
    ? '<div style="display:flex;gap:6px;flex-wrap:wrap">'+items.map(m=>'<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:3px 8px;border:1px solid var(--border);border-radius:99px">'+esc(m.title)+'<button onclick="collectionRemoveMat('+cid+','+m.id+')" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:13px;line-height:1" title="移出">×</button></span>').join('')+'</div>'
    : '<div style="font-size:11.5px;color:var(--text-3,#8a93a5)">尚未添加素材，点「+ 添加素材」开始</div>'
}
async function createCollection(){
  var t=$('colTitle').value.trim()
  if(!t){toast('请填写专题标题');return}
  var r=await api('/api/collections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:t,description:$('colDesc').value.trim(),color:$('colColor').value})})
  toast(r&&r.ok?r.message:'创建失败')
  if(r&&r.ok){$('colTitle').value='';$('colDesc').value='';loadCollectionsAdmin()}
}
async function collectionRename(cid,oldTitle,oldDesc){
  var t=prompt('修改专题标题：',oldTitle||'')
  if(t===null)return
  t=(t||'').trim()
  if(!t){toast('标题不能为空');return}
  var d=prompt('修改专题描述：',oldDesc||'')
  if(d===null)d=oldDesc||''
  var r=await api('/api/collections/'+cid,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:t,description:d})})
  toast(r&&r.ok?r.message:'更新失败')
  if(r&&r.ok)loadCollectionsAdmin()
}
async function collectionToggleVisible(cid,v){
  var r=await api('/api/collections/'+cid,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({isVisible:v})})
  toast(r&&r.ok?(v===1?'已显示':'已隐藏'):'操作失败')
  if(r&&r.ok)loadCollectionsAdmin()
}
async function collectionDelete(cid,title){
  if(!confirm('确定删除专题「'+title+'」？其中的素材不会被删除，仅解除关联。'))return
  var r=await api('/api/collections/'+cid,{method:'DELETE'})
  toast(r&&r.ok?r.message:'删除失败')
  if(r&&r.ok)loadCollectionsAdmin()
}
async function collectionAddMat(cid){
  var t=prompt('输入要加入的素材 ID（可在素材管理中查看）：')
  if(t===null)return
  var mid=parseInt(t,10)
  if(!mid){toast('请输入有效的素材 ID');return}
  var r=await api('/api/collections/'+cid+'/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({material_id:mid})})
  toast(r&&r.ok?r.message:(r&&r.message||'添加失败'))
  if(r&&r.ok){loadCollectionsAdmin()}
}
async function collectionRemoveMat(cid,mid){
  var r=await api('/api/collections/'+cid+'/items/'+mid,{method:'DELETE'})
  toast(r&&r.ok?r.message:'移除失败')
  if(r&&r.ok)loadColItems(cid)
}


/* ═══ 角色分权：用户角色设置 ═══ */
async function setUserRole(sel){
  var uid=sel.getAttribute('data-uid'), role=sel.value
  if(!confirm('确定将该用户角色改为「'+({admin:'管理员',editor:'学院编辑',reviewer:'审核员',reporter:'学生记者',student:'学生'}[role])+'」？')){loadUsers();return}
  var r=await api('/api/admin/users/'+encodeURIComponent(uid)+'/role',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:role})})
  toast(r&&r.ok?r.message:(r&&r.message||'设置失败'))
  loadUsers()
}

/* 活动签到管理 */
async function showSignCode(aid, title) {
  var r = await api("/api/admin/activities/" + aid + "/signcode", { method: "POST" })
  if (!r || !r.ok) { toast("生成失败"); return }
  var url = location.origin + "/#activity-" + aid
  var qr = window.qrcode ? (function () { try { var q = qrcode(0, "M"); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2 }) } catch (e) { return "" } })() : ""
  var m = document.getElementById("batchRejectModal")
  document.getElementById("brCount").textContent = ""
  document.getElementById("brFormArea").style.display = "none"
  var info = "<div style='font-size:13px;line-height:1.9'><b style='color:var(--gold)'>" + esc(title) + "</b><br>签到码：<b style='font-size:20px;letter-spacing:4px;color:var(--gold)'>" + r.code + "</b><br><span style='font-size:12px;color:var(--text-3)'>学生可在活动详情页输入此码完成签到；现场可将下方二维码投屏。</span></div><div style='text-align:center;margin:12px 0'>" + (qr || "") + "</div><div style='font-size:11.5px;color:var(--text-3);word-break:break-all'>" + esc(url) + "</div>"
  var infoEl = document.getElementById("brInfo")
  infoEl.innerHTML = info
  infoEl.style.display = "block"
  m.querySelector("h3").firstChild.textContent = "活动签到 "
  m.querySelector(".btn-danger").style.display = "none"
  m.querySelector(".btn-outline").textContent = "关闭"
  m.querySelector(".btn-outline").onclick = function () { closeSignModal() }
  m.style.display = "flex"
}
function restoreBatchModal() {
  var m = document.getElementById("batchRejectModal")
  document.getElementById("brFormArea").style.display = ""
  document.getElementById("brInfo").style.display = "none"
  document.getElementById("brInfo").innerHTML = ""
  m.querySelector("h3").firstChild.textContent = "批量退回 "
  m.querySelector(".btn-danger").style.display = ""
  m.querySelector(".btn-outline").textContent = "取消"
  m.querySelector(".btn-outline").onclick = null
}function closeSignModal() { var m = document.getElementById("batchRejectModal"); if (m) m.style.display = "none"; restoreBatchModal() }
async function showActJoins(aid, title) {
  var r = await api("/api/admin/activities/" + aid + "/joins")
  if (!r || !r.ok) { toast("名单加载失败"); return }
  var rows = r.data || []
  var m = document.getElementById("batchRejectModal")
  document.getElementById("brCount").textContent = ""
  document.getElementById("brFormArea").style.display = "none"
  var listHtml = "<div style='max-height:320px;overflow:auto'>" + (rows.length ? rows.map(function (j) {
    return "<div style='display:flex;justify-content:space-between;padding:7px 2px;border-bottom:1px dashed rgba(128,128,128,.2);font-size:13px'><span>" + esc(j.user_name || j.user_id) + "<span style='color:var(--text-3);font-size:11px;margin-left:6px'>" + esc(j.user_id) + "</span></span><span class='status-pill " + (j.status === "signed" ? "published" : "draft") + "'>" + (j.status === "signed" ? "已签到" : "已报名") + "</span></div>"
  }).join("") : "<div style='text-align:center;color:var(--text-3);padding:16px'>暂无报名</div>") + "</div>"
  var infoEl = document.getElementById("brInfo")
  infoEl.innerHTML = listHtml
  infoEl.style.display = "block"
  m.querySelector("h3").firstChild.textContent = "报名名单 · " + title + " "
  m.querySelector(".btn-danger").style.display = "none"
  m.querySelector(".btn-outline").textContent = "关闭"
  m.querySelector(".btn-outline").onclick = function () { closeSignModal() }
  m.style.display = "flex"
}

/* ═══ 账号设置（2026-10-23：个人资料 + 修改密码，与个人中心一致的自主管理）═══ */

/* 带 CSRF 兜底的请求：显式携带 X-CSRF-Token；若 403（token 失效）先刷新页面拿新 cookie 再重试一次 */
async function accFetch(url, opts){
  opts = opts || {}
  function getCsrf(){
    try { var m = document.cookie.match(/(?:^|;\s*)csrf=([^;]+)/); return m ? m[1] : '' } catch(e){ return '' }
  }
  function send(){
    var o = Object.assign({ credentials: 'same-origin' }, opts)
    o.headers = Object.assign({}, opts.headers || {})
    var c = getCsrf()
    if (c) o.headers['X-CSRF-Token'] = c
    return fetch(url, o)
  }
  var r = await send()
  if (r.status === 401){
    // 会话失效（单点登录：账号在别处登录过会踢掉此端）
    toast('登录状态已失效，请重新登录')
    setTimeout(function(){ location.href = '/login.html' }, 1600)
    return r
  }
  if (r.status === 403){
    try { await fetch('/admin.html', { credentials: 'same-origin', cache: 'no-store' }) } catch(e){}
    r = await send()
    if (r.status === 401){
      toast('登录状态已失效，请重新登录')
      setTimeout(function(){ location.href = '/login.html' }, 1600)
    }
  }
  return r
}

function loadAccountForm(){
  const u = currentUser || {}
  const av = document.getElementById('accAvatar')
  if (av){
    if (u.avatar){ av.style.backgroundImage = 'url(/api/avatars/' + u.avatar + ')'; av.textContent = '' }
    else { av.style.backgroundImage = ''; av.textContent = (u.name || '?').charAt(0) }
  }
  const sid = document.getElementById('accSid'); if (sid) sid.value = u.id || ''
  const roleEl = document.getElementById('accRole')
  if (roleEl) roleEl.value = (typeof ROLE_ZH !== 'undefined' && ROLE_ZH[_myRole]) || _myRole || ''
  const nm = document.getElementById('accName'); if (nm) nm.value = u.name || ''
  const bio = document.getElementById('accBio'); if (bio) bio.value = u.bio || ''
  const gr = document.getElementById('accGrade')
  if (gr && u.grade) for (const o of gr.options) o.selected = (o.value === u.grade)

  const sel = document.getElementById('accCollege')
  if (!sel) return
  const fill = (list) => {
    sel.innerHTML = '<option value="">未选择</option>' + list.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join('')
    if (u.college) sel.value = u.college
  }
  if (colleges && colleges.length){ fill(colleges) }
  else {
    api('/api/colleges').then(d => { colleges = (d && d.data) || []; fill(colleges) }).catch(() => {})
  }
}

async function saveAccountProfile(){
  const name = ((document.getElementById('accName') || {}).value || '').trim()
  const college = (document.getElementById('accCollege') || {}).value || ''
  const grade = (document.getElementById('accGrade') || {}).value || ''
  const bio = ((document.getElementById('accBio') || {}).value || '').trim()
  if (!name){ toast('请填写姓名'); return }
  try{
    const r = await accFetch('/api/me/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, college, grade, bio })
    })
    const d = await r.json().catch(function(){ return { ok:false, message:'保存失败（HTTP ' + r.status + '）' } })
    if (r.ok && d && d.ok){ currentUser = d.user || currentUser; toast('资料已保存') }
    else toast((d && d.message) || ('保存失败（HTTP ' + r.status + '）'))
  }catch(e){ toast('保存失败：网络异常') }
}

async function uploadAccountAvatar(input){
  const f = input.files && input.files[0]
  if (!f) return
  if (!f.type || f.type.indexOf('image/') !== 0){ toast('请选择图片文件'); input.value = ''; return }
  if (f.size > 5 * 1024 * 1024){ toast('头像文件过大（限制 5MB）'); input.value = ''; return }
  const fd = new FormData(); fd.append('file', f)
  try{
    const r = await accFetch('/api/me/avatar', { method: 'POST', body: fd })
    const d = await r.json().catch(function(){ return { ok:false, message:'上传失败（HTTP ' + r.status + '）' } })
    if (r.ok && d && d.ok){ currentUser = d.user || currentUser; loadAccountForm(); toast('头像已更新') }
    else toast((d && d.message) || ('上传失败（HTTP ' + r.status + '）'))
  }catch(e){ toast('上传失败：网络异常') }
  input.value = ''
}

async function saveAccountPassword(){
  const cur = (document.getElementById('accCurPwd') || {}).value || ''
  const nw = (document.getElementById('accNewPwd') || {}).value || ''
  const cfm = (document.getElementById('accConfirmPwd') || {}).value || ''
  if (!cur || !nw){ toast('请填写当前密码和新密码'); return }
  if (nw !== cfm){ toast('两次输入的新密码不一致'); return }
  if (nw.length < 8){ toast('新密码至少 8 位'); return }
  try{
    const r = await accFetch('/api/me/password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: cur, newPassword: nw })
    })
    const d = await r.json().catch(function(){ return { ok:false, message:'修改失败（HTTP ' + r.status + '）' } })
    if (r.ok && d && d.ok){
      toast('密码已修改')
      ;['accCurPwd', 'accNewPwd', 'accConfirmPwd'].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = '' })
    } else toast((d && d.message) || ('修改失败（HTTP ' + r.status + '）'))
  }catch(e){ toast('修改失败：网络异常') }
}

/* ═══ 管理员重置用户密码（2026-10-23）═══ */
async function resetUserPassword(uid, name){
  var who = name || uid
  if(!confirm('确定重置「' + who + '」的密码吗？\n\n· 系统会生成 12 位随机临时密码\n· 该用户所有已登录设备立即下线\n· 临时密码只显示这一次，请复制后转告本人')) return
  try{
    var d = await api('/api/admin/users/' + encodeURIComponent(uid) + '/reset-password', { method: 'POST' })
    if(!d || !d.ok){ toast((d && d.message) || '重置失败'); return }
    var pwd = (d.data && d.data.tempPassword) || ''
    var nm = (d.data && d.data.name) || who
    alert('已重置「' + nm + '」的密码\n\n临时密码：' + pwd + '\n\n请复制并告知本人；本人登录后应立即在「账号设置」中修改。')
  }catch(e){ toast('重置失败：网络异常') }
}

/* ═══ 大文件流式上传（2026-10-23）═══
   走 /api/materials/upload-big：二进制 body 直落临时文件，内存恒定 1~2MB。
   元数据走 query；带真实进度条。 */
function bigUploadOverlay(name, totalParts, doneParts){
  try { var old = document.getElementById('bigUpMask'); if (old) old.remove() } catch (e) {}
  var el = document.createElement('div')
  el.id = 'bigUpMask'
  el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(8,10,16,.82);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)'
  el.innerHTML = '<div style="min-width:340px;max-width:90vw;background:var(--card,#151a24);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:16px;padding:24px 26px;color:var(--text,#e7ebf3)">'
    + '<div style="font-size:14px;font-weight:800;margin-bottom:6px">正在上传大文件</div>'
    + '<div style="font-size:12.5px;color:var(--text-3,#8a93a5);margin-bottom:14px;word-break:break-all">' + name + '</div>'
    + '<div style="height:8px;border-radius:6px;background:rgba(128,128,128,.18);overflow:hidden">'
    + '<div id="bigUpBar" style="height:100%;width:0%;background:linear-gradient(90deg,#D4AF37,#E5C558);transition:width .2s"></div></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-3,#8a93a5);margin-top:8px">'
    + '<span id="bigUpPct">0%</span><span id="bigUpSize">0 MB</span></div>'
    + (totalParts ? '<div id="bigUpPart" style="font-size:11.5px;color:var(--text-3,#8a93a5);margin-top:6px">分片 ' + (doneParts || 0) + ' / ' + totalParts + '</div>' : '')
    + '<div style="font-size:11.5px;color:var(--text-3,#8a93a5);margin-top:12px;line-height:1.6">上传期间请勿关闭页面或切换网络</div>'
    + '</div>'
  document.body.appendChild(el)
  return el
}

function getCsrfToken(){
  try {
    // 必须取【最后一个】csrf，与服务端 parseCookies 一致（同名 cookie 可能有多份）
    var all = String(document.cookie || '').split(';')
    var val = ''
    for (var i = 0; i < all.length; i++) { var kv = all[i].trim(); if (kv.indexOf('csrf=') === 0) val = kv.slice(5) }
    return val ? decodeURIComponent(val) : ''
  } catch (e) { return '' }
}

/* 大文件入口：优先 OSS 分片直传（10GB 级也不占服务器），失败回退本地流式上传 */
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

/* ═══ OSS 分片直传：10MB/片 · 3 片并发 · 断点续传（uploadId 查已传分片）═══ */
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

  // 断点续传：查已成功分片
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

  function paint(){
    var p = Math.min(100, Math.round(uploadedBytes / file.size * 100))
    if (bar) bar.style.width = p + '%'
    if (pctEl) pctEl.textContent = p + '%'
    if (szEl) szEl.textContent = fmtFileSize(uploadedBytes) + ' / ' + fmtFileSize(file.size)
    if (partEl) partEl.textContent = '分片 ' + Object.keys(done).length + ' / ' + total
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
        var res = await fetch(sj.data.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' }, // 必须与签名时一致
          body: blob
        })
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

  if (failed) {
    try { mask.remove() } catch (e) {}
    return { ok: false, message: '部分分片上传失败，请重试（已传分片会保留，可续传）' }
  }

  var parts = Object.keys(done).map(function(n){ return { n: Number(n), etag: done[n] } })
  var cbody = Object.assign({}, meta, { key: key, uploadId: uploadId, parts: parts, size: file.size, name: file.name, mime: file.type || '' })
  var cb = await fetch('/api/oss/multipart/complete', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify(cbody)
  })
  var cj = await cb.json().catch(function(){ return null })
  try { mask.remove() } catch (e) {}
  if (cb.ok && cj && cj.ok) return cj
  return { ok: false, message: (cj && cj.message) || ('合并失败 HTTP ' + cb.status) }
}

/* ═══ 本地流式上传（OSS 不可用时的回退）═══ */
function uploadViaLocalBig(file, meta){
  return new Promise(function(resolve){
    var mask = bigUploadOverlay(file.name || '未命名文件')
    var bar = document.getElementById('bigUpBar')
    var pct = document.getElementById('bigUpPct')
    var sz = document.getElementById('bigUpSize')
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
      if (pct) pct.textContent = p + '%'
      if (sz) sz.textContent = fmtFileSize(e.loaded) + ' / ' + fmtFileSize(e.total)
    }
    xhr.onload = function(){
      try { mask.remove() } catch (e) {}
      var d = null
      try { d = JSON.parse(xhr.responseText) } catch (e) {}
      if (!d) { resolve({ ok: false, message: '上传失败（HTTP ' + xhr.status + '）' }); return }
      resolve(d)
    }
    xhr.onerror = function(){ try { mask.remove() } catch (e) {} resolve({ ok: false, message: '网络中断，上传失败' }) }
    xhr.ontimeout = function(){ try { mask.remove() } catch (e) {} resolve({ ok: false, message: '上传超时' }) }
    xhr.send(file)
  })
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
