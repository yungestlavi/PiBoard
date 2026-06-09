<div align="center">

#  PiBoard

**Self-hosted smart dashboard and digital photo frame for Raspberry Pi.**
An open-source DAKboard alternative: photos, clock, weather, calendar and news on any screen, managed from a web panel.

[Italiano](README.md) · **English**

</div>

---

## Table of contents
- [Features](#-features)
- [Requirements](#-requirements)
- [Installation](#-installation)
- [Opening the dashboard](#-opening-the-dashboard)
- [Photo sources](#-photo-sources)
- [Widgets](#-widgets)
- [Configuration (.env)](#️-configuration-env)
- [Updating PiBoard](#-updating-piboard)
- [Troubleshooting](#-troubleshooting)
- [Publishing on GitHub](#-publishing-on-github)
- [License](#-license)

---

##  Features

- **Full-screen photo frame** with cross-fade, Ken Burns effect and **animated GIFs**.
- **Resizable grid widgets** (drag the edges, or set width/height/depth) that automatically scale to their size:
  - **Clock**, digital or analog;
  - **Real-time weather**, phone-style, with a cascading **Country → Region → Province → City** picker (Italy with all ~7,900 municipalities; 30+ countries) and a 3-day forecast;
  - **Calendar** as a phone-style tile (month, day, year) that automatically shows events from **iCalendar** and **Google Calendar** links (recurring too); month and agenda views also available;
  - **News (RSS)** with ready-made newspapers per section (politics, business, world, sport…) and a featured headline that rotates every 10 minutes;
  - **Free text**.
- **12 ready-made themes** from a dropdown, ~80 Google fonts (each shown in its own typeface) and a **custom CSS** field. The **admin panel** itself has color themes too (dark, cream, light, indigo, forest).
- **Multiple photo sources**: USB/local folder, manual upload, OneDrive, Google Photos, Google Drive and Dropbox.
- **Web panel** with optional password, configuration **backup/restore** and a status page.
- **Robust kiosk mode**: full-screen Chromium with no cursor and no translation bar, hardware watchdog, nightly restart and automatic screen on/off.

##  Requirements

- Raspberry Pi 4 (recommended) or 3B+.
- **Raspberry Pi OS Lite (Trixie) 64-bit**.
- A microSD card and an HDMI screen.

##  Installation

### 1) Prepare the SD card
Use [Raspberry Pi Imager](https://www.raspberrypi.com/software/) to write *Raspberry Pi OS Lite (64-bit)*. In the advanced options (⚙️) enable **SSH**, set a **username** (e.g. `kiosk`), the hostname (e.g. `dashboard`) and your Wi-Fi. Boot the Pi and note its address (e.g. `dashboard.local` or the IP from your router).

### 2) Copy PiBoard to the Raspberry Pi
Download the zip from the [Releases](../../releases) page **or** clone the repo. On Windows, from **PowerShell**, extract the zip and copy it to the Pi:

```powershell
# extract the zip (use Expand-Archive to avoid nested folders)
Expand-Archive "$HOME\Downloads\PiBoard.zip" "$HOME\Desktop" -Force

# copy the folder to the Raspberry Pi
scp -r "$HOME\Desktop\PiBoard" <user>@<ip-or-hostname>:/home/<user>/
```

>  Do **not** extract the zip by double-clicking in File Explorer: it creates a nested `PiBoard\PiBoard\` folder. `Expand-Archive` doesn't.

On Linux/macOS:
```bash
unzip PiBoard.zip
scp -r PiBoard <user>@<ip-or-hostname>:/home/<user>/
```

### 3) Install
SSH in and run the installer:
```bash
ssh <user>@<ip-or-hostname>
```
```bash
cd ~/PiBoard
sed -i 's/\r$//' install.sh   # normalize line endings (if the file came from Windows)
chmod +x install.sh
sudo bash install.sh
sudo reboot
```

The installer creates the Python environment, installs dependencies, sets up the `piboard-backend` service, kiosk mode (cage + Chromium), the watchdog and the restart/screen-off timers. After the reboot the screen shows PiBoard.

## 🔗 Opening the dashboard

- **Display:** `http://<ip-or-hostname>:8080/`
- **Admin panel:** `http://<ip-or-hostname>:8080/admin/`  ← the **trailing slash is required**

Example with hostname `dashboard`: `http://dashboard.local:8080/admin/`.

> After every update press **Ctrl+Shift+R** in the browser to clear the cache.

##  Photo sources

| Source | Login? | Auto-sync | Notes |
|---|---|---|---|
| **Manual upload** | No | — | Drag photos into the panel |
| **USB / local folder** | No | Yes | Set `LOCAL_PHOTOS_PATH` |
| **Dropbox (link)** | No | Yes | Paste a shared folder link |
| **Google Drive (link)** | No | Yes | Shared folder + an API key |

>  The "link" methods (Dropbox and Google Drive) are the easiest: no account to connect, just share a folder "with anyone who has the link" and paste it into the panel.

### Google Drive via a link (recommended)
1. On [Google Cloud Console](https://console.cloud.google.com) create a project.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → Credentials → Create credentials → API key** (starts with `AIza…`).
4. On Google Drive create a folder, add your photos and share it as **"Anyone with the link → Viewer"**.
5. In the panel, *Google Drive folder via link* box: paste the link and the API key, then press **Connect**. (The **"How do I get the API key"** button shows these same steps.)

>  You need the **API key** (`AIza…`), not an **OAuth client ID** (`…apps.googleusercontent.com`).

### Dropbox via a link
1. On Dropbox create a folder, add your photos and create an **"Anyone with the link"** link.
2. In the panel, *Dropbox folder via link* box: paste the link and press **Connect**. (No key required.)

##  Widgets

- **Calendar:** *card* (phone-style), *month* or *agenda* view. Shows the device date and, if you connect an **iCalendar** or **Google Calendar** link, upcoming events.
- **Weather:** city chosen via the cascading menus (or, outside Italy, via city search). Shows temperature, condition, High/Low and forecast.
- **News:** pick a ready-made newspaper (or paste an RSS feed). A featured headline rotates every 10 minutes.
- **Appearance:** pick a theme from the dropdown, the fonts (shown in their own typeface) and optionally add custom CSS.

##  Configuration (`.env`)

Settings live in `/opt/piboard/.env`:

```ini
ADMIN_PASSWORD=            # panel password (empty = none)
MAX_IMAGE_DIM=2560         # max photo side

MS_CLIENT_ID=              # OneDrive
GDRIVE_API_KEY=            # Google Drive via link (can also be set from the panel)
LOCAL_PHOTOS_PATH=         # local/USB/NAS folder

PHOTO_SYNC_MINUTES=30      # how often to sync cloud sources
ROTATE_SECONDS=60          # duration of each photo
```

After editing `.env`:
```bash
sudo systemctl restart piboard-backend
```

##  Updating PiBoard

Re-copy the updated folder and re-run the installer (your `.env` and photos are kept):
```powershell
scp -r "$HOME\Desktop\PiBoard" <user>@<ip>:/home/<user>/
```
```bash
ssh <user>@<ip> "cd ~/PiBoard && sed -i 's/\r$//' install.sh && chmod +x install.sh && sudo bash install.sh && sudo systemctl restart piboard-backend"
```

Alternatively, if you use Git on the Pi: `cd ~/PiBoard && git pull && sudo bash install.sh && sudo systemctl restart piboard-backend`.

##  Troubleshooting

**SSH error after reinstalling the operating system (`WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED`).**
Every time you reinstall the OS on the Raspberry Pi, the device generates a new security key. Your PC still has the old one saved and blocks the connection with an error like:
```
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
Host key verification failed.
```
To fix it, delete the old key saved on your PC and reconnect:
```powershell
ssh-keygen -R dashboard.local
ssh-keygen -R <raspberry-ip>   # e.g. ssh-keygen -R 192.168.0.198
ssh kiosk@dashboard.local
```
if it pops up any error, paste this command:
```
Clear-Content C:\Users\rober\.ssh\known_hosts
```
You will be asked to confirm with `yes` and enter your password again: this is the correct behaviour. The same error also blocks `scp`: just run the two `ssh-keygen -R` commands before copying files.

**The panel shows "SmartDashboard" instead of "PiBoard".**
This means an older version of the software is still running on the Raspberry Pi. It happens when upgrading from a previous installation: the old `dashboard-backend` service holds port 8080 and the new `piboard-backend` can't start. To replace it permanently:
```bash
# 1) remove the old service and folder
sudo systemctl disable --now dashboard-backend 2>/dev/null
sudo rm -f /etc/systemd/system/dashboard-backend.service
sudo systemctl daemon-reload
sudo rm -rf /opt/dashboard

# 2) free the port and start PiBoard
sudo fuser -k 8080/tcp 2>/dev/null
sudo pkill -f 'uvicorn app.main:app' 2>/dev/null
sudo systemctl restart piboard-backend
sleep 5

# 3) verify — must print OK
curl -s localhost:8080/admin/ | grep -o 'Pi<span>Board</span>' && echo OK
```
If it prints `OK` → `sudo reboot` + **Ctrl+Shift+R** in the browser.

**I still see the old version / my changes don't show up.**
Only the **running** code matters, not the files on your PC. Check what the Pi actually serves:
```bash
curl -s localhost:8080/admin/ | grep -o 'Pi<span>Board</span>' && echo OK
```
If it doesn't print `OK`, the Pi is serving old code: redo copy + install, then **Ctrl+Shift+R** in the browser.

**`install.sh: command not found`** — the file isn't executable or has Windows line endings. Use:
```bash
cd ~/PiBoard && sed -i 's/\r$//' install.sh && chmod +x install.sh && sudo bash install.sh
```

**Service won't start / `address already in use`** — an old service is holding port 8080. Remove it and free the port:
```bash
sudo systemctl disable --now dashboard-backend 2>/dev/null
sudo rm -f /etc/systemd/system/dashboard-backend.service
sudo systemctl daemon-reload
sudo fuser -k 8080/tcp 2>/dev/null
sudo systemctl restart piboard-backend
```

**Live logs:**
```bash
journalctl -u piboard-backend -f
```

**Status and port:**
```bash
systemctl status piboard-backend --no-pager
sudo ss -ltnp | grep :8080
```

##  Publishing on GitHub

1. Create an **empty** repository on GitHub named `PiBoard` (no README).
2. In both READMEs the repository is already configured with your username.
3. From the project folder:
   ```bash
   cd PiBoard
   git init
   git branch -M main
   git remote add origin https://github.com/yungestlavi/PiBoard.git
   git add .
   git commit -m "PiBoard v1.0"
   git push -u origin main
   ```
   > If you get *"remote origin already exists"*: `git remote set-url origin https://github.com/yungestlavi/PiBoard.git`
4. Later **updates**:
   ```bash
   git add -A && git commit -m "describe your changes" && git push
   ```
5. **Release**: on GitHub → *Releases → Draft a new release* → create a tag (e.g. `v1.0.0`), a title, and (optionally) attach the project zip as a binary.

> The `.gitignore` already excludes secrets and local data (`.env`, `/data/`, cache, `.venv/`). **Never** put keys or passwords in `.env.example`.

##  License

[MIT](LICENSE).
