export function createCard(title) {
  const card = document.createElement('div');
  card.className = 'widget-card';

  if (title) {
    const h = document.createElement('div');
    h.className = 'widget-title';
    h.textContent = title;
    card.appendChild(h);
  }

  return card;
}

export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

export function reportWidgetError({ widgetType, message, error = null, target = null, asHtml = false }) {
  const prefix = widgetType ? `[${widgetType}]` : '[widget]';
  if (error) {
    console.error(`${prefix} ${message}`, error);
  } else {
    console.error(`${prefix} ${message}`);
  }

  if (!target) return;

  if (asHtml) {
    target.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
    return;
  }

  target.textContent = message;
}
