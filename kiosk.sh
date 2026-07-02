#!/usr/bin/env sh

exec >> /tmp/kiosk.log 2>&1
set -x

sleep 15

export XDG_RUNTIME_DIR=/run/user/$(id -u)
export WAYLAND_DISPLAY=wayland-0

# --- Go to project directory ---
PROJECT_DIR="$HOME/src/itsasign"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "ERROR: Missing project directory: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR" || exit 1

# --- Rotate display if available ---
if command -v wlr-randr >/dev/null 2>&1; then
    wlr-randr --output HDMI-A-1 --transform 90 || true
fi

# also: Alt-F4
lxterminal &

# --- Kill existing node processes ---
pkill node || true

# --- Start RSS server ---
npm run dev >> /tmp/rss-server.log 2>&1 &

# --- Start web server ---
npm run serve >> /tmp/web-server.log 2>&1 &

# --- Wait for web server ---
COUNT=0
MAX_RETRIES=30

until curl -s http://localhost:8080 >/dev/null; do
    sleep 1
    COUNT=$((COUNT + 1))

    if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
        echo "ERROR: Server failed to start"
        exit 1
    fi
done

# --- Launch Chromium ---
/usr/bin/chromium \
  --ozone-platform=wayland \
  --enable-features=UseOzonePlatform \
  --kiosk \
  --password-store=basic \
  http://localhost:8080 &
