/* ============================================================
   PiBoard — pannello admin
   ============================================================ */
const api = (p, opt) => fetch(p, opt).then((r) => r.json());
const $ = (id) => document.getElementById(id);
const uid = () => "w" + Math.random().toString(36).slice(2, 9);

function status(msg) {
  const s = $("status"); s.textContent = msg;
  setTimeout(() => { if (s.textContent === msg) s.textContent = ""; }, 2500);
}

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach((t) => {
  t.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    $("tab-" + t.dataset.tab).classList.add("active");
  };
});

/* ============================================================
   ASPETTO
   ============================================================ */
// Font Google offerti nei menu (oltre ai font caricati dall'utente)
const GOOGLE_FONTS = [
  // Sans moderni
  "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway", "Inter",
  "Nunito", "Sora", "Quicksand", "DM Sans", "Manrope", "Space Grotesk",
  "Outfit", "Rubik", "Work Sans", "Mulish", "Figtree",
  // Serif eleganti
  "Playfair Display", "Merriweather", "EB Garamond", "Cormorant Garamond",
  "Libre Baskerville", "Lora", "Bitter", "Crimson Text",
  // Display / titoli
  "Oswald", "Bebas Neue", "Anton", "Archivo Black", "Righteous",
  "Abril Fatface", "Fjalla One", "Teko",
  // Monospace
  "Source Code Pro", "JetBrains Mono", "Fira Code", "IBM Plex Mono", "Space Mono",
  // Calligrafici / a mano
  "Pacifico", "Lobster", "Dancing Script", "Caveat", "Satisfy", "Great Vibes",
  // Tech / a tema
  "Orbitron", "Audiowide", "Press Start 2P", "Russo One", "Saira", "Exo 2",
  // Altri sans
  "Karla", "Heebo", "Cabin", "Asap", "Hind", "PT Sans", "Titillium Web",
  "Barlow", "Josefin Sans", "Comfortaa", "Maven Pro",
  // Altri serif
  "Cardo", "Spectral", "Vollkorn", "Zilla Slab", "Noto Serif", "Frank Ruhl Libre",
  // Altri display / titoli
  "Alfa Slab One", "Staatliches", "Passion One", "Bungee", "Monoton", "Shrikhand",
  // Altri a mano
  "Sacramento", "Permanent Marker", "Shadows Into Light", "Indie Flower",
  "Amatic SC", "Kalam", "Gloria Hallelujah",
  // Altri monospace
  "Inconsolata", "Roboto Mono", "Ubuntu Mono", "Cousine",
];

// Carica TUTTI i font (Google + caricati) nell'admin, così ogni voce del menu
// si mostra nel proprio carattere.
function ensureFontsLoaded() {
  if (!window._gfontsDone) {
    const fams = GOOGLE_FONTS.map((f) => "family=" + encodeURIComponent(f).replace(/%20/g, "+")).join("&");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${fams}&display=swap`;
    document.head.appendChild(link);
    window._gfontsDone = true;
  }
  let st = document.getElementById("admin-font-faces");
  if (!st) { st = document.createElement("style"); st.id = "admin-font-faces"; document.head.appendChild(st); }
  st.textContent = (window._fontFaces || [])
    .map((f) => `@font-face{font-family:"${f.family}";src:url("${f.url}");font-display:swap;}`).join("");
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildFontOptions(selected) {
  ensureFontsLoaded();
  const uploaded = (window._fontFaces || []).map((f) => f.family);
  const seen = new Set();
  const out = [];
  ["", ...uploaded, ...GOOGLE_FONTS].forEach((n) => {
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  });
  return out.map((n) => {
    const style = n ? ` style="font-family:'${n.replace(/'/g, "")}'"` : "";
    return `<option value="${esc(n)}"${style} ${n === (selected || "") ? "selected" : ""}>${n || "(predefinito)"}</option>`;
  }).join("");
}

// Giornali pronti per il widget Notizie (RSS), per categoria
const RSS_PRESETS = [
  { label: "ANSA — Ultime", url: "https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml" },
  { label: "ANSA — Politica", url: "https://www.ansa.it/sito/notizie/politica/politica_rss.xml" },
  { label: "ANSA — Economia", url: "https://www.ansa.it/sito/notizie/economia/economia_rss.xml" },
  { label: "ANSA — Mondo", url: "https://www.ansa.it/sito/notizie/mondo/mondo_rss.xml" },
  { label: "ANSA — Sport", url: "https://www.ansa.it/sito/notizie/sport/sport_rss.xml" },
  { label: "Corriere della Sera — Home", url: "https://xml2.corriereobjects.it/rss/homepage.xml" },
  { label: "Corriere — Economia", url: "https://xml2.corriereobjects.it/rss/economia.xml" },
  { label: "Corriere — Sport", url: "https://xml2.corriereobjects.it/rss/sport.xml" },
  { label: "la Repubblica — Home", url: "https://www.repubblica.it/rss/homepage/rss2.0.xml" },
  { label: "Repubblica — Politica", url: "https://www.repubblica.it/rss/politica/rss2.0.xml" },
  { label: "Repubblica — Economia", url: "https://www.repubblica.it/rss/economia/rss2.0.xml" },
  { label: "Repubblica — Esteri", url: "https://www.repubblica.it/rss/esteri/rss2.0.xml" },
  { label: "Repubblica — Sport", url: "https://www.repubblica.it/rss/sport/rss2.0.xml" },
  { label: "Il Sole 24 Ore (economia/borsa)", url: "https://www.ilsole24ore.com/rss/italia.xml" },
  { label: "Il Post", url: "https://www.ilpost.it/feed/" },
  { label: "Il Fatto Quotidiano", url: "https://www.ilfattoquotidiano.it/feed/" },
  { label: "BBC — World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { label: "BBC — Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { label: "New York Times — Home", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" },
  { label: "NYT — World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
  { label: "NYT — Business", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml" },
  { label: "The Guardian — World", url: "https://www.theguardian.com/world/rss" },
  { label: "The Guardian — Sport", url: "https://www.theguardian.com/sport/rss" },
  { label: "Le Monde — Une", url: "https://www.lemonde.fr/rss/une.xml" },
  { label: "TechCrunch", url: "https://techcrunch.com/feed/" },
];

// Paesi per il selettore meteo (codice ISO, nome)
const COUNTRIES = [
  ["IT", "Italia"], ["FR", "Francia"], ["DE", "Germania"], ["ES", "Spagna"],
  ["GB", "Regno Unito"], ["IE", "Irlanda"], ["PT", "Portogallo"], ["NL", "Paesi Bassi"],
  ["BE", "Belgio"], ["CH", "Svizzera"], ["AT", "Austria"], ["DK", "Danimarca"],
  ["SE", "Svezia"], ["NO", "Norvegia"], ["FI", "Finlandia"], ["PL", "Polonia"],
  ["CZ", "Rep. Ceca"], ["GR", "Grecia"], ["HU", "Ungheria"], ["RO", "Romania"],
  ["HR", "Croazia"], ["SI", "Slovenia"], ["SK", "Slovacchia"], ["RU", "Russia"],
  ["TR", "Turchia"], ["UA", "Ucraina"], ["US", "Stati Uniti"], ["CA", "Canada"],
  ["MX", "Messico"], ["BR", "Brasile"], ["AR", "Argentina"], ["CL", "Cile"],
  ["CO", "Colombia"], ["JP", "Giappone"], ["CN", "Cina"], ["KR", "Corea del Sud"],
  ["IN", "India"], ["ID", "Indonesia"], ["TH", "Thailandia"], ["AU", "Australia"],
  ["NZ", "Nuova Zelanda"], ["ZA", "Sudafrica"], ["EG", "Egitto"], ["MA", "Marocco"],
  ["AE", "Emirati Arabi"], ["SA", "Arabia Saudita"], ["IL", "Israele"],
];

function bindRange(id) {
  const el = $(id), out = $(id + "-v");
  const upd = () => { if (out) out.textContent = el.value; };
  el.oninput = upd; upd();
}
["g-blur", "g-opacity", "g-radius"].forEach(bindRange);

async function loadAspetto() {
  const s = await api("/api/settings");
  const p = s.palette || {}, g = s.glass || {}, f = s.font || {}, bg = s.background || {};
  $("c-bg").value = p.bg || "#0b0f14";
  $("c-surface").value = p.surface || "#ffffff";
  $("c-text").value = p.text || "#f4f6fb";
  $("c-accent").value = p.accent || "#5ec8ff";
  $("c-muted").value = p.muted || "#9aa7b8";
  $("g-blur").value = g.blur ?? 14;
  $("g-opacity").value = g.opacity ?? 0.10;
  $("g-radius").value = g.radius ?? 22;
  $("g-shadow").checked = g.shadow !== false;
  ["g-blur", "g-opacity", "g-radius"].forEach((id) => $(id).dispatchEvent(new Event("input")));
  await loadFonts();                              // popola le opzioni dei menu font
  $("f-body").value = f.bodyFamily || "";
  $("f-display").value = f.displayFamily || "";
  $("bg-mode").value = bg.mode || "photos";
  $("bg-solid").value = bg.solid || "#0b0f14";
  $("bg-kb").checked = bg.kenburns !== false;
  $("custom-css").value = s.custom_css || "";
}

async function loadFonts() {
  const fonts = await api("/api/fonts").catch(() => []);
  window._fontFaces = fonts.map((f) => ({ family: f.name.replace(/\.\w+$/, ""), url: f.url }));
  $("f-list").innerHTML = fonts.map((f) => `<span class="chip">${f.name}</span>`).join("");
  const opts = buildFontOptions();
  $("f-body").innerHTML = opts;
  $("f-display").innerHTML = opts;
}

$("f-upload").onclick = async () => {
  const file = $("f-file").files[0];
  if (!file) return status("Scegli un file font");
  const fd = new FormData(); fd.append("file", file);
  await fetch("/api/fonts", { method: "POST", body: fd });
  status("Font caricato"); loadFonts();
};

function collectAspettoPayload() {
  return {
    palette: {
      bg: $("c-bg").value, surface: $("c-surface").value, text: $("c-text").value,
      accent: $("c-accent").value, muted: $("c-muted").value,
    },
    glass: {
      blur: +$("g-blur").value, opacity: +$("g-opacity").value,
      radius: +$("g-radius").value, shadow: $("g-shadow").checked,
    },
    font: {
      bodyFamily: $("f-body").value, displayFamily: $("f-display").value,
      faces: window._fontFaces || [],
    },
    background: {
      mode: $("bg-mode").value, solid: $("bg-solid").value, kenburns: $("bg-kb").checked,
    },
    custom_css: $("custom-css").value,
  };
}

async function saveAspetto() {
  await api("/api/settings", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(collectAspettoPayload()),
  });
  status("Aspetto salvato ✓");
}

$("save-aspetto").onclick = saveAspetto;

/* ---------- Temi pronti (preset CSS) ---------- */
const THEME_PRESETS = {
  "Notte (predefinito)": {
    palette: { bg: "#0b0f14", surface: "#ffffff", text: "#f4f6fb", accent: "#5ec8ff", muted: "#9aa7b8" },
    glass: { blur: 14, opacity: 0.10, radius: 22, shadow: true },
    font: { bodyFamily: "Inter", displayFamily: "Sora" }, custom_css: "",
  },
  "Vetro intenso": {
    palette: { bg: "#070b12", surface: "#ffffff", text: "#ffffff", accent: "#8ad6ff", muted: "#b9c4d4" },
    glass: { blur: 30, opacity: 0.18, radius: 28, shadow: true },
    font: { bodyFamily: "Manrope", displayFamily: "Space Grotesk" },
    custom_css: ".widget-inner{border:1px solid rgba(255,255,255,.18)}",
  },
  "Testo nudo": {
    palette: { bg: "#000000", surface: "#ffffff", text: "#ffffff", accent: "#ffffff", muted: "#cfd6e0" },
    glass: { blur: 0, opacity: 0, radius: 0, shadow: false },
    font: { bodyFamily: "Montserrat", displayFamily: "Oswald" },
    custom_css: ".widget-inner{background:none!important;backdrop-filter:none!important;text-shadow:0 2px 12px rgba(0,0,0,.85)}",
  },
  "Neon / Cyberpunk": {
    palette: { bg: "#0a0014", surface: "#1a0030", text: "#f0e9ff", accent: "#ff2bd6", muted: "#7af7ff" },
    glass: { blur: 12, opacity: 0.14, radius: 14, shadow: true },
    font: { bodyFamily: "Rubik", displayFamily: "Orbitron" },
    custom_css: ".display-font,.clock{text-shadow:0 0 8px #ff2bd6,0 0 18px #7af7ff}.widget-inner{border:1px solid rgba(255,43,214,.5)}",
  },
  "Material piatto": {
    palette: { bg: "#121212", surface: "#1e1e1e", text: "#ffffff", accent: "#03dac6", muted: "#b0b0b0" },
    glass: { blur: 0, opacity: 0.85, radius: 12, shadow: true },
    font: { bodyFamily: "Roboto", displayFamily: "Roboto" }, custom_css: "",
  },
  "Vintage seppia": {
    palette: { bg: "#2b2117", surface: "#efe2c8", text: "#f3e9d2", accent: "#c8a06a", muted: "#bfa98a" },
    glass: { blur: 6, opacity: 0.12, radius: 10, shadow: true },
    font: { bodyFamily: "EB Garamond", displayFamily: "Playfair Display" },
    custom_css: "#bg-a,#bg-b{filter:sepia(.45) saturate(.85) contrast(.95)}",
  },
  "Orologio gigante": {
    palette: { bg: "#05070a", surface: "#ffffff", text: "#ffffff", accent: "#ffd35e", muted: "#8a93a3" },
    glass: { blur: 0, opacity: 0, radius: 0, shadow: false },
    font: { bodyFamily: "Inter", displayFamily: "Bebas Neue" },
    custom_css: ".clock{font-size:9vw!important;letter-spacing:2px}.widget-inner{background:none!important;backdrop-filter:none!important}",
  },
  "Nordic light": {
    palette: { bg: "#eef1f5", surface: "#ffffff", text: "#1c2733", accent: "#3b82f6", muted: "#5b6b7d" },
    glass: { blur: 10, opacity: 0.55, radius: 20, shadow: true },
    font: { bodyFamily: "Work Sans", displayFamily: "DM Sans" }, custom_css: "",
  },
  "Tramonto": {
    palette: { bg: "#2a1224", surface: "#ffffff", text: "#fff3ea", accent: "#ff8c5a", muted: "#e6b8a8" },
    glass: { blur: 16, opacity: 0.12, radius: 24, shadow: true },
    font: { bodyFamily: "Poppins", displayFamily: "Abril Fatface" },
    custom_css: "body::after{content:'';position:fixed;inset:0;pointer-events:none;background:linear-gradient(160deg,rgba(255,140,90,.18),rgba(120,40,120,.28))}",
  },
  "Foresta": {
    palette: { bg: "#0d1f14", surface: "#ffffff", text: "#eaf6ec", accent: "#5fd08a", muted: "#9fb8a6" },
    glass: { blur: 14, opacity: 0.12, radius: 18, shadow: true },
    font: { bodyFamily: "Nunito", displayFamily: "Lora" }, custom_css: "",
  },
  "Terminale": {
    palette: { bg: "#000000", surface: "#001a00", text: "#39ff14", accent: "#39ff14", muted: "#1f9e12" },
    glass: { blur: 0, opacity: 0.25, radius: 4, shadow: false },
    font: { bodyFamily: "JetBrains Mono", displayFamily: "JetBrains Mono" },
    custom_css: ".widget-inner{border:1px solid rgba(57,255,20,.35);text-shadow:0 0 6px rgba(57,255,20,.6)}",
  },
  "Pastello": {
    palette: { bg: "#f6eef8", surface: "#ffffff", text: "#4a3b52", accent: "#c79bff", muted: "#9b8aa6" },
    glass: { blur: 12, opacity: 0.5, radius: 28, shadow: true },
    font: { bodyFamily: "Quicksand", displayFamily: "Pacifico" }, custom_css: "",
  },
};

function applyPreset(name) {
  const p = THEME_PRESETS[name];
  if (!p) return;
  $("c-bg").value = p.palette.bg; $("c-surface").value = p.palette.surface;
  $("c-text").value = p.palette.text; $("c-accent").value = p.palette.accent;
  $("c-muted").value = p.palette.muted;
  $("g-blur").value = p.glass.blur; $("g-opacity").value = p.glass.opacity;
  $("g-radius").value = p.glass.radius; $("g-shadow").checked = p.glass.shadow !== false;
  ["g-blur", "g-opacity", "g-radius"].forEach((id) => $(id).dispatchEvent(new Event("input")));
  $("f-body").value = p.font.bodyFamily || "";
  $("f-display").value = p.font.displayFamily || "";
  $("bg-mode").value = (p.background || {}).mode || "photos";
  if ((p.background || {}).solid) $("bg-solid").value = p.background.solid;
  $("bg-kb").checked = (p.background || {}).kenburns !== false;
  $("custom-css").value = p.custom_css || "";
  saveAspetto();
}

(function fillPresetMenu() {
  const sel = $("theme-preset");
  Object.keys(THEME_PRESETS).forEach((n) => {
    const o = document.createElement("option"); o.value = n; o.textContent = n; sel.appendChild(o);
  });
  sel.onchange = () => { if (sel.value) applyPreset(sel.value); };
})();

/* ============================================================
   WIDGET (gridstack)
   ============================================================ */
const grid = GridStack.init(
  { column: 12, cellHeight: 46, margin: 5, float: true, maxRow: 12,
    resizable: { handles: "n,ne,e,se,s,sw,w,nw" } },
  "#grid"
);
const W = new Map();  // id -> {type, config, el}

const DEFAULTS = {
  clock: { style: "digital", format: "HH:mm", showDate: true },
  weather: { lat: 41.9028, lon: 12.4964, units: "metric", place: "Roma" },
  calendar: { title: "Calendario", view: "card", ical_url: "", gcal_url: "" },
  rss: { url: "", title: "Notizie" },
  text: { text: "Ciao!" },
};
const NAMES = { clock: "Orologio", weather: "Meteo", calendar: "Calendario", rss: "RSS", text: "Testo" };

function cardHtml(id, type) {
  return `<div class="gs-name">${NAMES[type]}</div>
          <div class="gs-type">${type}</div>
          <button class="gs-cfg" onclick="openDrawer('${id}')">⚙ Configura</button>`;
}

function addWidget(type, opts = {}) {
  const id = opts.id || uid();
  const el = grid.addWidget({
    id, x: opts.x ?? 0, y: opts.y ?? 0, w: opts.w ?? 3, h: opts.h ?? 3,
    content: cardHtml(id, type),
  });
  W.set(id, { type, config: opts.config || { ...DEFAULTS[type] }, el, z: opts.z ?? 0 });
  return id;
}

document.querySelectorAll("[data-add]").forEach((b) => {
  b.onclick = () => addWidget(b.dataset.add);
});

async function loadWidgets() {
  const widgets = await api("/api/widgets");
  grid.removeAll(); W.clear();
  widgets.forEach((w) => addWidget(w.type, { x: w.x, y: w.y, w: w.w, h: w.h, z: w.z, config: w.config }));
}

$("save-widgets").onclick = async () => {
  const nodes = grid.save(false);  // [{id,x,y,w,h}]
  const payload = nodes.map((n) => {
    const item = W.get(n.id);
    return { type: item.type, x: n.x, y: n.y, w: n.w, h: n.h, z: item.z || 0, enabled: true, config: item.config };
  });
  await api("/api/widgets", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  status("Layout salvato ✓");
};

/* ---------- Drawer di configurazione ---------- */
let drawerId = null;

// Campi specifici per tipo + campi di stile comuni
const FIELDS = {
  clock: [
    { k: "style", t: "select", label: "Stile", opts: ["digital", "analog"] },
    { k: "format", t: "select", label: "Formato", opts: ["HH:mm", "HH:mm:ss"] },
    { k: "showDate", t: "check", label: "Mostra data" },
  ],
  weather: [],  // configurazione dedicata (selettore città) costruita a parte
  calendar: [
    { k: "title", t: "text", label: "Titolo" },
    { k: "view", t: "select", label: "Vista", opts: ["card", "month", "agenda"] },
    { k: "ical_url", t: "text", label: "Link iCalendar (.ics)" },
    { k: "gcal_url", t: "text", label: "Link Google Calendar (.ics)" },
  ],
  rss: [
    { k: "title", t: "text", label: "Titolo" },
    { k: "preset", t: "preset", label: "Giornale / sezione", opts: RSS_PRESETS, target: "url" },
    { k: "url", t: "text", label: "URL feed RSS (o scegli sopra)" },
  ],
  text: [{ k: "text", t: "text", label: "Testo" }],
};
const STYLE_FIELDS = [
  { k: "font", t: "font", label: "Font" },
  { k: "color", t: "text", label: "Colore testo (hex)" },
  { k: "bg", t: "text", label: "Colore sfondo (hex)" },
  { k: "align", t: "select", label: "Allineamento", opts: ["center", "left", "right"] },
];

function field(cfg, f) {
  const v = cfg[f.k] ?? "";
  if (f.t === "preset")
    return `<label><span>${f.label}</span><select data-preset="${f.target}">` +
      `<option value="">— scegli —</option>` +
      f.opts.map((o) => `<option value="${esc(o.url)}">${esc(o.label)}</option>`).join("") +
      `</select></label>`;
  if (f.t === "font")
    return `<label><span>${f.label}</span><select data-k="${f.k}">${buildFontOptions(v)}</select></label>`;
  if (f.t === "check")
    return `<label class="row"><input type="checkbox" data-k="${f.k}" ${v ? "checked" : ""}> <span>${f.label}</span></label>`;
  if (f.t === "select")
    return `<label><span>${f.label}</span><select data-k="${f.k}">` +
      f.opts.map((o) => `<option ${o == v ? "selected" : ""}>${o}</option>`).join("") + `</select></label>`;
  return `<label><span>${f.label}</span><input type="text" data-k="${f.k}" value="${v}"></label>`;
}

window.openDrawer = (id) => {
  drawerId = id;
  const item = W.get(id);
  const node = item.el.gridstackNode || {};
  $("drawer-title").textContent = NAMES[item.type] + " · dimensioni, stile e dati";
  const dimHtml =
    `<div class="dim-row">
       <label><span>Larghezza</span><input type="number" min="1" max="12" data-dim="w" value="${node.w ?? 3}"></label>
       <label><span>Altezza</span><input type="number" min="1" max="12" data-dim="h" value="${node.h ?? 3}"></label>
       <label><span>Profondità</span><input type="number" min="0" max="99" data-dim="z" value="${item.z ?? 0}"></label>
     </div>
     <p class="info">Puoi anche trascinare i bordi del widget per ridimensionarlo.</p>
     <hr style="border-color:var(--line);margin:1rem 0">`;
  const typeHtml = item.type === "weather"
    ? weatherConfigHtml(item)
    : FIELDS[item.type].map((f) => field(item.config, f)).join("");
  $("drawer-body").innerHTML =
    dimHtml +
    typeHtml +
    `<hr style="border-color:var(--line);margin:1rem 0">` +
    STYLE_FIELDS.map((f) => field(item.config, f)).join("");
  // dimensioni (live)
  $("drawer-body").querySelectorAll("[data-dim]").forEach((inp) => {
    inp.onchange = () => {
      const v = Math.max(+inp.min, Math.min(+inp.max, +inp.value || 0));
      inp.value = v;
      if (inp.dataset.dim === "z") item.z = v;
      else grid.update(item.el, { [inp.dataset.dim]: v });
    };
  });
  // campi dati + stile
  $("drawer-body").querySelectorAll("[data-k]").forEach((inp) => {
    inp.onchange = () => {
      const k = inp.dataset.k;
      item.config[k] = inp.type === "checkbox" ? inp.checked : inp.value;
    };
  });
  // menu "preset" (es. giornali RSS): scrive nel campo target
  $("drawer-body").querySelectorAll("[data-preset]").forEach((sel) => {
    sel.onchange = () => {
      const target = sel.dataset.preset;
      item.config[target] = sel.value;
      const inp = $("drawer-body").querySelector(`[data-k="${target}"]`);
      if (inp) inp.value = sel.value;
    };
  });
  if (item.type === "weather") wireWeather(item);
  $("drawer").classList.add("open");
};

/* ---------- Configurazione meteo: Paese → Regione → Provincia → Città ---------- */
async function loadGeo() {
  if (window._geo) return window._geo;
  window._geo = await fetch("geo.json").then((r) => r.json())
    .catch(() => ({ countries: [], italy: {}, regions: {} }));
  return window._geo;
}

function weatherConfigHtml(item) {
  const c = item.config;
  return `
    <label><span>Paese</span><select id="w-country"></select></label>
    <label><span>Regione</span><select id="w-region"><option value="">—</option></select></label>
    <label id="w-prov-l" style="display:none"><span>Provincia</span><select id="w-prov"><option value="">—</option></select></label>
    <label id="w-city-l"><span>Città</span><select id="w-city"><option value="">—</option></select></label>
    <div id="w-search-l" style="display:none">
      <label><span>Cerca città</span><input type="text" id="w-search" placeholder="scrivi il nome e premi Cerca"></label>
      <button class="btn" type="button" id="w-find">Cerca città</button>
    </div>
    <p class="info" id="w-current">${c.place ? "Selezionata: " + esc(c.place) : "Nessuna città selezionata"}</p>
    <label><span>Unità</span><select id="w-units">
      <option value="metric" ${c.units !== "imperial" ? "selected" : ""}>°C</option>
      <option value="imperial" ${c.units === "imperial" ? "selected" : ""}>°F</option>
    </select></label>`;
}

async function wireWeather(item) {
  const geo = await loadGeo();
  const $c = $("w-country"), $r = $("w-region"), $pL = $("w-prov-l"), $p = $("w-prov"),
        $cy = $("w-city"), $searchBox = $("w-search-l"), $search = $("w-search"),
        $units = $("w-units"), $cur = $("w-current");
  $c.innerHTML = geo.countries.map(([code, name]) => `<option value="${code}">${esc(name)}</option>`).join("");
  $c.value = item.config.country || "IT";
  $units.onchange = () => { item.config.units = $units.value; };

  const setPlace = (name, lat, lon) => {
    item.config.lat = lat; item.config.lon = lon; item.config.place = name;
    item.config.country = $c.value;
    $cur.textContent = "Selezionata: " + name;
  };

  const fillRegions = () => {
    const cc = $c.value;
    if (cc === "IT") {
      const regs = Object.keys(geo.italy).sort();
      $r.innerHTML = `<option value="">—</option>` + regs.map((n) => `<option>${esc(n)}</option>`).join("");
      $pL.style.display = ""; $searchBox.style.display = "none";
    } else {
      const regs = geo.regions[cc] || [];
      $r.innerHTML = `<option value="">—</option>` + regs.map((x, i) => `<option value="${i}">${esc(x.n)}</option>`).join("");
      $pL.style.display = "none"; $searchBox.style.display = "";
    }
    $p.innerHTML = `<option value="">—</option>`;
    $cy.innerHTML = `<option value="">—</option>`;
  };
  fillRegions();
  $c.onchange = fillRegions;

  $r.onchange = () => {
    const cc = $c.value;
    if (cc === "IT") {
      const reg = $r.value;
      const provs = reg ? Object.keys(geo.italy[reg]).sort() : [];
      $p.innerHTML = `<option value="">—</option>` + provs.map((n) => `<option>${esc(n)}</option>`).join("");
      $cy.innerHTML = `<option value="">—</option>`;
    } else {
      const reg = (geo.regions[cc] || [])[+$r.value];
      if (reg) setPlace(reg.n, reg.lat, reg.lon);  // la regione fa già da default
    }
  };

  $p.onchange = () => {
    const list = (geo.italy[$r.value] && geo.italy[$r.value][$p.value]) || [];
    $cy.innerHTML = `<option value="">—</option>` + list.map((x, i) => `<option value="${i}">${esc(x.n)}</option>`).join("");
  };

  $cy.onchange = () => {
    if ($c.value === "IT") {
      const list = (geo.italy[$r.value] && geo.italy[$r.value][$p.value]) || [];
      const city = list[+$cy.value];
      if (city) setPlace(city.n, city.lat, city.lon);
    } else {
      const v = $cy.value;
      if (v && v[0] === "s") {
        const r = (window._wRes || [])[+v.slice(1)];
        if (r) setPlace(r.name, r.lat, r.lon);
      }
    }
  };

  const doFind = async () => {
    const name = $search.value.trim();
    if (!name) return;
    $cur.textContent = "Cerco…";
    const d = await api(`/api/widget-data/geocode?name=${encodeURIComponent(name)}&country=${$c.value}`)
      .catch(() => ({ results: [] }));
    window._wRes = d.results || [];
    $cy.innerHTML = `<option value="">— scegli —</option>` +
      window._wRes.map((r, i) => `<option value="s${i}">${esc(r.name)}${r.region ? " (" + esc(r.region) + ")" : ""}</option>`).join("");
    $cur.textContent = window._wRes.length ? "Scegli una città dalla lista" : "Nessun risultato";
  };
  if ($search) {
    $("w-find").onclick = doFind;
    $search.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); doFind(); } };
  }
}

// Se ridimensioni col mouse mentre il drawer è aperto, aggiorna i numeri.
grid.on("resizestop", (e, el) => {
  const n = el.gridstackNode;
  if (!drawerId || !n || n.id !== drawerId) return;
  const wIn = document.querySelector('[data-dim="w"]');
  const hIn = document.querySelector('[data-dim="h"]');
  if (wIn) wIn.value = n.w;
  if (hIn) hIn.value = n.h;
});
$("drawer-close").onclick = () => $("drawer").classList.remove("open");
$("drawer-remove").onclick = () => {
  if (drawerId) { grid.removeWidget(W.get(drawerId).el); W.delete(drawerId); }
  $("drawer").classList.remove("open");
};

/* ============================================================
   FOTO & ACCOUNT
   ============================================================ */
async function loadAccounts() {
  const accs = await api("/api/accounts");
  $("acc-list").innerHTML = accs.length
    ? accs.map((a) => `<div class="acc"><span>${a.display_name} ${a.connected ? "✓" : "…"}</span>
        <button class="btn" onclick="delAcc(${a.id})">Rimuovi</button></div>`).join("")
    : `<p class="info">Nessun account collegato.</p>`;
  loadGallery();
}

async function loadGallery() {
  const d = await api("/api/photos");
  const photos = d.photos || [];
  $("photo-count").textContent = photos.length;
  $("gallery").innerHTML = photos.map((p) =>
    `<div class="thumb"><img src="${p.thumb || p.url}" loading="lazy">
      <button class="thumb-x" onclick="delPhoto(${p.id})" title="Elimina">×</button></div>`
  ).join("");
}

window.delPhoto = async (id) => {
  await fetch("/api/photos/" + id, { method: "DELETE" });
  loadGallery();
};

async function loadImageSettings() {
  const s = await api("/api/settings").catch(() => ({}));
  $("max-dim").value = String(s.max_image_dim ?? 2560);
}
$("save-maxdim").onclick = async () => {
  await api("/api/settings", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ max_image_dim: +$("max-dim").value }),
  });
  status("Risoluzione salvata ✓ (vale per le prossime foto)");
};
$("reprocess").onclick = async () => {
  if (!confirm("Riapplicare la risoluzione alle foto già caricate? Si può solo ridurre: il dettaglio già perso non torna.")) return;
  status("Riprocesso le foto…");
  await fetch("/api/photos/reprocess", { method: "POST" });
  status("Foto riprocessate ✓");
  loadGallery();
};

$("photo-upload").onclick = async () => {
  const files = $("photo-files").files;
  if (!files.length) return status("Scegli una o più foto");
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  status("Carico le foto…");
  await fetch("/api/photos/upload", { method: "POST", body: fd });
  status("Foto caricate ✓");
  $("photo-files").value = "";
  loadGallery();
};
window.delAcc = async (id) => {
  await fetch("/api/accounts/" + id, { method: "DELETE" });
  loadAccounts();
};

$("conn-dropbox-link").onclick = async () => {
  const link = $("dropbox-link").value.trim();
  if (!link) { $("conn-info").textContent = "Incolla il link della cartella Dropbox."; return; }
  $("conn-info").textContent = "Collego la cartella Dropbox e sincronizzo… (può volerci qualche secondo)";
  const r = await fetch("/api/accounts/dropbox-link", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link }),
  });
  if (r.ok) {
    const d = await r.json();
    $("conn-info").textContent = `Cartella Dropbox collegata ✓ Scaricate ${d.downloaded} foto. Si aggiornerà da sola.`;
    loadAccounts();
    if (typeof loadGallery === "function") loadGallery();
  } else {
    const e = await r.json().catch(() => ({}));
    $("conn-info").textContent = "Errore: " + (e.detail || "link non valido");
  }
};

$("conn-gdrive-link").onclick = async () => {
  const link = $("gdrive-link").value.trim();
  if (!link) { $("conn-info").textContent = "Incolla il link della cartella Drive."; return; }
  $("conn-info").textContent = "Collego la cartella e sincronizzo… (può volerci qualche secondo)";
  const r = await fetch("/api/accounts/gdrive-link", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link, api_key: $("gdrive-apikey").value.trim() }),
  });
  if (r.ok) {
    const d = await r.json();
    $("conn-info").textContent = `Cartella collegata ✓ Scaricate ${d.downloaded} foto. Si aggiornerà da sola.`;
    loadAccounts();
    if (typeof loadGallery === "function") loadGallery();
  } else {
    const e = await r.json().catch(() => ({}));
    $("conn-info").textContent = "Errore: " + (e.detail || "link non valido");
  }
};

$("sync-now").onclick = async () => {
  status("Sincronizzo…");
  await fetch("/api/photos/sync", { method: "POST" });
  status("Sincronizzato ✓"); loadAccounts();
};

/* ---------- Rimuovi tutti i widget ---------- */
$("clear-widgets").onclick = async () => {
  if (!confirm("Rimuovere TUTTI i widget?")) return;
  grid.removeAll(); W.clear();
  await api("/api/widgets", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: "[]",
  });
  status("Tutti i widget rimossi");
};

/* ---------- Durata del photoframe (secondi per foto) ---------- */
async function loadRotate() {
  const d = await api("/api/photos");
  $("rotate-secs").value = d.rotate_seconds || 60;
}
$("save-rotate").onclick = async () => {
  const n = Math.max(3, parseInt($("rotate-secs").value, 10) || 60);
  await api("/api/settings", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rotate_seconds: n }),
  });
  status("Durata salvata ✓");
};

/* ============================================================
   SISTEMA: stato, backup, sessione
   ============================================================ */
async function loadStatus() {
  const s = await api("/api/status").catch(() => null);
  if (!s) return;
  const h = Math.floor(s.uptime_s / 3600), m = Math.floor((s.uptime_s % 3600) / 60);
  $("status-box").innerHTML =
    `Acceso da: <b>${h}h ${m}m</b><br>` +
    `Foto: ${s.photos} · Widget: ${s.widgets} · Account: ${s.accounts}<br>` +
    `Ultimo sync: ${s.last_sync || "mai"}<br>` +
    (s.last_error
      ? `<span style="color:var(--danger)">Errore: ${s.last_error}</span>`
      : `Nessun errore`);
}
$("status-refresh").onclick = loadStatus;

$("backup-export").onclick = async () => {
  const data = await api("/api/backup");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "dashboard-config.json";
  a.click();
};
$("backup-import").onclick = async () => {
  const f = $("backup-file").files[0];
  if (!f) return status("Scegli un file .json");
  await fetch("/api/restore", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: await f.text(),
  });
  status("Configurazione ripristinata ✓");
  loadAspetto(); loadWidgets();
};
$("logout-btn").onclick = async () => {
  await fetch("/api/logout", { method: "POST" });
  location.reload();
};

/* ============================================================
   LOGIN GATE + AVVIO
   ============================================================ */
$("login-btn").onclick = async () => {
  const r = await fetch("/api/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: $("login-pw").value }),
  });
  if (r.ok) location.reload();
  else $("login-err").textContent = "Password errata";
};
$("login-pw").addEventListener("keydown", (e) => { if (e.key === "Enter") $("login-btn").click(); });

async function init() {
  const me = await api("/api/me").catch(() => ({ required: false, authed: true }));
  if (me.required && !me.authed) {
    $("login-gate").style.display = "flex";
    return;
  }
  loadAspetto();
  loadWidgets();
  loadAccounts();
  loadRotate();
  loadStatus();
  loadImageSettings();
}
init();

/* ---- Tema del pannello admin (persistente nel browser) ---- */
(function initSkin() {
  const sel = document.getElementById("admin-skin");
  if (!sel) return;
  const saved = localStorage.getItem("piboard-skin") || "scuro";
  document.documentElement.dataset.skin = saved;
  sel.value = saved;
  sel.onchange = () => {
    document.documentElement.dataset.skin = sel.value;
    localStorage.setItem("piboard-skin", sel.value);
  };
})();

/* ---- Pop-up "Come ottengo la chiave API" ---- */
(function apiKeyHelp() {
  const modal = document.getElementById("apikey-modal");
  const open = document.getElementById("apikey-help");
  const close = document.getElementById("apikey-close");
  if (!modal || !open) return;
  const show = () => { modal.style.display = "flex"; };
  const hide = () => { modal.style.display = "none"; };
  open.onclick = show;
  close.onclick = hide;
  modal.onclick = (e) => { if (e.target === modal) hide(); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
})();
