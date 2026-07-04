# Header Image

The optional full-width header strip is configured via `headerEnabled` in `config.json`.

The header height is fixed at `10rem`. The image is displayed with `fit: contain`, so the **entire image is shown without cropping**. This header override does not use the global `images.fit` default.

### Recommended image dimensions

To fill the strip edge-to-edge with no letterboxing, the image aspect ratio must match the header strip's ratio:

```
image width / image height = display width / header height
```

Examples for a **160 px** header:

| Display resolution | Ideal image size |
|---|---|
| 1920 × 1080 | 1920 × 160 |
| 2560 × 1440 | 2560 × 160 |
| 3840 × 2160 | 3840 × 160 |

If the image has a different aspect ratio, blank space will appear on the sides (`contain`) or the image will be cropped (`cover`).

---

# Adding New Widgets

This project uses a plugin pattern for widgets.

A widget is a JavaScript module in `widgets/` that exports:
- `type`: a string used in `config.json`
- `create(widget, config)`: a function that returns a DOM element

`index.html` dynamically imports all plugin modules listed in `config.json` under `plugins`.

## 1. Create a widget module

Create a new file in `widgets/`, for example `widgets/news.js`.

```js
import { createCard } from './utils.js';

export const type = 'news';

export function create(widget, config) {
  const el = createCard(widget.title || 'News');

  const body = document.createElement('div');
  body.textContent = widget.message || 'Hello from news widget';
  el.appendChild(body);

  return el;
}
```

Notes:
- The `type` value must be unique.
- `create()` can use anything from the widget config object.
- `create()` should return one root element.

## 1.5 Add widget CSS (recommended)

Styles are split into smaller files for easier maintenance.

Use this layout:
- styles/base.css: app-level variables, page shell, panel shell, global error/footer
- styles/panels.css: panel-specific layout overrides (for example sidebar and header-strip)
- styles/widgets/common.css: shared widget card/title/meta styles
- styles/widgets/<widget-name>.css: styles specific to one widget

When adding a new widget stylesheet:

1. Create a file at styles/widgets/<widget-name>.css.
2. Add an import in styles.css, for example:

```css
@import url('./styles/widgets/news.css');
```

3. Keep selectors widget-scoped (for example .news-widget, .news-title) to avoid collisions.

## 2. Register the module in config.json

Add the new module path to the top-level `plugins` array in `config.json`.

```json
"plugins": [
  "./widgets/clock.js",
  "./widgets/weather.js",
  "./widgets/playlist.js",
  "./widgets/news.js"
]
```

## 3. Add widget instance(s) to a panel

Under `panels[].widgets`, add an object with `type` matching the module export.

```json
{
  "type": "news",
  "title": "Campus News",
  "message": "Welcome to campus"
}
```

## 4. Reload and verify

After saving files and reloading the page:
- If the widget renders, setup is complete.
- If you see "Unknown widget type", check:
  - The module is in `plugins`
  - `type` in module matches `type` in `config.json`
  - The module file path is correct

## Optional: Use shared helpers

`widgets/utils.js` currently provides:
- `createCard(title)`
- `wait(ms)`
- `escapeHtml(text)`
- `reportWidgetError(options)`

Import only what you need.

## Optional: Async widget template

Use this pattern for widgets that fetch from an API.

```js
import { createCard } from './utils.js';

export const type = 'quote';

export function create(widget, config) {
  const el = createCard(widget.title || 'Quote');

  const content = document.createElement('div');
  const meta = document.createElement('div');
  meta.className = 'weather-meta';
  meta.textContent = 'Loading...';

  el.append(content, meta);

  async function load() {
    try {
      const response = await fetch(widget.url);
      if (!response.ok) throw new Error('Request failed');

      const data = await response.json();
      content.textContent = data.text || '(no content)';
      meta.textContent = data.author || '';
    } catch (error) {
      content.textContent = '';
      meta.textContent = 'Unavailable';
    }
  }

  load();

  // Optional periodic refresh.
  if (widget.refreshMs) {
    setInterval(load, widget.refreshMs);
  }

  return el;
}
```

Example instance config:

```json
{
  "type": "quote",
  "title": "Daily Quote",
  "url": "https://example.com/api/quote",
  "refreshMs": 60000
}
```

## Optional: Cleanup and lifecycle pattern

If a widget sets timers or performs long-running requests, use a cleanup hook.

Pattern:

1. Keep references to `setInterval` IDs and `AbortController` instances.
2. Expose a `destroy()` function from the plugin module.
3. Have the app call `destroy()` before replacing/removing widget elements.

Example plugin pattern:

```js
import { createCard } from './utils.js';

export const type = 'live-data';

const cleanupByElement = new WeakMap();

export function create(widget) {
  const el = createCard(widget.title || 'Live Data');
  const body = document.createElement('div');
  body.textContent = 'Loading...';
  el.appendChild(body);

  let intervalId = null;
  let controller = null;

  async function load() {
    try {
      if (controller) controller.abort();
      controller = new AbortController();

      const response = await fetch(widget.url, { signal: controller.signal });
      if (!response.ok) throw new Error('Request failed');
      const data = await response.json();
      body.textContent = data.value || '(no data)';
    } catch (error) {
      if (error.name !== 'AbortError') {
        body.textContent = 'Unavailable';
      }
    }
  }

  load();

  if (widget.refreshMs) {
    intervalId = setInterval(load, widget.refreshMs);
  }

  cleanupByElement.set(el, () => {
    if (intervalId) clearInterval(intervalId);
    if (controller) controller.abort();
  });

  return el;
}

export function destroy(el) {
  const cleanup = cleanupByElement.get(el);
  if (cleanup) {
    cleanup();
    cleanupByElement.delete(el);
  }
}
```

App-side usage note:

- If you later implement widget replacement/re-rendering, call `plugin.destroy(oldElement)` before removing it from the DOM.

---

# Playlist Widget and Item Types

The playlist widget is a carousel orchestrator that cycles through items of different types. Each item type is handled by a dedicated item widget.

## Adding a new playlist item type

1. Create a new item widget module in `widgets/items/<type>-item.js`
2. Export an async `playItem(stage, item, config)` function that:
   - Renders content to the `stage` DOM element
   - Waits for its display duration
   - Returns when done (the promise resolves when the item should advance)
3. Register the item widget in `widgets/playlist.js` in the `ITEM_PLAYERS` map

Example: Custom item type

```js
// widgets/items/custom-item.js
import { wait, reportWidgetError } from '../utils.js';

const WIDGET_TYPE = 'playlist.custom-item';

export async function playItem(stage, item = {}, config = {}) {
  stage.innerHTML = '';
  
  const slide = document.createElement('div');
  slide.className = 'playlist-slide';
  
  const content = document.createElement('div');
  content.textContent = item.text || 'Custom content';
  slide.appendChild(content);
  
  stage.appendChild(slide);
  
  const duration = item.durationMs || 5000;
  await wait(duration);
}
```

Then register it in `widgets/playlist.js`:

```js
import * as customItem from './items/custom-item.js';

const ITEM_PLAYERS = {
  'image': imageItem,
  'rss-feed': rssFeedItem,
  'custom': customItem  // Add here
};
```

And use it in config:

```json
{
  "type": "playlist",
  "items": [
    {
      "type": "custom",
      "text": "Hello",
      "durationMs": 3000
    }
  ]
}
```

## Built-in item types

### Image items

Display an image for a configured duration.

Configuration:
- `src`: image URL (required)
- `title`: display title (optional)
- `durationMs`: how long to show (default from `config.images.durationMs`, fallback `10000`)
- `fit`: CSS object-fit value (default from `config.images.fit`, fallback `cover`)

Example:

```json
{
  "type": "image",
  "title": "Campus Photo",
  "src": "images/campus.jpg",
  "durationMs": 8000,
  "fit": "contain"
}
```

Global defaults:

```json
{
  "images": {
    "durationMs": 10000,
    "fit": "cover"
  }
}
```

### RSS feed items

Fetch and display paginated RSS feeds using the Puppeteer server.

Configuration:
- `url`: feed URL (required)
- `title`: display title (default: feed title)
- `itemsPerPage`: items per slide (default from `config.rss.itemsPerPage`)
- `itemDurationMs`: milliseconds per slide (default from `config.rss.itemDurationMs`)
- `maxItems`: cap total items (default from `config.rss.maxItems`)
- `showQR`: show QR code linking to feed (default from `config.rss.showQR`)
- `showThumbnails`: show item thumbnails (default from `config.rss.showThumbnails`)
- `fontScale`: scale RSS text (default from `config.rss.fontScale`)
- `proxy`: override the fetch proxy URL (default from `config.rss.proxy`)

Example:

```json
{
  "type": "rss-feed",
  "title": "Campus News",
  "url": "https://example.com/feed.xml",
  "itemsPerPage": 2,
  "itemDurationMs": 3000,
  "showQR": true,
  "fontScale": 1.2
}
```

Global defaults (apply to all RSS items unless overridden):

```json
{
  "rss": {
    "proxy": "http://localhost:8080/",
    "itemDurationMs": 3000,
    "fontScale": 1,
    "showQR": true,
    "showThumbnails": true,
    "itemsPerPage": 3,
    "maxItems": 12
  }
}
```

## Current widget modules

Existing widget plugins in this project:
- `widgets/clock.js`
- `widgets/daydate.js`
- `widgets/weather.js`
- `widgets/playlist.js` (carousel orchestrator)
- `widgets/moon.js`
- `widgets/qotd.js`
- `widgets/xkcd.js`

Item widgets (used within playlist):
- `widgets/items/image-item.js`
- `widgets/items/rss-feed-item.js`
