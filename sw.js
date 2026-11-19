'use strict';
const CACHE_NAME = 'cal-pwa-v2.7.0', ASSETS = ['./', './index.html', './style.css', './app.js', './logic.js', './patchnotes.js', './manifest.json', './icon.svg'];
const BYP = ['script.google.com', 'script.googleusercontent.com', 'nominatim.openstreetmap.org', 'api.line.me'];
const DEF_T = 'แจ้งเตือนนัดคิวทำงาน', on = (ev, fn) => self.addEventListener(ev, fn);
const cln = s => String(s || '').replace(/\p{Extended_Pictographic}/gu, '').replace(/[ \t]{2,}/g, ' ').trim();
const putC = (q, r) => (r && r.status === 200 && r.type === 'basic') ? caches.open(CACHE_NAME).then(x => x.put(q, r.clone())).catch(() => {}).then(() => r) : r;
on('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(() => {}).then(() => self.skipWaiting())));
on('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())));
on('fetch', e => { const q = e.request; if (q.method !== 'GET') return; let u; try { u = new URL(q.url); } catch (_) { return; }
  if (u.origin !== self.location.origin || BYP.some(h => u.hostname.includes(h))) return;
  const net = fetch(q).then(r => putC(q, r));
  if (q.mode === 'navigate') { e.respondWith(net.catch(() => caches.match(q).then(c => c || caches.match('./index.html')))); return; }
  e.waitUntil(net.catch(() => {})); e.respondWith(caches.match(q).then(c => c || net)); });
function showSwNotification(title, opts) { const t = cln(title) || DEF_T, o = { body: '', icon: './icon.svg', badge: './icon.svg', vibrate: [180, 80, 180], requireInteraction: false, renotify: true, ...(opts || {}) };
  if (o.body) o.body = cln(o.body);
  return self.registration.showNotification(t, o).catch(() => self.registration.showNotification(t, { body: o.body || '', tag: o.tag, data: o.data })); }
on('push', e => { let p = { title: DEF_T, body: 'มีรายการนัดหมายที่ต้องติดตาม', aptId: '', url: './index.html' };
  if (e.data) try { p = { ...p, ...e.data.json() }; } catch (_) { p.body = e.data.text() || p.body; }
  e.waitUntil(showSwNotification(p.title, { body: p.body, tag: p.tag || 'cal-push-' + (p.aptId || Date.now()), data: { url: p.url || './index.html', aptId: p.aptId || '' } })); });
on('message', e => { const m = e.data; if (!m || typeof m !== 'object') return;
  if (m.type === 'SKIP_WAITING') self.skipWaiting(); else if (m.type === 'SHOW_NOTIFICATION') e.waitUntil(showSwNotification(m.title, m.options)); });
on('notificationclick', e => { e.notification.close(); const d = e.notification.data || {}, u = d.url || './index.html', id = d.aptId || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { c.focus(); if (id) c.postMessage({ type: 'NOTIFICATION_CLICK', aptId: id }); return; }
    if (self.clients.openWindow) return self.clients.openWindow(id ? `${u}#apt=${encodeURIComponent(id)}` : u); })); });
