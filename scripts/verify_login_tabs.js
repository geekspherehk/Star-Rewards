#!/usr/bin/env node
/* login 页 tab 场景离线验证（file:// 加载，不起服务器） */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const LOGIN = 'file://' + path.resolve(__dirname, '..', 'login.html');

async function activeTab(page) {
  return page.evaluate(() => {
    const active = document.querySelector('.auth-tab.active');
    const visible = ['login-form', 'register-form', 'forgot-form', 'reset-form']
      .find(id => { const el = document.getElementById(id); return el && el.style.display !== 'none'; });
    return { tab: active ? active.dataset.form : null, form: visible || null };
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    userDataDir: '/tmp/sr_login_tab_' + Date.now(),
    args: ['--no-first-run', '--disable-extensions'],
  });
  const cases = [
    ['无参数（默认）', 'login.html', { tab: 'login', form: 'login-form' }],
    ['?mode=login', 'login.html?mode=login', { tab: 'login', form: 'login-form' }],
    ['?mode=register', 'login.html?mode=register', { tab: 'register', form: 'register-form' }],
    ['?invite=AB12CD（默认注册）', 'login.html?invite=AB12CD', { tab: 'register', form: 'register-form' }],
    ['?invite=AB12CD&mode=login（mode 优先）', 'login.html?invite=AB12CD&mode=login', { tab: 'login', form: 'login-form' }],
    ['?reset=TOKEN（深链优先）', 'login.html?reset=TOKEN123', { tab: null, form: 'reset-form' }],
    ['?verify=TOKEN（不切 tab，登录页提示结果）', 'login.html?verify=TOKEN123', { tab: 'login', form: 'login-form' }],
  ];
  let fail = 0;
  for (const [name, url, expect] of cases) {
    const page = await browser.newPage();
    await page.goto(LOGIN + (url.includes('?') ? url.slice('login.html'.length) : ''), { waitUntil: 'networkidle0', timeout: 15000 }).catch(e => console.log('  (加载警告:', e.message.slice(0, 60) + ')'));
    await new Promise(r => setTimeout(r, 400));
    const got = await activeTab(page);
    const ok = got.tab === expect.tab && got.form === expect.form;
    if (!ok) fail++;
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} → tab=${got.tab} form=${got.form}（期望 ${expect.tab}/${expect.form}）`);
    await page.close();
  }
  await browser.close();
  console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
  process.exit(fail ? 1 : 0);
})();
