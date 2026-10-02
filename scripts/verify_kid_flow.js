// 孩子端（kid.html）+ 家长端月报（report-section）离线自检。
// 不需要登录、不碰生产：只做三件事
//   A. 静态断言：前端用到的 DOM id / 后端 action 是否真的存在
//   B. 渲染断言：把 script.js 里真实的 renderReport 抽出来，喂假数据看输出
//   C. 真实浏览器：用 puppeteer 打开 kid.html（未带链接），确认页面不炸、给出正确提示
// 用法：node scripts/verify_kid_flow.js [--no-browser]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let fails = 0;
const ok = (name) => console.log('  ✔', name);
const bad = (name, extra) => { fails++; console.log('  ✘', name, extra ? '\n      ' + extra : ''); };

// ── A. 静态断言 ─────────────────────────────────────────────
console.log('== A. 静态断言 ==');
const kidHtml = read('kid.html');
const indexHtml = read('index.html');
const php = read('api/index.php');

// kid.html 里 getElementById('x') 的 id 必须真存在（否则静默 null 就白屏）
const kidIds = [...kidHtml.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
const kidKnown = new Set([
  'app', 'boot', 'bootMsg', 'childName', 'points', 'flowers', 'gifts', 'giftsWrap',
  'say', 'sayBtn', 'msg'
]);
const kidMissing = [...new Set(kidIds)].filter((id) => !kidKnown.has(id));
kidMissing.length === 0
  ? ok('kid.html 引用的 DOM id 都在本地 id 清单里')
  : bad('kid.html 引用了不存在的 id', kidMissing.join(', '));

// kid.html 打的接口必须在后端白名单（kid_token 只能打这几个）
const kidActions = [...new Set([...kidHtml.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))];
const allowed = php.includes("return ['redeem_kid_link', 'kid_status', 'kid_checkin', 'kid_redeem', 'kid_say'];");
allowed ? ok('后端 kid 白名单存在（5 个 action）') : bad('后端 kidAllowedActions 白名单被改坏');

const usedActions = ['redeem_kid_link', 'kid_status', 'kid_checkin', 'kid_redeem', 'kid_say']
  .filter((a) => kidHtml.includes("'" + a + "'"));
usedActions.length === 5 ? ok('kid.html 只打白名单里的 5 个接口') : bad('kid.html 接口对不上白名单', usedActions.join(','));

// 家长端：script.js 里 qs 到的 id 必须 index.html 有
const scriptSrc = read('script.js');
const parentIds = [...new Set([...scriptSrc.matchAll(/getElementById\('(rp-[a-z-]+|ks-[a-z-]+|kid-setup-card|report-section)'\)/g)].map((m) => m[1]))];
const absent = parentIds.filter((id) => !indexHtml.includes('id="' + id + '"'));
absent.length === 0
  ? ok('家长端 ' + parentIds.length + ' 个 DOM id 都在 index.html 里')
  : bad('index.html 缺这些 id', absent.join(', '));

// 月度迁移 SQL 必须建 kid_links 表 + users.kid_token_version
const sql = read('database/kid_link_migration.sql');
/KID_LINK`?|CREATE TABLE.*kid_links|kid_links/is.test(sql) && /kid_token_version/is.test(sql)
  ? ok('数据库迁移含 kid_links 与 kid_token_version')
  : bad('database/kid_link_migration.sql 内容不完整');

// ── B. 渲染断言：真抽 renderReport 跑假数据 ─────────────────
console.log('== B. renderReport 离线渲染 ==');
const start = scriptSrc.indexOf('const RP_WD');
const end = scriptSrc.indexOf('async function loadReport');
if (start < 0 || end < 0) {
  bad('抽不到 renderReport 源码');
} else {
  const els = {};
  const mk = (id) => (els[id] = els[id] || { id, innerHTML: '', textContent: '', style: {}, hidden: false });
  global.window = {};
  global.document = { getElementById: (id) => mk(id) };
  // eslint-disable-next-line no-eval
  eval(scriptSrc.slice(start, end));

  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const fake = {
    success: true,
    month: ym,
    total_checkins: 7,
    active_days: 4,
    days: [{ date: ym + '-03', count: 2 }, { date: ym + '-11', count: 1 }],
    wishes: [
      { id: 1, title: '自己穿鞋', internalized: true, streak_now: 21 },
      { id: 2, title: '收书包', internalized: false, streak_now: 3 }
    ],
    redeemed: [{ id: 9, name: '去公园', points: 40 }],
    voice: [{ content: '我今天好开心', recorded_on: ym + '-11' }]
  };
  renderReport(fake);

  // 契约：本月不再画日历（首页打卡区已经是整月），翻到历史月才补这一格格
  els['rp-cal'] && els['rp-cal'].hidden === true
    ? ok('本月：月历不重复出现（首页已有整月月历）')
    : bad('本月仍画了月历，跟首页打卡区重复');

  // 翻到上个月：日历该出来
  const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ymPrev = pm.getFullYear() + '-' + String(pm.getMonth() + 1).padStart(2, '0');
  renderReport(Object.assign({}, fake, {
    month: ymPrev,
    days: [{ date: ymPrev + '-03', count: 2 }, { date: ymPrev + '-11', count: 1 }],
    redeemed: [{ id: 9, name: '去公园', points: 40 }],
    voice: [{ content: '我今天好开心', recorded_on: ymPrev + '-11' }]
  }));
  const lastDay = new Date(Number(ymPrev.slice(0, 4)), Number(ymPrev.slice(5, 7)), 0).getDate();
  const firstDow = new Date(ymPrev + '-01T00:00:00').getDay();
  const cal = els['rp-cal'] ? els['rp-cal'].innerHTML : '';
  const cells = (cal.match(/rp-day/g) || []).length;
  cells === lastDay + firstDow
    ? ok('历史月：月历格数 ' + cells + '（' + lastDay + ' 天 + ' + firstDow + ' 空位）')
    : bad('月历格数不对', '期望 ' + (lastDay + firstDow) + ' 实际 ' + cells);

  const onCount = (cal.match(/rp-day on/g) || []).length;
  onCount === 2 ? ok('有星星的两天被点亮') : bad('点亮天数不对', '实际 ' + onCount);
  /<b>3<\/b>/.test(cal) && /<b>11<\/b>/.test(cal) ? ok('日期数字渲染正常') : bad('日期数字缺失');
  /×2/.test(cal) ? ok('同一天按两次显示 ×2') : bad('×2 倍角标缺失');

  const stats = els['rp-stats'] ? els['rp-stats'].innerHTML : '';
  /自己按了/.test(stats) && /有星星的天/.test(stats) && /换走的东西/.test(stats)
    ? ok('月报三块数字都在')
    : bad('月报数字块缺失', stats.slice(0, 120));
  /<b>7<\/b>/.test(stats) ? ok('总次数 7 正确') : bad('总次数渲染不对', stats.slice(0, 120));

  const wishHtml = els['rp-wishes'] ? els['rp-wishes'].innerHTML : '';
  /已经会了/.test(wishHtml) ? ok('连续达标显示「已经会了」') : bad('内化标签缺失');
  /连着 3 天/.test(wishHtml) ? ok('未达标显示当前连续天数') : bad('连续天数标签缺失');
  /自己穿鞋/.test(wishHtml) ? ok('目标名渲染正常') : bad('目标名缺失');

  const redeemHtml = els['rp-redeemed'] ? els['rp-redeemed'].innerHTML : '';
  /去公园/.test(redeemHtml) && /-40/.test(redeemHtml) ? ok('兑换记录渲染正常') : bad('兑换记录渲染不对');
  /<b>1<\/b>/.test(stats) ? ok('「换走的东西」计数 1') : bad('兑换计数不对');

  const voiceHtml = els['rp-voice'] ? els['rp-voice'].innerHTML : '';
  /我今天好开心/.test(voiceHtml) ? ok('娃的原话渲染正常') : bad('原话缺失');

  // 空月：不该报错，且给一句人话
  renderReport({ success: true, month: ym, total_checkins: 0, active_days: 0, days: [], wishes: [], redeemed: [], voice: [] });
  const emptyTxt = els['rp-empty'] ? els['rp-empty'].textContent : '';
  /还没/.test(emptyTxt) ? ok('空月提示：' + emptyTxt) : bad('空月无提示');

  // XSS：原话必须被转义
  renderReport({
    success: true, month: ym, total_checkins: 1, active_days: 1,
    days: [], wishes: [{ title: '<img src=x onerror=alert(1)>', internalized: true, streak_now: 1 }],
    redeemed: [], voice: [{ content: '<script>alert(2)<\/script>', recorded_on: ym + '-01' }]
  });
  const escHtml = els['rp-wishes'].innerHTML + els['rp-voice'].innerHTML;
  !/<img src=x/.test(escHtml) && !/<script>alert/.test(escHtml) && /&lt;img/.test(escHtml)
    ? ok('用户内容已转义')
    : bad('存在未转义的用户内容', escHtml.slice(0, 160));
}

// ── D. 后端合同（纯静态，不连库）─────────────────────────────
console.log('== D. 后端合同 ==');
const fn = (name) => {
    const i = php.indexOf('function ' + name + '(');
    if (i < 0) return null;
    // 从函数体开头扫到下一个顶层 "function "（列 0）
    const j = php.indexOf('\nfunction ', i + 10);
    return php.slice(i, j < 0 ? php.length : j);
};

const whitelist = fn('kidAllowedActions') || '';
/\['redeem_kid_link', 'kid_status', 'kid_checkin', 'kid_redeem', 'kid_say'\]/.test(whitelist)
    ? ok('孩子端白名单 = 5 个 action，家长接口全在门外')
    : bad('白名单被改过');

const requireKid = fn('requireKid') || '';
/empty\(\$payload\['kid'\]\)/.test(requireKid) && /Not a kid token/.test(requireKid)
    ? ok('家长 token 拿孩子接口 → 403')
    : bad('requireKid 没有 kid 标记校验');
/kid_token_version'\] !== \$ver/.test(requireKid)
    ? ok('version 不匹配即失效（重新生成 → 旧平板当场打不开）')
    : bad('缺少 kid_token_version 校验');
/SELECT id, family_id FROM profiles WHERE id = \? AND user_id = \?/.test(requireKid)
    ? ok('token 里的 profile 必须属于该用户（不能拿别人家的孩子）')
    : bad('profile 归属校验缺失');

const say = fn('handleKidSay') || '';
/INSERT INTO child_voice/.test(say) && !/current_points|total_points|checkin_points/.test(say)
    ? ok('「说一句」只进 child_voice，不带分（娃不能靠说话刷星）')
    : bad('「说一句」动了积分');

const redeem = fn('handleRedeemKidLink') || '';
/status = 'consumed'/.test(redeem) && /status = 'active'/.test(redeem)
    ? ok('长链接一次性：换完即 consumed，二次打开 403')
    : bad('长链接没有一次性作废');
/KID_TOKEN_TTL/.test(redeem) && /'kid' => 1/.test(redeem)
    ? ok('换出的是 kid token（低权限、实质不过期）')
    : bad('签发的不是 kid token');

const setup = fn('handleSetupKidLink') || '';
/kid_token_version \+ 1/.test(setup) && /status = 'revoked'/.test(setup)
    ? ok('重新生成 = 旧票作废 + version+1（双保险）')
    : bad('重新生成的作废旧票逻辑不完整');

const checkin = fn('addCheckinFor') || '';
/== 1062/.test(checkin) && /Already checked in today/.test(checkin)
    ? ok('一天一亮靠唯一键冲突（同一愿望同一天 409）')
    : bad('重复打卡没有唯一键兜底');

const guard = fn('handleMonthlyReport') || '';
/requireFamilyMember/.test(guard) && guard.includes("preg_match('/^\\d{4}-\\d{2}$/'")
    ? ok('月报只给本家庭成员看，且月份格式被校验')
    : bad('月报权限/月份校验不完整');

// ── C. 真实浏览器开 kid.html（未带链接）─────────────────────
if (!process.argv.includes('--no-browser')) {
  console.log('== C. 浏览器实开 kid.html ==');
  (async () => {
    try {
      const puppeteer = require(path.join(
        process.env.HOME, '.workbuddy/binaries/node/workspace/node_modules/puppeteer-core'));
      const chromeDir = require('child_process')
        .execSync('ls -d "$HOME/Applications/Google Chrome.app" "$HOME/.cache/puppeteer" 2>/dev/null || true',
          { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean);
      const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: 'new',
        args: ['--no-sandbox', '--allow-file-access-from-files'],
      });
      console.log('  （Chrome: ' + (chromeDir.length ? 'found' : '/Applications fallback') + '）');
      const page = await browser.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      await page.goto('file://' + path.join(ROOT, 'kid.html'), { waitUntil: 'networkidle0' });
      const msg = await page.$eval('#bootMsg', (el) => el.textContent.trim()).catch(() => '');
      const shown = await page.$eval('#boot', (el) => !el.hidden);
      errs.length === 0 ? ok('kid.html 无 JS 报错') : bad('kid.html 有 JS 报错', errs.join(' | '));
      msg.includes('大人') ? ok('未带链接时给出正确提示：' + msg) : bad('未带链接提示不对', msg || '(空)');
      shown ? ok('兜底页可见（不是白屏）') : bad('兜底页被隐藏');
      await browser.close();
    } catch (e) {
      bad('puppeteer 环节失败', String(e.message || e));
    }
    console.log(fails === 0 ? '\n✔ 全部通过' : '\n✘ ' + fails + ' 项未通过');
    process.exit(fails === 0 ? 0 : 1);
  })();
} else {
  console.log(fails === 0 ? '\n✔ 全部通过（跳过浏览器）' : '\n✘ ' + fails + ' 项未通过');
  process.exit(fails === 0 ? 0 : 1);
}
