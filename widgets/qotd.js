import { createCard, reportWidgetError } from './utils.js';

export const type = 'qotd';

export function create(widget) {
  const el = createCard(widget.title || 'Quote of the Day');

  const quoteEl = document.createElement('div');
  quoteEl.className = 'qotd-quote';

  const attributionEl = document.createElement('div');
  attributionEl.className = 'qotd-attribution';

  el.append(quoteEl, attributionEl);

  const src = widget.src || 'qotd.txt';

  async function load() {
    try {
      const response = await fetch(`${src}?_=${Date.now()}`);
      if (!response.ok) throw new Error(`Could not load ${src}`);

      const text = (await response.text()).trim();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      const attrIndex = lines.findLastIndex(l => l.startsWith('\u2014') || l.startsWith('--'));

      if (attrIndex !== -1) {
        quoteEl.textContent = lines.slice(0, attrIndex).join(' ');
        attributionEl.textContent = lines[attrIndex].replace(/^--\s*/, '\u2014 ');
      } else {
        quoteEl.textContent = lines.join(' ');
        attributionEl.textContent = '';
      }
    } catch (error) {
      reportWidgetError({ widgetType: type, message: 'Quote unavailable', error, target: quoteEl });
      attributionEl.textContent = '';
    }
  }

  load();

  return el;
}
