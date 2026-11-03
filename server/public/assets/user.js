let currentUser=null, colleges=[], pendingFiles=[], pendingFile=null, pendingThumbBlob=null, pendingMeta={width:0,height:0,duration:0}
let curLang = localStorage.getItem('lang') || 'zh'
let currentTab = null

/* ========== Smart Tag Input ========== */
var _tagDB=null;
async function loadTagDB(){
  if(_tagDB) return _tagDB;
  try{
    var r=await fetch('/api/tags'); var j=await r.json();
    if(j.ok){ _tagDB=j.data; return _tagDB; }
  }catch(e){}
  _tagDB=[]; return _tagDB;
}
function initTagInput(input){
  if(!input||input.dataset._tagInit) return;
  input.dataset._tagInit='1';
  var box=document.createElement('div'); box.className='tag-suggest'; box.style.display='none';
  box.setAttribute('role','listbox');
  box.setAttribute('aria-label','标签建议');
  input.parentNode.style.position='relative';
  input.parentNode.appendChild(box);
  input.setAttribute('aria-haspopup','listbox');
  input.setAttribute('aria-expanded','false');
  input.setAttribute('aria-activedescendant','');
  var curIdx=-1;
  function render(items,q){
    if(!items.length){ box.style.display='none'; input.setAttribute('aria-expanded','false'); return; }
    box.innerHTML='';
    items.forEach(function(it,i){
      var d=document.createElement('div'); d.className='tag-suggest-item';
      d.setAttribute('role','option'); d.id='tag-opt-'+i; d.setAttribute('aria-selected','false');
      d.innerHTML='<span class="tag-name">#'+it.tag+'</span><span class="tag-count">'+it.count+'</span>';
      d.addEventListener('click',function(){
        insertTag(it.tag); box.style.display='none'; input.setAttribute('aria-expanded','false'); input.setAttribute('aria-activedescendant','');
      });
      box.appendChild(d);
    });
    curIdx=-1;
    box.style.display='block';
    input.setAttribute('aria-expanded','true');
  }
  function insertTag(tag){
    var v=input.value, pos=input.selectionStart;
    var before=v.substring(0,pos), after=v.substring(pos);
    var hashIdx=before.lastIndexOf('#');
    if(hashIdx>=0){
      input.value=before.substring(0,hashIdx)+'#'+tag+' '+after;
      var newCaret=hashIdx+tag.length+2;
      input.focus(); input.setSelectionRange(newCaret,newCaret);
    }
  }
  input.addEventListener('input',async function(){
    var v=input.value, pos=input.selectionStart;
    var before=v.substring(0,pos);
    var hashIdx=before.lastIndexOf('#');
    if(hashIdx<0){ box.style.display='none'; input.setAttribute('aria-expanded','false'); return; }
    var q=before.substring(hashIdx+1).trim();
    if(q.length===0){
      if(_tagDB){ render(_tagDB.slice(0,8),q); }
      return;
    }
    if(!/[a-zA-Z0-9一-龥]/.test(q)){ box.style.display='none'; input.setAttribute('aria-expanded','false'); return; }
    if(!_tagDB) await loadTagDB();
    var matches=_tagDB.filter(function(it){ return it.tag.indexOf(q)>=0; }).slice(0,8);
    render(matches,q);
  });
  input.addEventListener('keydown',function(e){
    var items=box.querySelectorAll('.tag-suggest-item');
    if(box.style.display==='none'||!items.length) return;
    if(e.key==='ArrowDown'){ e.preventDefault(); curIdx=Math.min(curIdx+1,items.length-1); items.forEach(function(it,i){ it.classList.toggle('active',i===curIdx); }); input.setAttribute('aria-activedescendant', curIdx>=0 ? items[curIdx].id : ''); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); curIdx=Math.max(curIdx-1,0); items.forEach(function(it,i){ it.classList.toggle('active',i===curIdx); }); input.setAttribute('aria-activedescendant', curIdx>=0 ? items[curIdx].id : ''); }
    else if(e.key==='Enter'&&curIdx>=0){ e.preventDefault(); items[curIdx].click(); }
    else if(e.key==='Escape'){ box.style.display='none'; input.setAttribute('aria-expanded','false'); }
  });
}

const UI = {
  'brand.name':{zh:'融媒体素材平台',en:'Media Platform'},
  'brand.sub':{zh:'我的工作室',en:'MY STUDIO'},
  'nav.dashboard':{zh:'工作台',en:'Workspace'},
  'nav.materials':{zh:'我的素材',en:'My Materials'},
  'nav.drafts':{zh:'草稿箱',en:'Drafts'},
  'nav.downloads':{zh:'下载记录',en:'Downloads'},
  'tab.downloads':{zh:'下载记录',en:'Downloads'},
  'empty.downloads':{zh:'还没有下载记录',en:'No downloads yet'},
  'dl.deleted':{zh:'素材已删除',en:'Material deleted'},
  'dl.tip':{zh:'在素材库下载的素材会出现在这里',en:'Materials you download will appear here'},
  'nav.messages':{zh:'消息中心',en:'Messages'},
  'nav.profile':{zh:'账号设置',en:'Settings'},
  'btn.logout':{zh:'退出登录',en:'Logout'},
  'btn.home':{zh:'返回首页',en:'Home'},
  'sm.menu':{zh:'菜单',en:'Menu'},
  'sm.close':{zh:'关闭',en:'Close'},
  'sm.quickActions':{zh:'快捷操作',en:'Quick Actions'},
  'hello':{zh:'你好，',en:'Hello, '},
  'tab.dashboard':{zh:'工作台',en:'Workspace'},
  'tab.materials':{zh:'我的素材',en:'My Materials'},
  'tab.favorites':{zh:'我的收藏',en:'My Favorites'},
  'nav.favorites':{zh:'我的收藏',en:'Favorites'},
  'tab.drafts':{zh:'草稿箱',en:'Drafts'},
  'tab.messages':{zh:'消息中心',en:'Messages'},
  'tab.profile':{zh:'账号设置',en:'Settings'},
  'stat.total':{zh:'素材总数',en:'Total Materials'},
  'stat.published':{zh:'已发布',en:'Published'},
  'stat.reviewing':{zh:'审核中',en:'Reviewing'},
  'stat.drafts':{zh:'草稿',en:'Drafts'},
  'stat.likes':{zh:'获赞',en:'Likes'},
  'stat.downloads':{zh:'下载',en:'Downloads'},
  'sec.recent':{zh:'最近上传',en:'Recent Uploads'},
  'sec.drafts':{zh:'草稿箱',en:'Drafts'},
  'sec.profile':{zh:'个人资料',en:'Profile'},
  'sec.upload':{zh:'上传素材',en:'Upload Material'},
  'st.draft':{zh:'草稿',en:'Draft'},
  'st.pending':{zh:'审核中',en:'Reviewing'},
  'st.approved':{zh:'已通过',en:'Approved'},
  'st.published':{zh:'已发布',en:'Published'},
  'st.archived':{zh:'已归档',en:'Archived'},
  'st.rejected':{zh:'已拒绝',en:'Rejected'},
  'type.image':{zh:'图片',en:'Image'},
  'type.video':{zh:'视频',en:'Video'},
  'type.doc':{zh:'文档',en:'Document'},
  'type.audio':{zh:'音频',en:'Audio'},
  'type.other':{zh:'其他',en:'Other'},
  'upload.tip':{zh:'提交审核后将由管理员审核，通过后公开展示；也可先保存为草稿。',en:'Submissions are reviewed by admin. Approved materials are displayed publicly. You can also save as draft.'},
  'upload.title':{zh:'素材标题',en:'Title'},
  'upload.titlePh':{zh:'给你的素材起个名字',en:'Name your material'},
  'upload.college':{zh:'所属学院',en:'College'},
  'upload.selectCollege':{zh:'--请选择--',en:'-- Select --'},
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
  'upload.drop':{zh:'点击选择文件，或将文件拖到此处',en:'Click or drag file here'},
  'upload.fmt':{zh:'支持 JPG / PNG / MP4 / PDF / MP3 等格式 · 大文件自动分片上传，视频最大 1GB',en:'JPG / PNG / MP4 / PDF / MP3 · Large files auto-split, video up to 1GB'},
  'upload.subScene':{zh:'拍摄场景',en:'Scene Type'},
  'upload.subDoc':{zh:'文档类型',en:'Document Type'},
  'upload.subAudio':{zh:'音频类型',en:'Audio Type'},
  'upload.subFormat':{zh:'照片格式',en:'Image Format'},
  'upload.subOther':{zh:'自定义标签',en:'Custom Tag'},
  'upload.subOtherPh':{zh:'输入自定义标签',en:'Enter custom tag'},
  'upload.draft':{zh:'保存草稿',en:'Save Draft'},
  'upload.submit':{zh:'提交审核',en:'Submit'},
  'profile.avatar':{zh:'头像',en:'Avatar'},
  'profile.changeAvatar':{zh:'更换头像',en:'Change Avatar'},
  'profile.name':{zh:'姓名',en:'Name'},
  'profile.namePh':{zh:'你的姓名',en:'Your name'},
  'profile.college':{zh:'学院',en:'College'},
  'profile.grade':{zh:'年级',en:'Grade'},
  'profile.bio':{zh:'简介',en:'Bio'},
  'profile.bioPh':{zh:'写一句话介绍自己...',en:'Introduce yourself...'},
  'profile.save':{zh:'保存资料',en:'Save Profile'},
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
  'profile.student':{zh:'同学',en:'Student'},
  'detail.title':{zh:'素材详情',en:'Details'},
  'detail.duration':{zh:'秒',en:'s'},
  'detail.uploadedAt':{zh:'上传于',en:'Uploaded'},
  'detail.submit':{zh:'提交审核',en:'Submit'},
  'detail.resubmit':{zh:'重新提交',en:'Resubmit'},
  'detail.download':{zh:'下载文件',en:'Download'},
  'detail.close':{zh:'关闭',en:'Close'},
  'detail.noExist':{zh:'素材不存在',en:'Material not found'},
  'empty.dashboard':{zh:'还没有上传素材',en:'No uploads yet'},
  'empty.materials':{zh:'还没有素材',en:'No materials yet'},
  'empty.favorites':{zh:'还没有收藏',en:'No favorites yet'},
  'misc.unfav':{zh:'取消收藏',en:'Unfavorite'},
  'misc.retry':{zh:'重新加载',en:'Retry'},
  'misc.favTip':{zh:'在素材库点击收藏按钮，喜欢的素材会出现在这里',en:'Tap the favorite button in the library and favorites will appear here'},
  't.unfav':{zh:'已取消收藏',en:'Removed from favorites'},
  'empty.drafts':{zh:'草稿箱为空',en:'Drafts empty'},
  'empty.messages':{zh:'暂无消息',en:'No messages'},
  'msg.like':{zh:'点赞通知',en:'Like Notification'},
  'msg.download':{zh:'下载通知',en:'Download Notification'},
  'msg.liked':{zh:'赞了',en:'liked'},
  'msg.dled':{zh:'下载了',en:'downloaded'},
  'msg.yourMat':{zh:'你的素材',en:'your material'},
  't.submitted':{zh:'已提交审核',en:'Submitted for review'},
  't.resubmitted':{zh:'已重新提交',en:'Resubmitted'},
  't.noExist':{zh:'素材不存在',en:'Material not found'},
  't.needTitle':{zh:'请填写素材标题',en:'Please enter a title'},
  't.needCollege':{zh:'请选择所属学院',en:'Please select college'},
  't.needType':{zh:'请选择素材类型',en:'Please select type'},
  't.saving':{zh:'保存中...',en:'Saving...'},
  't.submitting':{zh:'提交中...',en:'Submitting...'},
  't.draftOk':{zh:'草稿已保存',en:'Draft saved'},
  't.submitOk':{zh:'提交成功，等待管理员审核',en:'Submitted, awaiting review'},
  't.retry':{zh:'操作失败，请重试',en:'Failed, please retry'},
  't.nameEmpty':{zh:'姓名不能为空',en:'Name required'},
  't.profileOk':{zh:'资料已保存',en:'Profile saved'},
  't.profileFail':{zh:'保存失败',en:'Save failed'},
  't.imgOnly':{zh:'请上传图片',en:'Please upload an image'},
  't.avatarOk':{zh:'头像已更新',en:'Avatar updated'},
  't.avatarFail':{zh:'上传失败',en:'Upload failed'},
  't.netFail':{zh:'网络连接失败，请检查网络后重试',en:'Network failed. Check connection.'},
  't.netFail2':{zh:'网络连接失败',en:'Network failed'}, 'dir.boo':{zh:'导航',en:'Directory'}, 'dl.box':{zh:'下载',en:'Download'},
  't.badResp':{zh:'返回异常',en:'Bad response'},
  'filter.all':{zh:'全部状态',en:'All Status'},
  'filter.published':{zh:'已发布',en:'Published'},
  'filter.reviewing':{zh:'审核中',en:'Reviewing'},
  'filter.approved':{zh:'已通过',en:'Approved'},
  'filter.rejected':{zh:'已拒绝',en:'Rejected'},
  'filter.archived':{zh:'已归档',en:'Archived'},
  'misc.loading':{zh:'加载中...',en:'Loading...'},
  'misc.download':{zh:'下载',en:'Download'},
  'misc.count':{zh:'共',en:'Total '},
  'misc.items':{zh:'件',en:'items'},
  'misc.prev':{zh:'上一页',en:'Prev'},
  'misc.next':{zh:'下一页',en:'Next'},
  'misc.people':{zh:'人报名',en:'registered'},
  'misc.accounts':{zh:'个账号',en:'accounts'},
  'misc.records':{zh:'条',en:'records'},
  'misc.hasResume':{zh:'已上传',en:'Uploaded'},
  'misc.noResume':{zh:'未上传',en:'Not uploaded'},
  'misc.searchPh':{zh:'搜索我的素材...',en:'Search my materials...'},
  'grade.2026':{zh:'2026级',en:'Class 2026'},
  'grade.2025':{zh:'2025级',en:'Class 2025'},
  'grade.2024':{zh:'2024级',en:'Class 2024'},
  'grade.2023':{zh:'2023级',en:'Class 2023'},
  'grade.2022':{zh:'2022级',en:'Class 2022'},
  'sub.air':{zh:'空镜',en:'B-Roll'},
  'sub.aerial':{zh:'航拍',en:'Aerial'},
  'sub.ground':{zh:'地拍',en:'Ground'},
  'sub.timelapse':{zh:'延时摄影',en:'Timelapse'},
  'sub.slowmo':{zh:'慢动作',en:'Slow Motion'},
  'sub.transition':{zh:'转场',en:'Transition'},
  'sub.interview':{zh:'采访',en:'Interview'},
  'sub.event':{zh:'活动记录',en:'Event Record'},
  'sub.vlog':{zh:'Vlog',en:'Vlog'},
  'sub.promo':{zh:'宣传片',en:'Promo'},
  'sub.ppt':{zh:'课件PPT',en:'Courseware PPT'},
  'sub.thesis':{zh:'论文',en:'Thesis'},
  'sub.notes':{zh:'笔记',en:'Notes'},
  'sub.template':{zh:'模板',en:'Template'},
  'sub.report':{zh:'报告',en:'Report'},
  'sub.lesson':{zh:'教案',en:'Lesson Plan'},
  'sub.plan':{zh:'策划案',en:'Proposal'},
  'sub.script':{zh:'脚本',en:'Script'},
  'sub.music':{zh:'配乐',en:'Score'},
  'sub.sfx':{zh:'音效',en:'Sound Effect'},
  'sub.voiceover':{zh:'旁白配音',en:'Voiceover'},
  'sub.live':{zh:'现场录音',en:'Live Recording'},
  'sub.intro':{zh:'片头音乐',en:'Intro Music'},
  'sub.bgm':{zh:'背景音乐',en:'Background Music'},
  'dur.hour':{zh:'时',en:'h'},
  'dur.min':{zh:'分',en:'m'},
  'dur.sec':{zh:'秒',en:'s'},
  // College names
  'col.kuajing':{zh:'商学院',en:'Cross-border Commerce'}, 'col.guanli':{zh:'管理学院',en:'School of Management'},
  'col.waiyu':{zh:'外语外贸学院',en:'Foreign Languages & Trade'}, 'col.wenxue':{zh:'人文学院',en:'Literature & Creative Media'},
  'col.shuxue':{zh:'计算机学院',en:'Math & Computer Science'}, 'col.dashuju':{zh:'智能工程学院',en:'Big Data & Intelligent Engineering'},
  'col.chaoda':{zh:'数字治理学院',en:'Chongqing Digital Governance'}, 'col.yishu':{zh:'设计学院',en:'Art & Design'},
  'col.yinyue':{zh:'音乐学院',en:'Music & Dance'}, 'col.jiaoyu':{zh:'教育学院',en:'Education'},
  'col.tiyu':{zh:'体育学院',en:'Sports & Health'}, 'col.makesi':{zh:'通识教育学院',en:'Marxism Studies'},
  'col.guoji':{zh:'国际学院',en:'International College'}, 'col.rongmeiti':{zh:'传媒学院',en:'Film, TV & Media'},
}
function ut(k){const e=UI[k];return e?(e[curLang]||e.zh):k}
function refreshCustomSelects(){
  document.querySelectorAll('.cs-wrapper').forEach(w=>{
    const sel=w.querySelector('select');if(!sel)return
    const trig=w.querySelector('.cs-trigger')
    if(trig){trig.textContent=sel.options[sel.selectedIndex]?sel.options[sel.selectedIndex].textContent:'';trig.insertAdjacentHTML('beforeend',CS_ARROW)}
    const dd=w.querySelector('.cs-dropdown')
    if(dd){const items=dd.querySelectorAll('.cs-option');Array.from(sel.options).forEach((opt,i)=>{if(items[i])items[i].textContent=opt.textContent})}
  })
}
function setUserLang(lang){
  curLang=lang; localStorage.setItem('lang',lang)
  document.querySelectorAll('#langToggle span').forEach(s=>s.classList.toggle('active',s.dataset.lang===lang))
  document.querySelectorAll('[data-i18n]').forEach(el=>{const k=el.dataset.i18n;if(UI[k])el.textContent=ut(k)})
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{const k=el.dataset.i18nPh;if(UI[k])el.placeholder=ut(k)})
  document.querySelectorAll('[data-i18n-html]').forEach(el=>{const k=el.dataset.i18nHtml;if(UI[k])el.innerHTML=ut(k)})
  if(currentTab) $('pageTitle').textContent=ut('tab.'+currentTab)
  document.title=lang==='en'?'My Studio · Media Platform':'我的工作室 · 融媒体素材平台'
  if(currentUser) $('userName').textContent=ut('hello')+currentUser.name
  refreshCustomSelects()
  if(window.SM_USER) SM_USER.reRender()
  if(currentTab==='dashboard') loadDashboard()
  else if(currentTab==='materials') loadMyMaterials()
  else if(currentTab==='drafts') loadDrafts()
  else if(currentTab==='messages') loadMessages()
}
function toggleLang(){setUserLang(curLang==='zh'?'en':'zh')}

/* ── 移动端侧栏切换 ── */
function toggleMobileSidebar(){
  const sb=$('userSidebar'),ov=$('sidebarOverlay')
  sb.classList.toggle('mobile-show')
  ov.classList.toggle('show')
}
function closeMobileSidebar(){
  const sb=$('userSidebar'),ov=$('sidebarOverlay')
  sb.classList.remove('mobile-show')
  ov.classList.remove('show')
}

async function doLogout(){await api('/api/logout',{method:'POST'});location.href='/login.html'}
function showLogin(){currentUser=null;location.href='/login.html'}

/* ── 初始化 ── */
async function showMain(){
  $('mainLayout').classList.remove('hidden')
  $('userName').textContent=ut('hello')+currentUser.name;$('userAvatar').textContent=(currentUser.name||'?').charAt(0)
  setUserLang(curLang)
  if(currentUser.avatar){$('userAvatar').style.backgroundImage=`url(/api/avatars/${currentUser.avatar})`;$('userAvatar').style.backgroundSize='cover';$('userAvatar').textContent=''}
  const cl=await api('/api/colleges');colleges=cl.data||[]
  const sel=$('uploadCollege');sel.innerHTML='<option value="" data-i18n="upload.selectCollege">'+ut('upload.selectCollege')+'</option>'+colleges.map(c=>`<option value="${esc(c.name)}">${esc(collegeName(c.name))}</option>`).join('')
  $('pCollege').innerHTML=colleges.map(c=>`<option value="${esc(c.name)}"${c.name===currentUser.college?' selected':''}>${esc(collegeName(c.name))}</option>`).join('')
  initCustomSelects(document)
  initTagInput($('uploadTags'))
  loadTagDB()
  switchTab('dashboard')
}

/* ── 页面切换 ── */
const TAB_TITLES={dashboard:'tab.dashboard',materials:'tab.materials',favorites:'tab.favorites',drafts:'tab.drafts',downloads:'tab.downloads',messages:'tab.messages',profile:'tab.profile'}
async function switchTab(tab){
  currentTab=tab
  document.querySelectorAll('.nav-item').forEach(n=>{n.classList.remove('active');n.removeAttribute('aria-current')})
  var activeNav=document.querySelector(`.nav-item[data-tab="${tab}"]`)
  if(activeNav){activeNav.classList.add('active');activeNav.setAttribute('aria-current','page')}
  document.querySelectorAll('.tab-pane').forEach(t=>t.classList.add('hidden'))
  $('tab-'+tab).classList.remove('hidden')
  $('pageTitle').textContent=ut(TAB_TITLES[tab]||tab)
  closeMobileSidebar()
  if(window.SM_USER) SM_USER.updateActive()
  if(tab==='dashboard') loadDashboard()
  if(tab==='materials') loadMyMaterials()
  if(tab==='favorites') loadMyFavorites()
  if(tab==='drafts') loadDrafts()
  if(tab==='downloads') loadDownloads(1)
  if(tab==='messages') loadMessages()
  if(tab==='profile'){ loadProfileForm(); load2FA() }
}

/* ── 弹窗 ── */
function openModal(id){ var el=$(id); el.classList.remove('hidden'); if(window._modalOnOpen) window._modalOnOpen(el) }
function closeModal(id){
  const el=$(id)
  el.querySelector('.modal-box').classList.add('closing')
  el.classList.add('closing')
  if(window._modalOnClose) window._modalOnClose(el)
  setTimeout(()=>{el.classList.add('hidden');el.classList.remove('closing');el.querySelector('.modal-box').classList.remove('closing')},180)
}

/* ── 工作台 ── */
function loadingHTML(){return '<div class="empty-state" style="opacity:.5"><div class="icon" style="animation:spin 1s linear infinite"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div><p>'+ut('misc.loading')+'</p></div>'}
function errorHTML(msg){return '<div class="empty-state"><div class="icon" style="color:#f87171"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><p style="color:#f87171">'+(msg||ut('t.netFail2'))+'</p></div>'}
async function loadDashboard(){
  $('statsRow').innerHTML=loadingHTML()
  const[st,my,msgs]=await Promise.all([api('/api/me/stats'),api('/api/me/materials'),api('/api/me/notifications')])
  if(!st.ok||!my.ok){$('recentUploads').innerHTML=errorHTML();return}
  const s=st.data||{},mats=my.data||[],notifications=msgs.data||[]
  const unread=notifications.filter(n=>!n.read).length
  $('statsRow').innerHTML=[
    ['stat.total',s.uploaded||0,''],['stat.published',s.published||0,'success'],
    ['stat.reviewing',s.pending||0,'highlight'],['stat.drafts',s.drafts||0,''],
    ['stat.likes',s.totalLikes||0,'highlight'],['stat.downloads',s.totalDownloads||0,'']
  ].map(c=>`<div class="stat-card ${c[2]}" onclick="switchTab('materials')"><div class="num" data-count="${c[1]}">0</div><div class="label">${ut(c[0])}</div></div>`).join('')
  countUpAll($('statsRow'))
  $('draftBadge').textContent='0';countUp($('draftBadge'),s.drafts||0,800)
  $('draftBadge').style.display=s.drafts?'inline-block':'none'
  $('msgBadge').textContent='0';countUp($('msgBadge'),unread||0,800)
  $('msgBadge').style.display=unread?'inline-block':'none'
  const recent=mats.slice(0,4)
  $('recentUploads').innerHTML=recent.length?recent.map(m=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px"><span class="status-pill ${m.status}">${statusLabel(m.status)}</span><span style="flex:1">${esc(m.title)}</span><span style="color:var(--text-3);font-size:11px">${esc((m.created_at||'').slice(0,10))}</span></div>`).join(''):'<div class="empty-state"><div class="icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div><p>'+ut('empty.dashboard')+'</p></div>'
}

/* ── 素材卡片/状态 ── */
const statusNames={draft:'st.draft',pending_review:'st.pending',approved:'st.approved',published:'st.published',archived:'st.archived',rejected:'st.rejected'}
function statusLabel(s){return ut(statusNames[s]||s)}
const TYPE_KEY_MAP={'图片':'image','视频':'video','文档':'doc','音频':'audio','其他':'other',image:'image',video:'video',doc:'doc',audio:'audio',other:'other'}
const typeIcons={image:'IMG',video:'VID',doc:'DOC',audio:'AUD',other:'FILE'}
function typeToKey(t){return TYPE_KEY_MAP[t]||'other'}
function typeLabel(t){return ut('type.'+typeToKey(t))}
function fmtFileSize(b){if(!b)return'';if(b>1048576)return(b/1048576).toFixed(1)+'MB';if(b>1024)return(b/1024).toFixed(0)+'KB';return b+'B'}

/* College name translation */
const COLLEGE_NAME_MAP={'商学院':'col.kuajing','管理学院':'col.guanli','外语外贸学院':'col.waiyu','人文学院':'col.wenxue','计算机学院':'col.shuxue','智能工程学院':'col.dashuju','数字治理学院':'col.chaoda','设计学院':'col.yishu','音乐学院':'col.yinyue','教育学院':'col.jiaoyu','体育学院':'col.tiyu','通识教育学院':'col.makesi','国际学院':'col.guoji','传媒学院':'col.rongmeiti'}
function collegeName(n){if(!n)return'';const k=COLLEGE_NAME_MAP[n];return k?ut(k):n}

/* Material title translation (database content) */
const MATERIAL_TITLE_MAP={'校园春日樱花摄影集':'Campus Cherry Blossom Photography','校运会精彩瞬间混剪':'Sports Day Highlights Mix','大创答辩PPT模板':'Innovation Competition PPT Template','校园广播片头音乐':'Campus Radio Intro Music','图书馆建筑摄影组图':'Library Architecture Photography','校园微电影《青春序曲》':'Campus Micro-film "Youth Overture"','校园文化节海报设计稿':'Culture Festival Poster Design','模拟法庭辩论赛录像':'Mock Court Debate Recording','数据结构课程笔记整理':'Data Structures Course Notes','校园Vlog - 一日生活':'Campus Vlog - A Day in Life','毕业季纪念视频素材包':'Graduation Memorial Video Pack','校园植物图鉴手册':'Campus Plant Illustrated Handbook','网盘测试素材':'Cloud Drive Test Material'}
function materialTitle(t){if(!t)return'';return curLang==='en'?(MATERIAL_TITLE_MAP[t]||t):t}
const MATERIAL_DESC_MAP={'校园春日樱花摄影集':'A collection of cherry blossom photography on campus during spring.','校运会精彩瞬间混剪':'Highlights mix from the campus sports day.','大创答辩PPT模板':'A clean PPT template for innovation competition defense presentations.','校园广播片头音乐':'Intro music for the campus radio station.','图书馆建筑摄影组图':'Architectural photography of the campus library.','校园微电影《青春序曲》':'A campus micro-film about youth and dreams.','校园文化节海报设计稿':'Poster design for the campus culture festival.','模拟法庭辩论赛录像':'Recording of the mock court debate competition.','数据结构课程笔记整理':'Organized course notes for Data Structures.','校园Vlog - 一日生活':'A vlog capturing a day of campus life.','毕业季纪念视频素材包':'Video material pack for graduation memories.','校园植物图鉴手册':'An illustrated handbook of plants found on campus.','网盘测试素材':'Test material with cloud drive link.'}
function materialDesc(d){if(!d)return'';return curLang==='en'?(MATERIAL_DESC_MAP[d]||d):d}

function buildCard(m){
  const thumb=m.has_thumb&&m.thumb_filename?`<img src="/api/thumbs/${m.thumb_filename}" alt="${esc(m.title)}" loading="lazy" decoding="async">`:`<span style="font-size:13px;font-weight:700;letter-spacing:1px;opacity:.4">${typeIcons[typeToKey(m.type)]||'FILE'}</span>`
  return `<div class="mat-card" data-mid="${m.id}" tabindex="0" role="button">
    <div class="mat-thumb">${thumb}<span class="status-badge status-pill ${m.status}">${statusLabel(m.status)}</span></div>
    <div class="mat-body">
      <div class="mat-title" title="${esc(materialTitle(m.title))}">${esc(materialTitle(m.title))}</div>
      <div class="mat-meta">${m.file_size?`<span>${fmtFileSize(m.file_size)}</span><span class="dot"></span>`:''}<span>${esc(typeLabel(m.type))}</span></div>
      ${(m.tags||[]).length?`<div style="margin-bottom:6px;display:flex;gap:4px;flex-wrap:wrap">${m.tags.slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>`:''}
      ${m.status==='rejected'&&m.reject_reason?`<div style="font-size:12px;color:#f87171;margin-top:6px;line-height:1.5"><b>退回原因：</b>${esc(m.reject_reason)}</div>`:''}
    </div>
    <div class="mat-actions">
      ${m.status==='draft'?`<button class="btn btn-gold btn-sm" data-action="submit-draft" data-id="${m.id}">${ut('detail.submit')}</button>`:''}
      ${m.status==='rejected'?`<button class="btn btn-gold btn-sm" data-action="resubmit" data-id="${m.id}">${ut('detail.resubmit')}</button>`:''}
      ${m._fav?`<button class="btn btn-outline btn-sm" data-action="unfav" data-id="${m.id}">${ut('misc.unfav')}</button>`:''}
      ${m.has_file?`<a href="/api/materials/${m.id}/file" class="btn btn-outline btn-sm" style="text-decoration:none">${ut('misc.download')}</a>`:''}
    </div>
  </div>`
}

/* ── 我的素材 ── */
let matSearchT
function debounceLoadMats(){clearTimeout(matSearchT);matSearchT=setTimeout(loadMyMaterials,300)}

async function loadMyMaterials(){
  $('myMaterialsGrid').innerHTML=skeletonCardsHTML(6)
  const d=await api('/api/me/materials')
  if(!d.ok){$('myMaterialsGrid').innerHTML=emptyStateHTML({icon:'warn',title:ut('t.netFail2'),ctaText:ut('misc.retry')||'重试',ctaOnclick:'loadMyMaterials()'});return}
  let list=d.data||[]
  const q=$('matSearch').value.trim()
  if(q) list=list.filter(m=>m.title.includes(q)||(m.tags||[]).some(t=>t.includes(q)))
  const st=$('matStatusFilter').value
  if(st!=='all') list=list.filter(m=>m.status===st)
  $('myMaterialsGrid').innerHTML=list.length?list.map(buildCard).join(''):emptyStateHTML({icon:'folder',title:ut('empty.materials'),ctaText:ut('sec.upload'),ctaOnclick:'openUploadModal()'})
  applyStagger($('myMaterialsGrid'))
}

/* ── 我的收藏 ── */
async function loadMyFavorites(){
  $('myFavoritesGrid').innerHTML=skeletonCardsHTML(6)
  const d=await api('/api/me/favorites')
  if(!d.ok){$('myFavoritesGrid').innerHTML=emptyStateHTML({icon:'warn',title:ut('t.netFail2'),ctaText:ut('misc.retry')||'重试',ctaOnclick:'loadMyFavorites()'});return}
  const list=(d.data||[]).map(function(m){m._fav=true;return m})
  $('favCount').innerHTML=ut('misc.count')+' <span data-count="'+list.length+'">0</span> '+ut('misc.items')
  countUpAll($('favCount'))
  const badge=$('favBadge')
  if(badge){badge.textContent=list.length;badge.style.display=list.length?'inline-block':'none'}
  $('myFavoritesGrid').innerHTML=list.length?list.map(buildCard).join(''):emptyStateHTML({icon:'heart',title:ut('empty.favorites'),desc:ut('misc.favTip')||'在素材库点击收藏按钮，喜欢的素材会出现在这里'})
  applyStagger($('myFavoritesGrid'))
}
async function unfavoriteMaterial(id){
  const d=await api('/api/materials/favorite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({material_id:id})})
  if(d.ok){toast(ut('t.unfav')||'已取消收藏');loadMyFavorites()}
  else toast(d.message||'操作失败')
}

/* ── 草稿箱 ── */
async function loadDrafts(){
  $('myDraftsGrid').innerHTML=loadingHTML()
  const d=await api('/api/me/materials')
  if(!d.ok){$('myDraftsGrid').innerHTML=errorHTML();return}
  const list=(d.data||[]).filter(m=>m.status==='draft'||m.status==='rejected')
  $('draftCount').innerHTML=ut('misc.count')+' <span data-count="'+list.length+'">0</span> '+ut('misc.items')
  countUpAll($('draftCount'))
  $('myDraftsGrid').innerHTML=list.length?list.map(buildCard).join(''):'<div class="empty-state" style="grid-column:1/-1"><div class="icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z"/></svg></div><p>'+ut('empty.drafts')+'</p></div>'
}

async function submitDraft(id){const d=await api(`/api/materials/${id}/status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'submit'})});if(d.ok){toast(ut('t.submitted'));loadDrafts();loadMyMaterials()}else toast(d.message)}

/* ── 下载记录 ── */
var dlPage=1
function dlFormatSize(n){
  n=Number(n)||0
  if(n>=1048576) return (n/1048576).toFixed(1)+' MB'
  if(n>=1024) return (n/1024).toFixed(0)+' KB'
  return n+' B'
}
var _dlIconSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
async function loadDownloads(page){
  dlPage=page||1
  $('dlList').innerHTML=skeletonRowsHTML(6)
  const d=await api('/api/me/downloads?page='+dlPage+'&pageSize=20')
  if(!d.ok){$('dlList').innerHTML=emptyStateHTML({icon:'warn',title:ut('t.netFail2'),ctaText:ut('misc.retry')||'重试',ctaOnclick:'loadDownloads('+dlPage+')'});$('dlPager').style.display='none';return}
  const list=d.data||[],total=d.total||0
  $('dlCount').innerHTML=ut('misc.count')+' <span data-count="'+total+'">0</span> '+ut('misc.items')
  countUpAll($('dlCount'))
  $('dlList').innerHTML=list.length?list.map(dlRowHTML).join(''):emptyStateHTML({rawIcon:_dlIconSvg,title:ut('empty.downloads'),desc:ut('dl.tip')})
  applyStagger($('dlList'))
  renderDlPager(total,dlPage)
}
function dlRowHTML(r){
  const m=r.material
  const thumb=m&&m.thumb_filename?'/api/thumbs/'+encodeURIComponent(m.thumb_filename):null
  const time=(r.downloaded_at||'').replace('T',' ').slice(0,16)
  const meta=m?(esc(typeLabel(m.type))+(m.author?' · '+esc(m.author):'')+(m.file_size?' · '+dlFormatSize(m.file_size):'')):''
  return '<div class="dl-row"'+(m?' onclick="location.href=\'/material.html?id='+m.id+'\'" style="cursor:pointer"':'')+'>'+
    '<div class="dl-thumb">'+(thumb?'<img src="'+thumb+'" alt="'+esc(m.title)+'" loading="lazy" decoding="async">':'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>')+'</div>'+
    '<div class="dl-info"><div class="dl-title">'+(m?esc(m.title):ut('dl.deleted'))+'</div><div class="dl-meta">'+meta+'</div></div>'+
    '<div class="dl-time">'+esc(time)+'</div>'+
    '</div>'
}
function renderDlPager(total,page){
  const pager=$('dlPager'),pageSize=20,pages=Math.ceil(total/pageSize)
  if(pages<=1){pager.style.display='none';return}
  pager.style.display='flex'
  pager.innerHTML='<button class="btn btn-ghost btn-sm"'+(page<=1?' disabled':'')+' onclick="loadDownloads('+(page-1)+')">'+ut('misc.prev')+'</button>'+
    '<span style="align-self:center;font-size:12px;color:var(--text-3)">'+page+' / '+pages+'</span>'+
    '<button class="btn btn-ghost btn-sm"'+(page>=pages?' disabled':'')+' onclick="loadDownloads('+(page+1)+')">'+ut('misc.next')+'</button>'
}
async function resubmit(id){const d=await api(`/api/materials/${id}/status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resubmit'})});if(d.ok){toast(ut('t.resubmitted'));loadDrafts();loadMyMaterials()}else toast(d.message)}

/* ── 素材详情 ── */
async function openDetail(id){
  const d=await api('/api/materials/'+id)
  const m=d.data||d.material||d
  if(!m||m.id===undefined){toast(ut('t.noExist'));return}
  $('detailTitle').textContent=materialTitle(m.title)||ut('detail.title')
  const meta=[m.file_size?fmtFileSize(m.file_size):'',m.width&&m.height?m.width+'×'+m.height:'',m.duration?m.duration+ut('detail.duration'):''].filter(Boolean)
  $('detailBody').innerHTML=`
    <div style="margin-bottom:12px"><span class="status-pill ${m.status}">${statusLabel(m.status)}</span> <span style="font-size:12px;color:var(--text-3);margin-left:6px">${esc(typeLabel(m.type))} · ${esc(collegeName(m.college))}</span></div>
    ${materialDesc(m.description)?`<p style="font-size:13px;color:var(--text-2);margin-bottom:10px">${esc(materialDesc(m.description))}</p>`:''}
    ${meta.length?`<div style="font-size:12px;color:var(--text-3);margin-bottom:8px">${meta.join(' · ')}</div>`:''}
    ${(m.tags||[]).length?`<div style="margin-bottom:10px">${m.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>`:''}
    <div style="font-size:11px;color:var(--text-3)">${ut('detail.uploadedAt')} ${esc(m.created_at||'')}</div>
  `
  let btns=''
  if(m.status==='draft') btns+=`<button class="btn btn-gold btn-sm" data-action="submit-draft" data-id="${m.id}" data-close="detailModal">${ut('detail.submit')}</button>`
  if(m.status==='rejected') btns+=`<button class="btn btn-gold btn-sm" data-action="resubmit" data-id="${m.id}" data-close="detailModal">${ut('detail.resubmit')}</button>`
  if(m.has_file) btns+=`<a href="/api/materials/${m.id}/file" class="btn btn-primary btn-sm" style="text-decoration:none">${ut('detail.download')}</a>`
  btns+=`<button class="btn btn-outline btn-sm" onclick="closeModal('detailModal')">${ut('detail.close')}</button>`
  $('detailFooter').innerHTML=btns
  openModal('detailModal')
}

/* ── 上传 ── */
const UPLOAD_SUB_OPTIONS = {
  '图片': { labelKey:'upload.subFormat', items:['DNG','RAW','JPG','PNG','TIFF','PSD','HEIC','WEBP'] },
  '视频': { labelKey:'upload.subScene', itemKeys:['sub.air','sub.aerial','sub.ground','sub.timelapse','sub.slowmo','sub.transition','sub.interview','sub.event','sub.vlog','sub.promo'] },
  '文档': { labelKey:'upload.subDoc', itemKeys:['sub.ppt','sub.thesis','sub.notes','sub.template','sub.report','sub.lesson','sub.plan','sub.script'] },
  '音频': { labelKey:'upload.subAudio', itemKeys:['sub.music','sub.sfx','sub.voiceover','sub.live','sub.intro','sub.bgm'] },
  '其他': { labelKey:'upload.subOther', items:null }
}

function updateUploadSubOptions(type){
  const box=$('uploadSubOptions')
  if(!box)return
  const cfg=UPLOAD_SUB_OPTIONS[type]
  if(!cfg){
    box.classList.remove('open')
    setTimeout(function(){ if(!box.classList.contains('open')) box.innerHTML='' },350)
    return
  }
  const labelText=ut(cfg.labelKey)
  const labelStyle='display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--text-2)'
  if(cfg.items){
    var html='<label for="uploadSubSelect" style="'+labelStyle+'">'+labelText+'</label>'
    html+='<select id="uploadSubSelect" class="cs-custom" aria-label="子类型"><option value="">'+ut('upload.selectCollege')+'</option>'
    cfg.items.forEach(function(it){ html+='<option value="'+it+'">'+it+'</option>' })
    html+='</select>'
    box.innerHTML=html
    initCustomSelect($('uploadSubSelect'))
  } else if(cfg.itemKeys){
    var html='<label for="uploadSubSelect" style="'+labelStyle+'">'+labelText+'</label>'
    html+='<select id="uploadSubSelect" class="cs-custom" aria-label="子类型"><option value="">'+ut('upload.selectCollege')+'</option>'
    cfg.itemKeys.forEach(function(k){ html+='<option value="'+ut(k)+'">'+ut(k)+'</option>' })
    html+='</select>'
    box.innerHTML=html
    initCustomSelect($('uploadSubSelect'))
  } else {
    var html='<label for="uploadSubSelect" style="'+labelStyle+'">'+labelText+'</label>'
    html+='<input id="uploadSubSelect" type="text" placeholder="'+ut('upload.subOtherPh')+'" style="width:100%;padding:10px 14px;background:rgba(255,255,255,.04);border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;outline:none">'
    box.innerHTML=html
  }
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ box.classList.add('open') }) })
}

function openUploadModal(){
  pendingFiles=[];pendingFile=null;pendingThumbBlob=null;pendingMeta={width:0,height:0,duration:0}
  $('uploadPreview').style.display='none'
  $('uploadTitle').value='';$('uploadDesc').value='';$('uploadDate').value='';$('uploadTags').value='';$('uploadDrive').value=''
  $('uploadType').value=''
  $('uploadSubOptions').classList.remove('open')
  setTimeout(function(){ $('uploadSubOptions').innerHTML='' },350)
  $('uploadFile').value=''
  openModal('uploadModal')
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
  // 普通用户上限 1GB（2026-10-23）
  var _role2 = (currentUser && currentUser.is_admin) ? 'admin' : ((currentUser && currentUser.role) || 'student');
  var _maxMB2 = { admin: 20480, editor: 10240, reviewer: 10240, reporter: 5120, student: 1024 }[_role2] || 1024;
  if(f.size > _maxMB2*1024*1024){
    var _lbl2 = _maxMB2 >= 1024 ? (_maxMB2/1024) + 'GB' : _maxMB2 + 'MB';
    toast(curLang === 'en' ? ('File too large (max ' + _lbl2 + ')') : ('文件超过上限（最大 ' + _lbl2 + '）'));
    return;
  }
  pendingFile=f
  generatePreview(pendingFile)
}

function fmtDim(w,h){ if(!w||!h)return''; return w+'×'+h }
function fmtDuration(s){ if(!s)return''; if(s>=3600){var h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h+ut('dur.hour')+m+ut('dur.min')} if(s>=60){var m=Math.floor(s/60),sec=s%60;return m+ut('dur.min')+sec+ut('dur.sec')} return s+ut('dur.sec') }

function loadImage(file){
  return new Promise(function(resolve,reject){
    var img=new Image()
    var url=URL.createObjectURL(file)
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
  if(thumbWrap._lastBlobUrl){URL.revokeObjectURL(thumbWrap._lastBlobUrl);thumbWrap._lastBlobUrl=null}
  thumbWrap.innerHTML='<span style="font-size:13px;font-weight:700">'+(typeIcons[typeToKey($('uploadType').value)]||'FILE')+'</span>'
  if(file.type.startsWith('image/')){
    try{
      var img=await loadImage(file)
      pendingMeta.width=img.naturalWidth;pendingMeta.height=img.naturalHeight
      var canvas=document.createElement('canvas')
      var maxDim=300,ratio=Math.min(maxDim/img.naturalWidth,maxDim/img.naturalHeight,1)
      canvas.width=img.naturalWidth*ratio;canvas.height=img.naturalHeight*ratio
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height)
      canvas.toBlob(function(blob){ pendingThumbBlob=blob; if(thumbWrap._lastBlobUrl)URL.revokeObjectURL(thumbWrap._lastBlobUrl); var burl=URL.createObjectURL(blob); thumbWrap._lastBlobUrl=burl; thumbWrap.innerHTML='<img src="'+burl+'" alt="缩略图预览" style="width:80px;height:80px;object-fit:cover">' },'image/jpeg',0.82)
      metaEl.textContent=fmtFileSize(file.size)+' · '+fmtDim(pendingMeta.width,pendingMeta.height)
    }catch(e){ metaEl.textContent=fmtFileSize(file.size) }
  } else if(file.type.startsWith('video/')){
    try{
      var v=await readVideoMeta(file)
      pendingMeta.width=v.width;pendingMeta.height=v.height;pendingMeta.duration=Math.round(v.duration)
      thumbWrap.innerHTML='<span style="font-size:13px;font-weight:700">VID</span>'
      metaEl.textContent=fmtFileSize(file.size)+' · '+fmtDim(v.width,v.height)+' · '+fmtDuration(pendingMeta.duration)
    }catch(e){ metaEl.textContent=fmtFileSize(file.size)+' · '+ut('type.video') }
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
  if(!title){ toast(ut('t.needTitle'));return }
  if(!college){ toast(ut('t.needCollege'));return }
  if(!type){ toast(ut('t.needType'));return }
  var btn=isDraft?$('saveDraftBtn'):$('uploadBtn')
  var otherBtn=isDraft?$('uploadBtn'):$('saveDraftBtn')
  btn.disabled=true;otherBtn.disabled=true
  var lbl=btn.querySelector('span')
  lbl.textContent=isDraft?ut('t.saving'):ut('t.submitting')
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
  lbl.textContent=isDraft?ut('upload.draft'):ut('upload.submit')
  if(d.ok){
    toast(isDraft?ut('t.draftOk'):ut('t.submitOk'))
    closeModal('uploadModal')
    $('uploadTitle').value='';$('uploadDesc').value='';$('uploadDate').value='';$('uploadTags').value='';$('uploadDrive').value=''
    clearUploadFile()
    loadDashboard()
    if(isDraft) loadDrafts(); else loadMyMaterials()
  } else toast(d.message||ut('t.retry'))
}

/* 拖拽上传 */
var _uploadArea=document.getElementById('uploadArea')
if(_uploadArea){
  var _onDragOver=function(e){ e.preventDefault(); _uploadArea.style.borderColor='var(--gold)' }
  var _onDragLeave=function(){ _uploadArea.style.borderColor='' }
  var _onDrop=function(e){ e.preventDefault(); _uploadArea.style.borderColor=''; if(e.dataTransfer.files.length) handleFilesSelect(e.dataTransfer.files) }
  _uploadArea.addEventListener('dragover',_onDragOver)
  _uploadArea.addEventListener('dragleave',_onDragLeave)
  _uploadArea.addEventListener('drop',_onDrop)
  // store refs for potential cleanup
  _uploadArea._dragHandlers={over:_onDragOver,leave:_onDragLeave,drop:_onDrop}
}

/* ── 消息 ── */
async function loadMessages(){
  $('msgList').innerHTML=loadingHTML()
  const d=await api('/api/me/notifications')
  if(!d.ok){$('msgList').innerHTML=errorHTML();return}
  const list=d.data||[]
  if(!list.length){$('msgList').innerHTML='<div class="empty-state"><div class="icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div><p>'+ut('empty.messages')+'</p></div>';return}
  $('msgList').innerHTML=list.map(n=>`<div class="msg-item${n.read?'':' unread'}">
    <div class="msg-body"><div class="msg-title">${n.action==='like'?ut('msg.like'):ut('msg.download')}</div><div class="msg-detail">${esc(n.actor||'')} ${n.action==='like'?ut('msg.liked'):ut('msg.dled')}《${esc(n.material_title||'')}》</div></div>
    <div class="msg-time">${esc((n.created_at||'').slice(5,16))}</div></div>`).join('')
  // Mark all read
  const unread=list.filter(n=>!n.read)
  if(unread.length) {
    // 每 2s 逐条标记已读，不一次性全部标记
    unread.forEach((n,i)=>{
      setTimeout(()=>{
        api('/api/notifications/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[n.id]})})
      },i*2000)
    })
  }
}

/* ── 资料 ── */
function loadProfileForm(){
  if(!currentUser)return
  $('pName').value=currentUser.name||'';$('pBio').value=currentUser.bio||''
  for(const opt of $('pGrade').options){if(opt.value===currentUser.grade)opt.selected=true}
  const preview=$('profileAvatarPreview')
  if(currentUser.avatar){preview.style.backgroundImage=`url(/api/avatars/${currentUser.avatar})`;preview.style.backgroundSize='cover';preview.textContent=''}
  else{preview.style.backgroundImage='';preview.textContent=(currentUser.name||'?').charAt(0)}
}
async function saveProfile(){
  const name=$('pName').value.trim(),college=$('pCollege').value,grade=$('pGrade').value,bio=$('pBio').value.trim()
  if(!name){toast(ut('t.nameEmpty'));return}
  const d=await api('/api/me/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,college,grade,bio})})
  if(d.ok){currentUser=d.user;toast(ut('t.profileOk'));$('userName').textContent=currentUser.name}
  else toast(d.message||ut('t.profileFail'))
}
async function changePassword(){
  var cur=$('curPwd').value,nw=$('newPwd').value,cfm=$('confirmPwd').value
  if(!cur||!nw){toast(ut('profile.curPwdPh'));return}
  if(nw!==cfm){toast(ut('profile.pwdMismatch'));return}
  var d=await api('/api/me/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:cur,newPassword:nw})})
  if(d.ok){toast(ut('profile.pwdChanged'));$('curPwd').value='';$('newPwd').value='';$('confirmPwd').value=''}
  else toast(d.message||ut('profile.pwdChangeFail'))
}
async function uploadAvatar(input){
  const f=input.files[0];if(!f)return
  if(!f.type.startsWith('image/')){toast(ut('t.imgOnly'));return}
  if(f.size>5*1024*1024){toast(curLang==='en'?'Avatar too large (max 5MB)':'头像文件过大（限制5MB）');return}
  const fd=new FormData();fd.append('file',f)
  const d=await api('/api/me/avatar',{method:'POST',body:fd})
  if(d.ok){currentUser=d.user;$('userAvatar').style.backgroundImage=`url(/api/avatars/${currentUser.avatar})`;$('userAvatar').style.backgroundSize='cover';$('userAvatar').textContent='';loadProfileForm();toast(ut('t.avatarOk'))}
  else toast(d.message||ut('t.avatarFail'))
}

/* ── 启动 ── */
// ── 事件委托：素材卡片 + 操作按钮 ──
function _delegateCards(e){
  var btn=e.target.closest('[data-action]')
  if(btn){
    e.stopPropagation()
    var id=+btn.dataset.id, act=btn.dataset.action
    if(btn.dataset.close) closeModal(btn.dataset.close)
    if(act==='submit-draft') submitDraft(id)
    else if(act==='resubmit') resubmit(id)
    return
  }
  var card=e.target.closest('[data-mid]')
  if(card){ openDetail(+card.dataset.mid) }
}
function _delegateCardKey(e){
  if(e.key!=='Enter'&&e.key!==' ') return
  var card=e.target.closest('[data-mid]')
  if(card){ e.preventDefault(); openDetail(+card.dataset.mid) }
}
['myMaterialsGrid','myDraftsGrid'].forEach(function(gid){
  var el=$(gid)
  if(el){ el.addEventListener('click',_delegateCards); el.addEventListener('keydown',_delegateCardKey) }
})
$('detailFooter').addEventListener('click',function(e){
  var btn=e.target.closest('[data-action]')
  if(!btn) return
  var id=+btn.dataset.id, act=btn.dataset.action
  if(btn.dataset.close) closeModal(btn.dataset.close)
  if(act==='submit-draft') submitDraft(id)
  else if(act==='resubmit') resubmit(id)
})

async function init(){
  const me=await api('/api/me')
  if(me.user&&me.user.is_admin){window.location.href='/admin.html'}
  else if(me.user){currentUser=me.user;showMain()}
  else showLogin()
}
init()

;
var SM_USER=(function(){
  var wrapper,backdrop,prelayers,prelayerEls,panel,listEl,socialsEl,brandEl;
  var triggerZone,closeTimer=null;
  var isOpen=false,isAnimating=false,openTl=null,closeTl=null;

  function getItems(){
    return [
      {tab:'dashboard',i18n:'nav.dashboard'},
      {tab:'materials',i18n:'nav.materials'},
      {tab:'drafts',i18n:'nav.drafts',badge:'draftBadge'},
      {tab:'messages',i18n:'nav.messages',badge:'msgBadge'},
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
    ['#1a1214','#2d1925'].forEach(function(c){
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

    // Auto-close when mouse leaves panel
    panel.addEventListener('mouseenter',cancelClose);
    panel.addEventListener('mouseleave',function(){scheduleClose(300)});

    initGsap();

    syncBadges();
    ['draftBadge','msgBadge'].forEach(function(id){
      var orig=document.getElementById(id);
      if(orig&&window.MutationObserver){
        var mo=new MutationObserver(function(){syncBadges()});mo.observe(orig,{attributes:true,childList:true,characterData:true,subtree:true});if(!window._msgObservers)window._msgObservers=[];window._msgObservers.push(mo);
      }
    });

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
    h+='<div><div class="name">'+esc(ut('brand.name'))+'</div>';
    h+='<div class="sub">'+esc(ut('brand.sub'))+'</div></div>';
    h+='</div>';

    h+='<ul class="sm-panel-list">';
    getItems().forEach(function(item,i){
      h+='<li class="sm-panel-itemWrap">';
      h+='<a class="sm-panel-item" data-tab="'+item.tab+'">';
      h+='<span class="sm-panel-itemLabel">'+esc(ut(item.i18n))+'</span>';
      if(item.badge){
        h+='<span class="sm-panel-itemBadge" data-sm-badge="'+item.badge+'"></span>';
      }
      h+='<span class="sm-panel-itemNum">0'+(i+1)+'</span>';
      h+='</a></li>';
    });
    h+='</ul>';

    h+='<div class="sm-socials">';
    h+='<div class="sm-socials-buttons">';
    h+='<button class="specular-button specular-button--sm" id="smLogout" style="width:100%;--sb-radius:14px;--sb-tint:#ffffff;--sb-tint-opacity:0"><span class="specular-button__fx"></span><span class="specular-button__label">'+esc(ut('btn.logout'))+'</span></button>';
    h+='<button class="specular-button specular-button--sm" id="smHome" style="width:100%;margin-top:6px;--sb-radius:14px;--sb-tint:#ffffff;--sb-tint-opacity:0"><span class="specular-button__fx"></span><span class="specular-button__label">'+esc(ut('btn.home'))+'</span></button>';
    h+='</div></div>';

    panel.innerHTML=h;
    brandEl=panel.querySelector('.sm-brand');
    listEl=panel.querySelector('.sm-panel-list');
    socialsEl=panel.querySelector('.sm-socials');

    panel.querySelectorAll('.sm-panel-item').forEach(function(el){
      el.addEventListener('click',function(){
        var tab=this.getAttribute('data-tab');
        close();
        setTimeout(function(){switchTab(tab)},200);
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
      SM_USER.create();
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

/* ═══ 两步验证（2FA）自助管理（2026-10-23 接线，后端接口早已存在）═══ */
var TFA = { enabled: false, backupCodesLeft: 0 };
function _tfaEsc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

async function load2FA(){
  var box = document.getElementById('tfaBox');
  if (!box) return;
  try{
    var d = await api('/api/me/2fa');
    if (!d || !d.ok){ box.innerHTML = '<div style="font-size:13px;color:var(--text-3)">状态读取失败</div>'; return }
    TFA.enabled = !!d.enabled;
    TFA.backupCodesLeft = d.backupCodesLeft || 0;
    render2FA();
  }catch(e){
    box.innerHTML = '<div style="font-size:13px;color:var(--text-3)">加载失败，请稍后重试</div>';
  }
}

function render2FA(){
  var box = document.getElementById('tfaBox');
  if (!box) return;
  if (TFA.enabled){
    box.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">' +
        '<span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#22c55e;font-weight:700">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>已启用</span>' +
        '<span style="font-size:12.5px;color:var(--text-3)">剩余备用码 ' + TFA.backupCodesLeft + ' 个</span>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-outline btn-sm" onclick="regenBackupCodes()">重新生成备用码</button>' +
        '<button class="btn btn-danger btn-sm" onclick="disable2FA()">关闭两步验证</button>' +
      '</div>';
  } else {
    box.innerHTML =
      '<button class="btn btn-primary btn-sm" onclick="start2FASetup()">启用两步验证</button>' +
      '<span style="font-size:12.5px;color:var(--text-3);margin-left:10px">当前未启用</span>';
  }
}

async function start2FASetup(){
  var box = document.getElementById('tfaBox');
  var d = await api('/api/me/2fa/setup', { method: 'POST' });
  if (!d || !d.ok){ toast((d && d.message) || '操作失败'); return }
  box.innerHTML =
    '<div style="font-size:13px;line-height:1.85">' +
      '<p style="margin:0 0 10px">① 用验证器 App（Google / Microsoft Authenticator 等）扫码，或手动输入密钥：</p>' +
      '<div id="tfaQr" style="background:#fff;padding:10px;border-radius:10px;display:inline-block;margin:0 0 10px"></div>' +
      '<p style="margin:0 0 12px"><code style="background:var(--bg);padding:6px 10px;border-radius:6px;font-size:13px;letter-spacing:.12em;word-break:break-all">' + _tfaEsc(d.secret) + '</code></p>' +
      '<p style="margin:0 0 8px">② 输入 App 显示的 6 位动态码完成绑定：</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<input id="tfaCode" inputmode="numeric" maxlength="6" placeholder="6 位动态码" style="width:150px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:14px;letter-spacing:.2em">' +
        '<button class="btn btn-primary btn-sm" onclick="confirm2FA()">确认启用</button>' +
        '<button class="btn btn-outline btn-sm" onclick="load2FA()">取消</button>' +
      '</div>' +
    '</div>';
  // 生成二维码（兼容 qrcodejs / node-qrcode 两种 API）
  try{
    var el = document.getElementById('tfaQr');
    if (window.QRCode){
      if (typeof QRCode === 'function'){ new QRCode(el, { text: d.otpauth, width: 160, height: 160, correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 0 }) }
      else if (QRCode.toCanvas){ var cv = document.createElement('canvas'); QRCode.toCanvas(cv, d.otpauth, { width: 160, margin: 1 }); el.appendChild(cv) }
    } else {
      el.style.display = 'none';
    }
  }catch(e){}
  var inp = document.getElementById('tfaCode'); if (inp) inp.focus();
}

async function confirm2FA(){
  var inp = document.getElementById('tfaCode');
  var code = ((inp && inp.value) || '').trim();
  if (!/^\d{6}$/.test(code)){ toast('请输入 6 位数字动态码'); return }
  var d = await api('/api/me/2fa/enable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code }) });
  if (!d || !d.ok){ toast((d && d.message) || '验证失败'); return }
  TFA.enabled = true; TFA.backupCodesLeft = (d.backupCodes || []).length;
  showBackupCodes(d.backupCodes || []);
}

function showBackupCodes(codes){
  var box = document.getElementById('tfaBox');
  if (!box) return;
  box.innerHTML =
    '<div style="border:1px solid #d97706;border-radius:10px;padding:14px">' +
      '<p style="margin:0 0 10px;font-size:13px;font-weight:800;color:#d97706">备用恢复码（仅显示这一次，请立即保存）</p>' +
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;font-family:ui-monospace,Consolas,monospace;font-size:13px;margin-bottom:12px">' +
        codes.map(function(c){ return '<span style="background:var(--bg);padding:5px 8px;border-radius:6px;text-align:center">' + _tfaEsc(c) + '</span>' }).join('') +
      '</div>' +
      '<p style="margin:0 0 12px;font-size:12px;color:var(--text-3);line-height:1.75">忘记验证器或换手机时，用任意一个备用码可登录一次；每个码只能用一次。请截图保存或抄写到安全的地方。</p>' +
      '<button class="btn btn-primary btn-sm" onclick="load2FA()">我已保存</button>' +
    '</div>';
}

async function disable2FA(){
  var pwd = prompt('关闭两步验证需要双重验证\n\n请输入当前密码：');
  if (pwd === null) return;
  var code = prompt('请输入验证器当前的 6 位动态码（或一个备用码）：');
  if (code === null) return;
  var d = await api('/api/me/2fa/disable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwd, code: String(code).trim() }) });
  if (!d || !d.ok){ toast((d && d.message) || '关闭失败'); return }
  toast('已关闭两步验证'); load2FA();
}

async function regenBackupCodes(){
  var pwd = prompt('重新生成后旧的备用码全部作废\n\n请输入当前密码：');
  if (pwd === null) return;
  var d = await api('/api/me/2fa/backup/regen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwd }) });
  if (!d || !d.ok){ toast((d && d.message) || '操作失败'); return }
  showBackupCodes(d.backupCodes || []);
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
