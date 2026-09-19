// 移动端「全局 button{width:100%} 误伤」探测器
//
// 背景：style.css 的 @media (max-width:768px) 里有一条
//     button, .add-points-btn, .add-gift-btn { padding:10px 20px; width:100% }
// 裸 button 选择器会命中页面上**每一个**没有自己声明 width 的按钮。它们被撑成整行宽后：
//   - 把 flex 同级文本挤到 0 宽 → 汉字逐字竖排（邮箱验证横幅、激活进度条都中过招）
//   - 或让按钮独占一行，把本应并排的兄弟按钮顶到下一行
//   - 或让主/次按钮宽度倒置（实测过 84px : 314px）
//
// 做法（差分法，比肉眼翻截图可靠）：
//   1. 登录后到首页，量一遍所有 button 的宽度
//   2. 用 CSSOM 把「选择器含裸 button 且设了 width」的规则的 width 改成 auto
//   3. 再量一遍，宽度发生变化的按钮 = 自身没声明 width、完全依赖该全局规则的元素
//   4. 逐个人工判定：设计意图要满宽的（如 .add-points-btn）保留，
//      行内按钮则在该规则之后补 `width: auto` 收口
//
// 用法：
//   NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules \
//     node scripts/probe_mobile_button_rule.js [--width 430] [--keep]
//   --keep  保留临时测试账号（默认用完即删）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const os = require('os');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.SR_BASE || 'https://stellar.gaocaihk.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const argv = process.argv.slice(2);
const argOf = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const WIDTH = parseInt(argOf('--width', '430'), 10);
const KEEP = argv.includes('--keep');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-btnprobe-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: ud,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: 900, deviceScaleFactor: 2 });
  await page.setUserAgent(UA);
  // sw.js 对 fetch 做 cache-first 代理，经它转发的请求不计入 page 事件；探测逻辑不需要 SW
  try {
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  } catch (e) { /* 旧内核不支持时忽略 */ }

  let token = null, email = null;
  try {
    await page.goto(BASE + '/login.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#login-email', { timeout: 20000 });
    await sleep(800);

    email = 'sr.btnprobe.' + Math.floor(Date.now() / 1000) + '@example.com';
    let reg = null;
    // 登录页有自动跳转逻辑，evaluate 可能被导航打断 → 重试几次
    for (let i = 0; i < 4 && !reg; i++) {
      try {
        reg = await page.evaluate(async (e) => (await fetch('/api/index.php?action=register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: e, password: 'TestPass123!', consent: true }),
        })).json(), email);
      } catch (err) { await sleep(1200); }
    }
    if (!reg || !reg.token) throw new Error('临时账号注册失败: ' + JSON.stringify(reg));
    token = reg.token;
    await page.evaluate((t, e) => { localStorage.setItem('auth_token', t); localStorage.setItem('user_email', e); }, token, email);

    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(4500);
    // 新账号会弹新手引导遮罩，会挡住部分元素并影响布局测量
    await page.evaluate(() => {
      const m = document.getElementById('onboarding-modal');
      if (typeof dismissOnboarding === 'function') dismissOnboarding();
      if (m) m.style.display = 'none';
    });
    await sleep(900);

    const diff = await page.evaluate(() => {
      const widthOf = () => Array.from(document.querySelectorAll('button')).map(el => +el.getBoundingClientRect().width.toFixed(1));

      // 收集「选择器里含裸 button 且声明了 width」的规则（含媒体查询内部）
      const targets = [];
      const walk = (rules, media) => {
        for (const r of Array.from(rules)) {
          if (r.cssRules && r.cssRules.length) { walk(r.cssRules, r.conditionText || r.media ? (r.conditionText || '') : media); continue; }
          if (!r.selectorText || !r.style) continue;
          const bareButton = r.selectorText.split(',').some(s => s.trim() === 'button');
          if (bareButton && r.style.width) targets.push({ rule: r, media: media || '(顶层)', sel: r.selectorText.replace(/\s+/g, ' ').slice(0, 70), width: r.style.width });
        }
      };
      for (const s of Array.from(document.styleSheets)) {
        try { walk(s.cssRules, ''); } catch (e) { /* 跨域表跳过 */ }
      }

      const before = widthOf();
      const touched = targets.map(t => { t.rule.style.width = 'auto'; return { media: t.media, sel: t.sel, width: t.width }; });
      void document.body.offsetHeight;   // 强制 reflow
      const after = widthOf();

      const changed = [];
      const btns = document.querySelectorAll('button');
      btns.forEach((el, i) => {
        const d = before[i] - after[i];
        if (Math.abs(d) > 2) {
          const par = el.parentElement;
          changed.push({
            cls: (typeof el.className === 'string' ? el.className : '').slice(0, 34),
            id: el.id,
            text: (el.textContent || '').trim().slice(0, 20),
            before: before[i], after: after[i],
            parent: par ? par.tagName + '.' + String(par.className).slice(0, 26) : '',
            parentFlex: par ? getComputedStyle(par).display : '',
            siblings: par ? Array.from(par.children).filter(c => c !== el && c.getBoundingClientRect().width > 0).length : 0,
          });
        }
      });
      return {
        touched, changed,
        doc: { cw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth },
      };
    });

    console.log('视口 ' + WIDTH + 'px | 文档 client=' + diff.doc.cw + ' scroll=' + diff.doc.sw
      + (diff.doc.sw > diff.doc.cw ? '  ⚠ 横向溢出' : '  ✓ 无溢出'));
    console.log('\n命中的全局规则（选择器含裸 button 且设了 width）:');
    if (!diff.touched.length) console.log('   （无）');
    diff.touched.forEach(t => console.log('   [' + t.media + '] ' + t.sel + '  →  width:' + t.width));

    console.log('\n自身没声明 width、被该规则撑大的按钮 ' + diff.changed.length + ' 个:');
    if (!diff.changed.length) console.log('   ✅ 无 —— 全部按钮都已显式声明宽度');
    diff.changed.forEach(c => console.log(
      '   ' + (c.text || '(无文字)').padEnd(20)
      + c.before + 'px → ' + c.after + 'px   '
      + '类=' + c.cls + '  父=' + c.parent + '(' + c.parentFlex + ', 兄弟' + c.siblings + ')'
    ));
    console.log('\n判定提示：父容器是 flex 且存在可见兄弟节点、且按钮自身 CSS 无 width 的，基本就是误伤；');
    console.log('          .add-points-btn / .add-gift-btn 被显式列在全局规则里，属设计意图满宽，保留。');

    process.exitCode = diff.changed.length > 1 ? 1 : 0;   // 只剩已知的设计意图项即为通过
  } finally {
    if (token && !KEEP) {
      const del = await fetch(`${BASE}/api/index.php?action=delete_account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: 'DELETE' }),
      }).then(r => r.json()).catch(e => ({ error: String(e) }));
      console.log('\n临时账号清理:', email, JSON.stringify(del));
    }
    await browser.close();
    fs.rmSync(ud, { recursive: true, force: true });
  }
})();
