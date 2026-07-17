import { wait, reportWidgetError } from '../utils.js';
import { playItem as playImageItem } from './image-item.js';

const WIDGET_TYPE = 'playlist.xkcd-item';

export async function playItem(stage, item = {}, config = {}) {
  let comic;
  try {
    comic = await fetch('https://xkcd.com/info.0.json').then(r => r.json());
  } catch (error) {
    reportWidgetError({
      widgetType: WIDGET_TYPE,
      message: `Failed to fetch XKCD data: ${error.message}`,
      target: stage,
      asHtml: true
    });
    await wait(2500);
    return;
  }

  await playImageItem(stage, {
    ...item,
    title: item.title || comic.title,
    src: comic.img
  }, config);
}
