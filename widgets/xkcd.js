import { createCard, reportWidgetError } from './utils.js';

export const type = 'xkcd';

export function create(widget) {
  const el = createCard(widget.title || 'XKCD');

  const slide = document.createElement('div');
  slide.className = 'playlist-slide';

  const image = document.createElement('img');
  image.className = 'playlist-image';
  image.alt = 'Current XKCD comic';

  const title = document.createElement('div');
  title.className = 'xkcd-title';
  title.textContent = 'Loading...';

  slide.append(image, title);
  el.appendChild(slide);

  async function render() {
    try {
      const json = await fetch('https://xkcd.com/info.0.json').then(r => r.json());

      image.src = json.img;
      image.onerror = () => {
        reportWidgetError({
          widgetType: type,
          message: `Failed to load XKCD image`,
          target: el,
          asHtml: true
        });
      };

      title.textContent = json.title;
    } catch (error) {
      reportWidgetError({
        widgetType: type,
        message: `Failed to fetch XKCD data: ${error.message}`,
        target: el,
        asHtml: true
      });
    }
  }

  render();
  setInterval(render, Number(widget.refreshMs) || 86400000);

  return el;
}
