# Мимика — backup server on Raspberry Pi

Keeps a copy of every exercise session on your Raspberry Pi, reachable only inside your
Tailscale network. If the iPhone loses its data, one tap in the app restores the history.

- Python standard library only (no pip, no venv).
- Listens on `127.0.0.1:8765`. Tailscale provides HTTPS on port **8443**, so your existing
  `tailscale serve` setup (usually port 443) is not touched.
- Data lives in SQLite at `pi-server/data/mimika.db`. The access token is in
  `pi-server/config.json` (chmod 600). Both are git-ignored.

## Install (on the Pi, ~3 minutes)

```bash
cd ~
git clone https://github.com/maxSHPLmax/mimika.git
bash mimika/pi-server/install.sh
```

The script does four things:
1. creates `config.json` with a random token
2. installs and starts the `mimika-backup` systemd service
3. runs `tailscale serve` on port 8443
4. prints a **setup code**:

```
mimika-sync|https://raspberrypi.tailXXXX.ts.net:8443|<token>
```

If the HTTPS check fails: in the Tailscale admin console → **DNS**, enable **MagicDNS** and
**HTTPS Certificates**. They're probably already on, since your other app uses `serve`.
Then run the script again; it keeps the same token.

## Connect the iPhone

1. Install **Tailscale** from the App Store and sign in with the same account the Pi uses.
   Keep the VPN switched on. Tailscale can stay connected in the background.
2. Send the setup code to the iPhone (e.g. a message to yourself) and copy it.
3. In Мимика: **Настройки → Резервная копия на Raspberry Pi → Вставить → Подключить**.

The status line shows the last backup time. After that, it's automatic:
- sessions upload right after they're saved
- anything that couldn't be sent (Pi off, Tailscale off) waits and goes out on the next
  app launch

## Restore after data loss

Reinstall the app (Safari → Add to Home Screen), paste the same setup code, and tap
**Подключить**. If the phone is empty, it offers to load everything from the server,
including her exercise settings. **Восстановить** in Settings can also be used at any time;
it only adds missing sessions and never deletes anything.

## Dashboard

`https://<pi>:8443/dashboard` shows how the practice is going: days with sessions, sessions and
minutes per week against the guide's 2–3 a day, streak, a calendar, time of day, exercises done
or skipped, how she felt afterwards, and the recovery trend. Rest days after twitching count as
rest, not as missed days.

- **Her:** in the app, Настройки → Резервная копия → «Открыть дашборд занятий», or История →
  «Дашборд занятий».
- **You:** open `https://<pi>:8443/dashboard#k=<token>` once; `install.sh` prints this link.
  - The key sits in the URL fragment, which browsers never send to the server.
  - The page removes it from the address bar right away and remembers it on that device.
  - After that, you can bookmark the plain `https://<pi>:8443/dashboard`.
  - "Забыть ключ на этом устройстве" at the bottom removes it.
- **The page contains no data itself.** It loads `/api/export` with the key, and the server sends
  it with a strict Content-Security-Policy (no external resources).

## Useful commands

```bash
systemctl status mimika-backup               # is it running?
journalctl -u mimika-backup -n 50            # recent log (one line per request, no data)
tailscale serve status                       # shows :8443 next to your other app
cat ~/mimika/pi-server/config.json           # the token (to rebuild the setup code)

# Update after pulling a new version:
cd ~/mimika && git pull && sudo systemctl restart mimika-backup
```

## Extra safety: nightly copy of the database (optional)

```bash
crontab -e
# add:
0 3 * * * python3 -c "import sqlite3; sqlite3.connect('$HOME/mimika/pi-server/data/mimika.db').backup(sqlite3.connect('$HOME/mimika-backup.db'))"
```

## Uninstall

```bash
sudo tailscale serve --https=8443 off
sudo systemctl disable --now mimika-backup
sudo rm /etc/systemd/system/mimika-backup.service
```

## API (for Phase 3)

All endpoints require `Authorization: Bearer <token>`. CORS is allowed only for the app's
origin, set in `config.json` → `allowed_origins`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness; returns the session count when the token is valid |
| POST | `/api/sync` | `{sessions, notes, settings}`; upsert, and the newer `updatedAt` wins |
| GET | `/api/export` | everything, used for restore, the dashboard, and the Claude weekly summary later |
| GET | `/dashboard` | dashboard page (no key needed to load the page, the data needs one) |
