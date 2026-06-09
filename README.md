<div align="center">

# 🖥️ PiBoard

**Smart dashboard e cornice digitale self-hosted per Raspberry Pi.**
Un'alternativa open source a DAKboard: foto, orologio, meteo, calendario e notizie su un qualsiasi schermo, gestiti da un pannello web.

**Italiano** · [English](README.en.md)

</div>

---

## 📑 Indice
- [Funzionalità](#-funzionalità)
- [Requisiti](#-requisiti)
- [Installazione](#-installazione)
- [Aprire la dashboard](#-aprire-la-dashboard)
- [Sorgenti foto](#-sorgenti-foto)
- [Widget](#-widget)
- [Configurazione (.env)](#️-configurazione-env)
- [Aggiornare PiBoard](#-aggiornare-piboard)
- [Risoluzione problemi](#-risoluzione-problemi)
- [Pubblicare su GitHub](#-pubblicare-su-github)
- [Licenza](#-licenza)

---

## ✨ Funzionalità

- **Cornice digitale** a tutto schermo con dissolvenza incrociata, effetto Ken Burns e **GIF animate**.
- **Widget a griglia** completamente ridimensionabili (trascini i bordi col mouse o imposti larghezza/altezza/profondità), che si adattano automaticamente alla loro dimensione:
  - **Orologio** digitale o analogico;
  - **Meteo in tempo reale** stile telefono, con selettore a cascata **Paese → Regione → Provincia → Città** (Italia con tutti i ~7.900 comuni; oltre 30 Paesi) e previsione a 3 giorni;
  - **Calendario** a tessera stile telefono (mese, giorno, anno) che mostra in automatico gli eventi da link **iCalendar** e **Google Calendar** (anche ricorrenti); disponibili anche vista mese e agenda;
  - **Notizie (RSS)** con giornali pronti per sezione (politica, economia, mondo, sport…) e una notizia in evidenza che ruota ogni 10 minuti;
  - **Testo** libero.
- **12 temi pronti** da menu a tendina, ~80 font Google (ognuno mostrato nel proprio carattere) e un campo **CSS personalizzato**. Anche il **pannello di amministrazione** ha temi colore (scuro, crema, chiaro, indaco, foresta).
- **Sorgenti foto multiple**: USB/cartella locale, caricamento manuale, OneDrive, Google Photos, Google Drive e Dropbox.
- **Pannello web** con password opzionale, **backup/ripristino** della configurazione e pagina di stato.
- **Modalità kiosk** robusta: Chromium a schermo intero senza cursore né barra di traduzione, watchdog hardware, riavvio notturno e accensione/spegnimento automatico dello schermo.

## 📦 Requisiti

- Raspberry Pi 4 (consigliato) o 3B+.
- **Raspberry Pi OS Lite (Trixie) a 64 bit**.
- Una microSD e uno schermo HDMI.

## 🚀 Installazione

### 1) Prepara la scheda SD
Con [Raspberry Pi Imager](https://www.raspberrypi.com/software/) scrivi *Raspberry Pi OS Lite (64-bit)*. Nelle impostazioni avanzate (⚙️) abilita **SSH**, imposta un **nome utente** (es. `kiosk`), l'hostname (es. `dashboard`) e la rete Wi-Fi. Avvia il Pi e prendi nota del suo indirizzo (es. `dashboard.local` o l'IP dal router).

### 2) Copia PiBoard sul Raspberry
Scarica lo zip dalla pagina [Releases](../../releases) **oppure** clona il repo. Su Windows, da **PowerShell**, estrai lo zip e copialo sul Pi:

```powershell
# estrai lo zip (usa Expand-Archive per evitare cartelle annidate)
Expand-Archive "$HOME\Downloads\PiBoard.zip" "$HOME\Desktop" -Force

# copia la cartella sul Raspberry
scp -r "$HOME\Desktop\PiBoard" <utente>@<ip-o-hostname>:/home/<utente>/
```

> 💡 **Non** estrarre lo zip con doppio click in Esplora risorse: crea una cartella annidata `PiBoard\PiBoard\`. `Expand-Archive` no.

Su Linux/macOS:
```bash
unzip PiBoard.zip
scp -r PiBoard <utente>@<ip-o-hostname>:/home/<utente>/
```

### 3) Installa
Entra in SSH e lancia l'installer:
```bash
ssh <utente>@<ip-o-hostname>
```
```bash
cd ~/PiBoard
sed -i 's/\r$//' install.sh   # normalizza i fine-riga (se il file arriva da Windows)
chmod +x install.sh
sudo bash install.sh
sudo reboot
```

L'installer crea l'ambiente Python, installa le dipendenze, configura il servizio `piboard-backend`, la modalità kiosk (cage + Chromium), il watchdog e i timer di riavvio/spegnimento schermo. Dopo il riavvio lo schermo mostra PiBoard.

## 🔗 Aprire la dashboard

- **Display:** `http://<ip-o-hostname>:8080/`
- **Pannello admin:** `http://<ip-o-hostname>:8080/admin/`  ← lo **slash finale è obbligatorio**

Esempio con hostname `dashboard`: `http://dashboard.local:8080/admin/`.

> Dopo ogni aggiornamento fai **Ctrl+Shift+R** nel browser per svuotare la cache.

## 🖼️ Sorgenti foto

| Sorgente | Login? | Aggiornamento automatico | Note |
|---|---|---|---|
| **Caricamento manuale** | No | — | Trascini le foto nel pannello |
| **USB / cartella locale** | No | Sì | Imposta `LOCAL_PHOTOS_PATH` |
| **Dropbox (link)** | No | Sì | Incolli il link di una cartella condivisa |
| **Google Drive (link)** | No | Sì | Cartella condivisa + una chiave API |

> 💡 I metodi "a link" (Dropbox e Google Drive) sono i più semplici: niente account da collegare, basta condividere una cartella "con chiunque abbia il link" e incollarlo nel pannello.

### Google Drive con un link (consigliato)
1. Su [Google Cloud Console](https://console.cloud.google.com) crea un progetto.
2. **API e servizi → Libreria** → abilita **Google Drive API**.
3. **API e servizi → Credenziali → Crea credenziali → Chiave API** (inizia con `AIza…`).
4. Su Google Drive crea una cartella, mettici le foto e condividila come **"Chiunque con il link → Visualizzatore"**.
5. Nel pannello, riquadro *Cartella Google Drive da link*: incolla link e chiave API e premi **Collega**. (Il pulsante **"Come ottengo la chiave API"** mostra questi stessi passi.)

> ⚠️ Serve la **Chiave API** (`AIza…`), non un **ID client OAuth** (`…apps.googleusercontent.com`).

### Dropbox con un link
1. Su Dropbox crea una cartella, mettici le foto e crea un link **"Chiunque con il link"**.
2. Nel pannello, riquadro *Cartella Dropbox da link*: incolla il link e premi **Collega**. (Nessuna chiave necessaria.)

## 🧩 Widget

- **Calendario:** vista *card* (stile telefono), *mese* o *agenda*. Mostra la data del dispositivo e, se colleghi un link **iCalendar** o **Google Calendar**, gli eventi in arrivo.
- **Meteo:** città scelta con i menu a cascata (o, fuori dall'Italia, con la ricerca città). Mostra temperatura, condizione, Max/Min e previsione.
- **Notizie:** scegli un giornale predefinito (o incolla un feed RSS). Una notizia in evidenza ruota ogni 10 minuti.
- **Aspetto:** scegli un tema dal menu, i font (mostrati nel proprio carattere) e, se vuoi, aggiungi CSS personalizzato.

## ⚙️ Configurazione (`.env`)

Le impostazioni vivono in `/opt/piboard/.env`:

```ini
ADMIN_PASSWORD=            # password del pannello (vuoto = nessuna)
MAX_IMAGE_DIM=2560         # lato massimo delle foto

MS_CLIENT_ID=              # OneDrive
GDRIVE_API_KEY=            # Google Drive via link (puoi metterla anche dal pannello)
LOCAL_PHOTOS_PATH=         # cartella locale/USB/NAS

PHOTO_SYNC_MINUTES=30      # ogni quanto sincronizzare le sorgenti cloud
ROTATE_SECONDS=60          # durata di ogni foto
```

Dopo aver modificato il `.env`:
```bash
sudo systemctl restart piboard-backend
```

## 🔄 Aggiornare PiBoard

Ricopia la cartella aggiornata e rilancia l'installer (la tua `.env` e le foto vengono mantenute):
```powershell
scp -r "$HOME\Desktop\PiBoard" <utente>@<ip>:/home/<utente>/
```
```bash
ssh <utente>@<ip> "cd ~/PiBoard && sed -i 's/\r$//' install.sh && chmod +x install.sh && sudo bash install.sh && sudo systemctl restart piboard-backend"
```

In alternativa, se usi Git sul Pi: `cd ~/PiBoard && git pull && sudo bash install.sh && sudo systemctl restart piboard-backend`.

## 🛠️ Risoluzione problemi

**Errore SSH dopo aver reinstallato il sistema operativo (`WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED`).**
Ogni volta che si reinstalla il sistema operativo sul Raspberry Pi, il dispositivo genera una nuova chiave di sicurezza. Il PC ha ancora salvata quella vecchia e blocca il collegamento con un errore del tipo:
```
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
Host key verification failed.
```
Per risolvere, cancella la vecchia chiave salvata sul PC e riconnettiti:
```powershell
ssh-keygen -R dashboard.local
ssh-keygen -R <ip-del-raspberry>   # es. ssh-keygen -R 192.168.0.198
ssh kiosk@dashboard.local
```
Verrà chiesto di nuovo di confermare con `yes` e di inserire la password: è il comportamento corretto. Lo stesso errore blocca anche `scp`: basta eseguire i due `ssh-keygen -R` prima di copiare i file.

**Il pannello mostra "SmartDashboard" invece di "PiBoard".**
Significa che sul Raspberry è ancora in esecuzione una versione precedente del software. Succede quando si aggiorna da una vecchia installazione: il vecchio servizio `dashboard-backend` occupa la porta 8080 e il nuovo `piboard-backend` non riesce a partire. Per sostituirlo definitivamente:
```bash
# 1) rimuovi il vecchio servizio e la vecchia cartella
sudo systemctl disable --now dashboard-backend 2>/dev/null
sudo rm -f /etc/systemd/system/dashboard-backend.service
sudo systemctl daemon-reload
sudo rm -rf /opt/dashboard

# 2) libera la porta e avvia PiBoard
sudo fuser -k 8080/tcp 2>/dev/null
sudo pkill -f 'uvicorn app.main:app' 2>/dev/null
sudo systemctl restart piboard-backend
sleep 5

# 3) verifica — deve stampare OK
curl -s localhost:8080/admin/ | grep -o 'Pi<span>Board</span>' && echo OK
```
Se stampa `OK` → `sudo reboot` + **Ctrl+Shift+R** nel browser.

**Vedo ancora la versione vecchia / le modifiche non compaiono.**
Conta solo il codice **in esecuzione**, non i file sul PC. Verifica cosa serve davvero il Pi:
```bash
curl -s localhost:8080/admin/ | grep -o 'Pi<span>Board</span>' && echo OK
```
Se non stampa `OK`, il Pi sta servendo codice vecchio: rifai copia + installazione, poi nel browser **Ctrl+Shift+R**.

**`install.sh: command not found`** — il file non è eseguibile o ha fine-riga di Windows. Usa:
```bash
cd ~/PiBoard && sed -i 's/\r$//' install.sh && chmod +x install.sh && sudo bash install.sh
```

**Il servizio non parte / `address already in use`** — un vecchio servizio occupa la porta 8080. Rimuovilo e libera la porta:
```bash
sudo systemctl disable --now dashboard-backend 2>/dev/null
sudo rm -f /etc/systemd/system/dashboard-backend.service
sudo systemctl daemon-reload
sudo fuser -k 8080/tcp 2>/dev/null
sudo systemctl restart piboard-backend
```

**Vedere i log in tempo reale:**
```bash
journalctl -u piboard-backend -f
```

**Stato e porta:**
```bash
systemctl status piboard-backend --no-pager
sudo ss -ltnp | grep :8080
```

## 🐙 Pubblicare su GitHub

1. Crea un repository **vuoto** su GitHub chiamato `PiBoard` (senza README).
2. Nei due README il repository è già configurato con il tuo username.
3. Dalla cartella del progetto:
   ```bash
   cd PiBoard
   git init
   git branch -M main
   git remote add origin https://github.com/yungestlavi/PiBoard.git
   git add .
   git commit -m "PiBoard v1.0"
   git push -u origin main
   ```
   > Se ottieni *"remote origin already exists"*: `git remote set-url origin https://github.com/yungestlavi/PiBoard.git`
4. **Aggiornamenti** successivi:
   ```bash
   git add -A && git commit -m "descrizione modifiche" && git push
   ```
5. **Release**: su GitHub → *Releases → Draft a new release* → crea un tag (es. `v1.0.0`), un titolo, e (opzionale) allega lo zip del progetto come file binario.

> Il file `.gitignore` esclude già i segreti e i dati locali (`.env`, `/data/`, cache, `.venv/`). **Non** mettere mai chiavi o password nel `.env.example`.

## 📄 Licenza

[MIT](LICENSE).
