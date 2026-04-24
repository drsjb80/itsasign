import { createCard } from './utils.js';

export const type = 'time';

export function create(widget) {
  const el = createCard(widget.title || 'Time');
  const timeEl = document.createElement('div');
  timeEl.className = 'time-value';
  const dateEl = document.createElement('div');
  dateEl.className = 'time-date';
  el.append(timeEl, dateEl);

  const timeZone = widget.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = widget.locale || 'en-US';

  function update() {
    const now = new Date();
    timeEl.textContent = new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    }).format(now);

    dateEl.textContent = new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(now);
  }

  update();
  setInterval(update, 1000);
  return el;
}
