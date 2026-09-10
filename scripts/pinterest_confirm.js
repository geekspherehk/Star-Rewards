// 点击 Pinterest 发到智能体邮箱的「Confirm your email」链接，完成邮箱验证
// 用已登录的持久化 profile 打开，验证态会写回同一个会话
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';

const CONFIRM_URL = 'https://www.pinterest.com/email/click/?user_id=MTEyMzE1NTczMTk3ODcyNDM0MQ%3D%3D&od=dD04YThjZjYyOWM0NmQ0OWFjODQ4YTAzNzcwNmM5ZGFjOSZjPVBBUlRORVJfV0VMQ09NRV9WRVJJRklDQVRJT04mcz1Ob25lJm49Tm9uZQ%3D%3D&target=https%3A%2F%2Fwww.pinterest.com%2Fverify%2Fpartner%3Fcode%3Db5bff3c7be3443a4ac2b05b24547a953%26uid%3D1123155731978724341%26u_name%3Dujpu7859%26new%3D1%26utm_campaign%3Dptnremailconfirmwlc%26e_t%3D8a8cf629c46d49ac848a037706c9dac9%26e_t_s%3Dcta%26utm_source%3D31%26utm_medium%3D2010';

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,950'],
  });
  const page = (await browser.pages())[0] || await browser.newPage();
  console.log('[confirm] 打开确认链接…');
  await page.goto(CONFIRM_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  const info = await page.evaluate(() => ({
    url: location.href,
    text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 400),
  }));
  console.log('[confirm] 落地页:', info.url);
  console.log('[confirm] 页面文字:', info.text);
  await page.screenshot({ path: '/tmp/pin-confirm.png' });
  console.log('[confirm] 完成，截图 /tmp/pin-confirm.png');
  await browser.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
