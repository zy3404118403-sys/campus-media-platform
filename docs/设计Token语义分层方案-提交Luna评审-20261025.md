# 设计 Token 语义分层方案

**文档性质：** 方案提案（提交评审，非实施记录）
**编制日期：** 2026-10-25
**提交对象：** GPT-5.6 Luna（复核意见返回后据此定稿）
**关联文档：**《核验与修复记录-对Luna报告的逐条核对-20261025.md》

---

## 0. 文档性质与证据等级

本文档回答 Luna 复核中提出的一条批评：

> 「CSS 变量数量本身不能证明设计 Token 体系已经完成。还需要看：是否有 primitive → semantic → component 的分层；是否所有页面都使用同一套语义变量；是否存在大量旧变量和硬编码值并存；按钮、输入框、卡片和状态徽章是否有组件级 Token；颜色、字号、间距是否有命名和迁移规范。」

我方**接受该批评**，本文档是基于**实测数据**提出的分层实施方案，请评审方判断阶段划分、取舍与优先级是否合理。

### 证据等级（按守则标注）

| 级别 | 本文档中的使用 |
|---|---|
| **A 源码级** | 全部硬编码统计、变量清点、重复定义检测（脚本 `audit/phase2/token-audit.py` 可复跑） |
| **D 判断推测级** | 第 3 章阶段划分、第 5 章取舍建议、第 6 章的优先级判断 —— **均为我方判断，请评审方质疑** |

---

## 1. 现状诊断（实测数据）

### 1.1 硬编码规模（A 级）

统计范围：12 个页面内联 `<style>` + 6 个 CSS 文件（排除第三方 `hls.min.js`）。

| 文件 | hex 颜色 | `rgb()/rgba()` | 硬编码尺寸（≥10px） | 合计 |
|---|---:|---:|---:|---:|
| `index.css` | 112 | 219 | 410 | **741** |
| `community.css` | 89 | 62 | 241 | 392 |
| `user.css` | 70 | 114 | 182 | 366 |
| `admin.css` | 71 | 119 | 173 | 363 |
| `material.html` | 50 | 60 | 120 | 230 |
| `tasks.html` | 35 | 32 | 109 | 176 |
| `about.html` | 24 | 29 | 117 | 170 |
| `articles(-work).html` | 30 ×2 | 34 ×2 | 88 ×2 | 152 ×2 |
| `login.html` | 34 | 43 | 49 | 126 |
| `admin.html` | 26 | 19 | 57 | 102 |
| `cardnav.html` | 15 | 18 | 40 | 73 |
| `glass-solid.css` | 12 | 26 | 14 | 52 |
| `graph.html` | 18 | 2 | 16 | 36 |
| **合计** | **621** | **815** | **1721** | **3157** |

> **关键结论**：全站共 **3157 处硬编码**（1436 处颜色 + 1721 处尺寸）。这意味着「Token 体系已建立」的说法**不成立** —— 变量有了，但绝大多数样式仍在使用裸值。

### 1.2 变量清点（A 级）

| 文件 | 变量总数 | 颜色/背景/边框 | 间距/尺寸 | 圆角 | 阴影 | 字体/行高 | 动效 | 状态 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `index.css` | 128 | **98** | 8 | 4 | 5 | 0 | 0 | 0 |
| `glass-solid.css` | 52 | 12 | 9 | 7 | 4 | 3 | 5 | 4 |
| `shared.css` | 28 | 19 | 1 | 2 | 1 | 0 | 0 | 0 |
| `admin.css` | 30 | 18 | 1 | 2 | 2 | 0 | 0 | 2 |
| `user.css` | 28 | 16 | 1 | 3 | 2 | 0 | 0 | 0 |
| `community.css` | 27 | 18 | 1 | 2 | 2 | 0 | 0 | 0 |

> **关键结论**：变量**以颜色为主**（小计 181 个颜色类变量），**间距/字体几乎空白**（间距合计 21 个、字体仅 3 个）。这是「有颜色体系、无排版体系」的典型状态。

### 1.3 三个结构性问题（A 级，这是分层的真正理由）

**问题一：38 个变量在多个文件重复定义（无单一来源）**

```
--bg             → admin.css, community.css, index.css, user.css
--primary-light  → admin.css, community.css, index.css, user.css
--border-strong  → admin.css, community.css, index.css, user.css
--shadow-md      → admin.css, community.css, index.css, user.css
--accent         → admin.css, community.css, index.css
--sidebar-w      → admin.css, community.css, user.css
--gold-deep      → admin.css, index.css, user.css
...（共 38 个）
```

同一个名字在 3–4 个文件各定义一次，**改一处不会同步到其他页面** —— 这是「看起来有 Token、实际各页各写一套」。

**问题二：圆角变量 12 个，命名不成体系**

```
--radius, --radius-xs, --radius-sm, --radius-md, --radius-lg, --radius-xl, --radius-pill
--ag-radius, --dw-radius, --sb-radius, --sg-radius          ← 缩写前缀，无文档
--btn-secondary-radius                                       ← 组件级但命名不统一
```

`--ag` / `--dw` / `--sb` / `--sg` 四个缩写**无任何注释说明含义**，新人无法判断该用哪个。这恰好说明**组件级 Token 已自发存在，但缺命名规范**。

**问题三：间距变量 14 个，两套体系并存**

```
--space-1..12（数值刻度，4px 基准）   ← 我方 2026-10-25 新增
--space-xs/sm/md/lg/xl（语义刻度）    ← 原有
```

两套同时存在，且**无任何注释说明何时用哪套**。

---

## 2. 目标架构：三层 Token

### 2.1 三层定义

| 层 | 名称 | 职责 | 谁引用 | 示例 |
|---|---|---|---|---|
| **L1** | **Primitive**（原始层） | 只存**纯值**，无语义、无场景 | 仅被 L2 引用 | `--prim-gold-500: #D4AF37;`<br>`--prim-space-4: 16px;`<br>`--prim-radius-8: 8px;` |
| **L2** | **Semantic**（语义层） | 表达**用途与场景**，映射到 L1 | **页面样式只引用这层** | `--color-action-primary: var(--prim-gold-500);`<br>`--color-text-primary: #e8ecf4;`<br>`--space-section-gap: var(--prim-space-4);` |
| **L3** | **Component**（组件层） | 具体组件的尺寸/形态约束 | 仅被对应组件引用 | `--button-height-md: 44px;`<br>`--card-radius: var(--prim-radius-8);`<br>`--input-border-width: 1px;` |

**为什么必须三层而不是两层**：

- **只有 Semantic 没有 Primitive** → 语义层里会重新出现裸值（`--color-text-primary: #e8ecf4`），换主题时无法批量调整。
- **只有 Primitive 没有 Semantic** → 页面里会写 `var(--prim-gold-500)`，等于把"金色"这个实现细节暴露给业务层，改品牌色要全站搜索。
- **缺 Component 层** → 按钮高度、卡片圆角散落在各页面（当前 `--ag-radius`/`--btn-secondary-radius` 就是自发形成的 Component 层，只是没规范）。

### 2.2 命名规范（建议）

```
L1  --prim-{属性}-{刻度}          例：--prim-gold-500 / --prim-space-4 / --prim-radius-8
L2  --{语义}-{对象}-{修饰}         例：--color-text-primary / --color-bg-surface / --space-section-gap
L3  --{组件}-{属性}-{变体}         例：--button-height-md / --card-radius / --badge-bg-success
```

**禁止**：缩写前缀（`--ag-` / `--dw-`）、无语义数字（`--gold-deep` 到底多深？）、跨层引用（L3 不得直接引用 L1）。

**依赖方向（2026-10-25 修正，补明确规则）**：

| 层 | 允许引用 | 禁止引用 |
|---|---|---|
| L1 Primitive | 仅裸值（hex / px / 数字） | **禁止引用任何变量** |
| L2 Semantic | L1 Primitive | 禁止裸值、禁止引用 L3 |
| L3 Component | **L2 Semantic**（唯一合法来源） | **禁止直接引用 L1**、禁止裸值 |

> **本修正的起因**：Luna 验收指出附录示例 `--color-state-success: #34D399`（L2 直写 hex）与 `--button-padding-x: var(--prim-space-4)`（L3 直引 L1）**违反本文档自身设定的规则**。该批评完全成立，现已按上表修正。

---

## 3. 四阶段实施计划

### Phase 1 — 建立三层架构（纯新增、低风险、可回滚）

| 项 | 内容 |
|---|---|
| **目标** | 从「一堆变量」变成「有层级、有文档、有单一来源的体系」 |
| **产出** | ① `public/assets/tokens.css`（三层变量 + 每层注释）<br>② `Token分层说明.md`（映射表 + 命名规范 + 何时用哪层）<br>③ 全站 `<link>` 引入（置于 `glass-solid.css` 之前） |
| **验收标准** | 页面**视觉零变化**（新文件只定义变量，不改任何选择器）；任意现有变量都能在映射表中找到对应的新 Token |
| **风险** | **低风险、可回滚**（2026-10-25 修正：原表述"零风险"过强）<br>已知风险：①变量名与现有变量重名 ②CSS 加载顺序改变影响层叠 ③旧变量被意外覆盖 ④不同页面存在同名但不同值的变量 ⑤浏览器缓存导致新旧 CSS 混合<br>缓解：统一 `--ds-` 命名空间前缀（与现有 `--gold`/`--bg` 等无交集）+ 版本号 `?v=` 破缓存 + 不改任何现有选择器 + 保留 `tokens.css` 一键注释回滚 |
| **依赖** | 无 |

### Phase 2 — 组件级收口（建立验证手段）

| 项 | 内容 |
|---|---|
| **目标** | 让 Token「真正能用起来」，并建立「改一个 token 全站同步」的验证手段 |
| **收口组件（8 组）** | ① 按钮（`.btn` / `.act-primary` / `.act-sec` / `.icon-btn`）② 输入框 ③ 卡片（`.material-card` / `.cat-card` / `.rel-card`）④ 状态徽章（`.status-tag` / `.badge`）⑤ 弹窗（`.dl-box` / 上传遮罩）⑥ 表格（admin 9–10 列）⑦ 导航项（`.nav-item`）⑧ 空态（`.empty-state`） |
| **产出** | 每组的硬编码值 → Component Token；配套 `--{组件}-*` 变量清单 |
| **验收标准** | **改一个 Token 后全站同类组件同步变化**（例：`--button-height-md: 44px → 48px`，全部按钮一起变高，无需分页改） |
| **风险** | 低（逐个组件推进，可单独回退） |
| **依赖** | Phase 1 |

### Phase 3 — 页面级迁移（清理 3157 处硬编码）

| 项 | 内容 |
|---|---|
| **目标** | 消除「旧变量 + 硬编码」并存状态 |
| **产出** | 12 个页面 + 4 个 CSS 文件的裸值 → 语义 Token；旧变量加别名过渡 |
| **验收标准** | **（2026-10-25 修正：原「<20 处」过于绝对，改为带排除规则的多指标）**<br>① **共享组件 Token 覆盖率 ≥90%**（主指标）<br>② **新增硬编码不得增加**（CI 拦截，见 Phase 4）<br>③ 业务源码中裸色值下降 ≥80%（当前 1436 → 目标 <290）<br>④ 38 个重复定义变量完成比对与收敛<br>⑤ 页面视觉经逐页比对无差异<br>**统计口径（白名单）**：仅统计业务源码；排除第三方依赖（`hls.min.js`）、SVG 内联数据、`data:` URI、注释与测试文件；**允许保留**内容专属色、渐变、阴影中的 `rgba()`、CSS fallback 值、品牌装饰色 |
| **风险** | **中**（改动面广，需逐页视觉比对；建议按页提交、单页可回退） |
| **依赖** | Phase 2（需先有「改 token 全站响应」的验证能力） |

### Phase 4 — 治理与守护（防退化）

| 项 | 内容 |
|---|---|
| **目标** | 防止两三个月后新功能又重新写死颜色 |
| **产出** | ① stylelint 规则（禁 hex/rgb 裸值、禁 px 尺寸下限）② Token 预览页（一页看到全部 Token 效果）③ CI 检查（硬编码数量只降不升） |
| **验收标准** | 新增代码无法通过 lint 引入裸色值；每次提交硬编码数量不增长 |
| **风险** | **低风险**（2026-10-25 修正：原写"零"过强）<br>可能影响：①lint 规则误报导致开发受阻 ②排除路径配置不当产生大量噪音 ③CI 阻断影响提交流程 ④规则与既有代码冲突需反复调整<br>缓解：先 Report 模式运行一个迭代周期，收集误报并调优规则，再切为阻断模式 |
| **依赖** | Phase 3 基本完成（否则 lint 会报 3000+ 错误） |

---

## 4. 为什么是 4 阶段（论证与反例）

### 反例一：只做 Phase 1+2（不做 3）

**结果**：新 Token 与旧硬编码永久并存。用户看到的是"变量从 180 个涨到 280 个，但页面里还是 1436 处裸色值"。**这正是 Luna 批评当前状态的同一问题，只是数字更大。**

### 反例二：跳过 Phase 2 直接做 Phase 3

**结果**：一次性改 3157 处，**没有任何中间验证点**。改完之后如果某处颜色错了、某个间距变了 2px，**无法判断是迁移错误还是原本如此**（因为一次性全动了，没有"只改一个 token 看全局反应"的对照组）。

### 反例三：只做 Phase 1（只建架构不落地）

**结果**：得到一份"看起来很专业的 tokens.css"，但没有任何组件在用它。Luna 的原批评（"变量数量不能证明体系成立"）**依然成立**。

> **结论**：4 个阶段缺任一环都会退化成"形式上有 Token、实质上无治理"。但**是否 4 个阶段都做，请评审方判断**（见第 6 章问题 1）。

---

## 5. 关键取舍（我方判断，供质疑）

| # | 取舍 | 我方理由 | 可能的反对意见 |
|---|---|---|---|
| 1 | **不一次性重构**，分 4 阶段 | 3157 处硬编码不可能一次改完且验证；分批可每批回退 | 分期会让"两套并存"状态长期存在 |
| 2 | **Phase 3 按页推进**（单页可回退） | 12 页彼此独立，按页提交风险最小 | 页面间共用的组件无法单页验证 |
| 3 | **旧变量保留别名过渡**（如 `--gold` → 别名指向 `--color-action-primary`） | 避免破坏现有 180 个变量的所有引用点；可渐进替换 | 别名会让"两套命名"永久化，可能更乱 |
| 4 | **Component 层优先于页面层** | 当前 `--ag-radius`/`--dw-radius` 等已自发形成组件层，说明方向正确，只需规范 | 组件层的粒度选择容易反复（见问题 6） |
| 5 | **Phase 4 必须有 lint 兜底** | 无强制手段，任何体系都会退化 | lint 上线初期会报大量错误，需先清零 |

---

## 6. 请评审方判断的 7 个问题

> 以下问题我方**没有唯一答案**，请结合你们的评审视角给出判断。

1. **Phase 3（页面级迁移 3157 处）是否值得做？** 还是做完 Phase 1+2（组件级收口）即可认为"Token 体系成立"？如果砍掉 Phase 3，剩余的 1436 处硬编码是否仍会被判为"体系未完成"？

2. **旧变量别名策略应保留多久？** 是"永久别名（新旧并存但新代码强制用新 Token）"，还是"设定期限（如 2 个版本后删旧变量）"？

3. **38 个多文件重复定义的变量（`--bg` / `--primary-light` 等）应如何收敛？** 合并到 `tokens.css` 单一来源，还是保留各文件自治（因为 admin/user/community 是独立设计系统）？

   **（2026-10-25 补充：Luna 指出不能直接全局合并，我方接受并明确为四步法）**

   同名变量**值未必相同**，直接合并会导致管理端视觉变化、卡片层级变化、深色模式对比度下降。正确顺序：

   | 步骤 | 动作 | 判定 |
   |---|---|---|
   | 1 | **比对同名变量的实际值**（逐文件读取 `getComputedStyle` 或源码字面量） | 输出对照表 |
   | 2 | **值完全相同** → 合并到单一来源 | 安全 |
   | 3 | **值不同** → **不合并**，各自改成语义化名称（如 `--bg-admin-surface` / `--bg-user-surface`） | 保留差异 |
   | 4 | 全部引用点迁移完成后，**再删除旧别名** | 有据可查 |

   **明确不做的事**：不假设同名即同值；不在第一步就删除旧变量。

4. **命名粒度选择**：采用 `--color-text-primary` 这类长命名（清晰但迁移量大），还是保留 `--text` / `--bg` 这类短命名（迁移量小但语义弱）？

5. **Primitive 层是否必要？** 有些方案直接用 Semantic（`--color-action-primary: #D4AF37`），省掉 L1。对本项目这种**单品牌、无多主题需求**（仅深/浅色两套）的场景，L1 是否过度设计？

6. **Component 层粒度**：按组件（`--button-height-md`）还是按变体（`--button-primary-height` / `--button-secondary-height`）？本项目按钮已有 `.btn` / `.act-primary` / `.act-sec` / `.icon-btn` 四种形态。

7. **优先级判断**：Token 分层（4 阶段）与 496 处 `onclick` 改 `addEventListener`（CSP 收紧前置条件），**哪个先做价值更大？** 我方倾向 Token 优先（视觉一致性对用户可感知），但 CSP 是安全项，请给出你们判断。

---

## 7. 附：Token 清单草案（Phase 1 产出示例）

```css
/* ═══════════════════════════════════════════════════════════════
   L1 · Primitive（纯值，无语义）
   ═══════════════════════════════════════════════════════════════ */
:root {
  /* 品牌色阶 */
  --prim-gold-300: #E5C558;
  --prim-gold-500: #D4AF37;
  --prim-gold-700: #9A7208;
  --prim-blue-500: #3B82F6;
  --prim-violet-500: #8B5CF6;
  /* 状态色阶（2026-10-25 补充：原缺失导致 L2 只能用裸值） */
  --prim-green-400: #34D399;
  --prim-amber-400: #FBBF24;
  --prim-red-400: #F87171;
  --prim-blue-400: #60A5FA;

  /* 中性色阶 */
  --prim-ink-900: #0A0C12;   /* 页面底 */
  --prim-ink-800: #11141C;
  --prim-ink-700: #151A24;   /* 卡片底 */
  --prim-ink-500: #69718A;   /* 三级文字 */
  --prim-ink-300: #9AA3B5;   /* 二级文字 */
  --prim-ink-100: #E8ECF4;   /* 一级文字 */

  /* 间距刻度（4px 基准） */
  --prim-space-1: 4px;   --prim-space-2: 8px;   --prim-space-3: 12px;
  --prim-space-4: 16px;  --prim-space-6: 24px;  --prim-space-8: 32px;
  --prim-space-12: 48px;

  /* 圆角刻度 */
  --prim-radius-4: 4px;  --prim-radius-8: 8px;
  --prim-radius-12: 12px; --prim-radius-16: 16px; --prim-radius-full: 999px;

  /* 字号梯度 */
  --prim-font-11: 11px; --prim-font-12: 12px; --prim-font-13: 13px;
  --prim-font-15: 15px; --prim-font-17: 17px; --prim-font-20: 20px;
}

/* ═══════════════════════════════════════════════════════════════
   L2 · Semantic（语义层 —— 页面样式只引用这层）
   ═══════════════════════════════════════════════════════════════ */
:root {
  /* 文字 */
  --color-text-primary: var(--prim-ink-100);
  --color-text-secondary: var(--prim-ink-300);
  --color-text-tertiary: var(--prim-ink-500);
  /* 背景 */
  --color-bg-page: var(--prim-ink-900);
  --color-bg-elevated: var(--prim-ink-800);
  --color-bg-surface: var(--prim-ink-700);
  /* 动作 */
  --color-action-primary: var(--prim-gold-500);
  --color-action-primary-hover: var(--prim-gold-300);
  /* 状态（2026-10-25 修正：原先直接写十六进制，绕过了 L1；现改为引用 L1 色阶） */
  --color-state-success: var(--prim-green-400);
  --color-state-warning: var(--prim-amber-400);
  --color-state-danger: var(--prim-red-400);
  --color-state-info: var(--prim-blue-400);
  /* 间距语义 */
  --space-component-gap: var(--prim-space-2);
  --space-section-gap: var(--prim-space-6);
  --space-page-padding: var(--prim-space-6);
  /* 2026-10-25 补充：控件内边距（供 L3 的 --button-padding-x / --input-padding-x 引用） */
  --space-control-padding-x: var(--prim-space-4);
  --space-control-gap: var(--prim-space-2);
  /* 圆角语义 */
  --radius-control: var(--prim-radius-8);   /* 按钮/输入框 */
  --radius-surface: var(--prim-radius-12);  /* 卡片 */
  --radius-overlay: var(--prim-radius-16);  /* 弹窗 */
}

/* ═══════════════════════════════════════════════════════════════
   L3 · Component（组件层 —— 只被对应组件引用）
   ═══════════════════════════════════════════════════════════════ */
:root {
  --button-height-sm: 32px;
  --button-height-md: 44px;      /* 同时满足触控 44px 要求 */
  --button-height-lg: 48px;
  --button-radius: var(--radius-control);
  /* 2026-10-25 修正：原先 L3 直接引用 L1（--prim-space-4）违反依赖方向；
     现改为引用 L2 语义变量 --space-control-padding-x（见 L2 定义） */
  --button-padding-x: var(--space-control-padding-x);

  --input-height: 44px;
  --input-border-width: 1px;
  --input-radius: var(--radius-control);

  --card-radius: var(--radius-surface);
  --card-padding: var(--prim-space-4);

  --badge-radius: var(--prim-radius-4);
  --badge-height: 22px;

  --modal-radius: var(--radius-overlay);
  --modal-padding: var(--prim-space-6);
}
```

---

## 8. 附：现有资产迁移映射（节选）

| 现有变量 | 出现文件数 | 建议迁移目标 | 备注 |
|---|---:|---|---|
| `--bg` | 4 | `--color-bg-page` | 需逐文件核对值是否一致 |
| `--primary-light` | 4 | `--color-action-primary-hover` | 值可能不同，需先比对 |
| `--border-strong` | 4 | `--color-border-strong`（L2 新增） | — |
| `--shadow-md` | 4 | `--shadow-elevation-2`（L2 新增） | 现有 4 套阴影需统一 |
| `--radius` | 多 | `--radius-control` 或 `--radius-surface` | **需按用途区分**，不能一刀切 |
| `--ag-radius` / `--dw-radius` / `--sb-radius` / `--sg-radius` | 各 1 | 对应组件 Token（如 `--modal-radius`） | **需先查清四个缩写含义** |
| `--space-xs..xl` | 多 | `--space-component-gap` 等语义项 | 与 `--space-1..12` 两套并存需收敛 |
| `--gold` / `--gold-light` / `--gold-deep` | 多 | `--color-action-primary` 系列 | — |

---

## 9. 我方结论

**Token 分层不是"再加一些变量"，而是解决三个结构性问题**：

1. **3157 处硬编码** → 变量形同虚设（有了 Token 但页面不用）
2. **38 个变量在 4 个文件重复定义** → 没有单一来源，改一处不同步
3. **圆角 12 种命名 / 间距两套体系** → 无命名规范，新人无法判断该用哪个

**四阶段是必要的，但每阶段的深度可以商量** —— 这正是本文档第 6 章想请评审方判断的部分。我方不认为"做完 Phase 1 就算体系完成"，也不认为"必须一次做完 Phase 3 才能上线"。

**请评审方在下一版意见中明确**：

- 阶段数量是否合理（4 个 / 3 个 / 更多）
- 各阶段的**完成判定标准**（这是最关键的 —— 谁判定"Phase 2 完成"？依据是什么？）
- 优先级：Token vs CSP 前置改造（496 处 onclick）

---

# 第二部分：本轮已实施改动清单（供逐项验收）

> 本章列出 2026-10-25 本轮对话中**已部署到线上**的全部改动，含**文件与行号、改前改后代码、改动依据、验收方法**。
> 所有行号对应**当前线上版本**（2026-10-25 20:10 采集，脚本 `audit/phase2/collect-changelog-lines.py` 可复跑）。

## 10. 改动总览

| # | 改动项 | 文件:行号 | 类型 | 依据来源 | 证据级 |
|---|---|---|---|---|---|
| 1 | 详情页登录态解析修复 | `material.html:312` | 缺陷修复 | Luna 报告 P0 | A+B |
| 2 | 下载授权确认弹窗 | `material.html:686/703/695` | 新功能 | Luna 报告 P1 | A |
| 3 | 下载授权审计留痕 | `db.js:901-915` · `routes-materials.js:424` · `material.html:737` | 新功能 | Luna 复核建议 ③ | A+B+C |
| 4 | 同学院/同活动推荐 | `routes-materials.js:383` · `material.html:809/198` | 功能增强 | Luna 复核建议 ⑥ | A+B |
| 5 | 移动端触控 44px | `glass-solid.css:154` | 无障碍 | Luna 报告 P2（40.7px） | A+B |
| 6 | 设计 Token 扩展体系 | `glass-solid.css:216-248` | 体系搭建 | Luna 复核意见 4.2 | A |
| 7 | 全局焦点态 + 按钮三态 | `glass-solid.css:263/286` | 无障碍+反馈 | Luna 报告 P2 | A |
| 8 | 上传速度与剩余时间 | `index.js:1541/1577` | 功能增强 | Luna 报告 4.1（部分成立项） | A |
| 9 | 键盘可达性 polyfill | `shared.js:944` | 无障碍 | 我方 UI/UX 审计 | A |
| 10 | 空态自动重试倒计时 | `shared.js:696` | 交互增强 | Lucian 090 模式移植 | A |
| 11 | CSP Report-Only | `server.js:1262` · `helpers.js:127` · `server.js:930` | 安全 | Luna 复核建议 ② | A+B |
| 12 | 任务数据 + 显性入口 | `index.html:68` · `tasks.html:195/338` · DB #5-9 | 运营+信息架构 | Luna 复核建议 ④ | A+B+C |
| 13 | 首页 6 图本地化 | `index.html:249` | 依赖治理 | 我方 CSP 盘点发现 | A |
| 14 | OG/canonical 旧 IP 修正 | `index.html:8` | 缺陷修复 | 我方 CSP 盘点发现 | A |
| 15 | 任务提交错误文案 | `routes-tasks.js:90` | 缺陷修复 | 我方实测发现 | A+B |
| 16 | 渗透测试数据清理 | 数据库 | 数据治理 | Luna 报告 P2 | C |
| 17 | glass-solid 全站覆盖补齐 | 6 个页面 `<head>` | 一致性 | 我方审计发现 | A |

---

## 11. 逐项明细（含改前改后代码与验收方法）

### 11.1 详情页登录态解析修复（P0）

| 项 | 内容 |
|---|---|
| **文件:行号** | `public/material.html:312` |
| **问题** | 已登录用户在素材详情页点赞/收藏，被跳转到 `/login.html` |
| **根因（依据）** | 后端 `server.js:928` 返回 `{ok:true, user:...}`；前端读取 `me.data` → `CUR` 恒为 `null` → `doLike()` 中 `if(!CUR){location.href='/login.html';return}` 必然触发 |
| **改前** | ```js if(me&&me.ok&&me.data)CUR=me.data ``` |
| **改后** | ```js if(me&&me.ok)CUR=(me.user||me.data||null) ``` |
| **兼容性说明** | 同时兼容 `user` 与 `data` 两种结构，避免后端将来调整字段时再次失效 |
| **验收方法** | ① 登录后打开 `/material.html?id=23` ② 点「点赞」→ 应不跳转、计数 +1 ③ 再点一次 → 计数 -1 ④ 刷新页面 → 状态保持 ⑤ 退出登录后再点 → 才跳登录页 |
| **证据级** | A（源码）+ B（接口返回已实测）/ **浏览器点击回归待评审方验证** |

### 11.2 下载授权确认弹窗（P1）

| 项 | 内容 |
|---|---|
| **文件:行号** | `public/material.html:686`（`DL_TERMS_VERSION`）、`:703`（`showDownloadConfirm`）、`:695`（`_startDownload`） |
| **问题** | 下载直接触发文件流，无任何使用规范提示；校园素材涉及肖像权、校徽、活动版权 |
| **改动依据** | Luna 报告 P1「下载流程没有真正执行免责声明确认」 |
| **改动内容** | ① 新增 4 条使用规范（仅限校园宣传/教学/经授权；肖像校徽版权需另行许可；禁止商业冒用；对外发布注明来源）② **必须勾选**才可点「同意并下载」（非二次点击即放行）③ `localStorage` 按日记住（`_dlKey()` 返回 `dl-agree-YYYY-MM-DD`）④ Esc / 点遮罩可关 |
| **改前** | ```js function doDownload(){ if(!MAT)return; var a=document.createElement('a'); a.href='/api/materials/'+MAT.id+'/file'; … a.click() } ``` |
| **改后（关键片段）** | ```js var DL_TERMS_VERSION='v1.0'; function doDownload(){ if(!MAT)return; try{ if(localStorage.getItem(_dlKey())==='1'){ _startDownload(); return } }catch(e){} showDownloadConfirm() } function _startDownload(){ var a=document.createElement('a'); a.href='/api/materials/'+MAT.id+'/file'; … } ``` |
| **验收方法** | ① 清除 localStorage（或换无痕窗口）② 打开素材详情点「下载」→ 应弹确认框 ③ **不勾选**时「同意并下载」应为灰色禁用 ④ 勾选后按钮激活 ⑤ 点击 → 开始下载 ⑥ 关闭弹窗后再点下载 → **当天不再弹**（已验证按日记忆逻辑） |
| **证据级** | A（源码） |

### 11.3 下载授权审计留痕（Luna 复核建议 ③）

| 项 | 内容 |
|---|---|
| **涉及文件** | `db.js:901-915`（迁移）、`lib/routes-materials.js:424`（端点）、`public/material.html:737`（前端调用） |
| **问题** | 「有下载确认弹窗 ≠ 授权审计已完成」（Luna 复核不等式之一）。原 `download_logs` 只记 `material_id / user_id / ip / downloaded_at`，**不记用户同意了哪个版本的条款** |
| **改动依据** | Luna 复核第 3.2 节：「授权确认的审计留痕仍未完成」 |
| **迁移实现（关键）** | **不重建表**（原表已有 12 条真实下载记录，由 `server.js:38` 早期迁移创建），改为 `PRAGMA table_info` 检测后 `ALTER TABLE ADD COLUMN` 补 4 列：`material_title`（素材标题快照）/ `user_name`（用户名快照）/ `terms_version`（条款版本）/ `ua`（User-Agent） |
| **改前（我最初写错了一版）** | ```js CREATE TABLE IF NOT EXISTS download_logs (…) ``` → **表已存在时被静默跳过 → INSERT 报 no column → 端点 500** |
| **改后** | ```js const _dlCols = db.prepare('PRAGMA table_info(download_logs)').all().map(c=>c.name) for (const col of Object.keys(_dlWant)) { if(!_dlCols.includes(col)) db.exec(`ALTER TABLE download_logs ADD COLUMN ${col} ${_dlWant[col]}`) } ``` |
| **端点** | `POST /api/materials/:id/download-agree` → 记录 `material_id / material_title / user_id / user_name / terms_version / ip / ua`（`downloaded_at` 由表默认值填） |
| **前端接线** | 用户点「同意并下载」→ 先 POST 留痕 → **成功失败都继续下载**（`withBtnLoading(...).then(go)` + `setTimeout(go,1200)` 兜底，不阻断用户） |
| **验收方法** | ① 登录后下载任一素材并在弹窗勾选确认 ② 服务端查 `SELECT * FROM download_logs ORDER BY id DESC LIMIT 1` → 应看到 `material_title`/`user_name`/`terms_version`/`ip`/`ua` 全部有值 ③ 另可直接调 `POST /api/materials/23/download-agree` + `{"terms_version":"v1.0"}` → 期望 `200 {"ok":true,"message":"已记录授权确认"}` |
| **实测结果（我方）** | `200 已记录授权确认`，落库记录：`mid=31 「2025篮球赛」 user=系统测试账号 terms=v1.0 ip=123.146.23.135` ✓；测试记录已清理（历史 12 条完好） |
| **证据级** | A（源码）+ B（接口实测）+ C（DB 查询） |

### 11.4 同学院/同活动推荐（Luna 复核建议 ⑥）

| 项 | 内容 |
|---|---|
| **文件:行号** | `lib/routes-materials.js:383`（新端点）· `public/material.html:809`（前端调用）· `material.html:198`（理由徽章样式） |
| **背景澄清** | `materials` 表**无 `activity_id` 关联**（`activities` 表独立、`activity_joins` 是活动-用户报名表）→「同活动」用 `sub_type`（如"活动记录"）+ `shot_date` 同月近似 |
| **改动依据** | Luna 复核 4.4：「基础相关推荐已实现，下一步应从同类型推荐升级为同学院、同活动和专题化推荐」 |
| **打分规则** | 同 `sub_type` +35 · 同 `college` +30 · 标签重合 +10/个（上限 30）· 同 `shot_date` 年月 +25 · 同 `type` +12 · 下载量 +min(n,10) |
| **改前** | ```js api('/api/materials?page=1&pageSize=18'+(MAT.type?'&type='+…:'')+'&sort=downloads') ``` |
| **改后** | ```js api('/api/materials/'+MID+'/related?limit=6')  // 保留"池子太小时回退最新素材"的兜底 ``` |
| **新功能点** | 卡片左下角加**推荐理由徽章**（`同学院` / `同活动类型` / `同标签` / `同时段` / `同类型`），即 Luna 建议的「相关推荐的原因说明」 |
| **验收方法** | ① 打开 `/material.html?id=15`（运动会素材，活动记录 + 5 个标签）② 底部「相关推荐」应显示「毕业典礼/校园之春/迎新晚会」等 ③ 卡片左下角应看到金色理由徽章 ④ 直接调 `GET /api/materials/15/related?limit=6` → 应返回 6 条含 `reason`/`reasons`/`score` |
| **实测结果（我方）** | #15 → 「毕业典礼」score=**107** `同活动类型`(35+30+30+12)；「校园之春」87；「迎新晚会」52 `同学院` —— **分值逐条可复算** ✓ |
| **如实说明** | 当前全站素材仅 10 条（可推荐 9 条），**照片类为 0 条** → 照片详情页推荐区可能仍为空。这是**内容冷启动问题，非功能缺陷** |
| **证据级** | A（源码）+ B（接口实测） |

### 11.5 移动端触控 44px（Luna 报告 P2 · 40.7px）

| 项 | 内容 |
|---|---|
| **文件:行号** | `public/assets/glass-solid.css:154`（`@media (pointer: coarse)` 块） |
| **问题** | `.icon-btn`（`padding:8px 14px` 无 min-height ≈ **40.7px**）、`.act-sec` ≈38px、`.like-btn` `min-height:36px`；全站**无任何触屏适配** |
| **改动依据** | Luna 报告 P2 + 复核对 40.7px 数值的确认 |
| **改动内容** | 仅在**粗指针设备**（`@media (pointer: coarse)`）生效，桌面保持原密度：`.act-primary/.act-sec/.icon-btn/.like-btn/.btn/.btn-sm/.ghost-btn/.nav-item/.tab-item/.cat-card/.file-upload-area` 均 `min-height:44px`；`.icon-btn` 补 `min-width:44px`；`.act-row` gap 10→12px；弹窗关闭按钮 44×44 |
| **改前** | ```css .icon-btn{…;padding:8px 14px;…} ```（无 min-height） |
| **改后** | ```css @media (pointer: coarse){ .icon-btn, .act-sec, .like-btn, … { min-height:44px } .icon-btn{ min-width:44px; justify-content:center } } ``` |
| **验收方法** | ① Chrome DevTools → 设备模拟（**必须选带触摸的机型**，否则 `pointer:coarse` 不生效）② 选中「点赞」按钮 → Computed 面板查看 height ≥44px ③ 真机验证更可靠 |
| **证据级** | A（源码）+ **E（真机物理尺寸需评审方或用户在真机复测）** |

### 11.6 设计 Token 扩展体系（Luna 复核意见 4.2）

| 项 | 内容 |
|---|---|
| **文件:行号** | `public/assets/glass-solid.css:216`（`:root` Token 块）、`:248`（`prefers-reduced-motion`） |
| **改动依据** | Luna 复核 4.2：「不是完全没有 Token」，但「字体/行高缺口」成立 |
| **改动内容** | 新增 `--space-1..12`（4px 基准）/ `--text-2xs..3xl`（1.25 比例，正文 15px）/ `--leading-tight|normal|relaxed` / `--radius-xs..pill` / `--shadow-1..4` + `--shadow-glow-gold` / `--state-success|warn|danger|info` / `--dur-fast|base|slow` / `--ease-out|inout`；**仅新增不覆盖旧变量**以保证零回归 |
| **附带** | `@media (prefers-reduced-motion: reduce)` → 动效时长归零 + 全局 animation/transition 降至 0.01ms |
| **验收方法** | ① `curl /assets/glass-solid.css?v=4` → 搜索 `--space-1` / `--text-2xs` / `--prefers-reduced-motion` 均存在 ② 页面视觉应与改动前**完全一致**（纯新增） |
| **诚实说明** | **这只是 Phase 1 的雏形，不是完整分层**。本文档第 1–9 章已说明：全站仍有 3157 处硬编码、38 个变量重复定义、圆角 12 种命名 —— **体系尚未成立** |
| **证据级** | A（源码） |

### 11.7 全局焦点态 + 按钮三态

| 项 | 内容 |
|---|---|
| **文件:行号** | `glass-solid.css:263`（`:focus-visible` 共 7 处）、`:286`（`.is-loading` 共 5 处） |
| **改动依据** | Luna 报告「可见焦点态」+ 我方无障碍审计 |
| **改动内容** | ① `:focus-visible` 金色描边 2px / offset 2px，**仅键盘导航时出现**（鼠标点击不显示，避免视觉噪音）；卡片类额外加柔光 ② `.is-loading`（转圈 + 禁用 + 文字隐藏）/ `.is-success`（绿框 1.6s）/ `.is-error`（红框 + 抖动）；`prefers-reduced-motion` 下取消抖动 |
| **配套工具** | `shared.js:970` `withBtnLoading(btn, fn)` —— 包装异步操作自动切三态 |
| **验收方法** | ① 用 **Tab 键**遍历页面 → 焦点应显示金色描边 ② 用鼠标点击 → **不应出现**描边 ③ 触发任一异步操作（如登录）→ 按钮应出现转圈 |
| **诚实说明** | 成功/失败态主要仍靠 toast；`withBtnLoading` **尚未接入所有高频操作**（登录/上传按钮已有自身的"处理中"文案机制，未强行替换） |
| **证据级** | A（源码） |

### 11.8 上传速度与剩余时间

| 项 | 内容 |
|---|---|
| **文件:行号** | `public/assets/index.js:1541`（`bigUpSpeed` 元素）、`:1577`（`_spStart` 速度采样） |
| **改动依据** | 我方核对发现：Luna 报告「上传反馈需加强」**大部分不成立**（已有百分比/大小/分片/风险提示），但**确实缺「速度与剩余时间」** |
| **改动内容** | 1.5 秒后启动滑动样本估算，格式 `2.3 MB/s · 剩余 45 秒`；样本不足时显示「正在估算速度…」（避免展示假数据） |
| **改前** | 只有 `0%` + `0 MB` + `分片 x/y` |
| **改后** | 追加 `#bigUpSpeed` 行 + `paint()` 内计算 `bps = (uploadedBytes - _spBytes0) / elapsed` |
| **验收方法** | 上传一个 >100MB 文件 → 观察遮罩层应出现速度行；1.5 秒内显示「正在估算速度…」 |
| **证据级** | A（源码）+ **D（我方未真实跑大文件上传观察渲染，请评审方实测）** |

### 11.9 键盘可达性 polyfill

| 项 | 内容 |
|---|---|
| **文件:行号** | `public/shared.js:944` |
| **问题** | 全站 **496 处** `onclick` 分布在 `div`/`span`/`td` 上，键盘用户无法触发 |
| **改动内容** | 全局注入：所有 `div[onclick]/span[onclick]/td[onclick]` 自动获得 `tabindex="0"` + `role="button"` + Enter/Space 触发 click；`MutationObserver`（**去抖 200ms**）覆盖动态注入内容 |
| **为什么用 polyfill 而非逐个改** | 496 处逐个改 `<button>` 风险大且易漏；polyfill 一次覆盖全部，且不动结构。**属过渡方案**，CSP 收紧时仍需逐个改造 |
| **验收方法** | ① 用 Tab 键移动到素材卡片 → 应可聚焦 ② 按 Enter → 应打开详情 ③ 动态加载的新卡片（滚动加载）→ 同样可聚焦 |
| **证据级** | A（源码） |

### 11.10 空态自动重试倒计时

| 项 | 内容 |
|---|---|
| **文件:行号** | `public/shared.js:696`（`autoRetry` 逻辑）、`:706`（`new Function(opts.ctaOnclick)`） |
| **设计来源** | Lucian UI 元素库 090「插头重插的错误组件」—— 只取**模式**（倒计时环 + 自动重试），不搬其 15KB 耦合代码 |
| **改动内容** | `emptyStateHTML({autoRetry: N})` → 金色倒计时环（SVG 107 dashoffset 动画）+ 每秒数字递减 + N 秒后自动执行 `ctaOnclick`；每次新空态调用自动重置计时器（防重复） |
| **接入点** | 素材库网络失败空态 → `autoRetry: 8`（限流场景 10 秒） |
| **✅ 已解决（2026-10-25 21:00 更新）** | 原 `:706` 的 `new Function(opts.ctaOnclick)()` **已于本日移除**，改为 `ctaFn` 函数引用 + `ctaAction` 白名单双路径。**全项目现已无任何 `eval` / `new Function` 实际调用**（仅注释保留说明）。<br>因此 CSP 的 `'unsafe-eval'` 也已在同批次移除（见 §11.11）。<br>**遗留技术债**：`window.__esActions` 白名单是全局对象，若可被任意脚本写入仍可能绕过限制 —— 已列入待加固清单（只读封装 / 固定枚举 / 不允许外部输入） |
| **验收方法** | 断网 → 刷新素材库 → 应出现「内容加载失败」+ 倒计时环 → 恢复网络后等待 → 应自动重新加载 |
| **证据级** | A（源码）+ **D（未实测断网场景）** |

### 11.11 CSP Report-Only

| 项 | 内容 |
|---|---|
| **文件:行号** | `server.js:1262`（响应头，位于 `securityHeaders` 对象内，仅 HTML 生效）· `helpers.js:127`（`CSRF_EXEMPT` 加 `/api/csp-report`）· `server.js:930`（violation 收集端点） |
| **前置盘点（A 级）** | 内联 `<script>` **30 块 / 178.5 KB**；内联 `<style>` **12 块 / 88.7 KB**；行内事件属性 **496 处**；`javascript:` URL **5 处**；`eval`/`new Function` HTML 0 处但 `shared.js:706` **1 处**；iframe/object/embed **0** |
| **策略内容（2026-10-25 21:00 现行）** | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; report-uri /api/csp-report`<br>**注**：`'unsafe-eval'` 已于本日移除（配合 §11.10 的 `new Function` 清理） |
| **为什么仍需保留 `'unsafe-inline'`** | 30 个内联脚本块（178.5 KB）+ **496 处行内 `onclick`** + 12 个内联 `<style>`（88.7 KB）。移除需先完成 onclick 改造 → 属 Phase 3 之后的工作 |
| **当前安全状态定性（按 Luna 建议）** | `CSP Report-Only`：**可用于观测**<br>`CSP 强制模式`：**暂不具备上线条件**（`unsafe-inline` 未清零 + 浏览器回归未完成）<br>`unsafe-inline`：**技术债，需后续清理**<br>`unsafe-eval`：**已移除，应保持移除状态** |
| **Report-Only 的意义** | 浏览器**只上报不拦截** → 零功能风险；同时开始积累违规数据，为重写策略提供依据 |
| **验收方法** | ① `curl -I http://your-domain.example/` → 应看到 `Content-Security-Policy-Report-Only` 头 ② 打开页面 → Console 可能出现 `[Report Only] Refused to…` 警告（**这是预期行为**）③ 服务器端 `type C:\backend\csp-reports.log` → 应看到 violation 记录 |
| **实测结果（我方）** | 头存在 ✓；`POST /api/csp-report` → **204** ✓；`csp-reports.log` 已生成（含测试记录）✓ |
| **CSP 下发范围的完整实测（2026-10-25 21:10 采集，回应 Luna「未见 CSP」的判断）** | 见下方证据表。**关键发现：CSP 存在，但不同类型资源的响应头不同** —— 这解释了为什么评审方"没看到" |
| **证据表** | 见 §11.11.1 完整证据 |

#### 11.11.1 CSP 响应头实测证据（4 个 HTML 路径 × HTTP/HTTPS + 3 组对照）

| # | 协议 | 路径 | 状态 | `content-security-policy-report-only` | `content-security-policy`（正式） | `strict-transport-security` |
|---|---|---|---|---|---|---|
| 1 | HTTP | `/` | 200 | **✓ 有** | — | ✗ 无 |
| 2 | HTTP | `/index.html` | 200 | **✓ 有** | — | ✗ 无 |
| 3 | HTTP | `/material.html` | 200 | **✓ 有** | — | ✗ 无 |
| 4 | HTTP | `/tasks.html` | 200 | **✓ 有** | — | ✗ 无 |
| 5 | HTTPS | `/` | 200 | **✓ 有** | — | ✗ 无 |
| 6 | HTTPS | `/index.html` | 200 | **✓ 有** | — | ✗ 无 |
| 7 | HTTPS | `/material.html` | 200 | **✓ 有** | — | ✗ 无 |
| 8 | HTTPS | `/tasks.html` | 200 | **✓ 有** | — | ✗ 无 |
| 9 | HTTP | **`/api/health`（对照）** | 200 | **✗ 无** | **✓ 有** `default-src 'none'; frame-ancestors 'none'` | ✗ 无 |
| 10 | HTTP | **`/assets/index.js`（对照）** | 200 | ✗ 无 | ✗ 无 | ✗ 无 |
| 11 | HTTP | **`/shared.css`（对照）** | 200 | ✗ 无 | ✗ 无 | ✗ 无 |

**结论与差异解释**：

1. **8 个 HTML 类请求（4 路径 × 2 协议）全部带 `CSP-Report-Only`** —— 实测无缺失
2. **API 请求带的是「正式 CSP」而非「Report-Only」**（`lib/helpers.js:11` 的 `sendJSON` 统一加 `default-src 'none'; frame-ancestors 'none'`，这是早期就有的严格策略）→ **若按 `Content-Security-Policy-Report-Only` 头名去查 API 路径，会得到"无 CSP"的结论**
3. **静态资源（.js/.css）两类 CSP 头都没有** → 若查这两类路径同样会"看不到"
4. **HSTS 确实未配置**（11 个请求全部无该头）→ **Luna 此项判断正确**
5. **HTTP 确实未跳转 HTTPS**（8 个 HTML 请求均返回 200 无 `Location`）→ **Luna 此项判断正确**

**复现命令**：

```bash
# HTML 路径（应看到 CSP-Report-Only）
curl -sI --noproxy '*' http://your-domain.example/index.html | grep -i "content-security"
curl -skI --noproxy '*' https://your-domain.example/material.html | grep -i "content-security"

# API 路径（对照：只有正式 CSP）
curl -sI --noproxy '*' http://your-domain.example/api/health | grep -i "content-security"

# 静态资源（对照：两者都无）
curl -sI --noproxy '*' http://your-domain.example/assets/index.js | grep -i "content-security"

# HSTS / 跳转
curl -sI --noproxy '*' https://your-domain.example/ | grep -i "strict-transport"
curl -sI --noproxy '*' http://your-domain.example/ | grep -iE "^HTTP/|^location:"
```

**原始响应头存档**：`audit/phase2/csp-header-evidence.json`（11 组完整头，含全部头名清单）

#### 11.11.2 带版本指纹的重新核验（2026-10-25 20:40，回应 Luna「历史证据不能验收当前状态」）

| 指纹项 | 值 |
|---|---|
| 采集时刻（本地） | `2026-10-25T12:40:29.021Z`（= 北京时间 20:40:29） |
| **服务器时间** | `2026-10-25T20:40:09+08:00` |
| **node 进程启动时间** | **`2026-10-25T20:20:34`** |
| 服务状态 | `STATE: 4 RUNNING` |
| 报告存档 | `audit/phase2/csp-recheck-with-fingerprint.json` |

**同一时刻双协议复测结果（7 条路径 × 2 协议 = 14 次请求）**：

| 路径 | HTTP | HTTPS | 说明 |
|---|---|---|---|
| `/` | 200 **CSP-RO ✓** | 200 **CSP-RO ✓** | |
| `/index.html` | 200 **CSP-RO ✓** | 200 **CSP-RO ✓** | |
| `/material.html` | 200 **CSP-RO ✓** | 200 **CSP-RO ✓** | |
| `/tasks.html` | 200 **CSP-RO ✓** | 200 **CSP-RO ✓** | |
| `/api/health` | 200 **CSP(正式)** | 200 **CSP(正式)** | 不同策略（`default-src 'none'`） |
| `/assets/index.js` | 200 无 | 200 无 | 静态资源无安全头 |
| `/shared.js` | 200 无 | 200 无 | 同上 |

**关键点：node 进程在 20:20:34 重启过（即在 Luna 指出"可能采集后被重新部署"之后），重启后 CSP-Report-Only 依然生效** —— 排除了"历史证据与当前版本不一致"的可能。

#### 11.11.3 三方一致性核对（线上磁盘 vs 本地源码）

| 文件 | SHA-256 比对结果 |
|---|---|
| `server.js` | ✓ 一致 |
| `public/shared.js` | ✓ 一致 |
| `public/assets/index.js` | ✓ 一致 |
| `public/assets/glass-solid.css` | ✓ 一致 |
| `lib/helpers.js` | ✓ 一致 |
| `lib/routes-tasks.js` | ✓ 一致 |
| `lib/routes-materials.js` | ✓ 一致 |
| **合计** | **7 / 7 全部一致** |
| **证据级** | A（源码）+ B（HTTP 实测） |

### 11.12 任务数据 + 显性入口（Luna 复核建议 ④）

| 项 | 内容 |
|---|---|
| **涉及** | 数据库 `tasks` 表 5 条 · `index.html:68`（导航）· `tasks.html:195`（发布按钮）· `tasks.html:338`（`quickPublish`） |
| **问题（双层）** | **功能层**：后端 12 端点完整（我方已修正原报告判断）；**产品可用层**：`tasks` 表 0 条 + 发布入口仅在「任务管理」二级 tab（Luna 复核双层结论） |
| **改动 1：数据** | 播种 5 条真实任务（幂等脚本 `audit/phase2/seed-real-tasks.cjs`，按标题去重）：迎新晚会现场记录 50 分/3 人 · 校园四季秋日摄影 30 分/10 人 · 学院宣传片剪辑 80 分/2 人 · 运动会精彩瞬间 40 分/5 人 · 教师节专题采访 60 分/2 人；发布人：管理员账号（学号已隐去） |
| **改动 2：首页导航** | 改前：任务大厅**仅在头像下拉菜单**，顶部导航无入口<br>改后：`首页 → 素材库 → 专题 → 学院活动 → **任务大厅** → 校园社区`；`data-i18n="nav.tasks"` + `assets/index.js:14` 补 key |
| **改动 3：发布入口** | 改前：发布表单在左栏「任务管理」二级 tab<br>改后：`tasks.html` 页头按钮组新增 `#quickPublishBtn`「+ 发布任务」，**仅管理员显示**（`refreshQuickPublish()` 在 `loadTasks` 时判断 `ME.is_admin`），点击 `quickPublish()` → 切 tab + 自动聚焦标题输入框 |
| **验收方法** | **学生视角**（`20260000001`/`〔凭据已移除〕`）：首页导航应见「任务大厅」→ 点进应见 5 个任务卡 → 领取 → 重复领取应提示「你已领取该任务」→ 提交成果 → 我的任务可见<br>**管理员视角**（`admin`）：任务页右上角应见「+ 发布任务」→ 点击跳管理 tab → 发布新任务 → 大厅立刻多一条 |
| **实测结果（我方）** | `GET /api/tasks` → 5 条（含 points/slots/status/active_claims）✓；首页 HTML 含 `nav.tasks` + `/tasks.html` ✓；tasks.html 含 `quickPublishBtn`/`quickPublish`/`refreshQuickPublish` ✓ |
| **时间线澄清（2026-10-25 修正）** | Luna 指出本文件"一处说任务表为空、另一处说已初始化 5 条"，**此处补时间线消除歧义**：<br>· 2026-10-25 **18:30**：闭环测试后清理测试任务 → `tasks = 0`（彼时 §4.3 描述的"0 条"即此状态）<br>· 2026-10-25 **20:28**：执行 `seed-real-tasks.cjs` 播种 5 条真实任务 → `tasks = 5`<br>· 2026-10-25 **20:50**：Phase 0 基线备份实证 `tasks=5 / task_claims=0`（备份文件 `campus-baseline.db` 可复查）<br>**结论：两处描述不矛盾，是不同时间点状态；当前线上为 5 条** |
| **未登录时的表现** | `GET /api/tasks` 未登录返回 401「请先登录」（Luna 复核时观察到的现象）。这是**设计如此**（任务大厅需登录），并非接口故障。测试凭据请通过安全渠道获取（本文件不记录密码） |
| **🔴 数据性质标记（2026-10-25 21:20 补齐，Luna 要求）** | **5 条任务定性为「演示夹具」，非真实业务内容**。已实施三件套：<br>**① 独立标记**：`tasks.is_demo` 字段（`0`=真实业务 / `1`=演示夹具），由 `db.js` **v11 迁移**添加（`PRAGMA table_info` 检测 + `ALTER TABLE`）；当前 5 条全部 `is_demo=1`<br>**② 清理脚本**：`C:/backup/cleanup-demo-tasks.cjs` —— **预览/确认双模式**（默认只列出待删项并生成 JSON 备份；加 `--confirm` 才实际删除）；删除范围**严格限定 `is_demo=1`**，连带清理 `task_claims`<br>**③ 回滚方案**：`C:/backup/rollback-demo-tasks.cjs <backup.json>` —— 从 JSON 备份恢复任务与领取记录（含 `is_demo` 原值） |
| **前端标识** | 任务卡右上角显示「**演示**」黄色角标，`title` 属性说明「演示内容，用于功能体验，非正式发布任务」—— 避免普通用户误认为正式任务 |
| **转正式方式** | 若后续决定作为真实任务保留：`UPDATE tasks SET is_demo = 0 WHERE id IN (5,6,7,8,9)`，前端角标自动消失，无需改代码 |
| **实测验证（B 级）** | ① 前端 4 项检查全过（`t.is_demo` 判断 / 「演示」文案 / `.badge.demo` 样式 / title 说明）<br>② `GET /api/tasks` 返回 5 条**全部含 `is_demo=1`**<br>③ 清理脚本预览模式实测：生成备份 `demo-tasks-backup-2026-10-25T12-49-18.json`（5 任务 / 0 领取记录），**未实际删除**<br>④ 回滚脚本已生成（1863B / 1695B 均已落盘） |
| **证据级** | A（源码）+ B（接口实测）+ C（DB 查询） |

### 11.13 首页 6 图本地化 + 14. OG 旧 IP 修正

| 项 | 内容 |
|---|---|
| **文件:行号** | `index.html:249`（6 处 `photos/featured`）、`index.html:8`（3 处 `your-domain.example`） |
| **发现经过** | 做 CSP 前置盘点时扫描外部域名，发现两类外部依赖（**此为副产品发现，非原计划任务**） |
| **问题 A** | 首页 6 个精选 `<img src>` 直接指向 `trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=…` —— **依赖第三方 AI 服务、暴露生成 prompt、服务下线即全挂** |
| **处理 A** | 6 张图下载到 `public/photos/featured/feat-01..06-*.jpg`（各 172KB），src 改本地路径 |
| **🔴 验证发现（如实报告）** | **6 张图 MD5 完全相同**（`19a0b822edb11957055e4588c2159058`）→ TRAE 对 6 个不同 prompt 返回了**同一张占位图** → **首页 6 个精选卡片原本就显示同一张图** |
| **上线前必须补齐（Luna 复核要求，我方接受）** | ① **六张图是否真正不同** —— ❌ 当前相同，**必须替换**<br>② **是否体现校园场景** —— 当前为 AI 生成的泛校园图，需换真实校园影像<br>③ **是否经过压缩** —— 当前各 172KB（JPEG），替换时建议 WebP + 长边 ≤1920px<br>④ **是否有移动端裁剪方案** —— 当前无 `srcset`/`sizes`，建议补响应式图源<br>⑤ **是否有加载失败占位** —— 当前 `<img loading="lazy">` 但**无 `onerror` 兜底**<br>⑥ **是否有版权或来源说明** —— 当前无，建议在「关于我们」页统一注明图片来源与授权 |
| **问题 B** | `og:image` / `og:url` / `canonical` 指向**已停用的旧服务器** `old-server.example` → 分享预览与 SEO 规范化全部失效 |
| **处理 B** | 3 处改为 `your-domain.example`（正式域名备案后应改为域名） |
| **验收方法** | ① 首页 6 个精选卡片应能显示图片（不再请求外部域名）② 浏览器 Network 面板 → 应无 `trae-api-cn.mchost.guru` 请求 ③ 查看页面源码 `<meta property="og:url">` 应为当前 IP |
| **证据级** | A（源码） |

### 11.15 任务提交错误文案修复

| 项 | 内容 |
|---|---|
| **文件:行号** | `lib/routes-tasks.js:90`（`anyClaim` 校验块） |
| **问题** | 用户**已提交**成果后再点提交，返回「请先领取任务」—— 逻辑正确但提示完全误导 |
| **根因** | 原 SQL 只捞 `status IN ('claimed','rejected')` 的记录，查不到时统一回一句提示 |
| **改前** | ```js const claim = db.prepare("… AND status IN ('claimed','rejected') …").get(id, user.id) if (!claim) { sendJSON(res,400,{message:'请先领取任务'}) } ``` |
| **改后** | ```js const anyClaim = db.prepare("SELECT * FROM task_claims WHERE task_id=? AND user_id=? …").get(id, user.id) if(!anyClaim) → '请先领取该任务' if(anyClaim.status==='submitted') → '成果已提交，等待审核' if(anyClaim.status==='approved') → '该任务你已完成，无需重复提交' const claim = anyClaim ``` |
| **验收方法** | 领取任务 → 提交成果 → **再提交一次** → 应提示「成果已提交，等待审核」（不再是"请先领取"） |
| **实测结果（我方）** | 重复提交返回 `400 成果已提交，等待审核` ✓ |
| **证据级** | A（源码）+ B（接口实测） |

### 11.16 渗透测试数据清理

| 项 | 内容 |
|---|---|
| **问题** | 数据库存在 5 条渗透测试残留素材（Luna 报告 P2；我方核对确认实际为 `pt_` 前缀 4 条 + `pentest_probe_1` 1 条，非报告称的"若干 `pentest_`"） |
| **清理对象** | `#41 pentest_probe_1` · `#42 pt_poly` · `#43 pt_php2` · `#44 pt_path` · `#45 pt_xss_<img src=x onerror=alert(document.cookie)>`（含对应上传文件） |
| **清理后** | 素材 10 条：`approved=4 / draft=1 / published=5`；`pt_`/`pentest` 残留 0 条 |
| **脚本** | `audit/phase2/cleanup-pentest-data.cjs`（可复跑，幂等） |
| **⚠️ 遗留提醒** | Luna 复核指出：**标签表仍有 `pentest` 预置标签但计数为 0** —— 不等于仍有素材；正式发布前建议一并清理标签与通知/审核日志中的测试痕迹 |
| **证据级** | C（DB 查询） |

### 11.17 glass-solid.css 全站覆盖补齐

| 项 | 内容 |
|---|---|
| **问题** | 6 个页面（`tasks` / `about` / `login` / `graph` / `cardnav` / `articles-work`）**从未引用** `glass-solid.css` → 玻璃质感与触控规则在这些页面完全失效 |
| **发现经过** | 部署触控规则后验证"6 个页面引用已更新"时，发现覆盖率不对 |
| **处理** | 6 页 `<head>` 补 `<link rel="stylesheet" href="/assets/glass-solid.css?v=4">`；全站 12 页现全部引用 |
| **验收方法** | `curl /tasks.html | grep glass-solid` → 应有 1 处；对 12 个页面逐个检查应全部命中 |
| **证据级** | A（源码） |

---

## 12. 操作流程（本轮的标准动作顺序）

> 说明：我方在本轮中逐步固化了以下流程，其中第 2、4、6 步曾因跳过而出现过真实错误（见第 13 章）。

| 步骤 | 动作 | 目的 | 实例 |
|---|---|---|---|
| 1 | **读现状** | 改前先看真实代码/数据结构 | 下载审计前先 `PRAGMA table_info(download_logs)`，发现表已存在（避免建表错误） |
| 2 | **写脚本文件**，不用内联命令 | 避免 shell 转义破坏正则/路径 | 曾用 `node -e` 跑正则导致 `Unknown regular expression flags` |
| 3 | **改后立即读回验证** | 不假设替换成功 | 文档改 0.6 节时读回发现锚点不匹配（2 个换行 vs 实际 3 个） |
| 4 | **语法检查** | `node --check` / 内联 JS 全量提取检查 | 每次改 JS 后必跑 |
| 5 | **部署后端 → 等重启 → 再部署前端** | 配置/依赖顺序 | CSP 与 db 迁移均先部署后端并等 20s |
| 6 | **实测验证**（不是只看代码） | 接口实测 + DB 查询 + 云端 curl | 下载审计实测发现 500（建表错误），若不实测会误报"已完成" |
| 7 | **清理测试数据** | 不污染生产数据 | 任务闭环测试后清理；下载审计测试记录清理 |
| 8 | **写入记忆 + 文档** | 便于后续追溯 | 今日日志 + 交接摘要 |

### 部署命令范式（供评审方验证可复现性）

```bash
# 后端（含自动重启）
curl -X POST http://your-domain.example/api/deploy \
  -H "X-Deploy-Key: <key>" \
  -H "X-Deploy-Backend: 1" \
  -F "file=@server.js"

# 前端
curl -X POST http://your-domain.example/api/deploy \
  -H "X-Deploy-Key: <key>" \
  -F "file=@index.html"

# 验证头
curl -sI http://your-domain.example/ | grep -i "content-security-policy-report-only"
```

---

## 13. 本轮我方的错误与纠正记录（主动披露）

> 按 Luna 复核建议「报告自身问题」的做法，此处如实列出本轮犯的错误。

| # | 错误 | 后果 | 纠正方式 |
|---|---|---|---|
| 1 | **误判任务后端只有 1 个端点** | 得出"任务发布不了"的错误结论，并据此建议做后端 | 发现 `routes-tasks.js` 混用 `p ===` 与 `p.match()` 两种写法，重新盘点得 **12 个端点全部存在** |
| 2 | **下载审计用 `CREATE TABLE IF NOT EXISTS` 建表** | 表已存在（12 条真实记录）→ CREATE 被跳过 → INSERT 报缺列 → **端点 500** | 改 `PRAGMA table_info` + `ALTER TABLE ADD COLUMN`，保留历史数据 |
| 3 | **审计脚本 `v=17` vs `v17` 格式断层** | 报出 23 条假 P0"版本不一致" | 人工复核后确认只有 2 个页面真实落后 |
| 4 | **测试脚本切换学生登录后忘记切回管理员** | 403 被我误判为"系统 bug" | 修正测试脚本，重测通过 |
| 5 | **31947 bytes 与 21581 字符混为一谈** | 误判"文档内容丢失"（实际变大） | 统一按单位换算（中文 1 字符 ≈ 3 bytes） |
| 6 | **多次使用 `node -e` 内联脚本** | 正则/路径转义被 shell 破坏，多次失败 | 改为一律写 `.cjs` 文件执行 |
| 7 | **核验记录统计数字自相矛盾**（属实 17/无法核实 1 vs 表格实际 18/0） | Luna 复核时指出 | 已修正为 18/0 并加勘误说明 |

**改进措施已固化为守则**（写入项目长期记忆）：多写法交叉验证 / 禁内联脚本 / 替换后必读回 / 数字必带单位 / 测试失败先自检 / 部署顺序清单化 / 结论附验证方式 / 主动证伪 / 不猜接口行为 / 改动前先读现状 / 结论分级标注可信度（A/B/C/D/E）。

---

## 14. 请评审方重点验收的 5 项

> 以下 5 项**我方证据最弱**或**最需要外部验证**，请优先复核：

| # | 项 | 我方证据缺口 | 建议验收方式 |
|---|---|---|---|
| 1 | **11.5 触控 44px** | 源码级确认，**真机物理尺寸未测**（E 级） | 真机或 DevTools 触摸模拟，量取按钮实际高度 |
| 2 | **11.8 上传速度/剩余时间** | 源码级确认，**未真实跑 >100MB 上传观察渲染**（D 级） | 实测一个 100MB+ 文件，观察遮罩层速度行 |
| 3 | **11.10 空态自动重试** | 源码级确认，**未实测断网场景**（D 级） | 断网 → 刷新素材库 → 观察倒计时与自动重连 |
| 4 | **11.11 CSP Report-Only** | 头与端点已实测，但**未观察真实浏览器违规上报** | 打开各页面看 Console `[Report Only]` 警告，并检查 `csp-reports.log` 增长 |
| 5 | **11.12 任务全流程** | 接口与数据已实测，**浏览器 UI 点击未回归** | 按 11.12「验收方法」用学生号与管理员号各走一遍 |

---
