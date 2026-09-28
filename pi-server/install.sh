#!/usr/bin/env bash
# Мимика backup server — installer for Raspberry Pi (Raspberry Pi OS, Python 3, Tailscale).
# Usage:  bash install.sh [app-origin]
#   app-origin defaults to https://maxshplmax.github.io  (where the PWA is hosted)
set -euo pipefail

ORIGIN="${1:-https://maxshplmax.github.io}"
PORT=8765          # local only (127.0.0.1)
TS_PORT=8443       # HTTPS port on the tailnet; separate from any existing `tailscale serve` on 443
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE=mimika-backup
RUN_USER="$(id -un)"

echo "==> Installing Мимика backup server from $DIR (user: $RUN_USER)"
command -v python3 >/dev/null || { echo "python3 not found"; exit 1; }
command -v tailscale >/dev/null || { echo "tailscale not found"; exit 1; }
mkdir -p "$DIR/data"

# 1) Config with a random token (kept if it already exists, so the phone stays paired)
if [ ! -f "$DIR/config.json" ]; then
  python3 - "$DIR/config.json" "$ORIGIN" "$PORT" <<'PY'
import json, secrets, sys
path, origin, port = sys.argv[1], sys.argv[2], int(sys.argv[3])
json.dump({"token": secrets.token_urlsafe(24), "allowed_origins": [origin], "host": "127.0.0.1", "port": port},
          open(path, "w"), indent=2)
PY
  chmod 600 "$DIR/config.json"
  echo "    created config.json"
else
  echo "    config.json exists — keeping token"
fi

# 2) systemd service (starts on boot, restarts on failure)
sudo tee /etc/systemd/system/$SERVICE.service >/dev/null <<EOF
[Unit]
Description=Mimika backup server
After=network-online.target
Wants=network-online.target

[Service]
User=$RUN_USER
WorkingDirectory=$DIR
ExecStart=/usr/bin/env python3 $DIR/mimika_server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE
sudo systemctl restart $SERVICE
sleep 2
if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null; then
  echo "==> Service is running"
else
  echo "!! Service did not answer. Check: journalctl -u $SERVICE -n 50"; exit 1
fi

# 3) HTTPS on the tailnet via tailscale serve (additive: port $TS_PORT only)
echo "==> Publishing via Tailscale Funnel: https://<pi>:$TS_PORT  (other serve/funnel entries are not touched)"
sudo tailscale funnel --bg --https=$TS_PORT "http://127.0.0.1:$PORT"

TS_NAME="$(tailscale status --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')"
TOKEN="$(python3 -c "import json; print(json.load(open('$DIR/config.json'))['token'])")"
URL="https://$TS_NAME:$TS_PORT"

echo
echo "==> Checking HTTPS through Tailscale (first request may take ~10 s while the certificate is issued)…"
if curl -fsS --max-time 30 "$URL/api/health" >/dev/null; then echo "    OK: $URL"; else echo "    Not reachable yet — see README (HTTPS certificates must be enabled in the Tailscale admin console)."; fi

echo
echo "================================================================"
echo " Setup code for the app (Настройки → Резервная копия → Вставить):"
echo
echo "   mimika-sync|$URL|$TOKEN"
echo
echo " Send it to the iPhone (e.g. in a message to yourself), copy it,"
echo " then paste it in the app. Keep it private: it is the access key."
echo
echo " Dashboard link for your own browser (open once, it remembers the key):"
echo "   $URL/dashboard#k=$TOKEN"
echo "================================================================"
