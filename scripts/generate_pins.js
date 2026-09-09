// Pinterest Pin 生成器：按模板渲染 1000x1500 (2:3) 竖版图
// 用法: node scripts/generate_pins.js [输出目录]
const fs = require('fs');
const path = require('path');
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const OUT = process.argv[2] || path.join(__dirname, '..', 'assets', 'pins');
fs.mkdirSync(OUT, { recursive: true });

// Pin 数据：每篇英文指南对应 1 张主 Pin（tag/标题/副标题/落地链接/配色）
const PINS = [
  {
    slug: 'kids-points-chart',
    tag: 'KIDS POINTS CHART',
    title: 'Build a Points Chart\nThat Actually Works',
    sub: 'A complete parent guide — set it up right in 5 steps',
    url: 'https://stellar.gaocaihk.com/kids-points-chart-guide-en.html',
    c1: '#6C5CE7', c2: '#4B3BC4'
  },
  {
    slug: 'star-chart',
    tag: 'FREE TEMPLATE',
    title: 'How to Make\na Star Chart for Kids',
    sub: 'Step-by-step, with free online templates',
    url: 'https://stellar.gaocaihk.com/star-chart-guide-en.html',
    c1: '#6FC6F5', c2: '#2F86D6'
  },
  {
    slug: 'habit-building',
    tag: 'HABIT SCIENCE',
    title: 'Why Points Systems\nBuild Real Habits',
    sub: 'The behavioral science + a 6-step setup',
    url: 'https://stellar.gaocaihk.com/habit-building-guide-en.html',
    c1: '#7CD992', c2: '#2FA35A'
  },
  {
    slug: 'chore-vs-points',
    tag: 'CHORE CHART VS POINTS',
    title: 'Chore Chart or\nPoints System?',
    sub: 'They are not the same — pick the right one',
    url: 'https://stellar.gaocaihk.com/chore-chart-guide-en.html',
    c1: '#F5A524', c2: '#E08A2B'
  },
  {
    slug: 'reward-ideas',
    tag: '30+ IDEAS',
    title: 'Reward Ideas for Kids\nby Age Group',
    sub: 'Low-cost, high-appeal rewards (3-5 / 6-9 / 10+)',
    url: 'https://stellar.gaocaihk.com/reward-ideas-en.html',
    c1: '#FF8FA8', c2: '#E64C6B'
  },
  {
    slug: 'behavior-templates',
    tag: '73 READY-TO-USE',
    title: 'Behavior Reward\nTemplates',
    sub: 'Copy 73 point entries straight into your chart',
    url: 'https://stellar.gaocaihk.com/behavior-templates-en.html',
    c1: '#8B7BFF', c2: '#5B46E5'
  }
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

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox','--font-render-hinting=none'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1500, deviceScaleFactor: 1 });
  const manifest = [];
  for (const p of PINS) {
    const f = path.join(OUT, `pin-${p.slug}.png`);
    await page.setContent(html(p), { waitUntil: 'load' });
    await page.screenshot({ path: f });
    manifest.push({ file: f, title: p.title.replace(/\n/g, ' '), pin_title: `${p.title.split('\n')[0]} | Star Rewards`, description: `${p.sub} Free guide from Star Rewards.`, url: p.url, board: 'Kids Reward Chart Ideas' });
    console.log('OK', f);
  }
  fs.writeFileSync(path.join(OUT, 'pins.json'), JSON.stringify(manifest, null, 2));
  // 同时输出一份 CSV 便于上传/排程
  const csv = ['file,title,description,link,board'];
  manifest.forEach(m => csv.push([m.file, `"${m.pin_title}"`, `"${m.description}"`, m.url, m.board].join(',')));
  fs.writeFileSync(path.join(OUT, 'pins.csv'), csv.join('\n'));
  console.log('DONE ->', OUT, '| count=', manifest.length);
  await browser.close();
})().catch(e => { console.error('PIN ERROR:', e.message); process.exit(1); });
