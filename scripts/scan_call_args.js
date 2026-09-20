#!/usr/bin/env node
/**
 * scan_call_args.js — 「实参数 > 形参数」静态扫描
 *
 * 背景：api-client.js 的 addBehavior 曾漏声明第三形参却在函数体内读 extra，
 * ReferenceError 在 fetch 之前抛出、请求根本没发出（带病 5 周）。
 * node --check 只查语法查不出这种错，所以放进部署 preflight。
 *
 * 原理：
 *   1. 收集本项目 JS（及指定 HTML 内联脚本）里的函数/方法定义 → 名字 → 形参容量
 *      （rest 参数或函数体用了 arguments → 容量 ∞）
 *   2. 扫描所有调用点，实参数 > 容量 → 报错
 *   3. 只报"项目内有定义"的名字，外部 API（document.*、fetch 等）天然跳过
 *   4. 实参含展开语法（...）、调用点前是 new/function/call/apply 的跳过
 *
 * 用法: node scripts/scan_call_args.js [--quiet]   # 有问题 exit 1
 *       供 scripts/deploy-ftp.py preflight 调用；也可单独手动跑。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 参与扫描的文件：自有源码（排除第三方库/构建产物）
const JS_FILES = [
  'api/api-client.js', 'api/index.js', 'api/config.js',
  'script.js', 'login.js', 'i18n.js', 'utils.js', 'themes.js',
  'pwa-manager.js', 'sw.js',
].filter(f => fs.existsSync(path.join(ROOT, f)));
// 内联脚本同样会产生调用（如 index.html 里调 initializeApp），一并抽取
const HTML_FILES = ['index.html', 'login.html', 'landing.html']
  .filter(f => fs.existsSync(path.join(ROOT, f)));

const DEF_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'typeof', 'function', 'new', 'delete', 'void', 'await', 'case']);
const BUILTIN_SKIP = new Set(['console', 'fetch', 'parseInt', 'parseFloat', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'alert', 'confirm', 'prompt', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'Promise', 'Proxy', 'Reflect', 'URL', 'URLSearchParams',
  'Intl', 'Date', 'RegExp', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'BigInt', 'TextEncoder', 'TextDecoder',
  'caches', 'importScripts', 'postMessage', 'skipWaiting', 'clients', 'self']);

function extractScripts(htmlPath) {
  const src = fs.readFileSync(htmlPath, 'utf8');
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out.join('\n');
}

// 从参数串算容量：顶层逗号分参；有 ...rest → Infinity
function paramCapacity(paramSrc) {
  const s = paramSrc.replace(/\/\*[\s\S]*?\*\//g, ' ').trim();
  if (!s) return 0;
  let depth = 0, count = 1, cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { count++; continue; }
  }
  // rest 检测：任一顶层参数以 ... 开头
  const parts = [];
  depth = 0; cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  parts.push(cur);
  for (const p of parts) if (p.trim().startsWith('...')) return Infinity;
  return count;
}

// ── 收集定义 ──────────────────────────────────────────────
// name -> { cap, usesArguments, files:Set }
const defs = new Map();
function addDef(name, cap, usesArguments, file) {
  if (!name || DEF_KEYWORDS.has(name) || BUILTIN_SKIP.has(name)) return;
  const d = defs.get(name) || { cap: 0, usesArguments: false, files: new Set() };
  d.cap = Math.max(d.cap, cap);
  d.usesArguments = d.usesArguments || usesArguments;
  d.files.add(file);
  defs.set(name, d);
}

function scanDefinitions(code, file) {
  // ① function name(a, b) {}
  let re = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;
  let m;
  while ((m = re.exec(code))) addDef(m[1], paramCapacity(m[2]), bodyUsesArguments(code, m.index + m[0].length), file);
  // ② const/let/var name = (a, b) =>   或  = function(a, b)
  re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(([^)]*)\)\s*=>|function\s*\(([^)]*)\)\s*\{)/g;
  while ((m = re.exec(code))) {
    const params = m[2] !== undefined ? m[2] : m[3];
    addDef(m[1], paramCapacity(params || ''), bodyUsesArguments(code, m.index + m[0].length), file);
  }
  // ③ 对象/类方法（含 async）：name(a, b) {  —— 排除关键词后，形如 xxx(...) { 的都是方法简写
  re = /(?:^|[;,{\n])\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;
  while ((m = re.exec(code))) addDef(m[1], paramCapacity(m[2]), bodyUsesArguments(code, m.index + m[0].length), file);
  // ④ name: function(a, b) {
  re = /([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?function\s*\(([^)]*)\)\s*\{/g;
  while ((m = re.exec(code))) addDef(m[1], paramCapacity(m[2]), bodyUsesArguments(code, m.index + m[0].length), file);
}

// 从 openBraceIdx 起做花括号配平，返回配对 } 的下标（字符串感知），未配平返回 -1
function matchBrace(code, openBraceIdx) {
  let depth = 0, inStr = null;
  for (let i = openBraceIdx; i < code.length; i++) {
    const ch = code[i], prev = code[i - 1];
    if (inStr) { if (ch === inStr && prev !== '\\') inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '/' && code[i + 1] === '/') { // 行注释
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') { i += 2; while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++; i++; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function bodyUsesArguments(code, defMatchEnd) {
  // defMatchEnd 是定义正则匹配串的末尾 = 函数体的开括号 '{'
  const end = matchBrace(code, defMatchEnd - 1);
  if (end < 0) return false;
  return /\barguments\b/.test(code.slice(defMatchEnd, end));
}

// ── 扫描调用点 ────────────────────────────────────────────
// 从调用点 `( 往后做括号配平，数顶层逗号 → 实参数
// （逗号只在圆括号深度 1 且不在 {} [] 内才算分隔符，否则 {a, b} 对象会被误拆）
function countArgs(code, openParenIdx) {
  let depth = 0, brace = 0, bracket = 0, i = openParenIdx, args = 1, anyContent = false;
  let inStr = null;
  for (; i < code.length; i++) {
    const ch = code[i], prev = code[i - 1];
    if (inStr) { if (ch === inStr && prev !== '\\') inStr = null; continue; }
    if (ch === '"' || ch === "'" || (ch === '`')) { inStr = ch; continue; }
    if (ch === '(') { depth++; continue; }
    if (ch === ')') {
      depth--;
      if (depth === 0) {
        if (!anyContent) return 0;
        return args;
      }
      continue;
    }
    if (ch === '{') brace++;
    else if (ch === '}') brace--;
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket--;
    if (depth === 1 && brace === 0 && bracket === 0) {
      if (ch === ',') args++;
      else if (!/\s/.test(ch)) anyContent = true;
    } else if (!/\s/.test(ch)) {
      anyContent = true;
    }
  }
  return -1; // 未配平（模板字符串等复杂情况），跳过
}

function scanCalls(code, file, issues) {
  const re = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(code))) {
    const name = m[1];
    if (!defs.has(name)) continue;
    const before = code.slice(Math.max(0, m.index - 12), m.index);
    if (/\b(new|function|typeof|delete|void|case)$/.test(before.trim())) continue;
    if (/\.(call|apply|bind)$/.test(before.trim())) continue;
    const d = defs.get(name);
    if (d.usesArguments) continue;
    const n = countArgs(code, m.index + m[0].length - 1);
    if (n < 0) continue;
    // 展开实参 → 实参数不可知，跳过
    const callSrc = code.slice(m.index, m.index + 400);
    const openIdx = m.index + m[0].length - 1;
    let depth = 0, spread = false;
    for (let i = openIdx; i < code.length; i++) {
      const ch = code[i];
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) break; }
      else if (depth === 1 && ch === '.' && code[i + 1] === '.' && code[i + 2] === '.') { spread = true; break; }
    }
    if (spread) continue;
    if (n > d.cap) {
      const line = code.slice(0, m.index).split('\n').length;
      issues.push(`${file}:${line}: ${name}() 调用传 ${n} 个实参，但定义只有 ${d.cap} 个形参` +
        `（定义于 ${[...d.files].join(', ')}）——形如 addBehavior 漏形参却读变量的隐身 bug`);
    }
  }
}

// ── 主流程 ────────────────────────────────────────────────
// 额外文件参数（非 -- 开头）可追加扫描，用于回归测试/定点检查
const extraArgs = process.argv.slice(2).filter(a => !a.startsWith('--'));
const quiet = process.argv.includes('--quiet');
const issues = [];
const sources = [];
for (const f of JS_FILES) sources.push([f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
for (const f of HTML_FILES) sources.push([f + ' <内联>', extractScripts(path.join(ROOT, f))]);
for (const f of extraArgs) sources.push([f, fs.readFileSync(path.resolve(f), 'utf8')]);

for (const [f, code] of sources) scanDefinitions(code, f);
for (const [f, code] of sources) scanCalls(code, f, issues);

if (issues.length) {
  console.error('✘ 实参/形参数不匹配:');
  for (const i of issues) console.error('  - ' + i);
  process.exit(1);
}
if (!quiet) console.log(`✔ 实参/形参扫描通过（${sources.length} 个文件，${defs.size} 个定义）`);
