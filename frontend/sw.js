// Service Worker — 离线缓存
const CACHE = 'data-report-v2.7.1';

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/api.js',
  '/js/app.js',
  '/js/store.js',
  '/js/charts.js',
  '/js/pages/dashboard.js',
  '/js/pages/records.js',
  '/js/pages/entities.js',
  '/js/pages/invoices.js',
  '/js/pages/import.js',
  '/assets/icon-192.png',
  '/assets/icon-180.png',
  '/assets/icon-512.png',
  '/login.html',
  'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js'
];

// 安装：预缓存
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// 激活：清旧缓存
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 拦截请求：缓存优先，API 走网络
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API 请求不走缓存
  if (url.pathname.startsWith('/api/')) return;

  // CDN / 静态资源：缓存优先
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
      return cached || fetched;
    })
  );
});
