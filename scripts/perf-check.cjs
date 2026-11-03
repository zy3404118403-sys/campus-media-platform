/**
 * 小程序性能体检
 *
 * 不是跑真机帧率，而是从「能静态量化的部分」找风险：
 *   ① 包体构成 —— 哪些文件占了体积
 *   ② 代码规模 —— 哪个页面最重
 *   ③ setData 使用 —— 一次性塞大数组、循环里 setData 都是卡顿来源
 *   ④ WXML 复杂度 —— 深层嵌套 + wx:for 会拖慢首屏
 *   ⑤ 运行时隐患 —— 定时器未清、频繁 setData
 *
 * 用法：node audit/phase2/perf-check.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/新建文件夹 (4)/2026-08-30-18-11-43/miniapp';
const rows = [];
let errors = 0;

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === '.workbuddy' || e.name === 'tools' || e.name === 'node_modules') continue;
        const fp = path.join(dir, e.name);
        if (e.isDirectory()) walk(fp, out);
        else out.push(fp);
    }
    return out;
}

const files = walk(ROOT);
const sizeOf = (f) => fs.statSync(f).size;
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

/* ══════════ ① 包体构成 ══════════ */
console.log('════════ ① 包体构成 ════════\n');

let total = 0;
const byExt = {};
files.forEach((f) => {
    const s = sizeOf(f);
    total += s;
    const ext = path.extname(f) || '(no ext)';
    byExt[ext] = (byExt[ext] || 0) + s;
});

console.log('文件总数 ' + files.length + '　总包体 ' + kb(total) + '（微信上限 2 MB，占 ' + ((total / 2097152) * 100).toFixed(1) + '%）\n');
console.log('按类型：');
Object.entries(byExt)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ext, s]) => {
        console.log('  ' + ext.padEnd(10) + kb(s).padStart(10) + '  ' + ((s / total) * 100).toFixed(1) + '%');
    });

/* 最大的 12 个文件 */
console.log('\n最大的 12 个文件：');
const top = files
    .map((f) => ({ f, s: sizeOf(f) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 12);
top.forEach((t, i) => {
    const rel = path.relative(ROOT, t.f);
    const flag = t.s > 40 * 1024 ? '  ← 重点关注' : '';
    console.log('  ' + String(i + 1).padStart(2) + '. ' + kb(t.s).padStart(9) + '  ' + rel + flag);
});

/* ══════════ ② 页面代码规模 ══════════ */
console.log('\n════════ ② 各页面规模（JS + WXML 行数）════════\n');

const pages = fs
    .readdirSync(path.join(ROOT, 'pages'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

const pageRows = pages.map((p) => {
    const base = path.join(ROOT, 'pages', p, p);
    const lc = (ext) => {
        try {
            return fs.readFileSync(base + '.' + ext, 'utf8').split('\n').length;
        } catch (e) {
            return 0;
        }
    };
    return { page: p, js: lc('js'), wxml: lc('wxml'), wxss: lc('wxss') };
});

pageRows.sort((a, b) => b.js + b.wxml - (a.js + a.wxml));
pageRows.forEach((r) => {
    const sum = r.js + r.wxml;
    console.log('  ' + r.page.padEnd(18) + 'js ' + String(r.js).padStart(4) + '  wxml ' + String(r.wxml).padStart(4) + '  wxss ' + String(r.wxss).padStart(4));
});

/* ══════════ ③ setData 使用 ══════════ */
console.log('\n════════ ③ setData 使用情况 ════════\n');

const jsFiles = files.filter((f) => f.endsWith('.js'));
const setDataStat = [];
jsFiles.forEach((f) => {
    const src = fs.readFileSync(f, 'utf8');
    const calls = (src.match(/setData\s*\(/g) || []).length;
    if (!calls) return;
    /* 说明：曾经用正则猜「是否在循环里 setData」，但正则无法判断循环作用域，
       会把循环之后的语句也算进去（post-detail / diagnose 就是这么被误报的）。
       次数本身不代表有问题 —— 关键是别在渲染路径上高频调用，所以这里只做统计供人判断。 */
    setDataStat.push({ f: path.relative(ROOT, f), calls });
});
setDataStat.sort((a, b) => b.calls - a.calls);
setDataStat.slice(0, 8).forEach((s) => {
    console.log('  ' + String(s.calls).padStart(3) + ' 次  ' + s.f);
});
console.log('  （次数仅供参考：批量渲染时一次 setData 传整个列表是正确做法，逐条 setData 才需要改）');

/* 整包塞大数组：setData 里直接引用 mock 数组 */
console.log('\n一次性 setData 整表的风险点：');
let bulk = 0;
jsFiles.forEach((f) => {
    const src = fs.readFileSync(f, 'utf8');
    const hits = src.match(/setData\(\{[\s\S]{0,200}?[A-Za-z]+:\s*(mock\.[a-zA-Z]+|list|all)\b/g);
    if (hits && hits.length) {
        console.log('  ' + path.relative(ROOT, f) + '  (' + hits.length + ' 处)');
        bulk++;
    }
});
if (!bulk) console.log('  （无）');

/* ══════════ ④ WXML 复杂度 ══════════ */
console.log('\n════════ ④ WXML 复杂度（元素数 / wx:for / 嵌套）════════\n');

const wxmlFiles = files.filter((f) => f.endsWith('.wxml'));
const wxmlStat = wxmlFiles.map((f) => {
    const src = fs.readFileSync(f, 'utf8');
    const tags = (src.match(/<[a-z-]+/g) || []).length;
    const fors = (src.match(/wx:for=/g) || []).length;
    // 粗略估算嵌套：连续缩进的层数
    let maxDepth = 0;
    src.split('\n').forEach((line) => {
        const m = line.match(/^(\s*)</);
        if (m) maxDepth = Math.max(maxDepth, Math.floor(m[1].length / 2));
    });
    return { f: path.relative(ROOT, f), tags, fors, maxDepth };
});
wxmlStat.sort((a, b) => b.tags - a.tags);
wxmlStat.slice(0, 8).forEach((w) => {
    const flag = w.tags > 120 ? '  ← 元素偏多' : '';
    console.log('  ' + String(w.tags).padStart(4) + ' 元素  for ' + String(w.fors).padStart(2) + '  深度 ' + String(w.maxDepth).padStart(2) + '  ' + w.f + flag);
});

/* ══════════ ⑤ 运行时隐患 ══════════ */
console.log('\n════════ ⑤ 运行时隐患 ════════\n');

const hazards = [];
const hints = [];
jsFiles.forEach((f) => {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);

    if (/setInterval\s*\(/.test(src) && !/clearInterval\s*\(/.test(src)) {
        hazards.push(rel + '：用了 setInterval 但没有 clearInterval');
    }
    // setTimeout 的清理方式有两种：_alive 存活标记，或 onUnload 里 clearTimeout。
    // 两种都算已处理，不能只看前者，否则会把写对的页面误报成隐患。
    if (/setTimeout\s*\(/.test(src) && /onUnload/.test(src) &&
        !/_alive|isUnmounted|unmounted|clearTimeout/.test(src)) {
        hazards.push(rel + '：有 setTimeout，但 onUnload 既未清定时器也未做存活标记');
    }
    // onShow 里读 Storage 只是提示：读个短字符串成本可忽略，只有逐条读列表才需要缓存
    if (/onShow[\s\S]{0,200}?wx\.getStorageSync/.test(src)) {
        hints.push(rel + '：onShow 中读取 Storage（若是短标记可忽略；逐条读列表建议加内存缓存）');
    }
});
if (hazards.length) {
    hazards.forEach((h) => console.log('  ⚠ ' + h));
    errors += hazards.length;
} else {
    console.log('  未发现定时器泄漏或已卸载页面 setData 的隐患');
}
if (hints.length) {
    console.log('\n  提示（不计入隐患）：');
    hints.forEach((h) => console.log('   · ' + h));
}

/* ══════════ 汇总 ══════════ */
console.log('\n════════ 汇总 ════════');
console.log('总包体 ' + kb(total) + ' / 2 MB　·　页面 ' + pages.length + ' 个　·　文件 ' + files.length + ' 个');
console.log('体检项：' + (errors === 0 ? '未见明显性能隐患' : errors + ' 处需要关注'));

/* 给优化建议提供依据：图标库占比 */
const iconsWxss = files.find((f) => f.endsWith(path.join('utils', 'icons.wxss')));
if (iconsWxss) {
    const s = sizeOf(iconsWxss);
    console.log('\n图标库 icons.wxss 占包体 ' + ((s / total) * 100).toFixed(1) + '%（' + kb(s) + '）');
}
