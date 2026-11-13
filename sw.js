// 여행 환율 계산기 서비스 워커
// 앱 화면은 오프라인에서도 열리도록 저장하고, 환율·날씨 API는 항상 네트워크로 받아요
// (오프라인일 때의 환율은 앱이 기기에 저장해 둔 마지막 값을 써요).
// 앱 파일을 수정해서 다시 배포할 때는 VERSION 숫자를 올려 주세요.
const VERSION = "v7";
const APP_CACHE = "app-" + VERSION;
const FONT_CACHE = "fonts-v1";
const KEEP = ["fonts-v1", "fx-hist-v1"]; // 지우지 않는 저장소 (글꼴, 과거 환율)

// 환율 추이·알림 공용 코드
importScripts("fx-core.js");
const APP_FILES = [
  "./",
  "index.html",
  "fx-core.js",
  "places-core.js",
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
      .then((keys) => Promise.all(keys.filter((k) => k !== APP_CACHE && !KEEP.includes(k)).map((k) => caches.delete(k))))
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

// 하루 한 번쯤 백그라운드에서 환율을 확인해 알림 보내기
// (안드로이드 Chrome에서 설치한 앱만 지원. 실행 시점은 휴대폰이 정해요)
self.addEventListener("periodicsync", (e) => {
  if (e.tag === "fx-check") e.waitUntil(FX.checkAlerts({ notify: true, reg: self.registration }));
});

// 알림을 누르면 앱의 환율 추이 화면 열기
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./#trend", self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
      return self.clients.openWindow(url);
    })
  );
});
