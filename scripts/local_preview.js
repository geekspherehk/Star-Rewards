#!/usr/bin/env node
/**
 * 本地预览服务：把「本地前端」和「线上真实数据」接起来。
 *
 * 为什么需要它：站点是 PHP + MySQL（api/index.php 单入口），本机没有 PHP/MySQL，
 * 直接 python -m http.server 会让 API 请求 501。
 * 所以这里：
 *   1) 前端所有静态文件（index.html / style.css / script.js / i18n.js / sw.js / kid.html…）
 *      —— 读本地仓库最新代码，改完刷新即见，不用部署；
 *   2) /api/* —— 转发到生产 https://stellar.gaocaihk.com，带上线上 Origin/Referer，
 *      页面里 fetch('/api/index.php?action=...') 同源发出，看不到跨域，登录态 localStorage 正常。
 *
 * 用法：node scripts/local_preview.js  →  打开 http://localhost:9091/index.html
 * 端口：默认 9091（可用 PORT=xxxx 覆盖，尽量避开 8000-8020）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = process.env.SR_ORIGIN || 'https://stellar.gaocaihk.com';
const PORT = Number(process.env.PORT || 9091);

// 可选：给预览带上登录态，打开即进家长端首页，不用每次手输账号。
//   SR_PREVIEW_EMAIL=... SR_PREVIEW_PASSWORD=... node scripts/local_preview.js
let previewToken = '';
async function loginForPreview() {
  let email = process.env.SR_PREVIEW_EMAIL;
  let password = process.env.SR_PREVIEW_PASSWORD;
  // 账号放本地不入库的 scripts/.preview-account.json（{email,password}），env 优先
  if (!email || !password) {
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '.preview-account.json'), 'utf8'));
      email = cfg.email; password = cfg.password;
    } catch (e) { /* 没有就退回未登录预览，不影响使用 */ }
  }
  if (!email || !password) return;
  try {
    const r = await fetch(ORIGIN + '/api/index.php?action=login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, referer: ORIGIN + '/' },
      body: JSON.stringify({ email, password })
    });
    const j = await r.json();
    if (j && j.token) { previewToken = j.token; console.log('  预览登录态：已带上 ' + email); return; }
    // 账号不在 → 自举一个演示号，顺手造三笔数据，首页才有东西看
    if (/invalid email or password/i.test(JSON.stringify(j))) {
      const reg = await call('register', { email, password, consent: true });
      if (reg && reg.token) {
        // 注意 action 名不统一：行为是驼峰 addBehavior，打卡是 add_checkin 且必须带 wish_id
        await call('add_wish', { category: 'self_drive', title: '自己刷牙', wish_type: 'persistence', persistence_days: 30 }, reg.token);
        await call('addBehavior', { description: '今天自己整理书包', points: 3 }, reg.token);
        const wish = await call('add_wish', { category: 'health', title: '每天户外活动 30 分钟', wish_type: 'persistence', persistence_days: 21 }, reg.token);
        if (wish && wish.id) await call('add_checkin', { wish_id: wish.id }, reg.token);
        previewToken = reg.token;
        console.log('  预览登录态：已新建演示号 ' + email);
        return;
      }
    }
    console.log('  预览登录态失败：' + JSON.stringify(j));
  } catch (e) { console.log('  预览登录态失败：' + e.message); }
}

function call(action, body, token) {
  return fetch(ORIGIN + '/api/index.php?action=' + encodeURIComponent(action), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, referer: ORIGIN + '/', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(r => r.json()).catch(() => ({}));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.html': 'text/html; charset=utf-8',
  '.manifest': 'application/manifest+json; charset=utf-8'
};

function sendStatic(req, res, urlPath) {
  const rel = urlPath.replace(/^\/+/, '').split('/').filter(Boolean);
  let file = path.join(ROOT, ...(rel.length ? rel : ['index.html']));
  // 防目录穿越
  if (!file.startsWith(ROOT)) {
    res.writeHead(403); return res.end('forbidden');
  }
  // 直接指向目录（如 /kid.html 或 /assets）→ 补 index.html
  if (!path.extname(file)) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('404 ' + urlPath);
  }
  const ext = path.extname(file).toLowerCase();
  const headers = {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': 'no-store' // 预览要的是最新代码，禁缓存
  };
  // 家长端首页：注入预览登录态，打开就是已登录的最新首页
  if (previewToken && file.endsWith('index.html')) {
    const inject = '<script>try{' +
      'localStorage.setItem("auth_token",' + JSON.stringify(previewToken) + ');' +
      'localStorage.setItem("user_email",' + JSON.stringify(process.env.SR_PREVIEW_EMAIL || '') + ');' +
      // 跳过首启引导/新手卡，预览直接看到日常首页
      'localStorage.setItem("sr_onboarded","1");localStorage.setItem("v2_guide_seen","1");' +
      '}catch(e){}</script>';
    res.writeHead(200, headers);
    return res.end(fs.readFileSync(file).toString('utf8').replace('</body>', inject + '</body>'));
  }
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

function proxyApi(req, res, urlPath) {
  const target = ORIGIN + urlPath + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
  const headers = {
    'content-type': req.headers['content-type'] || 'application/json',
    accept: req.headers.accept || 'application/json',
    origin: ORIGIN,
    referer: ORIGIN + '/',
    'user-agent': req.headers['user-agent'] || 'Mozilla/5.0',
    'x-forwarded-host': new URL(ORIGIN).host
  };
  if (req.headers.authorization) headers.authorization = req.headers.authorization;

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', async () => {
    const method = req.method || 'GET';
    try {
      const r = await fetch(target, {
        method,
        headers,
        body: (method === 'GET' || method === 'HEAD') ? undefined : Buffer.concat(chunks)
      });
      const buf = Buffer.from(await r.arrayBuffer());
      const ct = r.headers.get('content-type');
      res.writeHead(r.status, {
        'content-type': ct || 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store'
      });
      res.end(buf);
    } catch (e) {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('proxy error: ' + e.message);
    }
  });
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname.startsWith('/api/')) return proxyApi(req, res, u.pathname);
  return sendStatic(req, res, u.pathname);
}).listen(PORT, async () => {
  console.log(`\n  本地预览已就绪（前端=本地最新代码，数据=线上真实数据）\n`);
  console.log(`  家长端： http://localhost:${PORT}/index.html`);
  console.log(`  孩子端： http://localhost:${PORT}/kid.html`);
  console.log(`\n  Ctrl+C 结束\n`);
  await loginForPreview();
});
