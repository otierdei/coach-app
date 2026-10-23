/* Offline cache for the app shell. Data requests (Apps Script) always go to the network;
   the app itself keeps the last data in localStorage, so it opens offline with the last state. */
const CACHE = "coach-v4";

/* Push from the coach push worker. Every push must show a notification, otherwise Safari may revoke the permission. */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {body: e.data ? e.data.text() : ""}; }
  const title = d.title || "Coach";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "", tag: d.tag || undefined, data: {url: d.url || "./"},
    icon: "icons/icon-192.png", badge: "icons/icon-192.png"
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(cs => {
    for (const c of cs) { if (c.url.startsWith(self.registration.scope)) { c.focus(); if (c.navigate && target !== c.url) c.navigate(target); return; } }
    return self.clients.openWindow(target);
  }));
});
const SHELL = ["./", "index.html", "styles.css", "theme.css", "api.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (/script\.google(usercontent)?\.com$/.test(u.hostname) || /claude\.ai$/.test(u.hostname)) return;
  if (u.origin === location.origin) {
    // network first for the app files, revalidated with the server (no 10 min HTTP cache), cache as fallback when offline
    e.respondWith(fetch(e.request, {cache: "no-cache"}).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match("index.html"))));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$|cdnjs\.cloudflare\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(n => { const c = n.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return n; })));
  }
});
