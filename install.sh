#!/usr/bin/env bash
#
# install.sh — deploy della PiBoard su Raspberry Pi OS Trixie Lite.
#
# USO:  copia la cartella del backend sul Pi, entraci ed esegui:
#           chmod +x install.sh
#           sudo ./install.sh
#
# Idempotente: puoi rilanciarlo senza danni.
# NON attiva ancora l'OverlayFS read-only: quello e' la Fase 4, da fare solo
# quando tutto e' stabile.
#
# Variabili sovrascrivibili:
#   KIOSK_USER=kiosk            utente che esegue browser e backend
#   KIOSK_URL=...               URL aperto dal kiosk (default: /docs, temporaneo)

set -euo pipefail

KIOSK_USER="${KIOSK_USER:-kiosk}"
APP_DIR="/opt/piboard"
DATA_DIR="/data"
KIOSK_URL="${KIOSK_URL:-http://localhost:8080}"        # la dashboard (display)
SCREEN_OFF="${SCREEN_OFF:-23:00}"                      # ora spegnimento schermo
SCREEN_ON="${SCREEN_ON:-07:00}"                        # ora accensione schermo
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "Esegui con sudo:  sudo ./install.sh" >&2
  exit 1
fi
echo ">> Utente kiosk: $KIOSK_USER  |  sorgenti: $SRC_DIR"

# --- 1/8  Pacchetti di sistema -------------------------------------------
echo ">> [1/8] Pacchetti..."
apt update
apt full-upgrade -y
apt install --no-install-recommends -y \
  greetd cage seatd chromium \
  libgles2 fontconfig fonts-dejavu-core \
  python3 python3-venv python3-pip curl

CHROMIUM_BIN="$(command -v chromium-browser || command -v chromium || true)"
[[ -n "$CHROMIUM_BIN" ]] || { echo "Chromium non trovato" >&2; exit 1; }

# --- 2/8  Driver grafico KMS + CMA (config.txt) --------------------------
echo ">> [2/8] Driver KMS + CMA..."
CONFIG=/boot/firmware/config.txt
[[ -f $CONFIG ]] || CONFIG=/boot/config.txt
if ! grep -q "vc4-kms-v3d,cma-256" "$CONFIG"; then
  if grep -q "^dtoverlay=vc4-kms-v3d" "$CONFIG"; then
    sed -i 's/^dtoverlay=vc4-kms-v3d.*/dtoverlay=vc4-kms-v3d,cma-256/' "$CONFIG"
  else
    echo "dtoverlay=vc4-kms-v3d,cma-256" >> "$CONFIG"
  fi
fi
grep -q "^max_framebuffers=2" "$CONFIG" || echo "max_framebuffers=2" >> "$CONFIG"

# --- 3/8  Utente kiosk + gruppi GPU/input --------------------------------
echo ">> [3/8] Utente $KIOSK_USER..."
id "$KIOSK_USER" &>/dev/null || useradd -m -s /bin/bash "$KIOSK_USER"
usermod -aG video,render,input "$KIOSK_USER"

# --- 4/8  Cartella dati persistente --------------------------------------
echo ">> [4/8] $DATA_DIR..."
mkdir -p "$DATA_DIR/db" "$DATA_DIR/photos_cache" "$DATA_DIR/fonts" "$DATA_DIR/thumbs"
chown -R "$KIOSK_USER:$KIOSK_USER" "$DATA_DIR"

# --- 5/8  Backend: copia + venv + dipendenze -----------------------------
echo ">> [5/8] Backend in $APP_DIR..."
mkdir -p "$APP_DIR"
rm -rf "$APP_DIR/app"
cp -r "$SRC_DIR/app" "$APP_DIR/app"
cp "$SRC_DIR/requirements.txt" "$APP_DIR/"
[[ -f "$APP_DIR/.env" ]] || cp "$SRC_DIR/.env.example" "$APP_DIR/.env"
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install --upgrade pip -q
"$APP_DIR/.venv/bin/pip" install -q -r "$APP_DIR/requirements.txt"
chown -R "$KIOSK_USER:$KIOSK_USER" "$APP_DIR"

# --- 6/8  Servizio systemd del backend -----------------------------------
echo ">> [6/8] Servizio piboard-backend..."
cat > /etc/systemd/system/piboard-backend.service <<EOF
[Unit]
Description=PiBoard backend (FastAPI)
After=network-online.target
Wants=network-online.target

[Service]
User=$KIOSK_USER
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# --- 7/8  Kiosk: script Chromium + autologin greetd ----------------------
echo ">> [7/8] Kiosk (cage + Chromium)..."
cat > /usr/local/bin/kiosk.sh <<EOF
#!/bin/bash
set -euo pipefail
CACHE_DIR="\${XDG_RUNTIME_DIR:-/tmp}/chromium-cache"
PROFILE_DIR="\${XDG_RUNTIME_DIR:-/tmp}/chromium-profile"
mkdir -p "\$CACHE_DIR" "\$PROFILE_DIR"

# Attende che il backend risponda prima di aprire il browser (evita race al boot)
until curl -sf http://localhost:8080/healthz >/dev/null; do sleep 1; done

exec $CHROMIUM_BIN \\
  --kiosk \\
  --ozone-platform=wayland \\
  --enable-features=UseOzonePlatform,CanvasOopRasterization \\
  --use-angle=gles \\
  --enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist \\
  --render-node-override=/dev/dri/renderD128 \\
  --disk-cache-dir="\$CACHE_DIR" --disk-cache-size=104857600 \\
  --user-data-dir="\$PROFILE_DIR" \\
  --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
  --hide-scrollbars --no-first-run --fast --fast-start \\
  --disable-translate --disable-features=TranslateUI,Translate \\
  --disable-pinch --overscroll-history-navigation=0 \\
  --autoplay-policy=no-user-gesture-required \\
  --force-device-scale-factor=1 --password-store=basic \\
  --disable-component-update --disable-background-networking \\
  --disable-sync --disable-breakpad \\
  --check-for-update-interval=2592000 \\
  $KIOSK_URL
EOF
chmod +x /usr/local/bin/kiosk.sh

mkdir -p /etc/greetd
cat > /etc/greetd/config.toml <<EOF
[terminal]
vt = 7

[initial_session]
command = "cage -s -- /usr/local/bin/kiosk.sh"
user = "$KIOSK_USER"

[default_session]
command = "cage -s -- /usr/local/bin/kiosk.sh"
user = "$KIOSK_USER"
EOF

# --- 8/8  Abilita i servizi ----------------------------------------------
echo ">> [8/8] Abilito i servizi..."
systemctl daemon-reload
systemctl enable seatd
systemctl enable piboard-backend
systemctl set-default graphical.target
systemctl enable greetd

# --- 9  Resilienza & manutenzione ----------------------------------------
echo ">> [9] Log in RAM, watchdog, riavvio notturno, spegnimento schermo..."

# Log di journald in RAM (riduce drasticamente le scritture su microSD)
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/volatile.conf <<EOF
[Journal]
Storage=volatile
RuntimeMaxUse=32M
EOF

# Watchdog hardware: riavvia il Pi se il sistema si pianta
grep -q "^dtparam=watchdog=on" "$CONFIG" || echo "dtparam=watchdog=on" >> "$CONFIG"
mkdir -p /etc/systemd/system.conf.d
cat > /etc/systemd/system.conf.d/watchdog.conf <<EOF
[Manager]
RuntimeWatchdogSec=15
RebootWatchdogSec=2min
EOF

# Riavvio notturno della sessione grafica (mantiene Chromium "fresco")
cat > /etc/systemd/system/piboard-refresh.service <<EOF
[Unit]
Description=Riavvio notturno della sessione kiosk
[Service]
Type=oneshot
ExecStart=/usr/bin/systemctl restart greetd
EOF
cat > /etc/systemd/system/piboard-refresh.timer <<EOF
[Unit]
Description=Riavvio kiosk ogni notte alle 04:00
[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true
[Install]
WantedBy=timers.target
EOF

# Spegnimento schermo programmato (HDMI off/on via vcgencmd)
cat > /etc/systemd/system/screen-off.service <<EOF
[Unit]
Description=Spegne lo schermo
[Service]
Type=oneshot
ExecStart=/usr/bin/vcgencmd display_power 0
EOF
cat > /etc/systemd/system/screen-on.service <<EOF
[Unit]
Description=Accende lo schermo
[Service]
Type=oneshot
ExecStart=/usr/bin/vcgencmd display_power 1
EOF
cat > /etc/systemd/system/screen-off.timer <<EOF
[Unit]
Description=Schermo OFF alle ${SCREEN_OFF:-23:00}
[Timer]
OnCalendar=*-*-* ${SCREEN_OFF:-23:00}:00
Persistent=true
[Install]
WantedBy=timers.target
EOF
cat > /etc/systemd/system/screen-on.timer <<EOF
[Unit]
Description=Schermo ON alle ${SCREEN_ON:-07:00}
[Timer]
OnCalendar=*-*-* ${SCREEN_ON:-07:00}:00
Persistent=true
[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable piboard-refresh.timer screen-off.timer screen-on.timer

echo
echo "============================================================"
echo " Installazione completata."
echo
echo "   1) (opzionale) in $APP_DIR/.env puoi impostare:"
echo "        ADMIN_PASSWORD=...   (protegge il pannello admin)"
echo "        LOCAL_PHOTOS_PATH=...  oppure gli ID OAuth"
echo
echo "   2) riavvia:        sudo reboot"
echo
echo "   3) verifica dal tuo PC:"
echo "        PiBoard:  http://$(hostname).local:8080/"
echo "        admin:      http://$(hostname).local:8080/admin/"
echo
echo " Schermo OFF ${SCREEN_OFF:-23:00} / ON ${SCREEN_ON:-07:00} · riavvio kiosk 04:00"
echo " Log:  journalctl -u piboard-backend -f"
echo "============================================================"
