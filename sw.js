'use strict';
const CACHE_NAME = 'cal-pwa-v2.6.8';
const ASSETS = ['./', './index.html', './style.css', './app.js', './logic.js', './patchnotes.js', './manifest.json', './icon.svg'];
const BYPASS_HOSTS = ['script.google.com', 'script.googleusercontent.com', 'nominatim.openstreetmap.org', 'api.line.me'];
const cleanText = s => String(s || '').replace(/\p{Extended_Pictographic}/gu, '').replace(/[ \t]{2,}/g, ' ').trim();
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(() => {}).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return; let url; try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin || BYPASS_HOSTS.some(h => url.hostname.includes(h))) return;
  e.respondWith(fetch(req).then(res => { if (res && res.status === 200 && res.type === 'basic') { const cl = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, cl)).catch(() => {}); } return res; })
    .catch(() => caches.match(req).then(c => c || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
function showSwNotification(title, opts) {
  const safeTitle = cleanText(title) || 'แจ้งเตือนนัดคิวทำงาน';
  const safeOpts = Object.assign({ body: '', icon: './icon.svg', badge: './icon.svg', vibrate: [180, 80, 180], requireInteraction: false, renotify: true }, opts || {});
  if (safeOpts.body) safeOpts.body = cleanText(safeOpts.body);
  return self.registration.showNotification(safeTitle, safeOpts).catch(() =>
    self.registration.showNotification(safeTitle, { body: safeOpts.body || '', tag: safeOpts.tag, data: safeOpts.data }));
}
self.addEventListener('push', e => {
  let p = { title: 'แจ้งเตือนนัดคิวทำงาน', body: 'มีรายการนัดหมายที่ต้องติดตาม', aptId: '', url: './index.html' };
  if (e.data) try { p = { ...p, ...e.data.json() }; } catch (_) { p.body = e.data.text() || p.body; }
  e.waitUntil(showSwNotification(p.title, { body: p.body, tag: p.tag || ('cal-push-' + (p.aptId || Date.now())), data: { url: p.url || './index.html', aptId: p.aptId || '' } }));
});
self.addEventListener('message', e => {
  const m = e.data; if (!m || typeof m !== 'object') return;
  if (m.type === 'SKIP_WAITING') self.skipWaiting();
  else if (m.type === 'SHOW_NOTIFICATION') e.waitUntil(showSwNotification(m.title, m.options));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const d = e.notification.data || {}, targetUrl = d.url || './index.html', aptId = d.aptId || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { c.focus(); if (aptId) c.postMessage({ type: 'NOTIFICATION_CLICK', aptId }); return; }
    if (self.clients.openWindow) return self.clients.openWindow(aptId ? `${targetUrl}#apt=${encodeURIComponent(aptId)}` : targetUrl);
  }));
});
