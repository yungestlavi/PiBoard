<div align="center">

# 🖥️ PiBoard

**Self-hosted smart dashboard and digital photo frame for the Raspberry Pi.**
An open-source alternative to DAKboard: photos, clock, weather, calendar and news on any screen, managed from a web panel.

[Italiano](README.md) · **English**

</div>

---

## ✨ Features

- **Full-screen photo frame** with crossfade, Ken Burns effect and **animated GIF** support.
- **Grid widgets**, fully resizable: drag the edges with the mouse, or set width, height and depth from the panel. Available:
  - **Clock**, digital or analog;
  - **Real-time weather** with a cascading **Country → Region → Province → City** picker (Italy with all ~7,900 municipalities; 30+ countries) and a 3-day forecast;
  - **Calendar** as a monthly grid (using the device date) or agenda, automatically showing events from **iCalendar** and **Google Calendar** links (recurring included);
  - **News (RSS)** with ready-made papers split by section (politics, business/markets, world, sport…) or your own feed; a headline that **rotates every 10 minutes**;
  - free **Text**.
- **12 ready-made themes** from a dropdown (Night, Heavy glass, Neon, Vintage, Terminal, Pastel…), ~45 Google fonts (each shown in its own typeface in the menu) and a **custom CSS** field.
- **Multiple photo sources** (see below): USB/local folder, manual upload, OneDrive, Google Photos, Google Drive and Dropbox.
- **Web admin panel** with optional password, configuration **backup/restore** and a status page.
- **Robust kiosk mode**: full-screen Chromium with no cursor and no translate bar, hardware watchdog, nightly restart and automatic screen on/off.

## 📦 Requirements

- Raspberry Pi 4 (recommended) or 3B+.
- **Raspberry Pi OS Lite (Trixie), 64-bit**.
- A microSD card and an HDMI display.

## 🚀 Installation

1. **Flash the OS** with [Raspberry Pi Imager](https://www.raspberrypi.com/software/): pick *Raspberry Pi OS Lite (64-bit)*. In the advanced settings enable **SSH**, set a username (e.g. `kiosk`) and your Wi-Fi.
2. **Boot the Pi** and find its IP address (from your router or via `ping <hostname>.local`).
3. **Copy PiBoard to the Pi.** Download the zip from the [Releases](../../releases) page and unzip it, or clone the repo:
   ```bash
   git clone https://github.com/YOUR-USERNAME/PiBoard.git
   ```
   Then copy the folder to the Pi (from your PC):
   ```bash
   scp -r PiBoard <user>@<pi-ip>:/home/<user>/
   ```
4. **Run the installer** (on the Pi, over SSH):
   ```bash
   cd ~/PiBoard
   chmod +x install.sh
   sudo ./install.sh
   sudo reboot
   ```

After rebooting, the screen shows the dashboard. The admin panel is at:

```
http://<pi-ip>:8080/admin/
```

(the trailing slash matters). The display is at `http://<pi-ip>:8080/`.

## 🖼️ Photo sources

| Source | Login? | Auto-sync | Notes |
|---|---|---|---|
| **Manual upload** | No | — | Drag photos into the panel |
| **USB / local folder** | No | Yes | Set `LOCAL_PHOTOS_PATH` |
| **Dropbox (link)** | No | Yes | Paste a shared folder link |
| **Google Drive (link)** | No | Yes | Shared folder + one API key |
| **OneDrive** | Yes (device code) | Yes | No redirect, ideal for headless devices |
| **Google Photos** | Yes | No | Official Picker API: pick photos/albums manually |
| **Google Drive (login)** | Yes | Yes | OAuth, for private folders |

> 💡 **Tip.** The "link" methods (Dropbox and Google Drive) are the easiest: no account to connect, just share a folder as "anyone with the link" and paste it into the panel. Add photos to the folder and they show up automatically.

### Google Drive via link (recommended)
1. In [Google Cloud Console](https://console.cloud.google.com): create a project, enable the **Google Drive API**, then **Credentials → Create credentials → API key** (starts with `AIza…`).
2. In Google Drive create a folder, add photos and share it as **"Anyone with the link → Viewer"**.
3. In the panel, *Google Drive folder via link* box: paste the link and the API key, click **Connect**.

### Dropbox via link
1. In Dropbox create a folder, add photos and create an **"Anyone with the link"** link.
2. In the panel, *Dropbox folder via link* box: paste the link and click **Connect**. (No key needed.)

### OneDrive
1. Register a *public client* app on [Microsoft Entra](https://entra.microsoft.com) with the `Files.Read` permission and *Allow public client flows = Yes*.
2. Put the **Application (client) ID** into `MS_CLIENT_ID` (in `.env`).
3. In the panel click *Connect OneDrive* and follow the device code.

## ⚙️ Configuration (`.env`)

Settings live in `/opt/piboard/.env`. The main ones:

```ini
ADMIN_PASSWORD=            # panel password (empty = none)
MAX_IMAGE_DIM=2560         # max photo side (downscaling)

MS_CLIENT_ID=              # OneDrive
GDRIVE_API_KEY=            # Google Drive via link (can also be set in the panel)
LOCAL_PHOTOS_PATH=         # local/USB/NAS folder

PHOTO_SYNC_MINUTES=30      # how often to sync cloud sources
ROTATE_SECONDS=60          # how long each photo is shown
```

After editing `.env`:
```bash
sudo systemctl restart piboard-backend
```

## 🔄 Updating

Copy the updated folder to the Pi and re-run the installer (your `.env` and photos are kept):
```bash
scp -r PiBoard <user>@<ip>:/home/<user>/
ssh <user>@<ip> "cd ~/PiBoard && sudo ./install.sh && sudo systemctl restart piboard-backend"
```

## 🔒 Privacy & security

- Secrets live only in `.env`, which is git-ignored: **never put them in `.env.example`**.
- API keys and the "link" methods only read content **you** have shared publicly.
- Set an `ADMIN_PASSWORD` if the Pi is reachable by others on the network.

## 📄 License

[MIT](LICENSE).
