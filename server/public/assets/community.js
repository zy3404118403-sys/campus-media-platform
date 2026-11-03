let currentBoardId=null,currentThreadId=null,currentBlogCat='',currentWallTag='',currentBlogId=null,currentCommentBlogId=null;
let currentForumSort='latest';
let blogPage=1,blogHasMore=true,wallPage=1,wallHasMore=true,blogIO=null,wallIO=null;
let currentSearchQuery='',currentSearchType='all';

// 设计审计 A4（2026-09-22）：内部事务入口（个人中心/私信）仅登录后显示
(async function revealAuthOnlyEntries(){
  try{
    const r=await api('/api/me');
    if(r&&r.ok&&r.user){document.querySelectorAll('[data-auth-only]').forEach(function(a){a.style.display=''})}
  }catch(e){}
})();

// ── 移动端侧边栏 ──
function toggleSidebar(){
$('sidebar').classList.toggle('open');
$('sidebar-overlay').classList.toggle('show');
}

// ── 弹窗系统 ──
let _lastFocus=null;
function openModal(id){
_lastFocus=document.activeElement;
const overlay=$(id);
overlay.classList.add('show');
overlay.setAttribute('aria-hidden','false');
const firstInput=overlay.querySelector('input,textarea,select,button');
if(firstInput)setTimeout(()=>firstInput.focus(),100);
}
function closeModal(id){
const overlay=$(id);
overlay.classList.remove('show');
overlay.setAttribute('aria-hidden','true');
if(_lastFocus)_lastFocus.focus();
}
// Escape 关闭 + 遮罩点击关闭
document.addEventListener('keydown',e=>{
if(e.key==='Escape'){
const open=document.querySelector('.modal-overlay.show');
if(open)closeModal(open.id);
}
});
document.querySelectorAll('.modal-overlay').forEach(overlay=>{
overlay.addEventListener('click',e=>{
if(e.target===overlay)closeModal(overlay.id);
});
});

// ── XSS sanitize ──
function sanitizeHTML(html){
const allowed={'P':1,'BR':1,'B':1,'STRONG':1,'I':1,'EM':1,'U':1,'UL':1,'OL':1,'LI':1,'A':1,'CODE':1,'PRE':1,'BLOCKQUOTE':1,'H1':1,'H2':1,'H3':1,'H4':1,'H5':1,'H6':1,'SPAN':1,'DIV':1,'IMG':1,'HR':1};
const allowedAttr={'A':['href','title'],'IMG':['src','alt','width','height']};
const div=document.createElement('div');
div.innerHTML=html;
const walker=document.createTreeWalker(div,NodeFilter.SHOW_ELEMENT,null);
const remove=[];
let node;
while(node=walker.nextNode()){
const tag=node.tagName;
if(!allowed[tag]){remove.push(node);continue;}
if(tag==='A'){node.removeAttribute('onclick');node.removeAttribute('onmouseover');node.target='_blank';node.rel='noopener noreferrer';}
if(tag==='IMG'){node.removeAttribute('onerror');node.removeAttribute('onload');}
node.getAttributeNames().forEach(attr=>{
if(attr.startsWith('on'))node.removeAttribute(attr);
if(attr==='style')node.removeAttribute(attr);
if(allowedAttr[tag]&&!allowedAttr[tag].includes(attr.toUpperCase())){
if(attr!=='href'&&attr!=='src'&&attr!=='alt'&&attr!=='title'&&attr!=='width'&&attr!=='height')node.removeAttribute(attr);
}
});
}
remove.forEach(n=>{const text=document.createTextNode(n.textContent);n.parentNode.replaceChild(text,n);});
return div.innerHTML;
}

// 导航切换
function navigateTo(sec){
document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
document.querySelectorAll('.mobile-tabbar .tab').forEach(t=>t.classList.remove('active'));
document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
document.querySelectorAll('.nav-item[data-section="'+sec+'"]').forEach(n=>n.classList.add('active'));
document.querySelectorAll('.mobile-tabbar .tab[data-section="'+sec+'"]').forEach(t=>t.classList.add('active'));
$('sec-'+sec).classList.add('active');
if(sec==='blog'){backToBlogList();loadBlog(true);}
if(sec==='forum')loadBoards();
if(sec==='wall')loadWall(true);
if(sec==='profile')loadProfile();
if(sec==='messages')showPmList();
if(sec==='activities')showActList();
}
document.querySelectorAll('.nav-item').forEach(item=>{
item.addEventListener('click',(e)=>{
e.preventDefault();
navigateTo(item.dataset.section);
if(window.innerWidth<=768)toggleSidebar();
});
item.addEventListener('keydown',(e)=>{
if(e.key==='Enter'||e.key===' '){e.preventDefault();navigateTo(item.dataset.section);if(window.innerWidth<=768)toggleSidebar();}
});
});
document.querySelectorAll('.mobile-tabbar .tab').forEach(tab=>{
tab.setAttribute('role','button');
tab.setAttribute('tabindex','0');
tab.addEventListener('click',()=>navigateTo(tab.dataset.section));
tab.addEventListener('keydown',(e)=>{
if(e.key==='Enter'||e.key===' '){e.preventDefault();navigateTo(tab.dataset.section);}
});
});

// 博客分类筛选
document.querySelectorAll('#blog-filters .filter-btn').forEach(btn=>{
btn.addEventListener('click',()=>{
document.querySelectorAll('#blog-filters .filter-btn').forEach(b=>b.classList.remove('active'));
btn.classList.add('active');
currentBlogCat=btn.dataset.cat;
loadBlog(true);
});
});

// 墙贴标签筛选
document.querySelectorAll('#wall-filters .filter-btn').forEach(btn=>{
btn.addEventListener('click',()=>{
document.querySelectorAll('#wall-filters .filter-btn').forEach(b=>b.classList.remove('active'));
btn.classList.add('active');
currentWallTag=btn.dataset.tag;
loadWall(true);
});
});

// ── 博客 ──
function blogSkeleton(n){return Array(n).fill('<div class="skeleton-card"><div class="skeleton-cover"></div><div class="skeleton-body"><div class="skeleton-line"></div><div class="skeleton-line mid"></div><div class="skeleton-line short"></div></div></div>').join('')}
var COVER_PALETTES={campus:['#0d3528','#1f7a5c'],tech:['#101f3a','#2d5f9e'],life:['#33230c','#a1741f'],study:['#22103a','#6a3fa0'],default:['#1a1a2e','#3a3a5c']};
function coverFallbackHTML(title,cat){
var pal=COVER_PALETTES[cat]||COVER_PALETTES.default;
var ch=(String(title||'').trim()[0])||'文';
return '<div class="cover-fallback" style="background:linear-gradient(135deg,'+pal[0]+','+pal[1]+')"><span>'+esc(ch)+'</span></div>';
}
function blogCardHTML(p){return `<div class="blog-card" onclick="viewBlog(${p.id})">
<div class="cover">${p.cover_image?'<img src="'+esc(p.cover_image)+'" alt="'+esc(p.title)+'" loading="lazy" style="width:100%;height:100%;object-fit:cover">':coverFallbackHTML(p.title,p.category)}</div>
<div class="body">
<div class="title">${esc(p.title)}</div>
<div class="summary">${esc((p.summary||'').replace(/<[^>]+>/g,''))}</div>
<div class="meta">
<span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${p.is_anonymous?'匿名':esc(p.author_name||'匿名')}</span>
<span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> ${p.views}</span>
<span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ${p.likes}</span>
<span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> ${p.comments}</span>
</div>
</div>
</div>`}
async function loadBlog(reset){
if(reset){blogPage=1;blogHasMore=true;if(blogIO)blogIO.disconnect();document.querySelectorAll('#sec-blog .sentinel').forEach(s=>s.remove());}
if(!blogHasMore)return;
const isFirst=blogPage===1;
if(isFirst)$('blog-grid').innerHTML=blogSkeleton(6);
let url='/api/blog/posts?page='+blogPage+'&limit=10';
if(currentBlogCat)url+='&category='+currentBlogCat;
const r=await api(url);
if(!r||!r.ok){if(isFirst)$('blog-grid').innerHTML=emptyStateHTML({icon:'warn',title:'加载失败',desc:'网络异常，请稍后重试',ctaText:'重新加载',ctaOnclick:"loadBlog(true)"});return;}
if(!r.data||r.data.length===0){if(isFirst)$('blog-grid').innerHTML=emptyStateHTML({icon:'doc',title:'还没有博文',desc:'来写下第一篇，分享你的校园故事',ctaText:'写博文',ctaOnclick:"openBlogModal()"});blogHasMore=false;return;}
const html=r.data.map(blogCardHTML).join('');
if(isFirst){$('blog-grid').innerHTML=html;applyStagger($('blog-grid'));}
else $('blog-grid').insertAdjacentHTML('beforeend',html);
blogHasMore=r.data.length>=10;
blogPage++;
if(blogHasMore)setupBlogObserver();
}
function setupBlogObserver(){
const sentinel=document.createElement('div');
sentinel.className='sentinel loading';
sentinel.textContent='加载更多...';
$('blog-grid').insertAdjacentElement('afterend',sentinel);
blogIO=new IntersectionObserver(entries=>{
if(entries[0].isIntersecting){
blogIO.disconnect();
sentinel.remove();
loadBlog(false);
}
},{rootMargin:'200px'});
blogIO.observe(sentinel);
}

function backToBlogList(){
$('blog-detail-view').classList.remove('active');
$('blog-list-view').classList.remove('hidden');
window.scrollTo(0,0);
}

async function viewBlog(id){
currentBlogId=id;
const r=await api('/api/blog/posts/'+id);
if(!r||!r.ok){toast('加载失败');return;}
const p=r.data;
$('blog-list-view').classList.add('hidden');
$('blog-detail-view').classList.add('active');
$('blog-detail-view').innerHTML=`
<span class="back-btn" onclick="backToBlogList()">← 返回博客列表</span>
<div class="detail-view">
<h1>${esc(p.title)}</h1>
<div class="detail-meta"><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${esc(p.author_name||'匿名')}</span><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> ${p.views}</span><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ${p.likes}</span><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> ${p.comments}</span><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${p.created_at}</span></div>
<div class="detail-content">${sanitizeHTML(p.content)}</div>
</div>
<div style="display:flex;gap:10px;margin-bottom:20px">
<button class="btn btn-primary" id="blog-like-btn" onclick="likeBlog(${p.id})"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> 点赞</button>
<button class="btn" onclick="openCommentModal(${p.id})"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> 评论</button>
</div>
<h3 style="margin-bottom:16px">评论 (${(r.comments||[]).length})</h3>
<div id="blog-comments">${(r.comments||[]).map(c=>`<div class="reply-item"><div class="reply-author">${esc(c.author_name)}</div><div class="reply-content">${esc(c.content)}</div><div class="reply-meta">${c.created_at}</div></div>`).join('')||emptyStateHTML({sm:true,icon:'msg',title:'暂无评论',desc:'说点什么吧'})}</div>
`;
window.scrollTo(0,0);
}

async function likeBlog(id){
const btn=$('blog-like-btn');
if(!btn)return;
const wasLiked=btn.textContent.includes('已点赞');
btn.disabled=true;
btn.textContent=wasLiked?'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> 点赞':'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> 已点赞';
const meta=document.querySelector('#blog-detail-view .detail-meta');
if(meta){
const span=meta.children[2];
if(span){const n=parseInt(span.textContent.match(/\d+/)||'0');span.textContent='<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> '+(wasLiked?Math.max(0,n-1):n+1);}
}
const r=await api('/api/blog/posts/'+id+'/like',{method:'POST'});
if(r&&r.ok){
toast(r.liked?'已点赞':'已取消');
}else{
toast('操作失败');
btn.textContent=wasLiked?'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> 已点赞':'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> 点赞';
if(meta){const span=meta.children[2];if(span){const n=parseInt(span.textContent.match(/\d+/)||'0');span.textContent='<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> '+(wasLiked?n+1:Math.max(0,n-1));}}
}
btn.disabled=false;
}

// ── 富文本编辑器 ──
let activeEditor='blog-content';
function rteCmd(cmd,val){document.execCommand(cmd,false,val||null);$(activeEditor).focus()}
function rteLink(){const url=prompt('输入链接URL：');if(url)rteCmd('createLink',url)}
function insertBlogImage(){$('blog-image-input').click()}
async function handleBlogImages(input){
const editor=$(activeEditor)||$('blog-content');
editor.focus();
for(const file of input.files){
if(!file.type.startsWith('image/')){toast(file.name+' 不是图片文件');continue;}
if(file.size>8*1024*1024){toast(file.name+' 超过8MB');continue;}
const dataUrl=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(file)});
const payload=file.type==='image/gif'?dataUrl:await resizeImage(dataUrl,1000);
const r=await api('/api/blog/upload-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:payload})});
if(r&&r.ok)document.execCommand('insertHTML',false,'<img src="'+r.url+'" alt="'+esc(file.name)+'">');
else toast('图片上传失败');
}
input.value='';
}
function openBlogModal(){$('blog-title').value='';$('blog-content').innerHTML='';openModal('blog-modal');}
async function submitBlog(){
const title=$('blog-title').value.trim(),content=$('blog-content').innerHTML.trim();
if(!title||!content){toast('标题和内容不能为空');return;}
const imgMatch=content.match(/<img[^>]+src=["']([^"']+)["']/i);
const cover=(imgMatch&&/^(\/uploads\/|https?:\/\/)/i.test(imgMatch[1])&&imgMatch[1].length<500)?imgMatch[1]:'';
const r=await api('/api/blog/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,content,category:$('blog-category').value,cover_image:cover})});
toast(r&&r.ok?r.message:'发布失败');
if(r&&r.ok){closeModal('blog-modal');loadBlog(true);}
}

// ── 论坛 ──
// 运营批（2026-09-22）：版块图标 SVG 化——icon 字段存 key（或兼容历史 emoji），映射 Feather 风格 SVG
const BOARD_ICON_PATHS={
study:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3 3h7z"/>',
life:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
job:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
market:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
tech:'<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
qa:'<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
tree:'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
lost:'<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
};
const BOARD_ICON_EMOJI={'📚':'study','🏠':'life','💼':'job','🛒':'market','💻':'tech','❓':'qa','🌙':'tree','🔍':'lost'};
function boardIconSvg(icon){
const key=BOARD_ICON_EMOJI[icon]||icon;
const p=BOARD_ICON_PATHS[key];
if(!p)return esc(icon||'');
return `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
async function loadBoards(){
const r=await api('/api/forum/boards');
if(!r||!r.ok||!r.data){$('forum-grid').innerHTML=emptyStateHTML({sm:true,icon:'folder',title:'暂无版块'});return;}
$('forum-grid').innerHTML=r.data.map(b=>`
<div class="board-card" onclick="showForumThreads(${b.id},'${esc(b.name)}',${b.is_anonymous})">
<div class="icon">${boardIconSvg(b.icon)}</div>
<div class="name">${esc(b.name)}</div>
<div class="desc">${esc(b.description)}</div>
<div class="count">${b.post_count} 帖</div>
</div>`).join('');
applyStagger($('forum-grid'));
}

function showForumBoards(){
$('forum-boards-view').style.display='block';
$('forum-threads-view').style.display='none';
$('forum-detail-view').style.display='none';
}

async function showForumThreads(id,name,anon){
if(id!==undefined)currentBoardId=id;
if(name!==undefined)$('forum-board-title').textContent=name;
if(anon!==undefined)$('thread-anon').parentElement.style.display=anon?'block':'none';
$('forum-boards-view').style.display='none';
$('forum-detail-view').style.display='none';
$('forum-threads-view').style.display='block';
$('thread-list').innerHTML=skeletonRowsHTML(5);
const r=await api('/api/forum/boards/'+currentBoardId+'/threads?page=1&limit=50&sort='+currentForumSort);
if(!r||!r.ok||!r.data){$('thread-list').innerHTML=emptyStateHTML({icon:'warn',title:'加载失败',desc:'请稍后重试'});return;}
$('thread-list').innerHTML=r.data.map(t=>`
<div class="thread-item" onclick="viewThread(${t.id})">
<div class="title">${t.is_pinned?'<span class="pin-badge">置顶</span>':''}${esc(t.title)}</div>
<div class="preview">${esc(t.content.replace(/<[^>]+>/g,'').slice(0,100))}</div>
<div class="meta"><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${t.is_anonymous?'匿名':esc(t.author_name)}</span><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> ${t.views}</span><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> ${t.replies}</span><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${t.created_at}</span></div>
</div>`).join('')||emptyStateHTML({icon:'msg',title:'暂无帖子',desc:'来发第一帖吧',ctaText:'发帖',ctaOnclick:'openThreadModal()'});
applyStagger($('thread-list'));
}
function changeForumSort(sort){
currentForumSort=sort;
document.querySelectorAll('#forum-sort-filter .filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.sort===sort));
showForumThreads();
}

async function viewThread(id){
currentThreadId=id;
$('forum-boards-view').style.display='none';
$('forum-threads-view').style.display='none';
$('forum-detail-view').style.display='block';
const r=await api('/api/forum/threads/'+id);
if(!r||!r.ok){toast('加载失败');return;}
const t=r.data;
$('thread-detail').innerHTML=`
<h1>${t.is_pinned?'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> ':''}${esc(t.title)}</h1>
<div class="detail-meta"><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${t.is_anonymous?'匿名':esc(t.author_name)}</span><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> ${t.views}</span><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> ${t.replies}</span><span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${t.created_at}</span></div>
<div class="detail-content">${sanitizeHTML(t.content)}</div>
${t.poll?renderPollHTML(t.poll):''}`;
$('reply-list').innerHTML=(r.replies||[]).filter(rp=>!rp.parent_reply_id).map(rp=>{
const children=(r.replies||[]).filter(c=>c.parent_reply_id===rp.id);
return `<div class="reply-item" id="reply-${rp.id}">
<div class="reply-author">${rp.is_anonymous?'匿名':esc(rp.author_name)}</div>
<div class="reply-content">${esc(rp.content)}</div>
<div class="reply-meta">${rp.created_at} <span class="reply-to-btn" onclick="toggleInlineReply(${rp.id})">回复</span></div>
<div class="inline-reply-form" id="inline-reply-${rp.id}">
<textarea class="form-textarea" id="inline-reply-content-${rp.id}" placeholder="回复 ${esc(rp.author_name)}..." maxlength="500"></textarea>
<div style="margin-top:6px;display:flex;gap:6px;justify-content:flex-end">
<button class="btn" style="padding:4px 12px;font-size:13px" onclick="toggleInlineReply(${rp.id})">取消</button>
<button class="btn btn-primary" style="padding:4px 12px;font-size:13px" onclick="submitInlineReply(${rp.id})">回复</button>
</div>
</div>
${children.map(c=>`<div class="reply-item nested">
<div class="reply-author">${c.is_anonymous?'匿名':esc(c.author_name)}</div>
<div class="reply-content">${esc(c.content)}</div>
<div class="reply-meta">${c.created_at} <span class="reply-to-btn" onclick="toggleInlineReply(${rp.id})">回复</span></div>
</div>`).join('')}
</div>`}).join('')||emptyStateHTML({sm:true,icon:'msg',title:'暂无回复',desc:'抢个沙发？'});
}

function openThreadModal(){
if(!currentBoardId){toast('请先选择版块');return;}
$('thread-title').value='';$('thread-content').innerHTML='';$('thread-anon').checked=false;
$('thread-poll-toggle').checked=false;$('poll-editor').style.display='none';$('poll-question').value='';$('poll-multiple').checked=false;resetPollOptions();
activeEditor='thread-content';
openModal('thread-modal');
}
async function submitThread(){
const title=$('thread-title').value.trim(),content=$('thread-content').innerHTML.trim();
if(!title||!content){toast('标题和内容不能为空');return;}
const body={boardId:currentBoardId,title,content,isAnonymous:$('thread-anon').checked};
if($('thread-poll-toggle').checked){
const q=$('poll-question').value.trim();
const opts=getPollOptionValues();
if(!q){toast('请填写投票问题');return;}
if(opts.length<2){toast('投票至少需要2个非空选项');return;}
body.poll={question:q,options:opts,allowMultiple:$('poll-multiple').checked};
}
const r=await api('/api/forum/threads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
toast(r&&r.ok?r.message:(r&&r.message||'发布失败'));
if(r&&r.ok){closeModal('thread-modal');showForumThreads(currentBoardId,$('forum-board-title').textContent,$('thread-anon').parentElement.style.display!=='none');}
}

// ── 投票 ──
function togglePollEditor(){
const on=$('thread-poll-toggle').checked;
$('poll-editor').style.display=on?'block':'none';
if(on&&$('poll-options').children.length<2){addPollOption();addPollOption();}
}
function addPollOption(){
const n=$('poll-options').children.length;
if(n>=10){toast('选项最多10个');return;}
const row=document.createElement('div');
row.className='poll-option-row';
row.innerHTML=`<input class="form-input poll-option-input" maxlength="50" placeholder="选项 ${n+1}"><button type="button" class="poll-option-del" onclick="removePollOption(this)" aria-label="删除选项">×</button>`;
$('poll-options').appendChild(row);
}
function removePollOption(btn){
if($('poll-options').children.length<=2){toast('至少保留2个选项');return;}
btn.closest('.poll-option-row').remove();
refreshPollOptionLabels();
}
function refreshPollOptionLabels(){
Array.from($('poll-options').children).forEach((row,i)=>{
const input=row.querySelector('.poll-option-input');
if(input&&!input.value)input.placeholder='选项 '+(i+1);
});
}
function resetPollOptions(){$('poll-options').innerHTML='';}
function getPollOptionValues(){
return Array.from(document.querySelectorAll('#poll-options .poll-option-input')).map(i=>i.value.trim()).filter(Boolean);
}
function renderPollHTML(p){
const voted=p.hasVoted;
const mine=voted?p.myVotes:[];
let inner=p.options.map(o=>{
const pct=p.totalVotes?Math.round(o.votes/p.totalVotes*100):0;
if(!voted){
return `<button type="button" class="poll-opt${p.allowMultiple?' poll-opt-multi':''}" onclick="${p.allowMultiple?`togglePollChoice(${o.index})`:`castPollVote(${o.index})`}" data-idx="${o.index}"><span class="poll-opt-radio"></span><span class="poll-opt-text">${esc(o.text)}</span></button>`;
}
return `<div class="poll-result${mine.includes(o.index)?' mine':''}">
<div class="poll-result-head"><span>${esc(o.text)}${mine.includes(o.index)?' <span class="poll-mine-tag">我的选择</span>':''}</span><span class="poll-result-num">${o.votes} 票 · ${pct}%</span></div>
<div class="poll-bar"><div class="poll-bar-fill" style="width:${pct}%"></div></div>
</div>`;
}).join('');
let footer=`<div class="poll-meta">${p.totalVotes} 人参与 · ${p.allowMultiple?'多选':'单选'}</div>`;
if(!voted&&p.allowMultiple){footer=`<button type="button" class="btn btn-primary poll-submit-btn" onclick="submitMultiVote()">投票</button>`+footer;}
return `<div class="poll-box" data-thread="${currentThreadId}">
<div class="poll-question"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg> ${esc(p.question)}</div>
${inner}
${footer}
</div>`;
}
function togglePollChoice(idx){
const btn=document.querySelector(`.poll-box .poll-opt[data-idx="${idx}"]`);
if(btn)btn.classList.toggle('chosen');
}
async function castPollVote(idxs){
const r=await api('/api/forum/threads/'+currentThreadId+'/poll/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({optionIndexes:Array.isArray(idxs)?idxs:[idxs]})});
if(r&&r.ok){toast(r.already?'你已投过票':r.message);viewThread(currentThreadId);}
else{toast(r&&r.message?r.message:'投票失败');}
}
function submitMultiVote(){
const chosen=Array.from(document.querySelectorAll('.poll-box .poll-opt.chosen')).map(b=>Number(b.dataset.idx));
if(!chosen.length){toast('请先选择选项');return;}
castPollVote(chosen);
}

async function submitReply(){
const content=$('reply-content').value.trim();
if(!content){toast('回复内容不能为空');return;}
const r=await api('/api/forum/threads/'+currentThreadId+'/replies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content})});
toast(r&&r.ok?r.message:'回复失败');
if(r&&r.ok){$('reply-content').value='';viewThread(currentThreadId);}
}
function toggleInlineReply(replyId){
const form=$('inline-reply-'+replyId);
form.classList.toggle('show');
if(form.classList.contains('show'))setTimeout(()=>$('inline-reply-content-'+replyId).focus(),100);
}
async function submitInlineReply(parentId){
const content=$('inline-reply-content-'+parentId).value.trim();
if(!content){toast('回复内容不能为空');return;}
const r=await api('/api/forum/threads/'+currentThreadId+'/replies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content,parentReplyId:parentId})});
toast(r&&r.ok?r.message:'回复失败');
if(r&&r.ok){toggleInlineReply(parentId);viewThread(currentThreadId);}
}

// ── 校园墙 ──
function wallSkeleton(n){return Array(n).fill('<div class="skeleton-card" style="padding:18px"><div class="skeleton-line"></div><div class="skeleton-line mid"></div><div class="skeleton-line short"></div></div>').join('')}
function wallItemHTML(w){
let imgs=[];
try{imgs=JSON.parse(w.images||'[]')}catch(e){}
return `<div class="wall-item${w.is_featured?' featured':''}" data-wid="${w.id}" role="button" tabindex="0" aria-label="查看墙贴详情">
${w.is_featured?'<span class="feat-badge">精选</span>':''}
<div class="content">${esc(w.content)}</div>
${imgs.length?`<div class="wall-images">${imgs.map(src=>`<img src="${esc(src)}" alt="校园墙图片" loading="lazy" onclick="event.stopPropagation();window.open('${esc(src)}','_blank')">`).join('')}</div>`:''}
<div class="wall-meta">
<span><span class="wall-tag">${esc(w.tag)}</span> ${w.is_anonymous?'匿名':esc(w.author_name)}</span>
<span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ${w.likes} · ${w.created_at}</span>
</div>
</div>`}
let wallCache=[]
function bindWallGrid(){
const grid=$('wall-grid');if(!grid||grid._wallBound)return
grid._wallBound=true
grid.addEventListener('click',function(e){
const item=e.target.closest('.wall-item');if(!item)return
openWallDetail(parseInt(item.getAttribute('data-wid'),10))
})
grid.addEventListener('keydown',function(e){
if(e.key!=='Enter'&&e.key!==' ')return
const item=e.target.closest('.wall-item');if(!item)return
e.preventDefault();openWallDetail(parseInt(item.getAttribute('data-wid'),10))
})
}
function openWallDetail(id){
const w=(wallCache||[]).find(function(x){return x.id===id})
if(!w){toast('内容已刷新，请重试');return}
_wallDetailId=id
let imgs=[]
try{imgs=JSON.parse(w.images||'[]')}catch(e){}
$('wd-content').textContent=w.content
$('wd-meta').innerHTML=`<span class="wall-tag">${esc(w.tag)}</span> ${w.is_anonymous?'匿名':esc(w.author_name||'同学')} · <span id="wd-likes" data-likes="${w.likes||0}"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ${w.likes||0}</span> · ${esc(String(w.created_at).slice(0,16).replace('T',' '))}`
$('wd-images').innerHTML=imgs.map(src=>`<img src="${esc(src)}" alt="墙贴图片" onclick="window.open('${esc(src)}','_blank')" style="cursor:zoom-in">`).join('')
$('wd-comment-input').value=''
$('wd-anon').checked=false
loadWallComments(id)
openModal('wall-detail-modal')
}
let _wallDetailId=null
async function loadWallComments(id){
const box=$('wd-comments')
box.innerHTML='<div style="text-align:center;opacity:.5;padding:14px;font-size:12px">加载评论中...</div>'
const r=await api('/api/wall/posts/'+id+'/comments')
if(!r||!r.ok){box.innerHTML='<div style="text-align:center;opacity:.5;padding:14px;font-size:12px">评论加载失败</div>';return}
const rows=r.data||[]
box.innerHTML=rows.length
  ? rows.map(c=>`<div class="wd-comment"><b>${esc(c.author_name||'同学')}</b><span>${esc(c.content)}</span><time>${esc(String(c.created_at).slice(0,16).replace('T',' '))}</time></div>`).join('')
  : '<div style="text-align:center;opacity:.5;padding:14px;font-size:12px">还没有评论，来抢沙发</div>'
}
async function postWallComment(){
if(!_wallDetailId)return
const content=$('wd-comment-input').value.trim()
if(!content){toast('评论内容不能为空');return}
const r=await api('/api/wall/posts/'+_wallDetailId+'/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content,isAnonymous:$('wd-anon').checked})})
toast(r&&r.ok?r.message:(r&&r.message||'评论失败'))
if(r&&r.ok){
  $('wd-comment-input').value=''
  $('wd-anon').checked=false
  loadWallComments(_wallDetailId)
  const lk=$('wd-likes');/* 评论数不影响点赞显示 */
}
}
async function likeWallPost(){
if(!_wallDetailId)return
const r=await api('/api/wall/posts/'+_wallDetailId+'/like',{method:'POST'})
if(r&&r.ok){
  const lk=$('wd-likes')
  const cur=parseInt(lk.dataset.likes||'0',10)
  const nv=r.liked?cur+1:Math.max(0,cur-1)
  lk.dataset.likes=nv
  lk.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> '+nv
  toast(r.liked?'已点赞':'已取消点赞')
}else{toast(r&&r.message||'操作失败')}
}
function closeWallDetail(){closeModal('wall-detail-modal')}
async function loadWall(reset){
if(reset){wallPage=1;wallHasMore=true;wallCache=[];if(wallIO)wallIO.disconnect();document.querySelectorAll('#sec-wall .sentinel').forEach(s=>s.remove());}
if(!wallHasMore)return;
const isFirst=wallPage===1;
if(isFirst)$('wall-grid').innerHTML=wallSkeleton(6);
let url='/api/wall/posts?page='+wallPage+'&limit=10';
if(currentWallTag)url+='&tag='+currentWallTag;
const r=await api(url);
if(!r||!r.ok||!r.data){if(isFirst)$('wall-grid').innerHTML=emptyStateHTML({icon:'warn',title:'加载失败',desc:'网络异常，请稍后重试',ctaText:'重新加载',ctaOnclick:"loadWall(true)"});return;}
if(r.data.length===0){if(isFirst)$('wall-grid').innerHTML=emptyStateHTML({icon:'pen',title:'还没有墙贴',desc:'第一条墙贴，由你来写',ctaText:'发墙贴',ctaOnclick:'openWallModal()'});wallHasMore=false;return;}
const html=r.data.map(wallItemHTML).join('');
if(isFirst){$('wall-grid').innerHTML=html;applyStagger($('wall-grid'));bindWallGrid();}
else $('wall-grid').insertAdjacentHTML('beforeend',html);
wallCache=(wallCache||[]).concat(r.data);
wallHasMore=r.data.length>=10;
wallPage++;
if(wallHasMore)setupWallObserver();
}
function setupWallObserver(){
const sentinel=document.createElement('div');
sentinel.className='sentinel loading';
sentinel.textContent='加载更多...';
$('wall-grid').insertAdjacentElement('afterend',sentinel);
wallIO=new IntersectionObserver(entries=>{
if(entries[0].isIntersecting){
wallIO.disconnect();
sentinel.remove();
loadWall(false);
}
},{rootMargin:'200px'});
wallIO.observe(sentinel);
}

function openWallModal(){$('wall-content').value='';$('wall-anon').checked=false;wallUploadImages=[];$('wall-image-previews').innerHTML='';openModal('wall-modal');}
async function submitWall(){
const content=$('wall-content').value.trim();
if(!content){toast('内容不能为空');return;}
const r=await api('/api/wall/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content,images:wallUploadImages,tag:$('wall-tag').value,isAnonymous:$('wall-anon').checked})});
toast(r&&r.ok?r.message:'发布失败');
if(r&&r.ok){closeModal('wall-modal');loadWall(true);}
}
let wallUploadImages=[];
async function handleWallImages(input){
const files=Array.from(input.files).slice(0,3-wallUploadImages.length);
for(const file of files){
if(file.size>8*1024*1024){toast(file.name+' 超过8MB');continue;}
const dataUrl=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(file)});
const resized=await resizeImage(dataUrl,800);
const r=await api('/api/wall/upload-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:resized})});
if(r&&r.ok){wallUploadImages.push(r.url);renderWallPreviews();}
else toast('图片上传失败');
}
input.value='';
}
function resizeImage(dataUrl,maxW){
return new Promise(res=>{
const img=new Image();
img.onload=()=>{
const canvas=document.createElement('canvas');
let w=img.width,h=img.height;
if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}
canvas.width=w;canvas.height=h;
canvas.getContext('2d').drawImage(img,0,0,w,h);
res(canvas.toDataURL('image/jpeg',0.8));
};
img.src=dataUrl;
});
}
function renderWallPreviews(){
$('wall-image-previews').innerHTML=wallUploadImages.map((src,i)=>`<div class="image-preview"><img src="${src}" alt="上传图片预览"><button class="remove-img" onclick="removeWallImage(${i})">×</button></div>`).join('');
}
function removeWallImage(i){wallUploadImages.splice(i,1);renderWallPreviews();}

// ── 评论 ──
function openCommentModal(id){
currentCommentBlogId=id;
$('comment-content').value='';
openModal('comment-modal');
}
async function submitComment(){
const content=$('comment-content').value.trim();
if(!content){toast('评论内容不能为空');return;}
closeModal('comment-modal');
const r=await api('/api/blog/posts/'+currentCommentBlogId+'/comment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content})});
if(r&&r.ok){
toast(r.message||'评论成功');
const list=$('blog-comments');
if(list){
const empty=list.querySelector('.empty-state');
if(empty)empty.remove();
const div=document.createElement('div');
div.className='reply-item';
div.innerHTML=`<div class="reply-author">${esc(r.data&&r.data.author_name||'我')}</div><div class="reply-content">${esc(content)}</div><div class="reply-meta">刚刚</div>`;
list.appendChild(div);
}
const h3=document.querySelector('#blog-detail-view h3');
if(h3){const m=h3.textContent.match(/\((\d+)\)/);if(m){h3.textContent='评论 ('+(parseInt(m[1])+1)+')';}}
}else{toast('评论失败');}
}

// ── 搜索 ──
let _searchTimer=null;
$('search-input').addEventListener('input',e=>{
clearTimeout(_searchTimer);
_searchTimer=setTimeout(()=>{if(e.target.value.trim().length>=2)performSearch(e.target.value.trim());},400);
});
$('search-input').addEventListener('keydown',e=>{
if(e.key==='Enter'){clearTimeout(_searchTimer);if(e.target.value.trim().length>=2)performSearch(e.target.value.trim());}
});
document.querySelectorAll('#search-filters .filter-btn').forEach(btn=>{
btn.addEventListener('click',()=>{
document.querySelectorAll('#search-filters .filter-btn').forEach(b=>b.classList.remove('active'));
btn.classList.add('active');
currentSearchType=btn.dataset.type;
if(currentSearchQuery)performSearch(currentSearchQuery);
});
});
async function performSearch(q){
currentSearchQuery=q;
document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
document.querySelectorAll('.mobile-tabbar .tab').forEach(t=>t.classList.remove('active'));
document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
$('sec-search').classList.add('active');
$('search-results').innerHTML='<div class="sentinel loading">搜索中...</div>';
let url='/api/search/v2?q='+encodeURIComponent(q);
if(currentSearchType!=='all')url+='&type='+currentSearchType;
const r=await api(url);
if(!r||!r.ok||!r.data||r.data.length===0){
$('search-results').innerHTML=emptyStateHTML({icon:'search',title:'未找到相关结果',desc:'换个关键词试试'});
return;
}
$('search-results').innerHTML=r.data.map(item=>{
const typeLabel={blog:'博客',forum:'论坛',wall:'墙贴',material:'素材'}[item.type]||item.type;
const onclick=item.type==='blog'?`viewBlog(${item.id});$('search-input').value='';`:
item.type==='forum'?`viewThread(${item.id});$('search-input').value='';`:
item.type==='material'?(typeof openDetail==='function'?`openDetail(${item.id});$('search-input').value='';`:`location.href='/material.html?id=${item.id}';`):
`loadWall(true);$('search-input').value='';`;
return `<div class="search-result-item" onclick="${onclick}">
<span class="sr-type ${item.type}">${typeLabel}</span>
<div class="sr-title">${_searchHl(item.title||item.content.slice(0,50),q)}</div>
<div class="sr-preview">${_searchHl((item.content||'').replace(/<[^>]+>/g,'').slice(0,100),q)}</div>
</div>`;
}).join('');
}

// ── 个人中心 ──
async function loadProfile(){
const r=await api('/api/user/profile');
if(!r||!r.ok){$('profile-content').innerHTML=emptyStateHTML({icon:'lock',title:'请先登录',desc:'登录后可查看个人中心',ctaText:'去登录',ctaHref:'login.html'});return;}
const u=r.data.user,s=r.data.stats;
$('profile-content').innerHTML=`
<div class="profile-header">
<div class="profile-avatar">${esc(u.name.charAt(0)||'U')}</div>
<div><div class="profile-name">${esc(u.name)}</div><div class="profile-id">ID: ${esc(u.id)}</div></div>
</div>
<div class="stats-grid">
<div class="stat-card"><div class="stat-num">${s.blog}</div><div class="stat-label">博客</div></div>
<div class="stat-card"><div class="stat-num">${s.forum}</div><div class="stat-label">帖子</div></div>
<div class="stat-card"><div class="stat-num">${s.wall}</div><div class="stat-label">墙贴</div></div>
<div class="stat-card"><div class="stat-num">${s.comments}</div><div class="stat-label">评论</div></div>
<div class="stat-card"><div class="stat-num">${s.replies}</div><div class="stat-label">回复</div></div>
<div class="stat-card"><div class="stat-num">${s.likes}</div><div class="stat-label">点赞</div></div>
<div class="stat-card"><div class="stat-num">${s.follows}</div><div class="stat-label">关注</div></div>
</div>
<div class="tag-filter" id="profile-filters">
<div class="filter-btn active" data-type="blog">我的博客</div>
<div class="filter-btn" data-type="forum">我的帖子</div>
<div class="filter-btn" data-type="wall">我的墙贴</div>
</div>
<div id="my-posts-list"></div>
`;
document.querySelectorAll('#profile-filters .filter-btn').forEach(btn=>{
btn.addEventListener('click',()=>{
document.querySelectorAll('#profile-filters .filter-btn').forEach(b=>b.classList.remove('active'));
btn.classList.add('active');
loadMyPosts(btn.dataset.type);
});
});
loadMyPosts('blog');
}
async function loadMyPosts(type){
const r=await api('/api/user/my-posts?type='+type);
if(!r||!r.ok||!r.data||r.data.length===0){$('my-posts-list').innerHTML=emptyStateHTML({sm:true,icon:'doc',title:'暂无内容',desc:'去发布第一条吧'});return;}
$('my-posts-list').innerHTML=r.data.map(p=>{
const title=p.title||p.content.slice(0,50);
const onclick=type==='blog'?`viewBlog(${p.id})`:type==='forum'?`viewThread(${p.id})`:'';
const statusLabel={'published':'已发布','pending':'待审核','approved':'已发布','rejected':'已驳回'}[p.status]||p.status;
return `<div class="my-post-item">
<div class="mp-title" style="cursor:pointer" onclick="${onclick}">${esc(title)}<span class="status-badge ${p.status==='published'||p.status==='approved'?'published':p.status==='pending'?'pending':'rejected'}">${statusLabel}</span></div>
<div class="mp-meta">${type==='blog'?'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> '+p.views+' <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> '+p.likes+' <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> '+p.comments:type==='forum'?'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> '+p.views+' <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> '+p.replies:'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> '+p.likes} · ${p.created_at}</div>
<div class="mp-actions" style="margin-top:8px;display:flex;gap:8px">
<button class="btn" style="padding:4px 12px;font-size:12px" onclick="editMyPost('${type}',${p.id},'${esc(title).replace(/'/g,"\\'")}')"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>️ 编辑</button>
<button class="btn" style="padding:4px 12px;font-size:12px;color:var(--rose,#f87171)" onclick="deleteMyPost('${type}',${p.id},'${esc(title).replace(/'/g,"\\'")}')"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> 删除</button>
</div>
</div>`}).join('');
}

// ── 编辑/删除 ──
let editingType=null,editingId=null;
async function editMyPost(type,id,title){
editingType=type;editingId=id;
$('edit-modal-title').textContent=type==='blog'?'编辑博文':type==='forum'?'编辑帖子':'编辑墙贴';
$('edit-title-wrap').style.display=type==='wall'?'none':'block';
$('edit-category-wrap').style.display=type==='blog'?'block':'none';
$('edit-content-rte-wrap').style.display=type==='wall'?'none':'block';
$('edit-content-text-wrap').style.display=type==='wall'?'block':'none';
$('edit-tag-wrap').style.display=type==='wall'?'block':'none';
// 加载现有内容
const r=await api(`/api/user/my-posts?type=${type}`);
if(r&&r.ok&&r.data){
const item=r.data.find(p=>p.id===id);
if(item){
$('edit-title').value=item.title||'';
if(type==='blog')$('edit-category').value=item.category||'campus';
if(type==='wall'){$('edit-content-text').value=item.content||'';$('edit-tag').value=item.tag||'分享';}
else{$('edit-content').innerHTML=item.content||item.summary||'';activeEditor='edit-content';}
}
}
openModal('edit-modal');
}
async function submitEdit(){
if(!editingType||!editingId)return;
let url,body;
if(editingType==='blog'){
const title=$('edit-title').value.trim(),content=$('edit-content').innerHTML.trim();
if(!title||!content){toast('标题和内容不能为空');return;}
url=`/api/blog/posts/${editingId}`;body={title,content,category:$('edit-category').value};
}else if(editingType==='forum'){
const title=$('edit-title').value.trim(),content=$('edit-content').innerHTML.trim();
if(!title||!content){toast('标题和内容不能为空');return;}
url=`/api/forum/threads/${editingId}`;body={title,content};
}else{
const content=$('edit-content-text').value.trim();
if(!content){toast('内容不能为空');return;}
url=`/api/wall/posts/${editingId}`;body={content,tag:$('edit-tag').value};
}
const r=await api(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
toast(r&&r.ok?r.message:'操作失败');
if(r&&r.ok){closeModal('edit-modal');
const activeFilter=document.querySelector('#profile-filters .filter-btn.active');
loadMyPosts(activeFilter?activeFilter.dataset.type:editingType);}
}
function deleteMyPost(type,id,title){
$('confirm-message').textContent=`确定要删除「${title}」吗？此操作不可撤销。`;
$('confirm-ok-btn').onclick=async()=>{
const r=await api(`/${type==='blog'?'api/blog/posts':type==='forum'?'api/forum/threads':'api/wall/posts'}/${id}`,{method:'DELETE'});
toast(r&&r.ok?r.message:'删除失败');
if(r&&r.ok){closeModal('confirm-modal');
const activeFilter=document.querySelector('#profile-filters .filter-btn.active');
loadMyPosts(activeFilter?activeFilter.dataset.type:type);}
};
openModal('confirm-modal');
}

// ── 通知系统 ──
async function loadNotifications(){
const r=await api('/api/community/notifications');
if(!r||!r.ok)return;
const badge=$('notif-badge');
if(r.unread>0){badge.textContent=r.unread>99?'99+':r.unread;badge.style.display='flex';}
else badge.style.display='none';
const list=$('notif-list');
if(!r.data||r.data.length===0){list.innerHTML='<div class="notif-empty">暂无通知</div>';return;}
const typeText={'blog_comment':'评论了你的博客','forum_reply':'回复了你的帖子','blog_like':'赞了你的博客','wall_like':'赞了你的墙贴','follow':'关注了你'};
list.innerHTML=r.data.map(n=>`<div class="notif-item ${n.is_read?'':'unread'}" onclick="handleNotifClick('${n.type}',${n.target_id})">
${n.is_read?'':'<span class="ni-dot"></span>'}
<div class="ni-text"><strong>${esc(n.actor_name)}</strong> ${typeText[n.type]||n.type} ${n.target_title?'「'+esc(n.target_title.slice(0,30))+'」':''}</div>
<div class="ni-time">${n.created_at}</div>
</div>`).join('');
}
function toggleNotifDropdown(){
const dd=$('notif-dropdown');
dd.classList.toggle('show');
if(dd.classList.contains('show'))loadNotifications();
}
function handleNotifClick(type,id){
$('notif-dropdown').classList.remove('show');
if(type==='blog_comment'||type==='blog_like')viewBlog(id);
if(type==='forum_reply')viewThread(id);
}
async function markAllNotifRead(){
const r=await api('/api/community/notifications/read-all',{method:'POST'});
if(r&&r.ok){toast('已全部标记为已读');loadNotifications();}
}
document.addEventListener('click',e=>{
const dd=$('notif-dropdown');
if(dd.classList.contains('show')&&!e.target.closest('.notif-icon-wrap')&&!e.target.closest('.notif-dropdown'))dd.classList.remove('show');
});

// 初始化
loadBlog(true);
let _notifInterval=null;
function startNotifPolling(){
if(_notifInterval)return;
_notifInterval=setInterval(()=>{if(!document.hidden)loadNotifications();},60000);
}
function stopNotifPolling(){if(_notifInterval){clearInterval(_notifInterval);_notifInterval=null;}}
startNotifPolling();
document.addEventListener('visibilitychange',()=>{
if(document.hidden){stopNotifPolling();stopPmPolling();}
else{loadNotifications();startNotifPolling();startPmPolling();}
});

// ── 站内私信 ──
var pmPartnerId=null;
var pmPollingTimer=null;
function showPmList(){
pmPartnerId=null;
stopPmPolling();
$('pm-conversation-list-view').style.display='';
$('pm-chat-view').style.display='none';
loadPmConversations();
updatePmBadge();
}
async function loadPmConversations(){
const r=await api('/api/messages/conversations');
const el=$('pm-conversations');
if(!r||!r.ok){el.innerHTML='<div class="pm-empty">请先登录查看私信</div>';return}
if(!r.data||r.data.length===0){el.innerHTML='<div class="pm-empty">暂无私信记录<br><span style="font-size:12px">在博客或论坛中点击用户名即可发起私信</span></div>';return}
el.innerHTML=r.data.map(c=>{
const initial=(c.partner_name||'?').charAt(0).toUpperCase();
const time=(c.created_at||'').substring(5,16);
const preview=(c.content||'').substring(0,40);
const isMine=c.from_id===c.partner_id?false:true;
return '<div class="pm-conv" onclick="openPmChat(\''+c.partner_id+'\',\''+encodeURIComponent(c.partner_name||'用户')+'\')">'+
'<div class="pm-conv-avatar">'+initial+'</div>'+
'<div class="pm-conv-info"><div class="pm-conv-name">'+(c.partner_name||'未知用户')+(c.unread?'<span class="pm-conv-unread">'+c.unread+'</span>':'')+'</div>'+
'<div class="pm-conv-preview">'+(isMine?'我: ':'')+preview+'</div></div>'+
'<div class="pm-conv-time">'+time+'</div></div>';
}).join('');
}
async function openPmChat(partnerId,partnerName){
pmPartnerId=partnerId;
$('pm-conversation-list-view').style.display='none';
$('pm-chat-view').style.display='';
$('pm-partner-name').textContent=decodeURIComponent(partnerName||'私信');
$('pm-messages').innerHTML='<div class="pm-empty">加载中...</div>';
await loadPmMessages(partnerId);
markPmRead(partnerId);
startPmPolling();
$('pm-input').focus();
}
async function loadPmMessages(partnerId){
const r=await api('/api/messages/chat/'+encodeURIComponent(partnerId));
if(!r||!r.ok){$('pm-messages').innerHTML='<div class="pm-empty">加载失败</div>';return}
const el=$('pm-messages');
if(!r.data||r.data.length===0){el.innerHTML='<div class="pm-empty">开始你们的对话吧</div>';return}
el.innerHTML=r.data.map(m=>{
const isMine=m.from_id===pmPartnerId?false:true;
return '<div style="display:flex;flex-direction:column;align-items:'+(isMine?'flex-end':'flex-start')+'">'+
'<div class="pm-bubble '+(isMine?'me':'them')+'">'+m.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'+
'<div class="pm-bubble-time" style="'+(isMine?'':'text-align:left')+'">'+(m.created_at||'').substring(5,16)+'</div></div>';
}).join('');
el.scrollTop=el.scrollHeight;
}
async function sendPm(){
const input=$('pm-input');
const content=input.value.trim();
if(!content||!pmPartnerId)return;
input.value='';
const r=await api('/api/messages/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({toId:pmPartnerId,content:content})});
if(r&&r.ok){
loadPmMessages(pmPartnerId);
}else{
input.value=content;
alert(r&&r.message?r.message:'发送失败');
}
}
async function markPmRead(partnerId){
await api('/api/messages/read/'+encodeURIComponent(partnerId),{method:'POST'});
updatePmBadge();
}
async function updatePmBadge(){
const r=await api('/api/messages/unread-count');
const count=r&&r.ok?r.count:0;
const navBadge=$('pm-nav-badge');
const tabBadge=$('pm-tab-badge');
if(navBadge){navBadge.textContent=count;navBadge.style.display=count>0?'':'none'}
if(tabBadge){tabBadge.textContent=count;tabBadge.style.display=count>0?'':'none'}
}
function startPmPolling(){
stopPmPolling();
pmPollingTimer=setInterval(()=>{
if(pmPartnerId){loadPmMessages(pmPartnerId);markPmRead(pmPartnerId);}
updatePmBadge();
},10000);
}
function stopPmPolling(){
if(pmPollingTimer){clearInterval(pmPollingTimer);pmPollingTimer=null}
}
async function startNewChat(userId,userName){
if(!userId){return}
navigateTo('messages');
await new Promise(r=>setTimeout(r,100));
openPmChat(userId,encodeURIComponent(userName||'用户'));
}
updatePmBadge();
setInterval(updatePmBadge,60000);

// ── 活动报名 ──
var actListData=[];
function showActList(){
$('act-list-view').style.display='';
$('act-detail-view').style.display='none';
loadActivities();
}
function actStatusText(s){
return {upcoming:'即将开始',ongoing:'进行中',completed:'已结束',ended:'已结束',cancelled:'已取消'}[s]||s;
}
function actStatusColor(s){
return {upcoming:'#1d4ed8',ongoing:'#16a34a',completed:'#6b7280',ended:'#6b7280',cancelled:'#dc2626'}[s]||'#6b7280';
}
async function loadActivities(){
const r=await api('/api/activities');
const el=$('act-cards');
if(!r||!r.ok){el.innerHTML='<div class="pm-empty">加载失败</div>';return}
actListData=r.data||[];
if(actListData.length===0){el.innerHTML='<div class="pm-empty">暂无活动<br><span style="font-size:12px">管理员可在后台发布活动</span></div>';return}
el.innerHTML=actListData.map(a=>{
var cap=a.capacity>0?'/'+a.capacity:'';
var pct=a.capacity>0?Math.min(100,Math.round(a.registered_count/a.capacity*100)):0;
var isEnded=a.status==='completed'||a.status==='ended'||a.status==='cancelled';
var btnClass=a.my_status==='registered'?'registered':(isEnded?'disabled':'not-registered');
var btnText=a.my_status==='registered'?'已报名':(isEnded?actStatusText(a.status):'立即报名');
var loc=a.location?'<svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'+a.location.substring(0,12):'';
var dl=a.reg_deadline?'⏰截止:'+a.reg_deadline.substring(0,10):'';
return '<div class="act-card" onclick="openActDetail('+a.id+')">'+
'<div class="act-card-banner" style="background:'+(a.color||'linear-gradient(135deg,#667eea,#764ba2)')+'">'+
(a.poster?'<img src="/api/posters/'+a.poster+'" alt="'+a.title+'" style="width:100%;height:100%;object-fit:cover">':a.title.charAt(0))+
'<span class="act-card-status '+a.status+'">'+actStatusText(a.status)+'</span></div>'+
'<div class="act-card-body">'+
'<div class="act-card-title">'+a.title+'</div>'+
'<div class="act-card-meta">'+
'<span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> '+(a.date||'')+'</span>'+
(loc?'<span>'+loc+'</span>':'')+
'<span><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> '+(a.registered_count||0)+cap+'</span>'+
(dl?'<span>'+dl+'</span>':'')+
'</div>'+
(a.capacity>0?'<div class="act-card-progress"><div class="act-card-progress-bar" style="width:'+pct+'%"></div></div>':'')+
'<button class="act-card-cta '+btnClass+'" '+(isEnded?'disabled':'')+' onclick="event.stopPropagation();'+(isEnded?'':(a.my_status==='registered'?'cancelAct('+a.id+',this)':'joinAct('+a.id+',this)'))+'">'+btnText+'</button>'+
'</div></div>';
}).join('');
}
async function joinAct(id,btn){
var r=await api('/api/activities/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activity_id:id})});
if(r&&r.ok){
btn.className='act-card-cta registered';
btn.textContent=r.already?'已报名':'已报名';
btn.onclick=function(e){e.stopPropagation();cancelAct(id,btn)};
loadActivities();
}else{
alert(r&&r.message?r.message:'报名失败');
}
}
async function cancelAct(id,btn){
if(!confirm('确定取消报名？'))return;
var r=await api('/api/activities/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activity_id:id})});
if(r&&r.ok){
btn.className='act-card-cta not-registered';
btn.textContent='立即报名';
btn.onclick=function(e){e.stopPropagation();joinAct(id,btn)};
loadActivities();
}else{
alert(r&&r.message?r.message:'取消失败');
}
}
async function openActDetail(id){
$('act-list-view').style.display='none';
$('act-detail-view').style.display='';
$('act-detail-title').textContent='活动详情';
$('act-detail-content').innerHTML='<div class="pm-empty">加载中...</div>';
var r=await api('/api/activities/'+id);
if(!r||!r.ok){$('act-detail-content').innerHTML='<div class="pm-empty">加载失败</div>';return}
var a=r.data;
var isEnded=a.status==='completed'||a.status==='ended'||a.status==='cancelled';
var cap=a.capacity>0?' / '+a.capacity:' 不限';
var pct=a.capacity>0?Math.min(100,Math.round(a.registered_count/a.capacity*100)):0;
var btnHtml='';
if(a.my_status==='registered'){
btnHtml='<button class="btn btn-primary" style="width:100%;padding:10px" onclick="cancelActDetail('+a.id+')">取消报名</button>';
}else if(!isEnded){
btnHtml='<button class="btn btn-primary" style="width:100%;padding:10px" onclick="joinActDetail('+a.id+')">立即报名</button>';
}else{
btnHtml='<button class="btn" style="width:100%;padding:10px" disabled>'+actStatusText(a.status)+'</button>';
}
$('act-detail-content').innerHTML=
'<div class="act-detail-info">'+
'<h2 style="margin:0 0 12px;font-size:20px">'+a.title+'</h2>'+
'<p><span class="label"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> 日期</span>'+(a.date||'未设置')+'</p>'+
(a.location?'<p><span class="label"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> 地点</span>'+a.location+'</p>':'')+
'<p><span class="label"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> 报名</span>'+(a.registered_count||0)+cap+'</p>'+
(a.capacity>0?'<div class="act-card-progress" style="margin:8px 0"><div class="act-card-progress-bar" style="width:'+pct+'%"></div></div>':'')+
(a.reg_deadline?'<p><span class="label">⏰ 截止</span>'+a.reg_deadline+'</p>':'')+
'<p><span class="label"><svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2.5px" aria-hidden="true"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg> 状态</span><span style="color:'+actStatusColor(a.status)+';font-weight:600">'+actStatusText(a.status)+'</span></p>'+
'<p style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)"><span class="label">描述</span><br>'+(a.description||'暂无描述')+'</p>'+
'</div>'+
btnHtml;
}
async function joinActDetail(id){
var r=await api('/api/activities/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activity_id:id})});
if(r&&r.ok){
openActDetail(id);
}else{
alert(r&&r.message?r.message:'报名失败');
}
}
async function cancelActDetail(id){
if(!confirm('确定取消报名？'))return;
var r=await api('/api/activities/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activity_id:id})});
if(r&&r.ok){
openActDetail(id);
}else{
alert(r&&r.message?r.message:'取消失败');
}
}

// ── 跨页直达（Ctrl+K 命令面板跳转入口）──
(function(){
const sp=new URLSearchParams(location.search);
const v=sp.get('view'), rawId=sp.get('id');
const id=rawId?parseInt(rawId,10):0;
if(v==='blog'&&id>0){navigateTo('blog');viewBlog(id);history.replaceState(null,'',location.pathname+'#blog');}
else if(v==='thread'&&id>0){navigateTo('forum');viewThread(id);history.replaceState(null,'',location.pathname+'#forum');}
else if(v==='wall'){navigateTo('wall');history.replaceState(null,'',location.pathname+'#wall');}
})();
