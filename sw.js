// Service Worker 文件
const CACHE_NAME = 'star-rewards-v179';
const urlsToCache = [
  '/',
  '/index.html',
  '/landing.html',
  '/assets/hero-illustration.jpg',
  '/assets/flower-card.png',
  '/assets/flower-card-en.png',
  '/assets/flower-closeup-en.png',
  '/assets/shot-calendar-en.png',
  '/assets/flower-closeup.png',
  '/assets/shot-calendar.png',
  '/assets/weekly/weekly-bg-c.png?v=1',
  '/assets/weekly/icon-cat-self_drive.png?v=1',
  '/assets/weekly/icon-cat-money.png?v=1',
  '/assets/weekly/icon-cat-empathy.png?v=1',
  '/assets/weekly/icon-cat-relationship.png?v=1',
  '/assets/weekly/icon-cat-planning.png?v=1',
  '/assets/weekly/icon-cat-resilience.png?v=1',
  '/assets/weekly/icon-cat-health.png?v=1',
  '/assets/weekly/icon-cat-aesthetics.png?v=1',
  // 孩子端大花页的花卡贴纸（不用 emoji：刷牙 🪥 是 Unicode 13，老 Android 出豆腐块）
  '/assets/weekly/icon-brush.png?v=1',
  '/assets/weekly/icon-bag.png?v=1',
  '/assets/weekly/icon-water.png?v=1',
  '/assets/weekly/icon-moon.png?v=1',
  '/assets/weekly/icon-ball.png?v=1',
  '/assets/weekly/icon-book.png?v=1',
  '/assets/weekly/icon-heart.png?v=1',
  '/assets/weekly/icon-plant.png?v=1',
  '/manifest-kid.json',
  '/login.html',
  '/style.css?v=109',
  '/script.js?v=124',
  '/poster-bg.png?v=2',
  '/qrcode-generator.js?v=1',
  '/login.js?v=16',
  '/i18n.js?v=92',
  '/utils.js?v=1',
  '/api/api-client.js?v=33',
  '/themes.js?v=1',
  '/theme-selector.html',
  '/kid.html',
  // 注意：'/manifest-kid.json' 上面已经列过一次，cache.addAll 遇重复 request 会整体 reject，不能留两份
  '/assets/kid-icon-192.png',
  '/assets/kid-icon-512.png',
  '/pwa-styles.css?v=1',
  '/manifest.json',
  '/placeholder.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/chart.min.js?v=2'
];

// 安装Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ 缓存已打开');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
      .catch(error => {
        console.log('⚠️ 缓存部分资源失败:', error);
        // 继续安装，即使某些资源无法缓存
      })
  );
});

// 激活Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ 删除旧缓存');
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 拦截网络请求
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // POST（提交奖励/打卡）绝不碰缓存，也不做 respondWith，直接走网络
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isHtml = req.mode === 'navigate' || accept.includes('text/html');

  // 页面一律 network-first：孩子平板装完一次之后，家长改的代码还得看得见，
  // 否则娃那边永远停在装那一刻的旧页面（以前踩过 cache-first 的坑）。
  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          try {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone())).catch(() => {});
          } catch (e) { /* 缓存失败不影响页面本身 */ }
          return res;
        })
        // 离线兜底：先还自己，再还孩子端；只有孩子端也没缓存才退首页。
        // 以前无脑兜 '/' —— 娃从桌面图标点开一断网就看到家长端登录页，家长以为「装坏了」。
        .catch(() => caches.match(req)
          .then((r) => r || caches.match('/kid.html') || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(req)
      .then((response) => {
        // 缓存命中 - 返回响应
        if (response) {
          return response;
        }
        // 缓存未命中 - 尝试从网络获取
        return fetch(req).catch(error => {
          console.log('❌ 网络请求失败:', error);
        });
      })
  );
});

// 后台同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

// 推送通知
self.addEventListener('push', (event) => {
  let title = 'Star Rewards';
  let body = '您有新的奖励消息！';
  let url = '/';
  try {
    if (event.data) {
      const payload = event.data.json();
      if (payload && typeof payload === 'object') {
        if (payload.title) title = payload.title;
        if (payload.body) body = payload.body;
        if (payload.url) url = payload.url;
      }
    }
  } catch (e) { /* 非 JSON 时用默认文案 */ }
  const options = {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-maskable-192.png',
    vibrate: [200, 100, 200],
    data: { url: url }
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 通知点击事件
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) { client.focus(); return; }
      }
      return clients.openWindow(url);
    })
  );
});

// 数据同步函数
async function syncData() {
  try {
    console.log('🔄 正在同步数据...');
    // 这里可以添加数据同步逻辑
    // 例如：同步离线时记录的积分数据
    return Promise.resolve();
  } catch (error) {
    console.error('❌ 数据同步失败:', error);
    return Promise.reject(error);
  }
}