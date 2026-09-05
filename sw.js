// Service Worker 文件
const CACHE_NAME = 'star-rewards-v109';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/style.css?v=68',
  '/script.js?v=95',
  '/poster-bg.png?v=2',
  '/qrcode-generator.js?v=1',
  '/login.js?v=9',
  '/i18n.js?v=70',
  '/utils.js?v=1',
  '/api/api-client.js?v=27',
  '/themes.js?v=1',
  '/theme-selector.html',
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
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 缓存命中 - 返回响应
        if (response) {
          return response;
        }
        
        // 缓存未命中 - 尝试从网络获取
        return fetch(event.request).catch(error => {
          console.log('❌ 网络请求失败:', error);
          // 如果是HTML页面，返回首页
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/');
          }
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