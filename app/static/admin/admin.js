/* ============================================================
   Smart Dashboard — pannello admin
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
  "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Oswald", "Raleway",
  "Inter", "Nunito", "Bebas Neue", "Pacifico", "Orbitron", "Lobster",
  "Playfair Display", "Merriweather", "Source Code Pro", "Sora", "Quicksand",
];
function buildFontOptions(selected) {
  const uploaded = (window._fontFaces || []).map((f) => f.family);
  const seen = new Set();
  const out = [];
  ["", ...uploaded, ...GOOGLE_FONTS].forEach((n) => {
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  });
  return out.map((n) =>
    `<option value="${n}" ${n === (selected || "") ? "selected" : ""}>${n || "(predefinito)"}</option>`
  ).join("");
}

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

$("save-aspetto").onclick = async () => {
  const payload = {
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
  await api("/api/settings", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  status("Aspetto salvato ✓");
};

/* ============================================================
   WIDGET (gridstack)
   ============================================================ */
const grid = GridStack.init({ column: 12, cellHeight: 46, margin: 5, float: true, maxRow: 12 }, "#grid");
const W = new Map();  // id -> {type, config, el}

const DEFAULTS = {
  clock: { style: "digital", format: "HH:mm", showDate: true },
  weather: { lat: 44.49, lon: 11.34, units: "metric", place: "Bologna" },
  calendar: { url: "", title: "Calendario" },
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
  W.set(id, { type, config: opts.config || { ...DEFAULTS[type] }, el });
  return id;
}

document.querySelectorAll("[data-add]").forEach((b) => {
  b.onclick = () => addWidget(b.dataset.add);
});

async function loadWidgets() {
  const widgets = await api("/api/widgets");
  grid.removeAll(); W.clear();
  widgets.forEach((w) => addWidget(w.type, { x: w.x, y: w.y, w: w.w, h: w.h, config: w.config }));
}

$("save-widgets").onclick = async () => {
  const nodes = grid.save(false);  // [{id,x,y,w,h}]
  const payload = nodes.map((n) => {
    const item = W.get(n.id);
    return { type: item.type, x: n.x, y: n.y, w: n.w, h: n.h, enabled: true, config: item.config };
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
  weather: [
    { k: "place", t: "text", label: "Nome luogo" },
    { k: "lat", t: "text", label: "Latitudine" },
    { k: "lon", t: "text", label: "Longitudine" },
    { k: "units", t: "select", label: "Unità", opts: ["metric", "imperial"] },
  ],
  calendar: [{ k: "title", t: "text", label: "Titolo" }, { k: "url", t: "text", label: "URL iCal (.ics)" }],
  rss: [{ k: "title", t: "text", label: "Titolo" }, { k: "url", t: "text", label: "URL feed RSS" }],
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
  $("drawer-title").textContent = NAMES[item.type] + " · stile e dati";
  $("drawer-body").innerHTML =
    FIELDS[item.type].map((f) => field(item.config, f)).join("") +
    `<hr style="border-color:var(--line);margin:1rem 0">` +
    STYLE_FIELDS.map((f) => field(item.config, f)).join("");
  // collega i campi al config
  $("drawer-body").querySelectorAll("[data-k]").forEach((inp) => {
    inp.onchange = () => {
      const k = inp.dataset.k;
      item.config[k] = inp.type === "checkbox" ? inp.checked : inp.value;
    };
  });
  $("drawer").classList.add("open");
};
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

$("conn-onedrive").onclick = async () => {
  const d = await api("/api/accounts/onedrive/connect", { method: "POST" });
  $("conn-info").innerHTML =
    `Vai su <a href="${d.verification_uri}" target="_blank">${d.verification_uri}</a> ` +
    `e inserisci il codice: <code>${d.user_code}</code><br>` +
    `Poi torna qui: l'account comparirà tra quelli collegati.`;
  setTimeout(loadAccounts, 15000);
};

$("conn-google").onclick = async () => {
  const d = await api("/api/accounts/google/connect");
  window.open(d.auth_url, "_blank");
  $("conn-info").innerHTML = "Completa l'accesso Google nella nuova scheda, poi seleziona le foto.";
  setTimeout(loadAccounts, 15000);
};

$("conn-gdrive").onclick = () => {
  // Il flusso Drive è un redirect: lo apriamo nella stessa finestra.
  $("conn-info").innerHTML = "Apro l'accesso a Google Drive…";
  window.location.href = "/api/gdrive/connect";
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
