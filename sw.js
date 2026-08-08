// Service Worker 文件
const CACHE_NAME = 'star-rewards-v9';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/style.css',
  '/i18n.css',
  '/script.js?v=8',
  '/login.js',
  '/i18n.js?v=11',
  '/utils.js',
  '/api/api-client.js',
  '/themes.js',
  '/theme-selector.html',
  '/pwa-styles.css',
  '/manifest.json',
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
  const options = {
    body: event.data ? event.data.text() : '您有新的奖励消息！',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: '查看详情'
      },
      {
        action: 'close',
        title: '关闭'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Star Rewards', options)
  );
});

// 通知点击事件
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    // 打开应用
    event.waitUntil(
      clients.openWindow('/')
    );
  }
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