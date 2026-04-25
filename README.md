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

```bash
npm install
```

## Run

From the project root:

```bash
node_modules/.bin/concurrently 'npx serve' 'node cors-anywhere'
```

This starts:
- A static web server for the app (via `npx serve`)
- A local CORS proxy for RSS requests (via `node cors-anywhere`)

## Configuration

Primary configuration lives in `config.json`:

- `plugins`: module paths for widget plugins
- `layout`: CSS grid columns/rows
- `panels`: panel definitions and per-panel `widgets`
- `rss.proxy`: optional default proxy URL for RSS feeds

Example plugin list:

```json
"plugins": [
  "./widgets/clock.js",
  "./widgets/weather.js",
  "./widgets/playlist.js"
]
```

## Extending With New Widgets

Add new widget modules under `widgets/`, then register them in `config.json` under `plugins`.

For full step-by-step instructions and templates, see `WIDGET.md`.

## Notes

- The app is intentionally config-driven to support signage changes without editing app logic.
- RSS feeds can use a global proxy (`rss.proxy`) or per-feed `proxy` values.

## Troubleshooting

### 1. `npm install` fails

- Confirm Node and npm are installed:

```bash
node -v
npm -v
```

- If dependencies are corrupted, remove and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

### 2. App does not open or render

- Make sure the run command is started from the project root:

```bash
node_modules/.bin/concurrently 'npx serve' 'node cors-anywhere'
```

- Open the URL printed by `serve` in your browser.
- Check browser dev tools console for module import errors.

### 3. RSS feeds do not load

- Verify `rss.proxy` in `config.json` points to your local proxy (for example `http://localhost:8080/`).
- For individual feed overrides, verify per-feed `proxy` values under playlist RSS items.
- Confirm the RSS source URL itself is valid and publicly reachable.
- If a feed still fails, test with another known RSS URL to isolate source issues.

### 4. `Unknown widget type` appears

- Ensure the widget module path is listed in `plugins` in `config.json`.
- Ensure the module exports `type` and `create(widget, config)`.
- Ensure the widget `type` in panel config exactly matches the exported `type` string.

### 5. Weather widget shows unavailable data

- Confirm latitude/longitude values are present in `config.json`.
- Check internet connectivity to Open-Meteo.
- Verify browser console for fetch/network errors.

### 6. Images do not appear in playlist

- Verify image paths are correct relative to the project root (for example files in `images/`).
- Check file name casing (`Toby.png` vs `toby.png`) on case-sensitive systems.
