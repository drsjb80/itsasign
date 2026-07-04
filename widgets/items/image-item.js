import { wait, reportWidgetError } from '../utils.js';

const WIDGET_TYPE = 'playlist.image-item';

export async function playItem(stage, item = {}, config = {}) {
  stage.innerHTML = '';
  const slide = document.createElement('div');
  slide.className = 'playlist-slide';

  const img = document.createElement('img');
  img.className = 'playlist-image';
  img.src = item.src;
  img.alt = item.title || '';
  img.onerror = () => {
    reportWidgetError({
      widgetType: WIDGET_TYPE,
      message: `Image failed to load: ${item.src || '(missing src)'}`,
      target: stage,
      asHtml: true
    });
  };

  const fit = resolveFit(item, config);
  if (fit) {
    img.style.objectFit = fit;
  }

  slide.appendChild(img);
  stage.appendChild(slide);

  const duration = resolveDurationMs(item, config);
  await wait(duration);
}

function resolveDurationMs(item = {}, config = {}) {
  const raw = item.durationMs
    ?? config.images?.durationMs
    ?? 10000;

  const durationMs = Number(raw);
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 10000;
}

function resolveFit(item = {}, config = {}) {
  return item.fit
    ?? config.images?.fit
    ?? 'cover';
}
