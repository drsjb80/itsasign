import { createCard } from './utils.js';

export const type = 'daydate';

export function create(widget) {
  const el = createCard(widget.title || null);
  el.classList.add('daydate-widget');

  const weekdayEl = document.createElement('div');
  weekdayEl.className = 'daydate-weekday';

  const dateEl = document.createElement('div');
  dateEl.className = 'daydate-date';

  el.append(weekdayEl, dateEl);

  const timeZone = widget.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = widget.locale || 'en-US';

  function update() {
    const now = new Date();

    weekdayEl.textContent = new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: 'long'
    }).format(now);

    dateEl.textContent = new Intl.DateTimeFormat(locale, {
      timeZone,
      month: 'short',
      day: '2-digit'
    }).format(now);
  }

  update();
  setInterval(update, 60000);

  return el;
}