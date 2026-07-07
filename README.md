[![Screenshot](Screenshot.png)](Screenshot.png)

# ItsaSign

[![CI](https://github.com/drsjb80/itsasign/actions/workflows/ci.yml/badge.svg)](https://github.com/drsjb80/itsasign/actions/workflows/ci.yml)

ItsaSign is an extensible digital signage application that renders configurable panels and widget plugins in the browser.

## What It Does

- Renders a full-screen digital signage layout from `config.json`
- Supports plugin-based widgets loaded dynamically from the `plugins` array in config
- Includes built-in widgets for:
  - Clock
  - Weather
  - Moon phase
  - Playlist (images + RSS feed pages)
  - Quote of the Day
  - XKCD (current comic with title)
- Fetches RSS feeds via Puppeteer to bypass bot detection (Cloudflare, etc.)
- Caches RSS feeds and other data for 24 hours

## Requirements

- Node.js (v20+)
- npm
- Docker (for RSS feed server with Puppeteer)

## Install

    npm install

## Development

**Lint code:**

    npm run lint
    npm run lint:fix  # Auto-fix issues

**Security audit:**

    npm audit

## Run

**Development** (two terminals):

    # Terminal 1: Build and run RSS server in Docker (port 3000)
    docker build -t itsasign-rss:latest .
    docker run -d -p 3000:3000 --name itsasign-rss itsasign-rss:latest

    # Terminal 2: Web server (port 8080)
    npm run serve

Then open `http://localhost:8080` in your browser.

**Docker Notes:**
- The RSS server runs in Docker with Node 22 and Chromium, regardless of your host system's Node version
- The web server runs locally on port 8080 and serves files from your project directory
- RSS server communicates with the web server over `localhost:3000`
- Two Dockerfiles are provided:
  - `Dockerfile` — generic build using Debian's Chromium package; use on most hosts (x86_64, non-Pi arm64, CI)
  - `Dockerfile.pi` — Raspberry Pi build; pulls Chromium from Raspberry Pi's apt repo, since vanilla Debian's arm64 Chromium build crashes on launch on Pi hardware. Build with `docker build -f Dockerfile.pi -t itsasign-rss:latest .`

**Kiosk mode** (full screen on startup):

Copy `kiosk.sh` to `~/scripts/`

Copy `kiosk.desktop` to `~/.config/autostart`

Reboot.

## Configuration

Primary configuration lives in `config.json`:

- `plugins`: module paths for widget plugins
- `layout`: CSS grid columns/rows
- `panels`: panel definitions and per-panel `widgets`
- `rss.fontScale`: optional global RSS text scale factor (default `1`)
- `rss.showQR`: optional global RSS QR toggle (default `true`)
- `rss.showThumbnails`: optional global RSS thumbnail toggle (default `true`)
- `rss.itemsPerPage`: optional global RSS page size (default `3`)
- `rss.maxItems`: optional global RSS item cap (default `12`)
- `images.durationMs`: optional global image duration default (default `10000`)
- `images.fit`: optional global image fit default (default `cover`)

Example plugin list:

    "plugins": [
      "./widgets/clock.js",
      "./widgets/weather.js",
      "./widgets/playlist.js"
    ]

### Making it Vertical

    wlr-randr --output $(wlr-randr | head -1 | sed -e 's/ .*//') --transform flipped-90

### RSS Playlist Font Scale

RSS feed text uses original base sizes by default (`fontScale: 1`).
You can scale all RSS text with these options:

- Global default: `rss.fontScale`
- Per RSS item override: `fontScale`

Precedence is per-item, then global.

Example:

    {
      "rss": {
        "fontScale": 2
      },
      "panels": [
        {
          "widgets": [
            {
              "type": "playlist",
              "items": [
                {
                  "type": "rss-feed",
                  "title": "BBC News",
                  "url": "https://feeds.bbci.co.uk/news/rss.xml",
                  "fontScale": 2
                }
              ]
            }
          ]
        }
      ]
    }

### RSS Playlist Thumbnails

RSS feed items can render a thumbnail when one is available.
If an item has no image, a TV static fallback is shown.

- Global default: `rss.showThumbnails`

Precedence is per-item, then global.

Example:

    {
      "rss": {
        "showThumbnails": true
      },
      "panels": [
        {
          "widgets": [
            {
              "type": "playlist",
              "items": [
                {
                  "type": "rss-feed",
                  "title": "BBC News",
                  "url": "https://feeds.bbci.co.uk/news/rss.xml",
                  "showThumbnails": true
                }
              ]
            }
          ]
        }
      ]
    }

  ### RSS QR Toggle

  RSS feed slides can show a QR code that links to the feed URL.

  - Global default: `rss.showQR`
  - Per RSS item override: `showQR`

  Precedence is per-item, then global.

### Image Defaults

Image playlist items can use global defaults for slide duration and fit.
The full-width header strip still uses `contain` so it shows the whole image without cropping.

  - Global default: `images.durationMs`
  - Global default: `images.fit`
  - Per image override: `durationMs`, `fit`

Precedence is per-item, then global.

### Weather Widget Options

The weather widget uses Open-Meteo and now supports current conditions and a daily forecast.

    {
      "type": "weather",
      "title": "Weather",
      "latitude": 39.7392,
      "longitude": -104.9903,
      "units": "fahrenheit",
      "useGeolocation": true,
      "geolocationTimeoutMs": 7000,
      "forecastDays": 5,
      "windSpeedUnit": "mph",
      "refreshMs": 600000
    }

- `latitude` / `longitude`: fallback location when geolocation is denied/unavailable.
- `useGeolocation`: if `true`, requests browser geolocation and uses it when granted.
- `geolocationTimeoutMs`: timeout for geolocation request.
- `forecastDays`: daily forecast length (1-7).
- `units`: `fahrenheit` or `celsius`.
- `windSpeedUnit`: `mph`, `kmh`, `ms`, or `kn`.
- `refreshMs`: refresh interval in milliseconds.

## RSS Feed Server

The app includes a Puppeteer-based RSS server (`rss-server.js`) that:

- Fetches RSS feeds via a real browser, bypassing bot detection (Cloudflare, etc.)
- Caches responses for 24 hours (configurable via `CACHE_TTL_MS`)
- Runs in Docker with Node 22 and Chromium
- Serves feeds to the web client on port 3000

**How it works:**
1. Client requests feed from `http://localhost:3000/fetch-rss?url=<feed-url>`
2. Server checks cache; if hit, returns instantly
3. If cache miss, Puppeteer fetches the feed via Chrome, captures the raw HTTP response
4. Result is cached and returned to client

## XKCD Widget

The XKCD widget fetches the current comic from the XKCD API and displays it with the comic title.

- Refreshes daily by default (configurable via `refreshMs`)
- No external dependencies or cron jobs needed
- Configuration in `config.json`:

```json
{
  "type": "xkcd",
  "title": "XKCD",
  "refreshMs": 86400000
}
```

## Extending With New Widgets

Add new widget modules under `widgets/`, then register them in `config.json` under `plugins`.

For full step-by-step instructions and templates, see `WIDGET.md`.

## Notes

- The app is intentionally config-driven to support signage changes without editing app logic.
- All RSS feeds are fetched server-side via Puppeteer to bypass bot detection and other restrictions.

## Troubleshooting

### 1. `npm install` fails

- Confirm Node and npm are installed:

    node -v
    npm -v

- If dependencies are corrupted, remove and reinstall:

    rm -rf node_modules package-lock.json
    npm install


### 2. RSS feeds do not load

- Ensure the RSS server Docker container is running: `docker ps | grep itsasign-rss`
- If not running, start it: `docker run -d -p 3000:3000 --name itsasign-rss itsasign-rss:latest`
- Verify the web server is running: `npm run serve` (port 8080)
- Confirm the RSS source URL itself is valid and publicly reachable.
- Check browser console (`F12` → Console tab) for fetch errors.
- Check container logs: `docker logs itsasign-rss`
- RSS feeds are cached for 24 hours; to force a refresh, restart the container: `docker restart itsasign-rss`
- If a feed still fails, test it directly: `curl "http://localhost:3000/fetch-rss?url=<feed-url>"`

### 3. `Unknown widget type` appears

- Ensure the widget module path is listed in `plugins` in `config.json`.
- Ensure the module exports `type` and `create(widget, config)`.
- Ensure the widget `type` in panel config exactly matches the exported `type` string.

### 4. Weather widget shows unavailable data

- Confirm either valid `latitude`/`longitude` values are present, or geolocation is allowed in the browser.
- Check internet connectivity to Open-Meteo.
- Verify browser console for fetch/network errors.

### 5. Images do not appear in playlist

- Verify image paths are correct relative to the project root (for example files in `images/`).
- Check file name casing (`Toby.png` vs `toby.png`) on case-sensitive systems.
