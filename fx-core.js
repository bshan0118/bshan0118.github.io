/* 여행 환율 계산기 · 환율 추이와 알림 공용 코드
   앱 화면(index.html)과 서비스 워커(sw.js)가 함께 사용해요.
   데이터: fawazahmed0/currency-api (날짜별 환율 스냅샷, 무료·키 없음) */
(function (g) {
  "use strict";
  const FX = {};
  const CDN = (tag, b) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tag}/v1/currencies/${b}.min.json`;
  const ALT = (tag, b) => `https://${tag}.currency-api.pages.dev/v1/currencies/${b}.min.json`;
  const HIST = "fx-hist-v1";
  const BIG = new Set(["JPY", "VND", "IDR", "KRW", "LAK", "KHR", "MNT", "UZS", "KZT", "HUF", "ISK", "CLP"]);
  const mem = new Map();

  FX.ymd = (d) => d.toISOString().slice(0, 10);
  FX.shift = (ymd, days) => { const d = new Date(ymd + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return FX.ymd(d); };

  /** 표시 단위: 엔·동처럼 단위가 작은 통화는 100부터, 값이 1보다 작으면 10배씩 */
  FX.unitFor = (cur, perOne) => {
    let u = BIG.has(cur) ? 100 : 1;
    while (perOne * u < 1 && u < 1e7) u *= 10;
    return u;
  };

  /* ---------- IndexedDB 키-값 저장소 (화면과 서비스 워커가 공유) ---------- */
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open("fxapp", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  FX.kv = {
    async get(k) { try { const d = await db(); return await new Promise((res) => { const q = d.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); } catch (e) { return undefined; } },
    async set(k, v) { try { const d = await db(); await new Promise((res) => { const t = d.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = res; t.onerror = res; }); } catch (e) {} }
  };

  /* ---------- 날짜별 환율 스냅샷 ---------- */
  async function fetchJSON(url, ms) {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms || 8000);
    try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); }
    finally { clearTimeout(t); }
  }
  /** base 기준 환율 스냅샷. tag: "latest" 또는 "YYYY-MM-DD". 반환 {date, rates:{jpy:..}} 또는 null */
  FX.snapshot = async (base, tag) => {
    base = base.toLowerCase();
    const key = base + "@" + tag;
    if (mem.has(key)) return mem.get(key);
    const p = (async () => {
      const url = CDN(tag, base);
      const dated = tag !== "latest";
      let cache = null;
      try { cache = await caches.open(HIST); } catch (e) {}
      if (dated && cache) {
        try { const hit = await cache.match(url); if (hit) { const j = await hit.json(); return { date: j.date, rates: j[base] }; } } catch (e) {}
      }
      let j = null;
      try { j = await fetchJSON(url); } catch (e) { try { j = await fetchJSON(ALT(tag, base)); } catch (e2) {} }
      if (!j || !j[base]) {
        if (!dated) { const last = await FX.kv.get("latest:" + base); if (last) return last; }
        return null;
      }
      const snap = { date: j.date, rates: j[base] };
      if (cache) {
        // 날짜가 정해진 데이터는 바뀌지 않으므로 저장해 두고 다시 쓰기
        try { await cache.put(dated ? url : CDN(j.date, base), new Response(JSON.stringify(j), { headers: { "content-type": "application/json" } })); } catch (e) {}
      }
      if (!dated) await FX.kv.set("latest:" + base, snap);
      return snap;
    })();
    mem.set(key, p);
    const v = await p;
    if (!v) mem.delete(key);
    return v;
  };

  /** 기간별 날짜 목록 (끝 날짜 포함). 1주·1개월은 매일, 3개월은 3일, 1년은 7일 간격 */
  FX.datesFor = (period, end) => {
    const spec = { "1w": [7, 1], "1m": [30, 1], "3m": [90, 3], "1y": [364, 7] }[period] || [30, 1];
    const out = [];
    for (let i = spec[0]; i > 0; i -= spec[1]) out.push(FX.shift(end, -i));
    out.push(end);
    return out;
  };

  async function pool(items, n, fn) {
    const out = new Array(items.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
    }));
    return out;
  }

  /** base 통화로 본 cur 1단위의 값 추이: [{d, v}] (없는 날은 빠짐) */
  FX.series = async (base, cur, period) => {
    const latest = await FX.snapshot(base, "latest");
    if (!latest) return { latest: null, points: [] };
    const dates = FX.datesFor(period, latest.date);
    const c = cur.toLowerCase();
    const snaps = await pool(dates.slice(0, -1), 6, (d) => FX.snapshot(base, d));
    snaps.push(latest);
    const points = [];
    snaps.forEach((s, i) => { const r = s && s.rates[c]; if (r > 0) points.push({ d: s.date || dates[i], v: 1 / r }); });
    return { latest, points };
  };

  /* ---------- 알림 판단 ---------- */
  const PNAME = { "1w": "1주", "1m": "1개월" };
  /** ref를 주면 그 값과 같은 자릿수로 (차이·변동폭 표시용) */
  FX.fmt = (v, ref) => { const r = ref == null ? Math.abs(v) : Math.abs(ref); return v.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: r < 10 ? 4 : 2 }); };

  /** 즐겨찾기마다 현재 값, 기간 최저 여부, 목표 도달 여부 계산 */
  FX.evaluate = async (cfg) => {
    if (!cfg || !cfg.favs || !cfg.favs.length) return [];
    const base = cfg.base;
    const latest = await FX.snapshot(base, "latest");
    if (!latest) return [];
    const res = [];
    for (const f of cfg.favs) {
      const r = latest.rates[f.cur.toLowerCase()];
      if (!(r > 0) || f.cur === base) continue;
      const one = 1 / r, u = f.unit || FX.unitFor(f.cur, one), v = one * u;
      const out = { cur: f.cur, n: f.n, f: f.f, u, v, date: latest.date, isLow: false, belowTarget: false, low: f.low || "", target: f.target || null };
      if (f.low === "1w" || f.low === "1m") {
        const { points } = await FX.series(base, f.cur, f.low);
        const past = points.slice(0, -1).map((p) => p.v * u);
        if (past.length >= (f.low === "1w" ? 5 : 20)) { out.prevMin = Math.min(...past); out.isLow = v <= out.prevMin; }
      }
      if (f.target > 0) out.belowTarget = v <= f.target;
      res.push(out);
    }
    return res;
  };

  /** 알림 보내기 (같은 알림은 하루 한 번, 목표 알림은 목표 위로 올라갔다 다시 내려올 때만) */
  FX.checkAlerts = async ({ notify, reg } = {}) => {
    const cfg = await FX.kv.get("alerts");
    const ev = await FX.evaluate(cfg);
    const st = (await FX.kv.get("alertState")) || {};
    const fire = [];
    for (const e of ev) {
      const s = st[e.cur] || (st[e.cur] = {});
      const unitTxt = `${e.u.toLocaleString("ko-KR")} ${e.cur}`;
      if (e.isLow && s.lowDay !== e.date) {
        s.lowDay = e.date;
        fire.push({ e, kind: "low", title: `${e.f} ${e.n} ${e.cur} ${PNAME[e.low]} 최저 환율`, body: `${unitTxt} = ${FX.fmt(e.v)} ${cfg.base} · 지난 ${PNAME[e.low]} 중 가장 낮아요` });
      }
      if (e.target > 0) {
        if (e.belowTarget && s.armed !== false) {
          s.armed = false;
          fire.push({ e, kind: "target", title: `${e.f} ${e.n} ${e.cur} 목표 환율 도달`, body: `${unitTxt} = ${FX.fmt(e.v)} ${cfg.base} · 목표 ${FX.fmt(e.target)} ${cfg.base} 이하` });
        } else if (!e.belowTarget) s.armed = true;
      } else delete s.armed;
    }
    await FX.kv.set("alertState", st);
    if (notify && reg && reg.showNotification) {
      for (const x of fire) {
        try { await reg.showNotification(x.title, { body: x.body, tag: `fx-${x.e.cur}-${x.kind}`, icon: "icons/icon-192.png", badge: "icons/favicon-32.png", data: { url: "./#trend" } }); } catch (e) {}
      }
    }
    return { ev, fire };
  };

  FX.reset = () => mem.clear();

  g.FX = FX;
})(typeof self !== "undefined" ? self : this);
