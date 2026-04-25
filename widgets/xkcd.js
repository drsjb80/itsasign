import { createCard, reportWidgetError } from './utils.js';

export const type = 'xkcd';

export function create(widget, config) {
  const el = createCard(widget.title || 'XKCD');

  const img = document.createElement('img');
  img.alt = 'XKCD comic image';
  img.style.width = '100%';
  img.style.display = 'block';
  img.style.borderRadius = '8px';
  img.style.objectFit = 'contain';

  const meta = document.createElement('div');
  meta.className = 'weather-meta';
  meta.textContent = 'Loading XKCD image...';

  el.append(img, meta);

  const endpoint = widget.url || 'https://xkcd.com/info.0.json';
  const proxy = widget.proxy !== undefined ? widget.proxy : (config?.rss?.proxy || null);
  const refreshMs = widget.refreshMs || 3600000;

  async function load() {
    try {
      const response = await fetch(proxy ? proxy + endpoint : endpoint);
      if (!response.ok) {
        throw new Error('XKCD request failed');
      }

      const data = await response.json();
      if (!data.img) {
        throw new Error('XKCD image missing');
      }

      img.src = data.img;
      meta.textContent = '';
    } catch (error) {
      reportWidgetError({
        widgetType: type,
        message: 'XKCD unavailable',
        error,
        target: meta
      });
    }
  }

  load();
  setInterval(load, refreshMs);

  return el;
}
