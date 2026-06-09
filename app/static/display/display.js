/* ============================================================
   PiBoard — motore del display
   Carica tema, widget e foto dal backend; applica gli stili in modo
   dinamico; ruota le foto con crossfade; si aggiorna in tempo reale via WS.
   ============================================================ */
const ROWS = 12, COLS = 12;
const api = (p) => fetch(p).then((r) => r.json());

let state = { settings: {}, widgets: [], photos: [], rotate: 60 };
let bgToggle = false, rotTimer = null, widgetTimers = [];

async function loadAll() {
  const [settings, widgets, photosResp] = await Promise.all([
    api("/api/settings").catch(() => ({})),
    api("/api/widgets").catch(() => []),
    api("/api/photos").catch(() => ({ photos: [], rotate_seconds: 60 })),
  ]);
  state.settings = settings || {};
  state.widgets = widgets || [];
  state.photos = (photosResp.photos || []);
  state.rotate = photosResp.rotate_seconds || 60;
  applyTheme();
  renderWidgets();
  startRotation();
  document.getElementById("boot").classList.add("hide");
}

/* ---------- Tema globale ---------- */
// Avvolge un nome di font tra virgolette + fallback (es. Bebas Neue -> "Bebas Neue", sans-serif)
function cssFamily(name) {
  return name ? `"${name}", sans-serif` : null;
}
// Famiglie da caricare da Google: tutte quelle usate, tranne i font caricati e i generici
const GENERIC_FONTS = new Set(["sans-serif", "serif", "monospace", "system-ui", "cursive"]);
function collectGoogleFamilies() {
  const uploaded = new Set(((state.settings.font || {}).faces || []).map((f) => f.family));
  const fams = new Set();
  const add = (n) => { if (n && !GENERIC_FONTS.has(n) && !uploaded.has(n)) fams.add(n); };
  const f = state.settings.font || {};
  add(f.bodyFamily); add(f.displayFamily);
  state.widgets.forEach((w) => add((w.config || {}).font));
  return [...fams];
}
function setVar(name, val) {
  if (val !== undefined && val !== null && val !== "")
    document.documentElement.style.setProperty(name, val);
}
function applyTheme() {
  const s = state.settings;
  const p = s.palette || {};
  setVar("--bg", p.bg); setVar("--surface", p.surface); setVar("--text", p.text);
  setVar("--accent", p.accent); setVar("--muted", p.muted);

  const g = s.glass || {};
  if (g.blur != null) setVar("--glass-blur", g.blur + "px");
  if (g.opacity != null) setVar("--glass-opacity", g.opacity);
  if (g.radius != null) setVar("--glass-radius", g.radius + "px");
  if (g.shadow === false) setVar("--glass-shadow", "none");

  // Font: @font-face per i file caricati + Google Fonts caricati in automatico
  const f = s.font || {};
  let faceCss = "";
  (f.faces || []).forEach((face) => {
    faceCss += `@font-face{font-family:"${face.family}";src:url("${face.url}");font-display:swap;}`;
  });
  // Raccoglie tutti i nomi di font usati (globali + widget) e li carica da Google,
  // escludendo quelli caricati a mano e i generici.
  const imports = [];
  if (f.googleHref) imports.push(f.googleHref);
  const fams = collectGoogleFamilies();
  if (fams.length) {
    const q = fams.map((x) => "family=" + encodeURIComponent(x).replace(/%20/g, "+")).join("&");
    imports.push(`https://fonts.googleapis.com/css2?${q}&display=swap`);
  }
  // gli @import vanno PRIMA delle altre regole
  document.getElementById("user-fonts").textContent =
    imports.map((u) => `@import url("${u}");`).join("") + faceCss;
  if (f.bodyFamily) setVar("--body-font", cssFamily(f.bodyFamily));
  if (f.displayFamily) setVar("--display-font", cssFamily(f.displayFamily));

  // Durata photoframe (secondi per foto)
  if (s.rotate_seconds) state.rotate = +s.rotate_seconds;

  // CSS custom (iniezione libera)
  document.getElementById("user-css").textContent = s.custom_css || "";

  // Sfondo
  const bg = s.background || {};
  if (bg.mode === "solid") {
    state.photos = [];
    document.querySelectorAll(".bg").forEach((el) => el.classList.remove("show"));
  }
}

/* ---------- Sfondo photoframe con crossfade ---------- */
function showPhoto(url) {
  const next = document.getElementById(bgToggle ? "bg-a" : "bg-b");
  const curr = document.getElementById(bgToggle ? "bg-b" : "bg-a");
  next.style.backgroundImage = `url("${url}")`;
  // Sulle GIF niente Ken Burns: l'animazione si vede pulita e pesa meno sul Pi.
  const isGif = /\.gif(\?|$)/i.test(url);
  const kb = !isGif && (state.settings.background || {}).kenburns !== false;
  next.classList.toggle("kenburns", kb);
  next.classList.add("show");
  curr.classList.remove("show");
  bgToggle = !bgToggle;
}
function startRotation() {
  clearInterval(rotTimer);
  if (!state.photos.length) return;
  let i = 0;
  const order = [...state.photos].sort(() => Math.random() - 0.5);
  showPhoto(order[0].url);
  rotTimer = setInterval(() => {
    i = (i + 1) % order.length;
    showPhoto(order[i].url);
  }, state.rotate * 1000);
}

/* ---------- Widget ---------- */
function rect(w) {
  return `left:${(w.x / COLS) * 100}%;top:${(w.y / ROWS) * 100}%;` +
         `width:${(w.w / COLS) * 100}%;height:${(w.h / ROWS) * 100}%;` +
         `z-index:${w.z || 0};`;
}
function applyWidgetStyle(inner, cfg) {
  if (cfg.font) inner.style.setProperty("--w-font", cssFamily(cfg.font));
  if (cfg.color) inner.style.setProperty("--w-color", cfg.color);
  if (cfg.bg) inner.style.background =
    `color-mix(in srgb, ${cfg.bg} ${(cfg.bgOpacity ?? 0.1) * 100}%, transparent)`;
  if (cfg.blur != null) inner.style.backdropFilter = `blur(${cfg.blur}px)`;
  if (cfg.radius != null) inner.style.borderRadius = cfg.radius + "px";
  if (cfg.shadow === false) inner.style.boxShadow = "none";
  if (cfg.align) inner.style.textAlign = cfg.align;
}
function renderWidgets() {
  widgetTimers.forEach(clearInterval);
  widgetTimers = [];
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  state.widgets.filter((w) => w.enabled !== false).forEach((w) => {
    const el = document.createElement("div");
    el.className = "widget";
    el.style.cssText = rect(w);
    const inner = document.createElement("div");
    inner.className = "widget-inner";
    applyWidgetStyle(inner, w.config || {});
    el.appendChild(inner);
    grid.appendChild(el);
    (RENDERERS[w.type] || RENDERERS.text)(inner, w.config || {});
  });
}

/* ---------- Renderer per tipo ---------- */
const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio",
  "agosto","settembre","ottobre","novembre","dicembre"];
const GIORNI = ["domenica","lunedì","martedì","mercoledì","giovedì","venerdì","sabato"];

const RENDERERS = {
  clock(inner, cfg) {
    if (cfg.style === "analog") return clockAnalog(inner);
    const wrap = document.createElement("div");
    wrap.className = "clock-digital";
    const t = document.createElement("div"); t.className = "clock-time";
    const d = document.createElement("div"); d.className = "clock-date";
    wrap.append(t); if (cfg.showDate !== false) wrap.append(d);
    inner.append(wrap);
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      t.textContent = (cfg.format === "HH:mm:ss") ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
      d.textContent = `${GIORNI[now.getDay()]} ${now.getDate()} ${MESI[now.getMonth()]}`;
    };
    tick(); widgetTimers.push(setInterval(tick, 1000));
  },

  text(inner, cfg) {
    const el = document.createElement("div");
    el.className = "text-widget";
    el.textContent = cfg.text || "Testo";
    inner.append(el);
  },

  weather(inner, cfg) {
    const draw = async () => {
      const q = `lat=${cfg.lat ?? 41.9028}&lon=${cfg.lon ?? 12.4964}&units=${cfg.units || "metric"}`;
      const d = await api("/api/widget-data/weather?" + q).catch(() => ({ ok: false }));
      inner.innerHTML = "";
      if (!d.ok) { inner.innerHTML = `<div class="wx-empty">Meteo non disponibile</div>`; return; }
      let fc = "";
      (d.forecast || []).forEach((f) => {
        fc += `<div class="wx-fc-day"><span class="wx-fc-n">${f.day}</span>` +
          `<span class="wx-fc-i">${f.icon}</span>` +
          `<span class="wx-fc-t">${f.hi}°<i>${f.lo}°</i></span></div>`;
      });
      const wrap = document.createElement("div"); wrap.className = "wx";
      wrap.innerHTML =
        `<div class="wx-place">${cfg.place ? escapeHtml(cfg.place) : "—"}</div>` +
        `<div class="wx-now"><span class="wx-temp">${d.temp}${d.unit}</span><span class="wx-ico">${d.icon}</span></div>` +
        `<div class="wx-desc">${d.desc}</div>` +
        `<div class="wx-hl">Max ${d.hi}° · Min ${d.lo}°${d.humidity != null ? " · 💧" + d.humidity + "%" : ""}</div>` +
        (fc ? `<div class="wx-fc">${fc}</div>` : "");
      inner.append(wrap);
    };
    draw(); widgetTimers.push(setInterval(draw, 15 * 60 * 1000));
  },

  rss(inner, cfg) {
    let items = [], idx = 0;
    const render = () => {
      inner.innerHTML = `<div class="list-title">${escapeHtml(cfg.title || "Notizie")}</div>`;
      if (!cfg.url) {
        inner.innerHTML += `<div class="list-row"><span class="list-what">Scegli un giornale o incolla un feed RSS</span></div>`;
        return;
      }
      if (!items.length) {
        inner.innerHTML += `<div class="list-row"><span class="list-what">Nessuna notizia</span></div>`;
        return;
      }
      const lead = document.createElement("div");
      lead.className = "news-lead";
      lead.textContent = items[idx % items.length].title;
      inner.append(lead);
      for (let k = 1; k <= 3 && k < items.length; k++) {
        const it = items[(idx + k) % items.length];
        const r = document.createElement("div"); r.className = "list-row";
        r.innerHTML = `<span class="list-what">${escapeHtml(it.title)}</span>`;
        inner.append(r);
      }
    };
    const fetchNews = async () => {
      const d = await api("/api/widget-data/rss?url=" + encodeURIComponent(cfg.url || "") + "&limit=20")
        .catch(() => ({ items: [] }));
      items = d.items || []; render();
    };
    fetchNews();
    // ogni 10 minuti mostra la notizia successiva; ogni ora riscarica il feed
    widgetTimers.push(setInterval(() => { idx++; render(); }, 10 * 60 * 1000));
    widgetTimers.push(setInterval(fetchNews, 60 * 60 * 1000));
  },

  calendar(inner, cfg) {
    const view = cfg.view || "card";
    const urls = [cfg.ical_url, cfg.gcal_url, cfg.url].filter(Boolean);
    const draw = async () => {
      let events = [];
      for (const u of urls) {
        const d = await api("/api/widget-data/ical?url=" + encodeURIComponent(u) + "&days=90")
          .catch(() => ({ events: [] }));
        events = events.concat(d.events || []);
      }
      events.sort((a, b) => (a.start < b.start ? -1 : 1));
      inner.innerHTML = "";
      if (view === "month") { renderMonthGrid(inner, events, cfg); return; }
      if (view === "agenda") { renderAgenda(inner, events, cfg, urls); return; }
      renderDateCard(inner, events, cfg);  // vista "card" stile telefono (predefinita)
    };
    draw(); widgetTimers.push(setInterval(draw, 30 * 60 * 1000));
  },
};

function renderDateCard(inner, events, cfg) {
  const now = new Date();
  const wrap = document.createElement("div"); wrap.className = "datecard";
  wrap.innerHTML =
    `<div class="dc-month">${MESI[now.getMonth()]} ${now.getFullYear()}</div>` +
    `<div class="dc-weekday">${GIORNI[now.getDay()]}</div>` +
    `<div class="dc-day">${now.getDate()}</div>`;
  const today = new Date(now.toDateString());
  const upcoming = events.filter((ev) => new Date(ev.start) >= today).slice(0, 4);
  if (upcoming.length) {
    const ul = document.createElement("div"); ul.className = "dc-events";
    upcoming.forEach((ev) => {
      const w = new Date(ev.start);
      const lbl = ev.allDay
        ? `${w.getDate()}/${w.getMonth() + 1}`
        : `${w.getDate()}/${w.getMonth() + 1} ${String(w.getHours()).padStart(2, "0")}:${String(w.getMinutes()).padStart(2, "0")}`;
      const r = document.createElement("div"); r.className = "dc-ev";
      r.innerHTML = `<span class="dc-ev-when">${lbl}</span><span class="dc-ev-what">${escapeHtml(ev.summary)}</span>`;
      ul.append(r);
    });
    wrap.append(ul);
  }
  inner.append(wrap);
}

function renderAgenda(inner, events, cfg, urls) {
  inner.innerHTML = `<div class="list-title">${escapeHtml(cfg.title || "Calendario")}</div>`;
  if (!events.length) {
    inner.innerHTML += `<div class="list-row"><span class="list-what">${urls.length ? "Nessun evento in arrivo" : "Aggiungi un link iCal o Google Calendar"}</span></div>`;
    return;
  }
  events.slice(0, 8).forEach((ev) => {
    const w = new Date(ev.start);
    const lbl = ev.allDay
      ? `${w.getDate()}/${w.getMonth() + 1}`
      : `${w.getDate()}/${w.getMonth() + 1} ${String(w.getHours()).padStart(2, "0")}:${String(w.getMinutes()).padStart(2, "0")}`;
    const r = document.createElement("div"); r.className = "list-row";
    r.innerHTML = `<span class="list-when">${lbl}</span><span class="list-what">${escapeHtml(ev.summary)}</span>`;
    inner.append(r);
  });
}

function renderMonthGrid(inner, events, cfg) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7;  // lunedì = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const evDays = new Set();
  events.forEach((ev) => {
    const dt = new Date(ev.start);
    if (dt.getFullYear() === year && dt.getMonth() === month) evDays.add(dt.getDate());
  });
  const wrap = document.createElement("div"); wrap.className = "cal";
  wrap.innerHTML = `<div class="cal-head">${cfg.title ? escapeHtml(cfg.title) + " · " : ""}${MESI[month]} ${year}</div>`;
  const g = document.createElement("div"); g.className = "cal-grid";
  ["L", "M", "M", "G", "V", "S", "D"].forEach((d) => {
    const c = document.createElement("div"); c.className = "cal-dow"; c.textContent = d; g.append(c);
  });
  for (let i = 0; i < startDow; i++) { const c = document.createElement("div"); c.className = "cal-cell empty"; g.append(c); }
  for (let day = 1; day <= daysInMonth; day++) {
    const c = document.createElement("div");
    c.className = "cal-cell" + (day === now.getDate() ? " today" : "") + (evDays.has(day) ? " has-ev" : "");
    c.innerHTML = `<span>${day}</span>`;
    g.append(c);
  }
  wrap.append(g);
  inner.append(wrap);
  const next = events.find((ev) => new Date(ev.start) >= new Date(now.toDateString()));
  if (next) {
    const dt = new Date(next.start);
    const nx = document.createElement("div"); nx.className = "cal-next";
    nx.textContent = `▸ ${dt.getDate()}/${dt.getMonth() + 1} ${next.summary}`;
    inner.append(nx);
  }
}

function clockAnalog(inner) {
  inner.innerHTML =
    `<div class="clock-analog"><svg viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="94" fill="none" stroke="var(--w-color,var(--text))" stroke-opacity="0.25" stroke-width="3"/>
      <line id="ah" x1="100" y1="100" x2="100" y2="55" stroke="var(--w-color,var(--text))" stroke-width="6" stroke-linecap="round"/>
      <line id="mh" x1="100" y1="100" x2="100" y2="35" stroke="var(--w-color,var(--text))" stroke-width="4" stroke-linecap="round"/>
      <line id="sh" x1="100" y1="100" x2="100" y2="28" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
      <circle cx="100" cy="100" r="5" fill="var(--accent)"/>
    </svg></div>`;
  const tick = () => {
    const n = new Date();
    const s = n.getSeconds(), m = n.getMinutes(), h = n.getHours() % 12;
    const set = (id, deg) =>
      inner.querySelector("#" + id).setAttribute("transform", `rotate(${deg} 100 100)`);
    set("sh", s * 6); set("mh", m * 6 + s * 0.1); set("ah", h * 30 + m * 0.5);
  };
  tick(); widgetTimers.push(setInterval(tick, 1000));
}

function escapeHtml(t) {
  const d = document.createElement("div"); d.textContent = t || ""; return d.innerHTML;
}

/* ---------- Realtime (WebSocket) ---------- */
function connectWS() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onmessage = async (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "config") {
      const oldRotate = state.rotate;
      state.settings = await api("/api/settings");
      state.widgets = await api("/api/widgets");
      applyTheme(); renderWidgets();
      if (state.rotate !== oldRotate) startRotation();   // durata foto cambiata
    } else if (msg.type === "photos") {
      const r = await api("/api/photos");
      state.photos = r.photos; state.rotate = r.rotate_seconds;
      startRotation();
    }
  };
  ws.onclose = () => setTimeout(connectWS, 3000);  // riconnessione automatica
}

loadAll();
connectWS();
