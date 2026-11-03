/**
 * 小程序工程自检：JSON 严格性 / 页面完整性 / JS 语法 / WXML 类名覆盖
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = 'D:/新建文件夹 (4)/2026-08-30-18-11-43/miniapp';
const NODE = process.execPath;

let errors = 0;
let warns = 0;
const ok = (m) => console.log('  ✓ ' + m);
const err = (m) => {
    console.log('  ✗ ' + m);
    errors++;
};
const warn = (m) => {
    console.log('  ⚠ ' + m);
    warns++;
};

/* ── 1. JSON 严格性 ── */
console.log('=== [1] JSON 严格性 ===');
const jsonFiles = ['app.json', 'project.config.json', 'sitemap.json'];
const parsed = {};
for (const f of jsonFiles) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) {
        err(f + ' 缺失');
        continue;
    }
    try {
        parsed[f] = JSON.parse(fs.readFileSync(p, 'utf8'));
        ok(f + ' 可解析');
    } catch (e) {
        err(f + ' 解析失败: ' + e.message);
    }
}

/* ── 2. 页面完整性 ── */
console.log('\n=== [2] 页面完整性 ===');
const app = parsed['app.json'] || {};
const pages = app.pages || [];
if (!pages.length) err('app.json.pages 为空');
ok('pages 声明 ' + pages.length + ' 个');
for (const pg of pages) {
    const base = path.join(ROOT, pg);
    for (const ext of ['.wxml', '.js']) {
        if (!fs.existsSync(base + ext)) err(pg + ext + ' 缺失');
    }
}
if (!errors) ok('所有页面的 .wxml / .js 均存在');

if (app.lazyCodeLoading !== 'requiredComponents') err('app.json 缺少 lazyCodeLoading: requiredComponents');
else ok('lazyCodeLoading 已配置');

/* ── 3. tabBar 合法性 ── */
console.log('\n=== [3] tabBar 合法性 ===');
const tabs = (app.tabBar && app.tabBar.list) || [];
if (!tabs.length) warn('未配置 tabBar');
let iconWithIcon = 0;
tabs.forEach((t) => {
    if (pages.indexOf(t.pagePath) === -1) err('tabBar.pagePath 未在 pages 中声明: ' + t.pagePath);
    if (!t.text) err('tabBar 缺少 text: ' + t.pagePath);

    // 图标：必须成对出现，且文件存在、体积合规
    const pair = [t.iconPath, t.selectedIconPath];
    if (pair.some((p) => p) && pair.some((p) => !p)) {
        err('tabBar 图标必须成对配置 iconPath + selectedIconPath: ' + t.text);
    }
    pair.forEach((rel) => {
        if (!rel) return;
        const fp = path.join(ROOT, rel);
        if (!fs.existsSync(fp)) {
            err('tabBar 图标不存在: ' + rel);
            return;
        }
        const size = fs.statSync(fp).size;
        if (size > 40 * 1024) err('tabBar 图标超过 40KB 限制: ' + rel + ' (' + size + ' bytes)');
        const head = fs.readFileSync(fp).subarray(0, 8);
        const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
        if (!isPng) err('tabBar 图标不是 PNG（小程序只接受 png/jpg，禁用 svg）: ' + rel);
    });
    if (t.iconPath && t.selectedIconPath) iconWithIcon++;
});
if (tabs.length && tabs.length <= 5) {
    ok('tabBar ' + tabs.length + ' 项，均已在 pages 中声明');
}
if (tabs.length && iconWithIcon === tabs.length) {
    ok('tabBar 图标 ' + iconWithIcon * 2 + ' 个文件齐全，均为 PNG 且未超 40KB');
} else if (tabs.length && iconWithIcon > 0) {
    warn('仅 ' + iconWithIcon + '/' + tabs.length + ' 项配了图标（部分页签会只剩文字）');
}

/* ── 4. JS 语法 ── */
console.log('\n=== [4] JS 语法 ===');
const jsFiles = [];
(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'node_modules' || e.name === '.git') continue;
            walk(fp);
        } else if (e.name.endsWith('.js')) {
            jsFiles.push(fp);
        }
    }
})(ROOT);
for (const f of jsFiles) {
    try {
        execFileSync(NODE, ['--check', f], { stdio: 'pipe' });
    } catch (e) {
        err(path.relative(ROOT, f) + ' 语法错误: ' + String(e.stderr || e.message).split('\n')[0]);
    }
}
ok(jsFiles.length + ' 个 JS 文件语法检查完成');

/* ── 5. WXML 类名覆盖 ── */
console.log('\n=== [5] WXML 类名 → WXSS 覆盖 ===');
const wxss = fs.readFileSync(path.join(ROOT, 'app.wxss'), 'utf8');
const defined = new Set();
for (const m of wxss.matchAll(/\.([a-zA-Z][\w-]*)/g)) defined.add(m[1]);
// 页面级 wxss
const pageWxss = [];
(function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, e.name);
        if (e.isDirectory()) walk(fp);
        else if (e.name.endsWith('.wxss') && fp !== path.join(ROOT, 'app.wxss')) pageWxss.push(fp);
    }
})(ROOT);
for (const f of pageWxss) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/\.([a-zA-Z][\w-]*)/g)) defined.add(m[1]);
}

const used = new Map();
const wxmlFiles = [];
(function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, e.name);
        if (e.isDirectory()) walk(fp);
        else if (e.name.endsWith('.wxml')) wxmlFiles.push(fp);
    }
})(ROOT);

// 动态拼接前缀（如 class="thumb thumb-{{item.ratio}}" 中的 thumb-）
const prefixes = new Map();

for (const f of wxmlFiles) {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);
    for (const m of src.matchAll(/class="([^"]*)"/g)) {
        const rawVal = m[1];

        // ① 只有三元表达式的「结果分支」才是类名；=== / !== 右侧是数据值，必须排除
        //    例：{{item.state === '已结束' ? 'pill' : 'pill'}} → '已结束' 不是类名
        const dyn = [];
        for (const d of rawVal.matchAll(/\{\{([^}]*)\}\}/g)) {
            const expr = d[1];
            for (const s of expr.matchAll(/'([^']*)'/g)) {
                const before = expr.slice(Math.max(0, s.index - 6), s.index);
                if (/(===|!==|==|!=)\s*$/.test(before)) continue; // 数据值，跳过
                dyn.push(s[1]);
            }
        }

        // ② 静态部分：把 {{...}} 换成占位符 \u0001，保留「拼接痕迹」
        //    例：thumb-{{x}} → "thumb-\u0001" → 残留 "thumb-" 说明是前缀拼接
        const marked = rawVal.replace(/\{\{[^}]*\}\}/g, '\u0001');
        const tokens = marked.split(/\s+/).concat(dyn.join(' ').split(/\s+/));

        for (const t of tokens) {
            const hasHole = t.includes('\u0001');
            const cls = t.replace(/\u0001/g, '').trim();
            if (!cls) continue;              // 整段动态（如 {{item.tone}}），无从静态判断
            if (hasHole) {                   // 拼接前缀
                if (!prefixes.has(cls)) prefixes.set(cls, new Set());
                prefixes.get(cls).add(rel);
                continue;
            }
            if (/[{}$]/.test(cls)) continue;
            if (!used.has(cls)) used.set(cls, new Set());
            used.get(cls).add(rel);
        }
    }
}

const missing = [];
for (const [cls, files] of used) {
    if (!defined.has(cls)) missing.push(cls + '  ←  ' + [...files].join(', '));
}

// 动态拼接前缀：只要 WXSS 里存在以该前缀开头的类即视为覆盖
// 例：thumb-{{item.ratio}} 要求 .thumb-a / .thumb-b / .thumb-c 存在
const badPrefix = [];
for (const [pre, files] of prefixes) {
    const covered = [...defined].some((d) => d.startsWith(pre));
    if (!covered) badPrefix.push(pre + '*（拼接前缀无对应样式）  ←  ' + [...files].join(', '));
}
for (const b of badPrefix) missing.push(b);

if (missing.length) {
    warn('有 ' + missing.length + ' 个类名未定义样式（不阻断编译，但会丢样式）：');
    missing.forEach((m) => console.log('      · ' + m));
} else {
    ok(
        '全部 ' + used.size + ' 个类名都有对应样式' +
        (prefixes.size ? '，' + prefixes.size + ' 个动态拼接前缀均有匹配（' + [...prefixes.keys()].join(' / ') + '）' : '')
    );
}

/* ── 6. WXML 标签配对 ── */
console.log('\n=== [6] WXML 标签配对 ===');
for (const f of wxmlFiles) {
    const src = fs.readFileSync(f, 'utf8');
    const opens = (src.match(/<view[\s>]/g) || []).length;
    const closes = (src.match(/<\/view>/g) || []).length;
    const viewBalanced = opens === closes;
    const bt = (src.match(/<block[\s>]/g) || []).length === (src.match(/<\/block>/g) || []).length;
    const sc = (src.match(/<scroll-view[\s>]/g) || []).length === (src.match(/<\/scroll-view>/g) || []).length;
    const tx = (src.match(/<text[\s>]/g) || []).length === (src.match(/<\/text>/g) || []).length;
    if (!viewBalanced || !bt || !sc || !tx) {
        err(
            path.relative(ROOT, f) +
                ' 标签不配对 (view ' + opens + '/' + closes +
                ', block ' + (bt ? 'ok' : 'x') +
                ', scroll ' + (sc ? 'ok' : 'x') +
                ', text ' + (tx ? 'ok' : 'x') + ')'
        );
    }
}
if (!errors) ok(wxmlFiles.length + ' 个 WXML 标签配对正确');

/* ── 7. 禁用 API 扫描 ── */
console.log('\n=== [7] 禁用写法扫描 ===');
const banned = [
    [/\blocalStorage\b/, 'localStorage'],
    [/\bdocument\./, 'document'],
    [/\bwindow\./, 'window'],
    [/\bfetch\(/, 'fetch'],
    [/<div[\s>]/, '<div>'],
    // 仅禁外部/相对路径背景图；data: 内嵌资源是合法用法（图标库就靠它）
    [/background-image:\s*url\(\s*(?!["']?data:)/, 'WXSS background-image:url() 外部或相对路径'],
];
let bannedHit = 0;
for (const f of jsFiles.concat(wxmlFiles, pageWxss)) {
    const src = fs.readFileSync(f, 'utf8');
    for (const [re, name] of banned) {
        if (re.test(src)) {
            err(path.relative(ROOT, f) + ' 使用了禁用写法: ' + name);
            bannedHit++;
        }
    }
}

/* 页面 wxss 里用 @import 引入页面目录之外的样式表：2026-11-03 实测踩过。
   管理后台 5 个页面原来都只写一行 @import "../../styles/admin.wxss"，
   结果样式整体没生效（页面渲染成未加工的竖排文本块），且编译不报任何错。
   这类失败没有任何提示，只能靠人眼看出来 —— 所以固化成检查。
   app.wxss 里 import 图标库是长期在用的写法，不在此列。 */
for (const f of pageWxss) {
    const src = fs.readFileSync(f, 'utf8');
    if (/@import\s+["'][^"']*\.\.\//.test(src)) {
        err(
            path.relative(ROOT, f) +
                ' 用 @import 引入了页面目录之外的样式表，实测会静默失效：请把样式并入 app.wxss'
        );
        bannedHit++;
    }
}
if (!bannedHit) ok('未发现 localStorage / document / window / fetch / HTML 标签 / 外部路径背景图');

/* ── 汇总 ── */
console.log('\n════════ 汇总 ════════');
console.log('  错误: ' + errors + ' | 警告: ' + warns);
console.log('  页面: ' + pages.length + ' | JS: ' + jsFiles.length + ' | WXML: ' + wxmlFiles.length);
console.log('  结论: ' + (errors === 0 ? '通过（可进 IDE 编译）' : '存在阻断问题，需修复'));
process.exit(errors === 0 ? 0 : 1);
