// 離線快取：第一次打開時把整個 App 存在手機上，之後沒網路也能開
const CACHE = "wordbook-202610221929";
const FILES = ["./", "index.html", "dict.json", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
// cache: "reload" 跳過瀏覽器快取，確保存到的是剛上傳的新檔案
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f =>
    fetch(new Request(f, { cache: "reload" })).then(r => { if (r.ok) return c.put(f, r); })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("wordbook-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const font = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !font) return;
  // 頁面本身：有網路就抓最新版（最多等 3 秒），沒網路才用手機上的版本
  if (req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/")) {
    e.respondWith(caches.open(CACHE).then(async c => {
      try {
        const r = await Promise.race([fetch(req, { cache: "no-cache" }), new Promise((_, no) => setTimeout(no, 3000))]);
        if (r.ok) { c.put("index.html", r.clone()); return r; }
      } catch {}
      return (await c.match("index.html")) || (await c.match("./")) || Response.error();
    }));
    return;
  }
  // 其他檔案（字典、圖示）：先用手機上的版本；有網路時順便更新
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || (req.mode === "navigate" ? c.match("index.html") : Response.error());
  }));
});
