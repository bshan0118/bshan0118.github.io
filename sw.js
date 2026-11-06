// 여행 환율 계산기 서비스 워커
// 앱 화면은 오프라인에서도 열리도록 저장하고, 환율·날씨 API는 항상 네트워크로 받아요
// (오프라인일 때의 환율은 앱이 기기에 저장해 둔 마지막 값을 써요).
// 앱 파일을 수정해서 다시 배포할 때는 VERSION 숫자를 올려 주세요.
const VERSION = "v3";
const APP_CACHE = "app-" + VERSION;
const FONT_CACHE = "fonts-v1";
const APP_FILES = [
  "./",
  "index.html",
  "privacy.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/store-icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP_CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 환율·날씨 API: 저장하지 않고 그대로 통과
  if (url.hostname.endsWith("er-api.com") || url.hostname.endsWith("open-meteo.com")) return;

  // 글꼴: 한 번 받으면 저장해서 오프라인에서도 사용
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONT_CACHE).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // 앱 파일: 화면(페이지)은 네트워크 우선 → 실패하면 저장본, 나머지는 저장본 우선
  if (url.origin === self.location.origin) {
    if (req.mode === "navigate") {
      e.respondWith(
        fetch(req).then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(APP_CACHE).then((c) => c.put(req, copy));
          return res;
        }).catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
      );
      return;
    }
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
