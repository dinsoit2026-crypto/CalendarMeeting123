'use strict';

const CACHE_NAME = 'cal-pwa-v2.6.5';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './logic.js',
  './patchnotes.js',
  './manifest.json',
  './icon.svg'
];

const BYPASS_HOSTS = ['script.google.com', 'script.googleusercontent.com', 'nominatim.openstreetmap.org', 'api.line.me'];

function cleanText(s) {
  return String(s || '').replace(/\p{Extended_Pictographic}/gu, '').replace(/[ \t]{2,}/g, ' ').trim();
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin || BYPASS_HOSTS.some(h => url.hostname.includes(h))) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(cached => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

self.addEventListener('push', event => {
  let payload = { title: 'แจ้งเตือนนัดคิวทำงาน', body: 'มีรายการนัดหมายที่ต้องติดตาม', aptId: '', url: './index.html' };
  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch (_) {
      payload.body = event.data.text() || payload.body;
    }
  }
  const title = cleanText(payload.title) || 'แจ้งเตือนนัดคิวทำงาน';
  const options = {
    body: cleanText(payload.body),
    icon: './icon.svg',
    badge: './icon.svg',
    tag: payload.tag || ('cal-push-' + (payload.aptId || Date.now())),
    renotify: true,
    data: { url: payload.url || './index.html', aptId: payload.aptId || '' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('message', event => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (msg.type === 'SHOW_NOTIFICATION') {
    const title = cleanText(msg.title) || 'แจ้งเตือนนัดคิวทำงาน';
    const opts = Object.assign({
      icon: './icon.svg',
      badge: './icon.svg',
      renotify: true
    }, msg.options || {});
    if (opts.body) opts.body = cleanText(opts.body);
    event.waitUntil(self.registration.showNotification(title, opts));
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || './index.html';
  const aptId = data.aptId || '';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (aptId) client.postMessage({ type: 'NOTIFICATION_CLICK', aptId });
          return;
        }
      }
      if (self.clients.openWindow) {
        const openTarget = aptId ? `${targetUrl}#apt=${encodeURIComponent(aptId)}` : targetUrl;
        return self.clients.openWindow(openTarget);
      }
    })
  );
});
