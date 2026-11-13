/* 여행 환율 계산기 · 주변 볼거리 데이터
   화면은 데이터 출처와 상관없이 같은 형식의 장소 목록만 받아요.
   지금 출처: 위키백과(영어+한국어, 무료). 나중에 다른 출처(예: Google Places)를 providers에 추가하면 돼요.

   장소 형식: { id, name, sub, lat, lon, dist, kind, desc, descLang, thumb, views, links:{map, dir, info} } */
(function (g) {
  "use strict";
  const P = { providers: {} };

  /** 두 좌표 사이 거리(m) */
  P.dist = (a, b, c, d) => {
    const R = 6371000, t = Math.PI / 180, dLa = (c - a) * t, dLo = (d - b) * t;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  /* ---------- 분류 ---------- */
  P.KINDS = [
    { id: "religion", label: "사찰·종교", icon: "⛩️", re: /temple|shrine|pagoda|church|cathedral|basilica|mosque|monastery|chapel|synagogue|사원|사찰|신사|성당|교회|모스크/ },
    { id: "culture", label: "역사·문화", icon: "🏛️", re: /museum|gallery|castle|palace|ruin|archaeolog|historic|heritage|monument|memorial|statue|mausoleum|tomb|citadel|fortress|\bfort\b|theatre|theater|opera|concert hall|\bhall\b|library|triumphal|박물관|미술관|성곽|궁전|궁$|유적|기념|동상|개선문|극장|홀$/ },
    { id: "street", label: "거리·쇼핑", icon: "🛍️", re: /street|market|shopping|department store|square|plaza|crossing|arcade|\bmall\b|quarter|alley|거리|시장|광장|교차점|상점가|백화점/ },
    { id: "arch", label: "건축·전망", icon: "🗼", re: /bridge|tower|skyscraper|building|observation|observatory|landmark|stadium|arena|gymnasium|station|다리|교$|교량|타워|빌딩|전망|경기장|역$/ },
    { id: "nature", label: "자연·공원", icon: "🌳", re: /park|garden|beach|mountain|\bhill\b|lake|waterfall|island|river|\bzoo\b|aquarium|botanic|forest|\bcave\b|\bbay\b|공원|정원|해변|해수욕장|호수|폭포|섬$|강$|동물원|수족관/ }
  ];
  P.kindOf = (text) => { for (const k of P.KINDS) if (k.re.test(text)) return k.id; return "etc"; };

  // 여행지로 보기 어려운 문서 (사건, 시설, 기관, 사람, 행정구역 등)
  const EXCLUDE = new RegExp([
    "\\bbattle\\b", "\\bsiege\\b", "massacre", "incident", "\\battack\\b", "bombing", "assassinat", "murder", "earthquake", "accident", "\\bcrash\\b", "\\briot\\b", "protest", "disaster",
    "election", "constituency", "revolution", "revolutionary", "\\bcommune\\b", "uprising", "\\bweek\\b", "^(list|timeline|history) of", "demolished", "destroyed", "nightclub", "restaurant", "\\bbar\\b", "\\bcaf[eé]\\b", "^(ancient|gallo-roman|roman|former) (city|town|settlement)", "ceremony", "parade", "affair", "scandal", "^\\S*\\s*arrondissement", "^(roman catholic )?(arch)?diocese", "military base", "air base", "naval base", "\\bdiamond\\b", "gemstone", "painting", "manuscript", "hospital", "clinic", "embassy", "consulate", "\\bschool\\b", "university", "college", "academy", "institute",
    "company", "corporation", "\\bbank\\b", "headquarters", "office building", "apartment", "\\bhotel\\b", "hostel", "police", "prison", "\\bcourt\\b",
    "ministry", "government", "political", "newspaper", "broadcaster", "television", "radio station", "record label", "publisher",
    "railway line", "metro line", "subway line", "bus (station|stop|route|terminal)", "expressway", "highway", "\\broad\\b", "power station",
    "\\b(city|town|village|commune|county|province|prefecture|ward|district|neighbou?rhood|municipality|suburb) (in|of)\\b", "capital of", "administrative",
    "\\(born ", "\\(\\s*(c\\.\\s*)?\\d{3,4}\\s*[–-]\\s*\\d{0,4}\\s*\\)", "politician", "\\bactor\\b", "actress", "singer", "footballer", "businessman", "species", "\\balbum\\b", "\\bfilm\\b", "\\bsong\\b", "\\bnovel\\b", "video game",
    "사건", "전투", "학살", "사고", "병원", "대사관", "영사관", "학교", "대학", "회사", "기업", "은행", "정당", "선거구", "행정 구역", "정치인", "배우", "가수"
  ].join("|"), "i");
  // 제목으로 알 수 있는 사건·행사·기관
  const TITLE_EX = /사건|전투|학살|사고|폭동|대학교?$|학교$|병원$|대사관|방송 ?센터|본사|올림픽|선수권|\bincident\b|massacre|\bbattle of\b|\bsiege of\b|bombing|\battack\b|olympics|championship|\buniversity\b|\bschool\b|hospital|embassy|headquarters|\b(1[5-9]|20)\d\d\b|affair|scandal|^(list|timeline|history) of|semaine|\bweek\b|^fires? (in|of)|ceremony|개막식|화재|\bfire$|\bfire of\b|경찰|\bpolice\b|폐막식|코뮌|혁명|nightclub|restaurant|arrondissement|diocese|교구$|^파리 \d+구$|\d+구$/i;
  const STATION = /(railway|train|metro|subway|underground|light rail|tram) station|역$/i;

  /* ---------- 위키백과 출처 ---------- */
  async function getJSON(url, ms) {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms || 12000);
    try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
    finally { clearTimeout(t); }
  }
  const api = (lang, q) => `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&${q}`;
  const sumViews = (pv) => pv ? Object.values(pv).reduce((a, b) => a + (b || 0), 0) : 0;

  /** 이어 받기(continue)까지 모두 받아 페이지별로 합치기 */
  async function queryAll(lang, q) {
    const pages = new Map(); let cont = "";
    for (let k = 0; k < 10; k++) {
      const j = await getJSON(api(lang, q + cont));
      for (const p of (j.query && j.query.pages) || []) {
        const m = pages.get(p.pageid || p.title) || {};
        for (const key in p) if (p[key] !== undefined) m[key] = p[key];
        pages.set(p.pageid || p.title, m);
      }
      if (!j.continue) break;
      cont = "&" + new URLSearchParams(j.continue).toString();
    }
    return [...pages.values()];
  }
  function geo(lang, lat, lon, r) {
    const other = lang === "en" ? "ko" : "en";
    return queryAll(lang, `generator=geosearch&ggscoord=${lat}|${lon}&ggsradius=${r}&ggslimit=80` +
      `&prop=coordinates|pageimages|description|pageprops|pageviews|langlinks&colimit=max&piprop=thumbnail&pithumbsize=320&pilimit=max` +
      `&ppprop=wikibase_item&pvipdays=30&lllang=${other}&lllimit=max`);
  }
  /** 한국어에만 잡힌 장소의 영어 문서 정보(설명·조회 수) 채우기 */
  async function enInfo(titles) {
    const out = {};
    for (let i = 0; i < titles.length; i += 50) {
      const chunk = titles.slice(i, i + 50);
      try {
        const pages = await queryAll("en", `prop=description|pageviews|pageimages&piprop=thumbnail&pithumbsize=320&pvipdays=30&redirects=1&titles=${encodeURIComponent(chunk.join("|"))}`);
        pages.forEach((p) => { out[p.title] = p; });
      } catch (e) {}
    }
    return out;
  }
  async function extracts(lang, titles) {
    const out = {};
    for (let i = 0; i < titles.length; i += 20) {
      const chunk = titles.slice(i, i + 20);
      try {
        const j = await getJSON(api(lang, `prop=extracts|description&exintro=1&explaintext=1&exsentences=2&exlimit=max&redirects=1&titles=${encodeURIComponent(chunk.join("|"))}`));
        ((j.query && j.query.pages) || []).forEach((p) => { out[p.title] = p; });
        ((j.query && j.query.redirects) || []).forEach((r) => { if (out[r.to]) out[r.from] = out[r.to]; });
      } catch (e) {}
    }
    return out;
  }

  P.providers.wiki = {
    name: "위키백과",
    credit: { text: "장소 정보: 위키백과 (CC BY-SA)", url: "https://ko.wikipedia.org" },
    /** 반경 안의 볼거리. 위치는 약 100m 단위로 반올림해서 보내요. */
    async search({ lat, lon, radius, limit }) {
      const la = +lat.toFixed(3), lo = +lon.toFixed(3), r = Math.max(100, Math.min(10000, Math.round(radius)));
      const [en, ko] = await Promise.allSettled([geo("en", la, lo, r), geo("ko", la, lo, r)]);
      if (en.status === "rejected" && ko.status === "rejected") throw en.reason;
      const map = new Map();
      for (const p of en.value || []) {
        const key = (p.pageprops && p.pageprops.wikibase_item) || "en:" + p.title;
        const kt = p.langlinks && p.langlinks[0] && p.langlinks[0].title;
        map.set(key, { key, en: p.title, ko: kt || null, enDesc: p.description || "", koDesc: "", co: p.coordinates && p.coordinates[0], thumb: p.thumbnail && p.thumbnail.source, views: sumViews(p.pageviews) });
      }
      for (const p of ko.value || []) {
        const key = (p.pageprops && p.pageprops.wikibase_item) || "ko:" + p.title;
        const m = map.get(key) || { key, en: null, enDesc: "", views: 0 };
        m.ko = p.title; m.koDesc = p.description || ""; m.co = m.co || (p.coordinates && p.coordinates[0]);
        if (!m.en && p.langlinks && p.langlinks[0]) m.enLink = p.langlinks[0].title;
        m.thumb = m.thumb || (p.thumbnail && p.thumbnail.source); m.views += sumViews(p.pageviews);
        map.set(key, m);
      }
      // 한국어 결과에만 있는 장소: 영어 문서의 설명·조회 수를 더해서 같은 기준으로 거르고 순위 매기기
      const need = [...map.values()].filter((m) => !m.en && m.enLink);
      if (need.length) {
        const info = await enInfo(need.map((m) => m.enLink));
        for (const m of need) {
          const x = info[m.enLink]; if (!x) continue;
          m.en = x.title; m.enDesc = x.description || ""; m.views += sumViews(x.pageviews);
          m.thumb = m.thumb || (x.thumbnail && x.thumbnail.source);
        }
      }
      let items = [];
      for (const m of map.values()) {
        if (!m.co) continue;
        const text = [m.en, m.ko, m.enDesc, m.koDesc].filter(Boolean).join(" · ");
        if (EXCLUDE.test(m.enDesc + " · " + m.koDesc) || TITLE_EX.test((m.en || "") + " · " + (m.ko || ""))) continue;
        if (/coup|rebellion|uprising|war\b|conflict/i.test(m.enDesc)) continue;
        if (STATION.test(m.enDesc + " " + (m.ko || "")) && m.views < 30000) continue; // 큰 역만 남기기
        m.kind = P.kindOf(text.toLowerCase());
        m.dist = P.dist(lat, lon, m.co.lat, m.co.lon);
        if (m.dist > r * 1.05) continue;
        items.push(m);
      }
      items.sort((a, b) => b.views - a.views);
      items = items.slice(0, limit || 40);
      // 설명: 한국어 문서가 있으면 한국어, 없으면 영어
      const [kx, ex] = await Promise.all([
        extracts("ko", items.filter((m) => m.ko).map((m) => m.ko)),
        extracts("en", items.filter((m) => !m.ko && m.en).map((m) => m.en))
      ]);
      return items.map((m) => {
        const x = m.ko ? kx[m.ko] : ex[m.en];
        const name = m.ko || m.en;
        const enPlain = m.en ? m.en.replace(/\s*\(.*?\)\s*$/, "") : name;
        return {
          id: m.key, name, sub: m.ko && m.en ? enPlain : (m.enDesc || ""),
          lat: m.co.lat, lon: m.co.lon, dist: m.dist, kind: m.kind, views: m.views,
          desc: (x && x.extract) || (m.ko ? m.koDesc : m.enDesc) || "", descLang: m.ko ? "ko" : "en",
          thumb: m.thumb || null,
          links: {
            map: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.en || name)}`,
            dir: `https://www.google.com/maps/dir/?api=1&destination=${m.co.lat},${m.co.lon}&travelmode=walking`,
            info: m.ko ? `https://ko.wikipedia.org/wiki/${encodeURIComponent(m.ko)}` : `https://en.wikipedia.org/wiki/${encodeURIComponent(m.en)}`
          }
        };
      });
    }
  };

  /* ---------- 공통 진입점 (같은 조건은 30분 동안 다시 요청하지 않음) ---------- */
  const cache = new Map();
  P.search = async (provider, opt) => {
    const key = [provider, opt.lat.toFixed(3), opt.lon.toFixed(3), opt.radius].join("|");
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < 30 * 60 * 1000) return hit.v;
    const v = await P.providers[provider].search(opt);
    cache.set(key, { t: Date.now(), v });
    return v;
  };

  g.Places = P;
})(typeof self !== "undefined" ? self : this);
