// Service Worker 文件
const CACHE_NAME = 'star-rewards-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/style.css',
  '/script.js',
  '/supabase.min.js',
  '/pwa-manager.js',
  '/manifest.json',
  '/mobile-wrapper.html'
];

// 安装Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ 缓存已打开');
        return cache.addAll(urlsToCache);
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
    })
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

        // 克隆请求
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // 检查是否收到有效的响应
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // 克隆响应
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
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
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: '查看详情',
        icon: '/assets/icons/view.png'
      },
      {
        action: 'close',
        title: '关闭',
        icon: '/assets/icons/close.png'
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