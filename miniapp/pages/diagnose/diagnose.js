/**
 * 设备自检页（仅用于真机验收，不入口到界面）
 *   pages/diagnose/diagnose
 *
 * 为什么要这一页：键盘遮挡、安全区、原生相册选择器、滚动帧率这几项
 * 在模拟器里拿不到真实数据，而开发者工具的自动化通道只驱动模拟器。
 * 所以把"测什么"做成页面内的一段代码，让真机自己报出自己的数据，
 * 再一键复制成文本发回来。
 */
Page({
  data: {
    build: 'v5 · 2026-11-02 01:45（坐标系纠正 + 越界拦截）',
    rows: [],        // 设备信息 { k, v }
    taps: [],        // 触控目标 { name, px, state }
    kb: { now: '尚未触发', last: '', state: 'info', trace: '', focus: false },
    pick: { text: '尚未测试', state: 'info' },
    net: { text: '读取中…', state: 'info' },
    perf: { text: '尚未测试', state: 'info' },
    stress: [],
    launch: '',
    copying: false,
  },

  onLoad(opts) {
    this._alive = true;
    this.measureEnv();
    this.measureTaps();
    this.watchNet();
    this.watchKeyboard();
    this.watchResize();
    // 等首屏渲染完再自动聚焦，否则输入框还没挂载
    setTimeout(() => this.autoFocusKb(), 900);
    // 记录进入本页的方式（验证分享/深链是否带参数）
    const q = Object.keys(opts || {})
      .map((k) => k + '=' + opts[k])
      .join(' & ');
    this.setData({ launch: q || '（无参数，直接打开）' });
  },

  /* iPad 上小程序是可浮动窗口，旋转/改大小都会换布局宽度（rpx 随之换算）。
     不监听 resize 的话，设备信息会停留在 onLoad 那一刻，量出来的数会自相矛盾
     （实测：屏幕报 820 但元素按 1180 宽渲染，触控目标整体大 1.43 倍）。 */
  watchResize() {
    if (typeof wx.onWindowResize !== 'function') return;
    const handler = () => {
      if (!this._alive) return;
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        if (!this._alive) return;
        this.measureEnv();
        this.measureTaps();
      }, 320);
    };
    wx.onWindowResize(handler);
    this._offResize = () => {
      if (typeof wx.offWindowResize === 'function') wx.offWindowResize(handler);
    };
  },

  onUnload() {
    this._alive = false;
    if (this._offKb) this._offKb();
    if (this._offNet) this._offNet();
    if (this._offResize) this._offResize();
    if (this._resizeTimer) clearTimeout(this._resizeTimer);
    if (this._kbTimer) clearTimeout(this._kbTimer);
  },

  /* ── 1. 设备与安全区 ── */
  measureEnv() {
    const s = wx.getSystemInfoSync();
    const sa = s.safeArea || {};
    const inset = sa.bottom != null ? Math.round(s.screenHeight - sa.bottom) : -1;
    const rows = [
      { k: '自检页版本', v: this.data.build },
      { k: '采样时间', v: new Date().toTimeString().slice(0, 8) },
      { k: '机型', v: s.model || '未知' },
      { k: '系统', v: s.system || '未知' },
      { k: '微信版本', v: s.version || '未知' },
      { k: '基础库', v: s.SDKVersion || '未知' },
      { k: '屏幕', v: s.screenWidth + ' × ' + s.screenHeight + ' px' },
      { k: '可视窗口', v: s.windowWidth + ' × ' + s.windowHeight + ' px' },
      { k: '像素比 DPR', v: String(s.pixelRatio) },
      { k: '状态栏高度', v: (s.statusBarHeight || 0) + ' px' },
      {
        k: 'safeArea 原始值',
        v: sa.top != null ? 'top=' + Math.round(sa.top) + ' bottom=' + Math.round(sa.bottom) : '无法读取',
      },
      { k: '安全区（JS 推算）', v: inset >= 0 ? inset + ' px（iPad 上不可靠，看下方 CSS 实测）' : '无法读取' },
      { k: '1rpx 折算', v: (s.windowWidth / 750).toFixed(3) + ' px' },
    ];
    this._sys = s;
    this._inset = inset;
    this.setData({ rows: rows });
    // 等首帧渲染完成再量底栏，否则拿到 0
    setTimeout(() => this.measureBar(), 260);
  },

  /* ── 2. 底栏与占位是否一致（对应 G-03）──
     ⚠️ iPad 上不能用 windowHeight 判"贴底"：实测 iPad Air 11" 报 screenHeight=1180、
     safeArea.bottom=795、windowHeight=723.95，三套坐标系互不自洽（windowHeight 比
     CSS 真实视口小 360px）。所以这里改用 selectViewport() 拿 CSS 眼中的视口高，
     并用占位元素反推 CSS 实际生效的 env(safe-area-inset-bottom)。 */
  measureBar() {
    if (!this._alive) return;
    const q = wx.createSelectorQuery().in(this);
    q.select('#diagBar').boundingClientRect();
    q.select('#diagSpacer').boundingClientRect();
    q.selectViewport().boundingClientRect();
    q.selectViewport().scrollOffset();
    q.exec((res) => {
      const bar = res[0];
      const spacer = res[1];
      const vp = res[2];
      const scroll = res[3] || {};
      if (!bar || !spacer || !vp) return;

      const rpx = this._sys.windowWidth / 750;
      // boundingClientRect 返回「相对显示区域」的坐标，不需要再减 scrollTop
      // （2026-11-02 实测纠正：早先怀疑返回文档坐标而减了一次，键盘弹起+页面滚动时算出负值）
      const scrollTop = scroll.scrollTop || 0;
      const barViewTop = bar.top;
      // 占位 = 160rpx + env(safe-area-inset-bottom) → 反推 CSS 真实 inset
      // 安卓无安全区时算出 -0.9 左右的浮点误差（实测 69 vs 69.92），一律当 0，别把噪声当负值报出去
      const envRaw = spacer.height - 160 * rpx;
      const envPx = envRaw <= 1 ? 0 : Math.round(envRaw * 10) / 10;
      const barBottom = barViewTop + bar.height;
      const vpGap = Math.round((vp.height - barBottom) * 10) / 10;
      const winVpDiff = Math.round((vp.height - this._sys.windowHeight) * 10) / 10;
      const gap = Math.round((spacer.height - bar.height) * 10) / 10;

      const rows = this.data.rows.slice();
      rows.push({
        k: 'CSS 安全区（实测）',
        v: envPx === 0 ? '0（该设备无底部安全区）' : envPx + ' px（env 生效值）',
      });
      rows.push({ k: '视口高度（CSS）', v: Math.round(vp.height * 10) / 10 + ' px' });
      rows.push({
        k: 'windowHeight 偏差',
        v: winVpDiff === 0 ? '一致' : winVpDiff + ' px（JS 值偏小则此值为正）',
      });
      rows.push({ k: '测量时已滚动', v: scrollTop + ' px' });
      rows.push({ k: '底栏实测高', v: Math.round(bar.height * 10) / 10 + ' px' });
      rows.push({ k: '占位实测高', v: Math.round(spacer.height * 10) / 10 + ' px' });
      rows.push({ k: '内容与底栏间隙', v: gap + ' px' });
      rows.push({
        k: '底栏是否贴底',
        v: Math.abs(vpGap) <= 1.5 ? '是（差 ' + vpGap + ' px）' : '否（差 ' + vpGap + ' px）',
      });
      this.setData({ rows: rows });
    });
  },

  /* ── 3. 触控目标尺寸（对应 H 组 / 无障碍）── */
  measureTaps() {
    const q = wx.createSelectorQuery().in(this);
    const map = [
      ['#diagTapBtn', '主按钮（.btn）'],
      ['#diagTapAct', '图标操作（.bar-act）'],
      ['#diagTapChip', '筛选胶囊（.chip）'],
      ['#diagInputWrap', '输入框触控区（.input-wrap）'],
    ];
    map.forEach((m) => q.select(m[0]).boundingClientRect());
    q.exec((res) => {
      const taps = [];
      res.forEach((r, i) => {
        if (!r) return;
        const h = Math.round(r.height * 10) / 10;
        const w = Math.round(r.width * 10) / 10;
        taps.push({
          name: map[i][1],
          px: w + ' × ' + h,
          state: h >= 44 ? 'ok' : 'warn',
          note: h >= 44 ? '≥44px' : '偏小（<44px）',
        });
      });
      this.setData({ taps: taps });
    });
  },

  /* ── 4. 键盘遮挡（对应 G-01 / G-02）──
     注意：键盘收起时不能把判定结果冲掉，否则用户点完再复制就只剩「已收起」。
     所以拆成两行：当前状态 + 最近一次判定。 */
  watchKeyboard() {
    if (typeof wx.onKeyboardHeightChange !== 'function') {
      this.setData({ kb: { now: '不支持监听', last: '基础库没有 onKeyboardHeightChange', state: 'warn' } });
      return;
    }
    const handler = (res) => {
      if (!this._alive) return;
      if (this._kbTimer) {
        clearTimeout(this._kbTimer);
        this._kbTimer = null;
      }
      const h = res && res.height ? res.height : 0;
      // 记录事件序列：上一轮只看到「已收起」却查不出原因，就是缺这条轨迹
      this._kbEvents = this._kbEvents || [];
      this._kbEvents.push(h);
      if (this._kbEvents.length > 8) this._kbEvents.shift();
      this.setData({ 'kb.trace': '事件序列（px）：' + this._kbEvents.join(' → ') });
      if (h <= 0) {
        // 只更新「当前」，保留「最近一次判定」
        this.setData({ 'kb.now': '键盘已收起（已保留上次判定）' });
        return;
      }
      this.setData({ 'kb.now': '键盘高度 ' + h + ' px，测量中…' });
      setTimeout(() => this.judgeKeyboard(h), 420);
    };
    wx.onKeyboardHeightChange(handler);
    this._offKb = () => {
      if (typeof wx.offKeyboardHeightChange === 'function') wx.offKeyboardHeightChange(handler);
    };
  },

  /* 输入框在底部固定栏里，用户容易找不到（实测有人扫完码没点它，报告全是"尚未触发"）。
     所以进页面就自动聚焦弹键盘；同时起一个 3 秒兜底——真没收到事件就明说原因，不能静默。 */
  autoFocusKb() {
    if (!this._alive) return;
    this.setData({ 'kb.focus': true });
    if (this._kbTimer) clearTimeout(this._kbTimer);
    this._kbTimer = setTimeout(() => {
      if (!this._alive) return;
      if (!this._kbEvents || !this._kbEvents.length) {
        this.setData({
          'kb.last':
            '已自动聚焦，但 3 秒内没收到任何键盘高度事件 —— 可能是系统没弹软键盘（接了外接键盘 / 平板），或该基础库不支持 onKeyboardHeightChange',
          'kb.state': 'warn',
        });
      }
    }, 3000);
  },

  /* 手动重试：先失焦再聚焦，强制系统重新弹一次键盘 */
  onRetryKb() {
    this.setData({ 'kb.focus': false });
    setTimeout(() => this.autoFocusKb(), 220);
  },

  judgeKeyboard(kbH) {
    const q = wx.createSelectorQuery().in(this);
    q.select('#diagKbInput').boundingClientRect();
    q.select('#diagBar').boundingClientRect();
    q.selectViewport().boundingClientRect();
    q.selectViewport().scrollOffset();
    q.exec((res) => {
      const input = res[0];
      const bar = res[1];
      const vp = res[2];
      const scroll = res[3] || {};
      // 取不到元素时必须说出来，否则上层只能看到「尚未测量」，无从定位
      const missing = [];
      if (!input) missing.push('#diagKbInput');
      if (!bar) missing.push('#diagBar');
      if (!vp) missing.push('viewport');
      if (missing.length) {
        this.setData({
          'kb.last': '测量中断：取不到 ' + missing.join(' / '),
          'kb.state': 'warn',
        });
        return;
      }
      const st = scroll.scrollTop || 0;
      const kbTop = vp.height - kbH;
      // boundingClientRect 返回的是「相对显示区域」的坐标，**不能再减 scrollTop**。
      // 2026-11-02 实测教训：多减一次后拿到 y=-753，而 `y <= kbTop` 对负数永远成立 → 假通过。
      const inputBottom = input.bottom;
      const barBottom = bar.top + bar.height;

      // 越界拦截：坐标跑出视口范围说明测量口径坏了，此时必须判「无效」，绝不能给「通过」
      const insane =
        inputBottom < -2 || inputBottom > vp.height + 2 ||
        barBottom < -2 || barBottom > vp.height + 2;
      if (insane) {
        this.setData({
          'kb.now': '键盘在弹起状态（' + kbH + ' px）',
          'kb.last':
            '判定无效：测量值越界（输入框底 y=' + Math.round(inputBottom) +
            ' / 底栏底 y=' + Math.round(barBottom) +
            ' / 视口 ' + Math.round(vp.height) +
            ' / 当时滚动 ' + Math.round(st) + ' px）——坐标系异常，需换测法',
          'kb.state': 'warn',
        });
        return;
      }

      const inputOk = inputBottom <= kbTop + 2;
      const barOk = barBottom <= kbTop + 2;
      const state = inputOk && barOk ? 'ok' : 'bad';
      const verdict = inputOk && barOk
        ? '输入框与底栏都在键盘上方 ✓'
        : inputOk
        ? '输入框可见，但底面栏被键盘压住'
        : '输入框被键盘挡住';
      this.setData({
        'kb.now': '键盘在弹起状态（' + kbH + ' px）',
        'kb.last':
          '键盘 ' + kbH + ' px · 键盘顶边 y=' + Math.round(kbTop) +
          ' · 输入框底 y=' + Math.round(inputBottom) +
          ' · 底栏底 y=' + Math.round(barBottom) +
          ' · 视口 ' + Math.round(vp.height) +
          ' · 当时滚动 ' + Math.round(st) + ' px → ' + verdict,
        'kb.state': state,
      });
    });
  },

  /* ── 5. 原生相册 / 拍摄（对应 F-01）── */
  onPick() {    wx.chooseMedia({
      count: 1,
      mediaType: ['image', 'video'],
      sourceType: ['album', 'camera'],
      maxDuration: 30,
      success: (res) => {
        const f = (res.tempFiles && res.tempFiles[0]) || {};
        const kb = f.size ? Math.round(f.size / 1024) : 0;
        this.setData({
          pick: {
            text:
              '拉起成功 · 类型 ' + (res.type || f.fileType || '?') +
              ' · 大小 ' + kb + ' KB' +
              (f.duration ? ' · 时长 ' + f.duration + ' 秒' : '') +
              ' · 路径后缀 ' + String(f.tempFilePath || '').split('.').pop(),
            state: 'ok',
          },
        });
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '未知错误';
        const cancel = msg.indexOf('cancel') > -1;
        this.setData({
          pick: {
            text: cancel ? '选择器能正常拉起（你点了取消）' : '拉起失败：' + msg,
            state: cancel ? 'ok' : 'bad',
          },
        });
      },
    });
  },

  /* ── 6. 网络（对应 G-06）── */
  watchNet() {
    const read = () => {
      wx.getNetworkType({
        success: (r) => {
          if (!this._alive) return;
          this.setData({ net: { text: '当前网络：' + (r.networkType || '未知'), state: 'info' } });
        },
      });
    };
    read();
    const handler = (r) => {
      if (!this._alive) return;
      this.setData({ net: { text: '网络已切换：' + (r.networkType || '未知'), state: 'info' } });
    };
    if (typeof wx.onNetworkStatusChange === 'function') {
      wx.onNetworkStatusChange(handler);
      this._offNet = () => {
        if (typeof wx.offNetworkStatusChange === 'function') wx.offNetworkStatusChange(handler);
      };
    }
  },

  /* ── 7. 渲染开销采样（对应 H-01 滚动跟手）──
     小程序里没有可靠的 requestAnimationFrame，所以不假装测 fps；
     改测「一次性追加 100 行」的 setData 往返耗时，这是真机渲染压力的直接体现 */
  onPerf() {
    if (this.data.stress.length) return; // 已有压力列表，避免反复叠加
    const stress = [];
    for (let i = 1; i <= 100; i++) {
      stress.push({ i: i, text: '压力行 ' + i + ' · 用于观察快速滚动是否掉帧' });
    }
    const t0 = Date.now();
    this.setData({ stress: stress }, () => {
      const cost = Date.now() - t0;
      const state = cost <= 120 ? 'ok' : cost <= 260 ? 'warn' : 'bad';
      this.setData({
        perf: {
          text: '追加 100 行耗时 ' + cost + ' ms',
          state: state,
        },
      });
    });
  },

  /* 聊天页是 height:100vh + 固定输入栏，是本项目里键盘遮挡风险最高的布局，
     自检页的普通滚动布局测不出它的问题，所以直接给个入口去看真章 */
  onGoChat() {
    wx.navigateTo({ url: '/pages/chat/chat?id=1' });
  },

  /* ── 8. 复制报告 ── */
  onCopy() {
    const s = this._sys || {};
    const lines = ['【小程序真机自检报告】'];
    this.data.rows.forEach((r) => lines.push(r.k + ': ' + r.v));
    lines.push('');
    lines.push('【触控目标】');
    this.data.taps.forEach((t) => lines.push(t.name + ': ' + t.px + ' (' + t.note + ')'));
    lines.push('');
    lines.push('【键盘·当前】' + this.data.kb.now);
    lines.push('【键盘·最近一次判定】' + (this.data.kb.last || '尚未测量') + ' [' + this.data.kb.state + ']');
    if (this.data.kb.trace) lines.push('【键盘·事件序列】' + this.data.kb.trace);
    lines.push('【相册选择器】' + this.data.pick.text);
    lines.push('【网络】' + this.data.net.text);
    lines.push('【渲染开销】' + this.data.perf.text + ' [' + this.data.perf.state + ']');
    lines.push('【进入方式】' + this.data.launch);
    lines.push('');
    lines.push('机型 ' + (s.model || '') + ' / ' + (s.system || '') + ' / 微信 ' + (s.version || '') + ' / 基础库 ' + (s.SDKVersion || ''));
    this.setData({ copying: true });
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => {
        this.setData({ copying: false });
        wx.showModal({
          title: '已复制到剪贴板',
          content: '把这段文字发给我即可，我已按项目编号对齐好。',
          showCancel: false,
          confirmText: '好',
          confirmColor: '#d8b46a',
        });
      },
      fail: () => this.setData({ copying: false }),
    });
  },
});
