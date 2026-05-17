# ItsaSign

ItsaSign is an extensible digital signage application that renders configurable panels and widget plugins in the browser.

## What It Does

- Renders a full-screen digital signage layout from `config.json`
- Supports plugin-based widgets loaded dynamically from the `plugins` array in config
- Includes built-in widgets for:
  - Clock
  - Weather
  - Playlist (images + RSS feed pages)
- Supports RSS feed proxying via `cors-anywhere.js`

## Requirements

- Node.js
- npm

## Install

    npm install

## Run

Copy `kiosk.sh` to `~/scripts/`

Cope `kiosk.desktop` to `~/.config/autostart`

Reboot.

## Configuration

Primary configuration lives in `config.json`:

- `plugins`: module paths for widget plugins
- `layout`: CSS grid columns/rows
- `panels`: panel definitions and per-panel `widgets`
- `rss.proxy`: optional default proxy URL for RSS feeds
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
        "proxy": "http://localhost:8080/",
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

## Extending With New Widgets

Add new widget modules under `widgets/`, then register them in `config.json` under `plugins`.

For full step-by-step instructions and templates, see `WIDGET.md`.

## Notes

- The app is intentionally config-driven to support signage changes without editing app logic.
- RSS feeds can use a global proxy (`rss.proxy`) or per-feed `proxy` values.

## Troubleshooting

### 1. `npm install` fails

- Confirm Node and npm are installed:

    node -v
    npm -v

- If dependencies are corrupted, remove and reinstall:

    rm -rf node_modules package-lock.json
    npm install


### 2. RSS feeds do not load

- Verify `rss.proxy` in `config.json` points to your local proxy (for example `http://localhost:8080/`).
- For individual feed overrides, verify per-feed `proxy` values under playlist RSS items.
- Confirm the RSS source URL itself is valid and publicly reachable.
- If a feed still fails, test with another known RSS URL to isolate source issues.

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
