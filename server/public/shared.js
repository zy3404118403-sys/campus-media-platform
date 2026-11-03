/* ═══════════════════════════════════════════════════════════════
   shared.js — 校园素材共建平台共享组件库
   从 index/admin/user 三页提取的公共 JS 组件，消除约 800 行重复代码
   加载方式: <script src="shared.js"></script> (放在第一个内联脚本之前)
   ═══════════════════════════════════════════════════════════════ */

/* ─── 1. 基础工具 ─── */
function $(id){ return document.getElementById(id) }

/* i18n 统一桥接: index用t(), admin用at(), user用ut() */
function _t(s){
	if(typeof t==='function') return t(s)
	if(typeof at==='function') return at(s)
	if(typeof ut==='function') return ut(s)
	return s
}

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }
function escurl(s){ return String(s==null?'':s).replace(/"/g,'&quot;') }
/* 搜索结果关键词高亮（全站共享）：esc 先行、关键词再正则转义后包 <mark class="sr-hl">，注入面为零。
   供 Ctrl+K 命令面板与 community.html 搜索结果共用；q 为空/非法时原样返回 esc(text)。 */
window._searchHl = function(text, q){
	var s = esc(text)
	q = String(q==null?'':q).trim()
	if(!q) return s
	var qEsc = esc(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
	if(!qEsc) return s
	try{ return s.replace(new RegExp('('+qEsc+')','gi'), '<mark class="sr-hl">$1</mark>') }catch(e){ return s }
}

/* ─── 2. Toast 通知（含 aria-live 公告） ─── */
function toast(msg, ms){
	var el=$('toast'); if(!el) return;
	if(!el.getAttribute('role')){ el.setAttribute('role','alert'); el.setAttribute('aria-live','assertive'); el.setAttribute('aria-atomic','true') }
	el.textContent=msg; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(function(){ el.classList.remove('show') }, ms||2600)
}

/* ─── 3. API 请求封装（含CSRF自动发送）─── */
function _getCSRFCookie(){
	// 2026-10-23：必须取【最后一个】csrf，与服务端 parseCookies（后者覆盖前者）保持一致。
	// HTTP/HTTPS 切换后浏览器可能同时存在两个同名 csrf cookie，取第一个会造成前后端 token 不一致 → 403
	var all = String(document.cookie || '').split(';')
	var val = ''
	for(var i=0;i<all.length;i++){
		var kv = all[i].trim()
		if(kv.indexOf('csrf=') === 0) val = kv.slice(5)
	}
	try { return val ? decodeURIComponent(val) : '' } catch(e) { return val }
}
async function api(url, opts){
	opts = opts || {}
	try{
		var method = (opts.method||'GET').toUpperCase()
		if(['POST','PUT','DELETE','PATCH'].includes(method)){
			var csrf = _getCSRFCookie()
			if(csrf){
				opts.headers = opts.headers || {}
				opts.headers['X-CSRF-Token'] = csrf
			}
			// 2026-10-23：token 缺失时先 GET 一次触发 Set-Cookie 补发，再读
			if(!csrf){
				try {
					await fetch('/api/health', { credentials:'same-origin' })
					var csrf2 = _getCSRFCookie()
					if(csrf2){
						opts.headers = opts.headers || {}
						opts.headers['X-CSRF-Token'] = csrf2
					}
				} catch(e) {}
			}
		}
		var res = await fetch(url, Object.assign({credentials:'same-origin'}, opts))
		var ct = res.headers.get('content-type')||''
		if(ct.includes('application/json')){
			var d = await res.json().catch(function(){ return {ok:false,message:_t('t.badResp')} })
			// 2026-10-23：429 限流单独标记，避免前端误报成"网络连接失败"
			// 2026-10-23：CSRF 失效（常见于协议切换后 token 不同步）→ 刷新后自动重试一次
			if(res.status === 403 && !opts.__csrfRetried && /CSRF/i.test(String((d && d.message) || ''))){
				opts.__csrfRetried = true
				try { await fetch('/api/health', { credentials:'same-origin' }) } catch(e){}
				var t3 = _getCSRFCookie()
				if(t3){ opts.headers = opts.headers || {}; opts.headers['X-CSRF-Token'] = t3 }
				return api(url, opts)
			}
			if(res.status === 429){
				return { ok:false, rateLimited:true, status:429,
					message: (d && d.message) || '请求过于频繁，请稍等几秒再试' }
			}
			if(!d.ok && res.status===401){
				if(typeof showLogin==='function') showLogin()
				else {
					if(typeof currentUser!=='undefined') currentUser=null
					if(typeof refreshUserUI==='function') refreshUserUI()
				}
			}
			if(!d.ok && res.status===403 && d.message && d.message.includes('CSRF')){
				toast(d.message)
			}
			return d
		}
		return {ok:res.ok, status:res.status}
	}catch(e){
		toast(_t('t.netFail'))
		return {ok:false,message:_t('t.netFail2'),error:String(e)}
	}
}

/* ─── 4. countUp 数字动画 ─── */
function countUp(el,target,duration){
	if(!el)return
	target=Math.max(0,parseInt(target)||0)
	duration=duration||1200
	var start=parseInt(el.textContent)||0
	if(start===target){el.textContent=target;return}
	var startTime=performance.now()
	function step(now){
		var t=Math.min((now-startTime)/duration,1)
		var eased=1-Math.pow(1-t,3)
		el.textContent=Math.round(start+(target-start)*eased)
		if(t<1)requestAnimationFrame(step)
	}
	requestAnimationFrame(step)
}
function countUpAll(container){
	(container||document).querySelectorAll('[data-count]').forEach(function(el){
		if(!el.dataset._counted){el.dataset._counted='1';countUp(el,el.dataset.count)}
	})
}

/* ─── 5. CustomSelect 自定义下拉框 ───
   WAI-ARIA 1.2 Select-Only Combobox 模式
   - trigger: role="combobox" + aria-expanded + aria-haspopup="listbox" + tabindex="0"
   - dropdown: role="listbox" + aria-label
   - options: role="option" + aria-selected + id (for aria-activedescendant)
   - 键盘: ArrowDown/Up 导航, Enter 选择, Escape 关闭, Home/End 跳转首尾
   - 原生 select 使用 sr-only (视觉隐藏但保留在可访问性树中) */
var CS_ARROW = '<svg class="cs-arrow" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 4.5 6 7.5 9 4.5"/></svg>'

/* 生成唯一 ID 用于 aria-activedescendant */
var _csIdCounter = 0
function _csNextId(prefix){ return prefix + (++_csIdCounter) }

function initCustomSelect(select){
	if(select.dataset.csInit || select.dataset._csInit) return
	select.dataset.csInit = '1'
	select.dataset._csInit = '1'

	/* 原生 select → sr-only（保留在 a11y 树中而非 display:none） */
	select.classList.add('sr-only')
	select.setAttribute('aria-hidden','true')
	select.setAttribute('tabindex','-1')

	var baseId = _csNextId('cs')
	var wrapper = document.createElement('div')
	wrapper.className = 'cs-wrapper'
	select.parentNode.insertBefore(wrapper, select)
	wrapper.appendChild(select)

	/* Trigger — Combobox */
	var trigger = document.createElement('div')
	trigger.className = 'cs-trigger'
	trigger.setAttribute('role','combobox')
	trigger.setAttribute('aria-expanded','false')
	trigger.setAttribute('aria-haspopup','listbox')
	trigger.setAttribute('tabindex','0')
	var labelId = baseId + '-label'
	trigger.setAttribute('aria-labelledby', labelId)

	var arrow = document.createElement('span')
	arrow.innerHTML = CS_ARROW
	/* 隐藏标签 span 供 aria 引用（从原生 select 的 label 或 name 获取可读名称） */
	var hiddenLabel = document.createElement('span')
	hiddenLabel.id = labelId
	hiddenLabel.className = 'sr-only'
	hiddenLabel.style.cssText = 'position:absolute !important;width:1px !important;height:1px !important;padding:0 !important;margin:-1px !important;overflow:hidden !important;clip:rect(0,0,0,0) !important;white-space:nowrap !important;border:0 !important'
	hiddenLabel.textContent = (select.getAttribute('aria-label') || select.name || _t('upload.subSelect'))
	trigger.appendChild(hiddenLabel)
	trigger.appendChild(document.createTextNode(''))
	trigger.appendChild(arrow)
	wrapper.appendChild(trigger)

	/* Dropdown — Listbox */
	var dropdown = document.createElement('div')
	dropdown.className = 'cs-dropdown'
	dropdown.setAttribute('role','listbox')
	dropdown.setAttribute('aria-label', hiddenLabel.textContent)
	wrapper.appendChild(dropdown)

	/* 当前键盘高亮的选项 index */
	var activeIndex = 0

	function getOptions(){ return dropdown.querySelectorAll('.cs-option:not(.cs-disabled)') }

	function refresh(){
		var sel = select.options[select.selectedIndex]
		var textNode = trigger.childNodes[1] /* text node after hiddenLabel */
		if(!sel || !sel.value){
			trigger.classList.add('cs-placeholder')
			textNode.textContent = sel ? sel.textContent : _t('upload.subSelect')
		} else {
			trigger.classList.remove('cs-placeholder')
			textNode.textContent = sel.textContent
		}
		/* 重建 dropdown */
		dropdown.innerHTML = ''
		activeIndex = select.selectedIndex >= 0 ? select.selectedIndex : 0
		for(var i=0; i<select.options.length; i++){
			var opt = select.options[i]
			var item = document.createElement('div')
			item.className = 'cs-option' + (i===select.selectedIndex?' cs-selected':'') + (!opt.value?' cs-disabled':'')
			item.setAttribute('role','option')
			item.setAttribute('aria-selected', String(i===select.selectedIndex))
			var oid = baseId + '-opt-' + i
			item.id = oid
			if(!opt.value) item.setAttribute('aria-disabled','true')
			else item.setAttribute('tabindex','-1')
			item.textContent = opt.textContent
			;(function(o, idx){
				item.addEventListener('click', function(e){
					e.stopPropagation()
					if(!o.value) return
					select.selectedIndex = idx
					refresh()
					wrapperClose()
					select.dispatchEvent(new Event('change', {bubbles:true}))
				})
			})(opt, i)
			dropdown.appendChild(item)
		}
		/* 设置初始 aria-activedescendant */
		updateActiveDescendant()
	}

	function updateActiveDescendant(){
		var opts = getOptions()
		if(opts.length > 0 && activeIndex < opts.length){
			trigger.setAttribute('aria-activedescendant', opts[activeIndex].id)
		} else {
			trigger.removeAttribute('aria-activedescendant')
		}
	}

	function setActive(idx, scrollIntoView){
		var opts = getOptions()
		if(opts.length === 0) return
		idx = Math.max(0, Math.min(idx, opts.length - 1))
		activeIndex = idx
		/* 更新视觉高亮 */
		opts.forEach(function(o,i){
			if(i === idx) o.style.background = 'var(--skin-option-hover-bg,rgba(212,175,55,.1))'
			else o.style.background = ''
		})
		updateActiveDescendant()
		/* 滚动到可见区域 */
		if(scrollIntoView && opts[idx]) opts[idx].scrollIntoView({block:'nearest'})
	}

	function wrapperOpen(){
		if(wrapper.classList.contains('open')) return
		closeAllCustomSelects() /* 单选模式：先关闭所有兄弟 */
		wrapper.classList.add('open')
		trigger.setAttribute('aria-expanded','true')
		/* 高亮第一条可选项或当前选中项 */
		var selectedOption = dropdown.querySelector('.cs-option.cs-selected:not(.cs-disabled)')
		if(selectedOption){
			var opts = getOptions()
			for(var i=0; i<opts.length; i++){ if(opts[i]===selectedOption){ activeIndex=i; break } }
		} else { activeIndex = 0 }
		setActive(activeIndex, true)
	}

	function wrapperClose(){
		if(!wrapper.classList.contains('open')) return
		wrapper.classList.remove('open')
		trigger.setAttribute('aria-expanded','false')
		trigger.removeAttribute('aria-activedescendant')
		/* 清除高亮 */
		var opts = getOptions()
		for(var i=0; i<opts.length; i++) opts[i].style.background = ''
	}

	/* ── 键盘导航 ── */
	trigger.addEventListener('keydown', function(e){
		var isOpen = wrapper.classList.contains('open')
		switch(e.key){
			case 'ArrowDown':
				e.preventDefault()
				if(!isOpen){ wrapperOpen(); return }
				setActive(activeIndex + 1, true)
				break
			case 'ArrowUp':
				e.preventDefault()
				if(!isOpen){ wrapperOpen(); return }
				setActive(activeIndex - 1, true)
				break
			case 'Home':
				if(!isOpen) return
				e.preventDefault()
				setActive(0, true)
				break
			case 'End':
				if(!isOpen) return
				e.preventDefault()
				setActive(getOptions().length - 1, true)
				break
			case 'Enter':
			case ' ':
				e.preventDefault()
				if(isOpen){
					/* 选择当前高亮项 */
					var opts = getOptions()
					if(opts.length > 0 && activeIndex < opts.length){
						opts[activeIndex].click()
					}
				} else {
					wrapperOpen()
				}
				break
			case 'Escape':
				if(isOpen){ e.preventDefault(); e.stopPropagation(); wrapperClose() }
				break
			case 'Tab':
				/* Tab 离开时关闭下拉 → 自然焦点前进 */
				if(isOpen) wrapperClose()
				break
		}
	})

	/* 点击触发器 */
	trigger.addEventListener('click', function(e){
		e.stopPropagation()
		if(wrapper.classList.contains('open')) wrapperClose()
		else wrapperOpen()
	})

	/* option hover 同步键盘高亮 */
	dropdown.addEventListener('mouseover', function(e){
		var optEl = e.target.closest('.cs-option')
		if(!optEl || optEl.classList.contains('cs-disabled')) return
		var opts = getOptions()
		for(var i=0; i<opts.length; i++){
			if(opts[i] === optEl){ setActive(i, false); break }
		}
	})

	wrapper._refresh = refresh
	wrapper._open = wrapperOpen
	wrapper._close = wrapperClose
	refresh()
}

function initCustomSelects(container){
	(container||document).querySelectorAll('select.cs-custom').forEach(initCustomSelect)
}

function closeAllCustomSelects(){
	document.querySelectorAll('.cs-wrapper.open').forEach(function(w){ w.classList.remove('open') })
	/* 同步更新 aria-expanded */
	document.querySelectorAll('.cs-trigger[aria-expanded="true"]').forEach(function(t){ t.setAttribute('aria-expanded','false'); t.removeAttribute('aria-activedescendant') })
}

if(!window._csClickBound){
	window._csClickBound = true
	document.addEventListener('click', closeAllCustomSelects)
}

/* ─── 6. SpecularButton (WebGL 高光按钮) ─── */
function startSpecularButtons(){
	document.querySelectorAll('.specular-button').forEach(function(btn){
		var fx=btn.querySelector('.specular-button__fx')
		if(!fx) return
		if(fx.dataset.init && btn._specularDestroy) btn._specularDestroy()
		if(!fx.dataset.init) {
			try{ initSpecularButton(btn,fx) }catch(e){ console.warn('SpecularButton init failed:',e) }
		}
	})
}
function initSpecularButton(btn, fx){
	if(!window.OGL) return
	var OGL = window.OGL
	var Renderer = OGL.Renderer, Triangle = OGL.Triangle, Program = OGL.Program, Mesh = OGL.Mesh

	var PAD = 20
	var dpr = window.devicePixelRatio || 1

	var VERT = '#version 300 es\nin vec2 position;\nvoid main(){ gl_Position=vec4(position,0.0,1.0); }'

	var FRAG = '#version 300 es\nprecision highp float;\nuniform vec2 uCenter; uniform vec2 uHalfSize; uniform float uRadius;\nuniform float uAngle; uniform float uPx; uniform vec3 uLineColor;\nuniform vec3 uBaseColor; uniform float uIntensity; uniform float uShineSize;\nuniform float uShineFade; uniform float uThickness; uniform float uBaseWidth;\nout vec4 fragColor;\nfloat sdRoundedRect(vec2 p, vec2 b, float r){\n  vec2 q=abs(p)-b+r;\n  return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r;\n}\nfloat gaussianLine(float d, float sigma){\n  float x=d/(sigma+1e-6);\n  float k=mix(1.0,1.6,smoothstep(0.0,1.5,x));\n  return exp(-k*x*x);\n}\nvoid main(){\n  vec2 p=gl_FragCoord.xy-uCenter;\n  float d=sdRoundedRect(p,uHalfSize,uRadius);\n  vec2 L=vec2(cos(uAngle),sin(uAngle));\n  float base=(1.0-smoothstep(0.0,uBaseWidth,abs(d)))*0.45;\n  vec2 nEll=normalize(p/(uHalfSize*uHalfSize)+1e-6);\n  float phi=acos(clamp(abs(dot(nEll,L)),0.0,1.0));\n  float rim=1.0-smoothstep(uShineSize-uShineFade,uShineSize+uShineFade+1e-4,phi);\n  float line=gaussianLine(d,uThickness);\n  float edgeClamp=1.0-smoothstep(0.5*uPx,3.0*uPx,abs(d));\n  float hi=line*rim*edgeClamp*uIntensity;\n  vec3 col=uBaseColor*base+uLineColor*hi;\n  float a=clamp(base+hi,0.0,1.0);\n  fragColor=vec4(col,a);\n}'

	function hexToRgb(hex){
		var h=(hex||'#000000').replace('#','')
		if(h.length===3) h=h.split('').map(function(c){return c+c}).join('')
		var n=parseInt(h,16)
		return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]
	}

	var opts = {
		radius: 18, lineColor: '#ffffff', baseColor: '#525252',
		intensity: 1, shineSize: 10, shineFade: 40, thickness: 1,
		speed: 0.35, followMouse: true, proximity: 250, autoAnimate: false
	}
	var r = btn.style.getPropertyValue('--sb-radius')
	if(r) opts.radius = parseFloat(r)

	var renderer = new Renderer({ alpha:true, premultipliedAlpha:true, antialias:true, dpr:dpr })
	var gl = renderer.gl
	gl.clearColor(0,0,0,0)
	gl.enable(gl.BLEND)
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

	var geometry = new Triangle(gl)
	if(geometry.attributes.uv) delete geometry.attributes.uv

	var program = new Program(gl, {
		vertex: VERT, fragment: FRAG,
		uniforms: {
			uCenter: { value:[0,0] }, uHalfSize: { value:[1,1] },
			uRadius: { value: 0 }, uAngle: { value: 2.4 }, uPx: { value: dpr },
			uLineColor: { value:[1,1,1] }, uBaseColor: { value:[0.32,0.32,0.32] },
			uIntensity: { value: 1 }, uShineSize: { value: 0.17 },
			uShineFade: { value: 0.7 }, uThickness: { value: 1 },
			uBaseWidth: { value: dpr }
		}
	})

	var mesh = new Mesh(gl, { geometry:geometry, program:program })
	gl.canvas.setAttribute('aria-hidden','true')
	fx.appendChild(gl.canvas)
	fx.dataset.init = '1'
	fx.classList.add('sb-fx-active')

	var sizeRef = { w:1, h:1 }
	function resize(){
		var rect = btn.getBoundingClientRect()
		sizeRef.w = rect.width; sizeRef.h = rect.height
		renderer.setSize(rect.width + PAD*2, rect.height + PAD*2)
		program.uniforms.uCenter.value = [(PAD + rect.width/2)*dpr, (PAD + rect.height/2)*dpr]
		program.uniforms.uHalfSize.value = [(rect.width/2)*dpr, (rect.height/2)*dpr]
	}
	var ro = new ResizeObserver(resize)
	ro.observe(btn)
	resize()

	var pointerAngle = null, proximityT = 0
	function onPointerMove(e){
		var rect = btn.getBoundingClientRect()
		var cx = rect.left + rect.width/2
		var cy = rect.top + rect.height/2
		var dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right)
		var dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom)
		var dist = Math.hypot(dx, dy)
		if(dist === 0){
			var nx = (e.clientX - cx) / (rect.width/2)
			var ny = (cy - e.clientY) / (rect.height/2)
			pointerAngle = Math.atan2(2/rect.height, -2/rect.width) + nx*0.3 + ny*0.15
		} else {
			pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx)
		}
		var t = Math.max(0, 1 - dist / Math.max(opts.proximity, 1))
		proximityT = t * t * (3 - 2*t)
	}
	window.addEventListener('pointermove', onPointerMove)

	var angle = 2.4, idleAngle = 2.4, bright = 0, last = performance.now(), raf = 0
	function update(now){
		raf = requestAnimationFrame(update)
		var dt = Math.min((now - last) / 1000, 0.05)
		last = now
		idleAngle += opts.speed * dt
		var steer = opts.followMouse && pointerAngle != null && (!opts.autoAnimate || proximityT > 0)
		var target = steer ? pointerAngle : idleAngle
		var diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
		angle += diff * (1 - Math.exp(-dt * 7))
		var brightTarget = opts.autoAnimate ? 1 : proximityT
		bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8))
		program.uniforms.uAngle.value = angle
		program.uniforms.uRadius.value = Math.min(opts.radius, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr
		program.uniforms.uLineColor.value = hexToRgb(opts.lineColor)
		program.uniforms.uBaseColor.value = hexToRgb(opts.baseColor)
		program.uniforms.uIntensity.value = opts.intensity * bright
		program.uniforms.uShineSize.value = (opts.shineSize * Math.PI) / 180
		program.uniforms.uShineFade.value = (opts.shineFade * Math.PI) / 180
		program.uniforms.uThickness.value = opts.thickness * dpr
		renderer.render({ scene: mesh })
	}
	raf = requestAnimationFrame(update)

	// IntersectionObserver: 不可见时暂停 rAF，可见时恢复
	var _sbVisible = true
	var _sbIO = new IntersectionObserver(function(entries){
		var vis = entries[0] && entries[0].isIntersecting
		if(vis && !_sbVisible){
			_sbVisible = true
			last = performance.now()
			raf = requestAnimationFrame(update)
		} else if(!vis && _sbVisible){
			_sbVisible = false
			cancelAnimationFrame(raf)
		}
	}, { threshold: 0.01 })
	_sbIO.observe(btn)

	btn._specularDestroy = function(){
		cancelAnimationFrame(raf)
		_sbIO.disconnect()
		window.removeEventListener('pointermove', onPointerMove)
		ro.disconnect()
		var loseCtx = gl.getExtension('WEBGL_lose_context')
		if(loseCtx) loseCtx.loseContext()
		fx.classList.remove('sb-fx-active')
		fx.dataset.init = ''
		delete btn._specularDestroy
	}
}
if(!window._sbOglBound){
	window._sbOglBound = true
	window.addEventListener('ogl-ready', startSpecularButtons)
	if(window.OGL) startSpecularButtons()
}

/* ─── 7. 主题切换（View Transitions 圆形扩散 + aria-pressed 状态） ── */
function toggleTheme(){
	var h=document.documentElement
	var cur=h.getAttribute('data-theme')||'dark'
	var next=cur==='dark'?'light':'dark'
	/* 性能：切换期间给 <html> 打 theme-switching 标记，
	   配合 homepage-v3.css 暂停装饰性动画/过渡，避免 View Transition
	   快照期间 34 层 backdrop-filter 与无限动画争抢帧预算导致掉帧 */
	function begin(){ h.classList.add('theme-switching') }
	function end(){ clearTimeout(h._tswT); h._tswT=setTimeout(function(){ h.classList.remove('theme-switching') },420) }
	function apply(){
		h.setAttribute('data-theme',next)
		localStorage.setItem('theme',next)
		updateThemeIcon(next)
		var btn = $('themeToggle')
		if(btn) btn.setAttribute('aria-pressed', String(next==='light'))
		try{ window.dispatchEvent(new CustomEvent('theme-toggled',{detail:{theme:next}})) }catch(e){}
		end()
	}
	begin()
	/* 不支持 View Transitions / 用户偏好减少动效：直接切换 */
	var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
	if(!document.startViewTransition || reduceMotion){ apply(); return }
	/* 从按钮位置圆形扩散 */
	var x=innerWidth-46, y=innerHeight-46
	var btn=document.getElementById('themeToggle')
	if(btn && btn.getBoundingClientRect){ var r=btn.getBoundingClientRect(); x=r.left+r.width/2; y=r.top+r.height/2 }
	var endRadius=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))
	try{
		var vt=document.startViewTransition(apply)
		vt.ready.then(function(){
			document.documentElement.animate(
				{clipPath:['circle(0px at '+x+'px '+y+'px)','circle('+endRadius+'px at '+x+'px '+y+'px)']},
				{duration:480,easing:'ease-in-out',pseudoElement:'::view-transition-new(root)'}
			)
		}).catch(function(){})
	}catch(e){ apply() }
}
function updateThemeIcon(theme){
	var el=document.getElementById('themeToggleIcon')
	if(!el)return
	if(theme==='light'){
		el.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
	}else{
		el.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
	}
}
;(function(){
	var theme=document.documentElement.getAttribute('data-theme')||'dark'
	if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',function(){updateThemeIcon(theme)})}
	else{updateThemeIcon(theme)}
	/* 初始化 aria-pressed */
	document.addEventListener('DOMContentLoaded',function(){
		var btn = $('themeToggle')
		if(btn) btn.setAttribute('aria-pressed', String(theme==='light'))
	})
})()

/* ─── 8. ClickSpark 点击火花效果 ── */
if(!window._clickSparkInit){
window._clickSparkInit = true;
;(function(){
	var sparkColor='#fff', sparkSize=10, sparkRadius=15, sparkCount=8, duration=400, easing='ease-out', extraScale=1.0;
	var canvas=document.createElement('canvas');
	canvas.setAttribute('aria-hidden','true');
	canvas.style.cssText='position:fixed;top:0;left:0;pointer-events:none;z-index:99999;display:block';
	document.body.appendChild(canvas);
	var ctx=canvas.getContext('2d'), sparks=[], rafId=null, dpr=window.devicePixelRatio||1;
	function resize(){var w=window.innerWidth,h=window.innerHeight;canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
	resize();window.addEventListener('resize',resize);
	function easeFunc(t){switch(easing){case 'linear':return t;case 'ease-in':return t*t;case 'ease-in-out':return t<0.5?2*t*t:-1+(4-2*t)*t;default:return t*(2-t)}}
	function draw(ts){
		ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
		sparks=sparks.filter(function(sp){
			var el=ts-sp.startTime; if(el>=duration) return false;
			var p=el/duration, e=easeFunc(p), dist=e*sparkRadius*extraScale, len=sparkSize*(1-e);
			var x1=sp.x+dist*Math.cos(sp.angle), y1=sp.y+dist*Math.sin(sp.angle);
			var x2=sp.x+(dist+len)*Math.cos(sp.angle), y2=sp.y+(dist+len)*Math.sin(sp.angle);
			ctx.strokeStyle=sparkColor; ctx.lineWidth=2; ctx.lineCap='round';
			ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
			return true;
		});
		if(sparks.length) rafId=requestAnimationFrame(draw); else {rafId=null; ctx.clearRect(0,0,window.innerWidth,window.innerHeight)}
	}
	document.addEventListener('click',function(e){
		var x=e.clientX, y=e.clientY, now=performance.now();
		for(var i=0;i<sparkCount;i++) sparks.push({x:x,y:y,angle:(2*Math.PI*i)/sparkCount,startTime:now});
		if(!rafId) rafId=requestAnimationFrame(draw);
	});
})();
}

/* ─── 9. 模态框无障碍辅助 ──
   各页面有自己的 openModal/closeModal（CSS 差异：index 用 .active，admin/user 用 .hidden），
   但都调用以下辅助函数来补全焦点管理 + Escape 关闭 + ARIA */
var _modalStack = []
window._lastFocusedEl = null

/* 打开模态框前：记住当前焦点、注册 Escape 监听 */
window._modalOnOpen = function(overlay){
	if(!overlay) return
	window._lastFocusedEl = document.activeElement
	_modalStack.push(overlay.id || '')
	/* 确保 ARIA 属性 */
	if(!overlay.getAttribute('role')) overlay.setAttribute('role','dialog')
	if(!overlay.hasAttribute('aria-modal')) overlay.setAttribute('aria-modal','true')
	/* Escape 关闭 */
	if(!window._modalEscBound){
		window._modalEscBound = true
		document.addEventListener('keydown', function(e){
			if(e.key==='Escape' && _modalStack.length > 0){
				var id = _modalStack[_modalStack.length - 1]
				if(id && typeof closeModal==='function') closeModal(id)
			}
		})
	}
	/* 焦点移到弹窗内第一个可聚焦元素 */
	var focusTarget = overlay.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
	if(focusTarget) setTimeout(function(){ focusTarget.focus() }, 50)
}

/* 关闭模态框后：还原焦点 */
window._modalOnClose = function(overlay){
	if(!overlay) return
	var idx = _modalStack.lastIndexOf(overlay.id || '')
	if(idx >= 0) _modalStack.splice(idx, 1)
	if(window._lastFocusedEl && document.contains(window._lastFocusedEl)){
		setTimeout(function(){ window._lastFocusedEl.focus() }, 50)
	}
}

/* ── 导出供页面级脚本使用 ── */
window._csRefresh = function(select){ var w = select && select.closest && select.closest('.cs-wrapper'); if(w && w._refresh) w._refresh() }
window._csOpen = function(select){ var w = select && select.closest && select.closest('.cs-wrapper'); if(w && w._open) w._open() }
window._csClose = function(select){ var w = select && select.closest && select.closest('.cs-wrapper'); if(w && w._close) w._close() };

/* ─── 9.5 全站空状态 / 骨架屏工厂（批次1 体验统一） ───
   用法: var html = emptyStateHTML({icon:'doc', title:'还没有文稿', desc:'写下第一篇吧', ctaText:'新建文稿', ctaOnclick:'openEditor()'})
   图标集与 user/articles 页内联 SVG 风格一致（48px 线性）；sm 为紧凑版 */
var _esIcons = {
	doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
	pen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><line x1="2" y1="2" x2="9.586" y2="9.586"/></svg>',
	search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
	lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
	mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
	image:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
	msg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
	folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
	heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
	check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
	chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
	warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
}
function _esIconHTML(icon){
	if(!icon) return ''
	if(icon.indexOf('<svg')===0) return icon
	return _esIcons[icon] || _esIcons.doc
}
window.emptyStateHTML = function(opts){
	opts = opts || {}
	var icon = opts.rawIcon ? _esIconHTML(opts.rawIcon) : _esIconHTML(opts.icon)
	var cta = ''
	if(opts.ctaText){
		if(opts.ctaHref){
			cta = '<a class="es-cta'+(opts.ctaPlain?' es-cta-plain':'')+'" href="'+opts.ctaHref+'">'+opts.ctaText+'</a>'
		}else{
			cta = '<button type="button" class="es-cta'+(opts.ctaPlain?' es-cta-plain':'')+'" onclick="'+(opts.ctaOnclick||'')+'">'+opts.ctaText+'</button>'
		}
		if(opts.ctaText2){
			cta += opts.ctaHref2
				? '<a class="es-cta es-cta-plain" href="'+opts.ctaHref2+'">'+opts.ctaText2+'</a>'
				: '<button type="button" class="es-cta es-cta-plain" onclick="'+(opts.ctaOnclick2||'')+'">'+opts.ctaText2+'</button>'
		}
	}
	// 2026-10-23：自动重试倒计时（设计借鉴 Lucian 090「插头重插的错误组件」）
	// opts.autoRetry = 秒数；到期自动执行 ctaFn（函数引用，不再用字符串求值）
	var autoBlock = ''
	if(opts.autoRetry && opts.ctaOnclick){
		var _sec = parseInt(opts.autoRetry, 10) || 8
		if(window._esRetryTimer){ try{ clearTimeout(window._esRetryTimer) }catch(e){} }
		autoBlock = '<div class="es-retry" data-sec="'+_sec+'">'
			+ '<div class="es-ring"><svg viewBox="0 0 40 40"><circle class="es-ring-bg" cx="20" cy="20" r="17"/><circle class="es-ring-fg" cx="20" cy="20" r="17"/></svg><b>'+_sec+'</b></div>'
			+ '<span class="es-retry-note">秒后自动重试</span></div>'
		window._esRetryTimer = setTimeout(function(){
			window._esRetryTimer = null
			// 2026-10-25：移除 new Function（Luna 列为高优先级风险，也是 CSP 去掉 'unsafe-eval' 的前置条件）
			// 改为执行调用方传入的函数引用 ctaFn；兼容 window.__esActions 白名单映射
			try {
				if (typeof opts.ctaFn === 'function') opts.ctaFn()
				else if (opts.ctaAction && window.__esActions && typeof window.__esActions[opts.ctaAction] === 'function') window.__esActions[opts.ctaAction]()
				else console.warn('[emptyStateHTML] autoRetry 需要 ctaFn 或 ctaAction，已跳过自动重试')
			} catch (e) { console.warn('[emptyStateHTML] 自动重试执行失败:', e && e.message) }
		}, _sec * 1000)
	}
	return '<div class="empty-state'+(opts.sm?' sm':'')+'" style="'+(opts.style||'')+'">'
		+ (icon ? '<div class="es-icon">'+icon+'</div>' : '')
		+ '<div class="es-title">'+(opts.title||'')+'</div>'
		+ (opts.desc ? '<div class="es-desc">'+opts.desc+'</div>' : '')
		+ autoBlock
		+ (cta ? '<div class="es-actions">'+cta+'</div>' : '')
		+ '</div>'
}
/* 骨架屏工厂：cards 卡片列表 / rows 表格行（依赖 shared.css .sk-* + .skeleton shimmer） */
window.skeletonCardsHTML = function(n){
	n = n || 6
	var out = ''
	for(var i=0;i<n;i++){
		out += '<div class="sk-card"><div class="skeleton sk-thumb"></div><div class="sk-pad">'
			+ '<div class="skeleton sk-line w80"></div><div class="skeleton sk-line w60"></div><div class="skeleton sk-line w40"></div>'
			+ '</div></div>'
	}
	return out
}
window.skeletonRowsHTML = function(n){
	n = n || 5
	var out = ''
	for(var i=0;i<n;i++){
		out += '<div class="sk-row"><div class="skeleton sk-line" style="max-width:48px"></div><div class="skeleton sk-line"></div><div class="skeleton sk-line w60"></div><div class="skeleton sk-line w40"></div></div>'
	}
	return out
}
/* 列表骨架复用：给容器打上 stagger-in 编排（reduced-motion 由 CSS 兜底） */
window.applyStagger = function(el){
	if(el && el.classList) el.classList.add('stagger-in')
};

/* ─── 10. 全局命令面板（Ctrl+K / ⌘K 全站搜索） ───
   数据源: GET /api/search?q=  返回 { ok, data:[{type:'blog'|'forum'|'wall', id, title, content}] }
   跳转约定与 community.html 侧栏搜索一致:
   blog → viewBlog(id) / community.html?view=blog&id=N
   forum → viewThread(id) / community.html?view=thread&id=N
   wall → navigateTo('wall') / community.html#wall */
(function(){
	if(window._kpInit) return; window._kpInit = true

	var panel=null, inputEl=null, listEl=null, hintEl=null
	var items=[], active=-1, timer=null, opened=false, restoreFocus=null
	var favs=[], favsLoaded=false
	var TYPE_LABEL={blog:'博客',forum:'论坛',wall:'墙贴',material:'素材'}
	var TYPE_ICON={
		blog:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
		forum:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
		wall:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>',
		material:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
	}

	function ensureDOM(){
		if(panel) return
		var style=document.createElement('style')
		style.textContent='#kp-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding-top:12vh;background:rgba(8,10,16,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .18s ease}'+
		'#kp-overlay.kp-open{opacity:1}'+
		'#kp-panel{width:min(600px,92vw);background:var(--bg,#151a23);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.5);overflow:hidden;transform:translateY(8px) scale(.98);transition:transform .18s ease}'+
		'#kp-overlay.kp-open #kp-panel{transform:none}'+
		'#kp-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border,rgba(255,255,255,.08))}'+
		'#kp-input{flex:1;background:transparent;border:none;outline:none;color:var(--text,#e8edf4);font-size:15px;font-family:inherit}'+
		'#kp-input::placeholder{color:var(--text-3,#8a93a5)}'+
		'#kp-kbd{font-size:11px;color:var(--text-3,#8a93a5);border:1px solid var(--border,rgba(255,255,255,.14));border-radius:5px;padding:2px 6px;white-space:nowrap}'+
		'#kp-list{max-height:min(400px,52vh);overflow-y:auto;padding:6px}'+
		'#kp-list::-webkit-scrollbar{width:6px}#kp-list::-webkit-scrollbar-thumb{background:rgba(128,138,155,.35);border-radius:3px}'+
		'.kp-item{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:9px;cursor:pointer}'+
		'.kp-item[aria-selected="true"],.kp-item:hover{background:rgba(127,150,255,.14)}'+
		'.kp-badge{display:inline-flex;align-items:center;gap:4px;flex:none;font-size:11px;padding:2px 7px;border-radius:5px;margin-top:2px;color:var(--text-2,#aeb6c6);background:rgba(127,150,255,.12)}'+
		'.kp-main{min-width:0}'+
		'.kp-title{font-size:13.5px;font-weight:600;color:var(--text,#e8edf4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
		'.kp-preview{font-size:12px;color:var(--text-3,#8a93a5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}'+
		'#kp-foot{display:flex;justify-content:space-between;padding:8px 14px;border-top:1px solid var(--border,rgba(255,255,255,.08));font-size:11px;color:var(--text-3,#8a93a5)}'+
		'.kp-empty{padding:28px 0;text-align:center;font-size:13px;color:var(--text-3,#8a93a5)}'+
		'mark.sr-hl{background:rgba(250,204,21,.32);color:inherit;border-radius:2px;padding:0 1px}'
		document.head.appendChild(style)

		panel=document.createElement('div')
		panel.id='kp-overlay'
		panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-label','全站搜索')
		panel.innerHTML='<div id="kp-panel">'+
			'<div id="kp-head">'+
			'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-3,#8a93a5);flex:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'+
			'<input id="kp-input" type="text" placeholder="搜索博客、论坛、墙贴…" autocomplete="off" spellcheck="false" aria-label="搜索关键词">'+
			'<span id="kp-kbd">Esc 关闭</span>'+
			'</div>'+
			'<div id="kp-list" role="listbox" aria-label="搜索结果"></div>'+
			'<div id="kp-foot"><span>↑↓ 选择 · Enter 打开</span><span>Ctrl + K</span></div>'+
			'</div>'
		document.body.appendChild(panel)
		inputEl=panel.querySelector('#kp-input')
		listEl=panel.querySelector('#kp-list')

		panel.addEventListener('mousedown',function(e){ if(e.target===panel) close() })
		listEl.addEventListener('click',function(e){
			var it=e.target.closest('.kp-item')
			if(it){ jump(items[parseInt(it.dataset.i,10)]); close() }
		})
		inputEl.addEventListener('input',function(){
			clearTimeout(timer)
			var q=inputEl.value.trim()
			if(q.length<2){ render([]); return }
			timer=setTimeout(function(){ query(q) },300)
		})
		inputEl.addEventListener('keydown',function(e){
			if(e.key==='ArrowDown'||e.key==='ArrowUp'){
				e.preventDefault()
				if(!items.length) return
				active=(active+(e.key==='ArrowDown'?1:-1)+items.length)%items.length
				markActive()
			}else if(e.key==='Enter'){
				e.preventDefault()
				if(active>=0&&items[active]){ jump(items[active]); close() }
			}
		})
	}

	function open(){
		ensureDOM()
		if(opened) return
		opened=true; restoreFocus=document.activeElement
		panel.classList.add('kp-open')
		panel.style.pointerEvents='auto'
		render([])
		inputEl.value=''; setTimeout(function(){ inputEl.focus() },30)
		/* 未登录静默跳过；已登录拉取收藏，空查询时展示"我的收藏"分组 */
		if(!favsLoaded){
			favsLoaded=true
			if(typeof api==='function'){
				api('/api/me/favorites').then(function(r){
					if(r&&r.ok&&Array.isArray(r.data)) { favs=r.data.slice(0,6); if(!inputEl.value.trim()) render([]) }
				}).catch(function(){})
			}
		}
	}
	function close(){
		if(!opened) return
		opened=false
		panel.classList.remove('kp-open')
		panel.style.pointerEvents='none'
		clearTimeout(timer)
		if(restoreFocus&&document.contains(restoreFocus)){ try{restoreFocus.focus()}catch(e){} }
	}
	function toggle(){ opened?close():open() }

	function stripHTML(s){ var d=document.createElement('div'); d.innerHTML=s||''; return (d.textContent||'').replace(/\s+/g,' ').trim() }
	function render(list){
		items=list.slice(0,12); active=items.length?0:-1
		if(!items.length){
			var q=inputEl&&inputEl.value.trim()
			/* 空查询且有收藏：展示"我的收藏"快捷分组 */
			if(!q&&favs.length){
				var favItems=favs.map(function(m){ return {type:'material', id:m.id, title:m.title, content:''} })
				items=favItems; active=0
				listEl.innerHTML='<div style="padding:8px 12px 2px;font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--text-3,#8a93a5)">我的收藏</div>'+
					favItems.map(function(it,i){
						return '<div class="kp-item" role="option" data-i="'+i+'" aria-selected="'+(i===active)+'">'+
						'<span class="kp-badge">'+(TYPE_ICON.material||'')+' '+(TYPE_LABEL.material||'')+'</span>'+
						'<div class="kp-main"><div class="kp-title">'+esc(it.title||('素材 #'+it.id))+'</div></div></div>'
					}).join('')
				return
			}
			listEl.innerHTML='<div class="kp-empty">'+(q&&q.length>=2?'未找到相关结果':'输入至少 2 个字符开始搜索')+'</div>'
			return
		}
		listEl.innerHTML=items.map(function(it,i){
			var preview=stripHTML(it.content||'').slice(0,90)
			var kw=(inputEl&&inputEl.value.trim())||''
			return '<div class="kp-item" role="option" data-i="'+i+'" aria-selected="'+(i===active)+'">'+
			'<span class="kp-badge">'+(TYPE_ICON[it.type]||'')+' '+(TYPE_LABEL[it.type]||it.type)+'</span>'+
			'<div class="kp-main"><div class="kp-title">'+_searchHl(it.title||preview.slice(0,40)||('内容 #'+it.id),kw)+'</div>'+
			(preview?'<div class="kp-preview">'+_searchHl(preview,kw)+'</div>':'')+'</div></div>'
		}).join('')
		markActive(true)
	}
	function markActive(noScroll){
		var els=listEl.querySelectorAll('.kp-item')
		els.forEach(function(el,i){ el.setAttribute('aria-selected', i===active?'true':'false') })
		if(active>=0&&els[active]&&!noScroll){
			var r=els[active].getBoundingClientRect(), box=listEl.getBoundingClientRect()
			if(r.top<box.top||r.bottom>box.bottom) els[active].scrollIntoView({block:'nearest'})
		}
	}

	async function query(q){
		try{
			var r=await api('/api/search/v2?q='+encodeURIComponent(q))
			if(!opened) return
			if(r&&r.ok&&Array.isArray(r.data)) render(r.data)
			else render([])
		}catch(e){ render([]) }
	}

	function jump(it){
		if(!it) return
		if(it.type==='material'){
			if(typeof openDetail==='function'){ openDetail(it.id) }
			else location.href='/material.html?id='+it.id
			return
		}
		var onCommunity=(typeof viewBlog==='function'&&typeof navigateTo==='function')
		if(it.type==='blog'){
			if(onCommunity){ navigateTo('blog'); viewBlog(it.id) }
			else location.href='/community.html?view=blog&id='+it.id
		}else if(it.type==='forum'){
			if(onCommunity&&typeof viewThread==='function'){ navigateTo('forum'); viewThread(it.id) }
			else location.href='/community.html?view=thread&id='+it.id
		}else{
			if(onCommunity&&typeof loadWall==='function'){ navigateTo('wall') }
			else location.href='/community.html#wall'
		}
	}

	document.addEventListener('keydown',function(e){
		if((e.ctrlKey||e.metaKey)&&(e.key==='k'||e.key==='K')){ e.preventDefault(); toggle(); return }
		if(e.key==='/'&&!opened){
			var t=e.target
			var editable=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable)
			if(!editable){ e.preventDefault(); open() }
		}
		if(e.key==='Escape'&&opened){ e.preventDefault(); close() }
	})

	window._kpOpen=open
})();

/* 自动重试倒计时：每秒刷新环内数字（元素由调用方插入 DOM）*/
setInterval(function(){
	var el = document.querySelector('.es-retry[data-sec]')
	if(!el) return
	var n = parseInt(el.getAttribute('data-sec'), 10)
	if(n > 0){ el.setAttribute('data-sec', n - 1); var b = el.querySelector('b'); if(b) b.textContent = n - 1 }
}, 1000)

/* ═══ 键盘可达性 polyfill（2026-10-25）：覆盖全站 [onclick] 的 div/span/td ═══
   自动加 tabindex=0 + role=button + Enter/Space 触发 click，MutationObserver 覆盖动态注入内容 */
;(function kbPolyfill(){
  function enhance(root){
    try{
      var list = (root || document).querySelectorAll('div[onclick]:not([data-kb]),span[onclick]:not([data-kb]),td[onclick]:not([data-kb])')
      list.forEach(function(el){
        el.setAttribute('data-kb','1')
        el.setAttribute('tabindex','0')
        el.setAttribute('role','button')
        el.addEventListener('keydown',function(e){
          if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); el.click() }
        })
      })
    }catch(e){}
  }
  var t = null
  var mo = new MutationObserver(function(){
    if(t) clearTimeout(t)
    t = setTimeout(function(){ enhance(document) }, 200)   // 去抖，防大页面卡顿
  })
  document.addEventListener('DOMContentLoaded', function(){
    enhance(document)
    mo.observe(document.documentElement, { childList: true, subtree: true })
  })
})()

/* ═══ 按钮异步状态助手（2026-10-25）═══
   用法：const r = await withBtnLoading(btn, () => api(...))
   - 处理中：is-loading（转圈 + 禁用 + 文字隐藏）
   - 成功：is-success（绿色描边 1.6s）
   - 失败：is-error（红色描边 + 抖动 1.6s）
   - 异常同样落到 is-error，并原样抛出供调用方处理
*/
window.withBtnLoading = async function (btn, fn) {
  if (!btn) return fn()
  var wasDisabled = btn.disabled
  btn.classList.remove('is-success', 'is-error')
  btn.classList.add('is-loading')
  btn.disabled = true
  var ok = false
  try {
    var r = await fn()
    ok = !(r && r.ok === false)
    return r
  } catch (e) {
    ok = false
    throw e
  } finally {
    btn.classList.remove('is-loading')
    btn.disabled = wasDisabled
    if (ok) {
      btn.classList.add('is-success')
      setTimeout(function () { btn.classList.remove('is-success') }, 1600)
    } else {
      btn.classList.add('is-error')
      setTimeout(function () { btn.classList.remove('is-error') }, 1600)
    }
  }
}
