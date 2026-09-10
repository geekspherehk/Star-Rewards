// Pinterest Pin 生成器：按模板渲染 1000x1500 (2:3) 竖版图
// 用法: node scripts/generate_pins.js [输出目录]
//
// 内容策略：同一个落地页配多张「不同钩子」的 Pin —— Pinterest 官方鼓励这种做法，
// 不同创意能覆盖不同搜索词，且不会互相冲突。每张 Pin 归入对应画板。
// 重新生成时会保留 pins.json 里已有的 posted 标记（避免重复发布）。
const fs = require('fs');
const path = require('path');
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const OUT = process.argv[2] || path.join(__dirname, '..', 'assets', 'pins');
fs.mkdirSync(OUT, { recursive: true });

// 每个指南页 3 个变体（A/B/C），不同钩子 + 不同配色
const PINS = [
  // 1. Points chart
  { slug: 'kids-points-chart', tag: 'KIDS POINTS CHART', title: 'Build a Points Chart\nThat Actually Works',
    sub: 'A complete parent guide — set it up right in 5 steps',
    url: 'https://stellar.gaocaihk.com/kids-points-chart-guide-en.html', board: 'Kids Reward Chart Ideas', c1: '#6C5CE7', c2: '#4B3BC4' },
  { slug: 'kids-points-chart-b', tag: 'WHY CHARTS FAIL', title: 'Points Chart\nNot Working?',
    sub: '3 mistakes parents make — and the fix for each',
    url: 'https://stellar.gaocaihk.com/kids-points-chart-guide-en.html', board: 'Kids Reward Chart Ideas', c1: '#5B7CFA', c2: '#3350C9' },
  { slug: 'kids-points-chart-c', tag: 'START TONIGHT', title: 'Points Chart\nin 5 Steps',
    sub: 'No apps, no printing — just a chart and a marker',
    url: 'https://stellar.gaocaihk.com/kids-points-chart-guide-en.html', board: 'Kids Reward Chart Ideas', c1: '#8B6CE7', c2: '#5A3BC4' },

  // 2. Star chart
  { slug: 'star-chart', tag: 'FREE TEMPLATE', title: 'How to Make\na Star Chart for Kids',
    sub: 'Step-by-step, with free online templates',
    url: 'https://stellar.gaocaihk.com/star-chart-guide-en.html', board: 'Star Chart for Kids', c1: '#6FC6F5', c2: '#2F86D6' },
  { slug: 'star-chart-b', tag: 'PRINT & GO', title: 'Free Printable\nStar Chart',
    sub: 'Print it tonight, start tomorrow morning',
    url: 'https://stellar.gaocaihk.com/star-chart-guide-en.html', board: 'Star Chart for Kids', c1: '#4FB8EC', c2: '#1D6FB8' },
  { slug: 'star-chart-c', tag: 'AGES 3-10', title: 'Star Charts\nby Age',
    sub: 'What actually works at each stage',
    url: 'https://stellar.gaocaihk.com/star-chart-guide-en.html', board: 'Star Chart for Kids', c1: '#7ED0F0', c2: '#3A90CE' },

  // 3. Habit building
  { slug: 'habit-building', tag: 'HABIT SCIENCE', title: 'Why Points Systems\nBuild Real Habits',
    sub: 'The behavioral science + a 6-step setup',
    url: 'https://stellar.gaocaihk.com/habit-building-guide-en.html', board: 'Habit Building for Children', c1: '#7CD992', c2: '#2FA35A' },
  { slug: 'habit-building-b', tag: 'THE 21-DAY MYTH', title: 'Habits Don\u2019t\nTake 21 Days',
    sub: 'What really makes a habit stick in kids',
    url: 'https://stellar.gaocaihk.com/habit-building-guide-en.html', board: 'Habit Building for Children', c1: '#6FCF8A', c2: '#278C4E' },
  { slug: 'habit-building-c', tag: 'TIMING MATTERS', title: 'Reward Now\nor Later?',
    sub: 'The timing rule that makes habits stick',
    url: 'https://stellar.gaocaihk.com/habit-building-guide-en.html', board: 'Habit Building for Children', c1: '#8CDD9C', c2: '#37A863' },

  // 4. Chore vs points
  { slug: 'chore-vs-points', tag: 'CHORE CHART VS POINTS', title: 'Chore Chart or\nPoints System?',
    sub: 'They are not the same — pick the right one',
    url: 'https://stellar.gaocaihk.com/chore-chart-guide-en.html', board: 'Chore Chart & Responsibility', c1: '#F5A524', c2: '#E08A2B' },
  { slug: 'chore-vs-points-b', tag: 'PAID CHORES?', title: 'Should Kids Be Paid\nfor Chores?',
    sub: 'The answer most parents don\u2019t expect',
    url: 'https://stellar.gaocaihk.com/chore-chart-guide-en.html', board: 'Chore Chart & Responsibility', c1: '#F2B03C', c2: '#D07A1E' },
  { slug: 'chore-vs-points-c', tag: 'CHORES BY AGE', title: 'Chores a 5-Year-Old\nCan Really Do',
    sub: 'A realistic list, age by age',
    url: 'https://stellar.gaocaihk.com/chore-chart-guide-en.html', board: 'Chore Chart & Responsibility', c1: '#F8BC55', c2: '#C97F16' },

  // 5. Reward ideas
  { slug: 'reward-ideas', tag: '30+ IDEAS', title: 'Reward Ideas for Kids\nby Age Group',
    sub: 'Low-cost, high-appeal rewards (3-5 / 6-9 / 10+)',
    url: 'https://stellar.gaocaihk.com/reward-ideas-en.html', board: 'Parenting Reward Ideas', c1: '#FF8FA8', c2: '#E64C6B' },
  { slug: 'reward-ideas-b', tag: 'ZERO COST', title: '30 Rewards That\nCost Nothing',
    sub: 'Free rewards kids actually want',
    url: 'https://stellar.gaocaihk.com/reward-ideas-en.html', board: 'Parenting Reward Ideas', c1: '#FF9DB4', c2: '#D9425F' },
  { slug: 'reward-ideas-c', tag: 'STOP BUYING', title: 'Stop Buying\nRewards',
    sub: 'Experience rewards that work better',
    url: 'https://stellar.gaocaihk.com/reward-ideas-en.html', board: 'Parenting Reward Ideas', c1: '#F98BA6', c2: '#C93C58' },

  // 6. Behavior templates
  { slug: 'behavior-templates', tag: '73 READY-TO-USE', title: 'Behavior Reward\nTemplates',
    sub: 'Copy 73 point entries straight into your chart',
    url: 'https://stellar.gaocaihk.com/behavior-templates-en.html', board: 'Kids Reward Chart Ideas', c1: '#8B7BFF', c2: '#5B46E5' },
  { slug: 'behavior-templates-b', tag: 'STOP GUESSING', title: 'What Should\nYou Reward?',
    sub: '73 ready-made entries, sorted by category',
    url: 'https://stellar.gaocaihk.com/behavior-templates-en.html', board: 'Kids Reward Chart Ideas', c1: '#9A8CFF', c2: '#6350E8' },
  { slug: 'behavior-templates-c', tag: 'COPY & PASTE', title: 'The Behaviour List\nEvery Chart Needs',
    sub: 'Copy these 73 entries tonight',
    url: 'https://stellar.gaocaihk.com/behavior-templates-en.html', board: 'Kids Reward Chart Ideas', c1: '#8070FF', c2: '#4E3BD8' },
];

function html(p) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1000px; height:1500px; overflow:hidden;
    font-family:'Helvetica Neue',Arial,sans-serif; -webkit-font-smoothing:antialiased; }
  .pin { width:1000px; height:1500px; position:relative; color:#fff;
    background:linear-gradient(150deg, ${p.c1} 0%, ${p.c2} 100%);
    display:flex; flex-direction:column; padding:88px 76px 76px; }
  .brand { font-size:26px; letter-spacing:5px; font-weight:700; opacity:.95; }
  .rule { width:96px; height:6px; background:rgba(255,255,255,.85); border-radius:3px; margin:26px 0 40px; }
  .tag { display:inline-block; align-self:flex-start; font-size:24px; font-weight:700;
    letter-spacing:1.6px; padding:12px 24px; border-radius:34px;
    background:rgba(255,255,255,.18); border:2px solid rgba(255,255,255,.5); margin-bottom:44px; }
  .title { font-size:88px; line-height:1.14; font-weight:800; letter-spacing:-1.5px; white-space:pre-line; }
  .sub { margin-top:38px; font-size:36px; line-height:1.5; font-weight:500; opacity:.95; max-width:760px; }
  .spacer { flex:1; }
  .foot { border-top:2px solid rgba(255,255,255,.35); padding-top:32px; }
  .cta { font-size:38px; font-weight:700; margin-bottom:10px; }
  .dom { font-size:26px; opacity:.9; letter-spacing:.5px; }
  .blob { position:absolute; border-radius:50%; background:rgba(255,255,255,.10); }
  .b1 { width:420px; height:420px; right:-120px; top:180px; }
  .b2 { width:260px; height:260px; right:60px; bottom:260px; background:rgba(255,255,255,.08); }
  </style></head><body>
  <div class="pin">
    <div class="blob b1"></div><div class="blob b2"></div>
    <div class="brand">STAR REWARDS</div>
    <div class="rule"></div>
    <div class="tag">${p.tag}</div>
    <div class="title">${p.title}</div>
    <div class="sub">${p.sub}</div>
    <div class="spacer"></div>
    <div class="foot">
      <div class="cta">Read the free guide →</div>
      <div class="dom">stellar.gaocaihk.com</div>
    </div>
  </div></body></html>`;
}

// 保留已有 pins.json 里的 posted 标记（按 file 路径匹配），避免重复发布
function loadPostedMap() {
  const map = new Map();
  try {
    const old = JSON.parse(fs.readFileSync(path.join(OUT, 'pins.json'), 'utf8'));
    old.forEach(o => { if (o.posted) map.set(o.file, o.posted_at || true); });
  } catch (e) {}
  return map;
}

(async () => {
  const postedMap = loadPostedMap();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox','--font-render-hinting=none'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1500, deviceScaleFactor: 1 });
  const manifest = [];
  for (const p of PINS) {
    const f = path.join(OUT, `pin-${p.slug}.png`);
    await page.setContent(html(p), { waitUntil: 'load' });
    await page.screenshot({ path: f });
    const entry = {
      file: f,
      title: p.title.replace(/\n/g, ' '),
      pin_title: `${p.title.split('\n')[0]} | Star Rewards`,
      description: `${p.sub} Free guide from Star Rewards.`,
      url: p.url,
      board: p.board,
    };
    if (postedMap.has(f)) { entry.posted = true; entry.posted_at = postedMap.get(f); }
    manifest.push(entry);
    console.log('OK', f);
  }
  fs.writeFileSync(path.join(OUT, 'pins.json'), JSON.stringify(manifest, null, 2));
  const csv = ['file,title,description,link,board'];
  manifest.forEach(m => csv.push([m.file, `"${m.pin_title}"`, `"${m.description}"`, m.url, m.board].join(',')));
  fs.writeFileSync(path.join(OUT, 'pins.csv'), csv.join('\n'));
  const done = manifest.filter(m => m.posted).length;
  console.log('DONE ->', OUT, '| total=', manifest.length, '| 已发布=', done, '| 待发=', manifest.length - done);
  await browser.close();
})().catch(e => { console.error('PIN ERROR:', e.message); process.exit(1); });
