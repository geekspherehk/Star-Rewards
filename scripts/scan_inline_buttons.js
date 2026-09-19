// 移动端「行内按钮被全局 button{width:100%} 撑开」问题扫描（430 / 320 视口）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const path = require('path'), os = require('os'), fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'https://stellar.gaocaihk.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-btnscan-'));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', userDataDir: profile, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  const OUT = path.join(__dirname, '..', 'screenshots');
  fs.mkdirSync(OUT, { recursive: true });

  for (const W of [430, 320]) {
    await page.setViewport({ width: W, height: 900, deviceScaleFactor: 2 });
    if (W === 430) {
      // 首次：登录取 token
      await page.goto(BASE + '/login.html', { waitUntil: 'networkidle2', timeout: 60000 });
      const r = await page.evaluate(async () => {
        const res = await fetch('/api/index.php?action=register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'sr.scan.' + Math.floor(Date.now() / 1000) + '@example.com', password: 'TestPass123!', consent: true })
        });
        return await res.json();
      });
      if (!r || !r.token) { console.log('注册失败:', JSON.stringify(r).slice(0, 200)); await browser.close(); return; }
      await page.evaluate(t => localStorage.setItem('auth_token', t), r.token);
      global.TOKEN = r.token;
      global.EMAIL = r.email;
    }
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);
    await page.evaluate(() => {
      if (typeof dismissOnboarding === 'function') dismissOnboarding();
      const ob = document.getElementById('onboarding-modal'); if (ob) ob.style.display = 'none';
      const a2hs = document.getElementById('a2hs-banner'); if (a2hs) a2hs.style.display = 'none';
      if (typeof showVerifyBanner === 'function') showVerifyBanner();
    });
    await sleep(1200);

    const report = await page.evaluate(() => {
      const out = { doc: { clientW: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth }, bad: [], padded: [], total: 0 };
      const vw = document.documentElement.clientWidth;
      for (const b of document.querySelectorAll('button')) {
        const r = b.getBoundingClientRect();
        if (!r.width || !r.height || r.width < 20) continue;
        out.total++;
        const p = b.parentElement; if (!p) continue;
        const pr = p.getBoundingClientRect();
        const pcs = getComputedStyle(p);
        const cs = getComputedStyle(b);
        const isFlexRow = pcs.display.includes('flex') && pcs.flexDirection !== 'column';
        const fillRatio = r.width / Math.max(1, pr.width - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight));
        const overflow = r.right > vw + 0.5 || r.left < -0.5;
        // 第二类：图标按钮（无文字/1-2 字）被移动端全局 button padding 撑大（显式 width 被 padding 顶开）
        const txt = (b.textContent || '').trim();
        const padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight);
        if (txt.length <= 2 && Math.max(padL, padR) >= 18) {
          out.padded.push({ cls: b.className || '(no class)', text: txt || '(无文字)', w: +r.width.toFixed(1), h: +r.height.toFixed(1), padding: cs.padding, overflow });
        }
        // 可疑：flex 行内 + 几乎占满父宽 + 明显不该满宽（父内有其他兄弟）
        if ((isFlexRow && fillRatio > 0.9 && p.children.length > 1) || overflow) {
          out.bad.push({
            cls: b.className || '(no class)', text: (b.textContent || '').trim().slice(0, 12) || '(无文字)',
            w: +r.width.toFixed(1), parentW: +pr.width.toFixed(1), parentCls: String(p.className).slice(0, 28),
            parentDisplay: pcs.display, fill: +fillRatio.toFixed(2), overflow, padding: cs.padding
          });
        }
      }
      return out;
    });
    console.log('\n===== 视口 ' + W + 'px ===== （共 ' + report.total + ' 个可见按钮）');
    console.log('文档宽度: client=' + report.doc.clientW + ' scroll=' + report.doc.scrollW + (report.doc.scrollW > report.doc.clientW ? '  ⚠ 横向溢出' : ''));
    if (!report.bad.length) console.log('未发现被撑开的行内按钮');
    for (const x of report.bad) console.log('  ⚠ 满宽 ' + x.cls + ' "' + x.text + '" w=' + x.w + '/' + x.parentW + ' fill=' + x.fill + ' pad=' + x.padding + ' 父=' + x.parentCls + '(' + x.parentDisplay + ')' + (x.overflow ? ' [溢出视口]' : ''));
    if (!report.padded.length) console.log('未发现被 padding 撑大的图标按钮');
    for (const x of report.padded) console.log('  ⚠ 图标按钮 ' + x.cls + ' "' + x.text + '" ' + x.w + '×' + x.h + ' pad=' + x.padding + (x.overflow ? ' [溢出视口]' : ''));
    await page.screenshot({ path: path.join(OUT, 'btnscan-' + W + '.png'), fullPage: false });
  }

  // 清理临时账号
  const del = await page.evaluate(async () => {
    const t = localStorage.getItem('auth_token');
    const res = await fetch('/api/index.php?action=delete_account', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ confirm: 'DELETE' }) });
    return await res.text();
  }).catch(e => String(e));
  console.log('\n临时账号清理:', String(del).slice(0, 120));
  await browser.close();
  fs.rmSync(profile, { recursive: true, force: true });
})();
