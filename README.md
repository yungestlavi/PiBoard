<div align="center">

# 🖥️ PiBoard

**Smart dashboard e cornice digitale self-hosted per Raspberry Pi.**
Un'alternativa open source a DAKboard: foto, orologio, meteo, calendario e notizie su un qualsiasi schermo, gestiti da un pannello web.

**Italiano** · [English](README.en.md)

</div>

---

## ✨ Funzionalità

- **Cornice digitale** a tutto schermo con dissolvenza incrociata, effetto Ken Burns e supporto **GIF animate**.
- **Widget a griglia** completamente ridimensionabili: trascini i bordi col mouse oppure imposti larghezza, altezza e profondità dal pannello. Disponibili:
  - **Orologio** digitale o analogico;
  - **Meteo in tempo reale** con selettore a cascata **Paese → Regione → Provincia → Città** (Italia con tutti i ~7.900 comuni; oltre 30 Paesi) e previsione a 3 giorni;
  - **Calendario** a griglia mensile (con la data del dispositivo) o agenda, che mostra in automatico gli eventi da link **iCalendar** e **Google Calendar** (anche ricorrenti);
  - **Notizie (RSS)** con giornali pronti divisi per sezione (politica, economia/borsa, mondo, sport…) o un feed a tua scelta; una notizia in evidenza che **ruota ogni 10 minuti**;
  - **Testo** libero.
- **12 temi pronti** selezionabili da un menu a tendina (Notte, Vetro intenso, Neon, Vintage, Terminale, Pastello…), ~45 font Google (ogni font si vede nel proprio carattere nel menu) e un campo per il **CSS personalizzato**.
- **Sorgenti foto multiple** (vedi sotto): USB/cartella locale, caricamento manuale, OneDrive, Google Photos, Google Drive e Dropbox.
- **Pannello web** di amministrazione con password opzionale, **backup/ripristino** della configurazione e pagina di stato.
- **Modalità kiosk** robusta: Chromium a schermo intero senza cursore né barra di traduzione, watchdog hardware, riavvio notturno e accensione/spegnimento automatico dello schermo.

## 📦 Requisiti

- Raspberry Pi 4 (consigliato) o 3B+.
- **Raspberry Pi OS Lite (Trixie) a 64 bit**.
- Una scheda microSD e uno schermo HDMI.

## 🚀 Installazione

1. **Flasha il sistema** con [Raspberry Pi Imager](https://www.raspberrypi.com/software/): scegli *Raspberry Pi OS Lite (64-bit)*. Nelle impostazioni avanzate abilita **SSH**, imposta un nome utente (es. `kiosk`) e la rete Wi-Fi.
2. **Avvia il Pi** e trova il suo indirizzo IP (dal router o con `ping <hostname>.local`).
3. **Copia PiBoard sul Pi**. Scarica lo zip dalla pagina [Releases](../../releases) ed estrailo, oppure clona il repo:
   ```bash
   git clone https://github.com/TUO-UTENTE/PiBoard.git
   ```
   Poi copia la cartella sul Pi (dal PC):
   ```bash
   scp -r PiBoard <utente>@<ip-del-pi>:/home/<utente>/
   ```
4. **Esegui l'installer** (sul Pi, via SSH):
   ```bash
   cd ~/PiBoard
   chmod +x install.sh
   sudo ./install.sh
   sudo reboot
   ```

Dopo il riavvio lo schermo mostra la dashboard. Il pannello di amministrazione è su:

```
http://<ip-del-pi>:8080/admin/
```

(lo slash finale è importante). Il display è su `http://<ip-del-pi>:8080/`.

## 🖼️ Sorgenti foto

| Sorgente | Login? | Aggiornamento automatico | Note |
|---|---|---|---|
| **Caricamento manuale** | No | — | Trascini le foto nel pannello |
| **USB / cartella locale** | No | Sì | Imposta `LOCAL_PHOTOS_PATH` |
| **Dropbox (link)** | No | Sì | Incolli il link di una cartella condivisa |
| **Google Drive (link)** | No | Sì | Cartella condivisa + una chiave API |
| **OneDrive** | Sì (device code) | Sì | Niente redirect, ideale per dispositivi headless |
| **Google Photos** | Sì | No | Selettore ufficiale (Picker API): scegli foto/album a mano |
| **Google Drive (login)** | Sì | Sì | OAuth, per cartelle private |

> 💡 **Consiglio.** I metodi "a link" (Dropbox e Google Drive) sono i più semplici: niente account da collegare, basta condividere una cartella "con chiunque abbia il link" e incollarlo nel pannello. Aggiungi foto alla cartella e compaiono da sole.

### Google Drive con un link (consigliato)
1. Su [Google Cloud Console](https://console.cloud.google.com): crea un progetto, abilita la **Google Drive API**, poi **Credenziali → Crea credenziali → Chiave API** (inizia con `AIza…`).
2. Su Google Drive crea una cartella, mettici le foto e condividila come **"Chiunque con il link → Visualizzatore"**.
3. Nel pannello, riquadro *Cartella Google Drive da link*: incolla il link e la chiave API, premi **Collega**.

### Dropbox con un link
1. Su Dropbox crea una cartella, mettici le foto e crea un link **"Chiunque con il link"**.
2. Nel pannello, riquadro *Cartella Dropbox da link*: incolla il link e premi **Collega**. (Nessuna chiave necessaria.)

### OneDrive
1. Registra una app *public client* su [Microsoft Entra](https://entra.microsoft.com) con permesso `Files.Read` e *Allow public client flows = Yes*.
2. Metti l'**Application (client) ID** in `MS_CLIENT_ID` (file `.env`).
3. Nel pannello premi *Collega OneDrive* e segui il codice device.

## ⚙️ Configurazione (`.env`)

Le impostazioni vivono in `/opt/piboard/.env`. Le principali:

```ini
ADMIN_PASSWORD=            # password del pannello (vuoto = nessuna)
MAX_IMAGE_DIM=2560         # lato massimo delle foto (ridimensionamento)

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

## 🔄 Aggiornamento

Ricopia la cartella aggiornata sul Pi e rilancia l'installer (la tua `.env` e le foto vengono mantenute):
```bash
scp -r PiBoard <utente>@<ip>:/home/<utente>/
ssh <utente>@<ip> "cd ~/PiBoard && sudo ./install.sh && sudo systemctl restart piboard-backend"
```

## 🔒 Privacy e sicurezza

- I segreti stanno solo nel `.env`, che è escluso da Git: **non metterli mai nel `.env.example`**.
- Le chiavi API e i metodi "a link" leggono solo contenuti che **tu** hai condiviso pubblicamente.
- Imposta una `ADMIN_PASSWORD` se il Pi è raggiungibile da altri sulla rete.

## 📄 Licenza

[MIT](LICENSE).
