import { createCard, escapeHtml, reportWidgetError } from './utils.js';
import * as imageItem from './items/image-item.js';
import * as rssFeedItem from './items/rss-feed-item.js';
import * as xkcdItem from './items/xkcd-item.js';

export const type = 'playlist';

const ITEM_PLAYERS = {
  'image': imageItem,
  'rss-feed': rssFeedItem,
  'xkcd': xkcdItem
};

export function create(widget, config) {
  const el = createCard(widget.title || 'Playlist');

  const meta = document.createElement('div');
  meta.className = 'meta-row';
  meta.innerHTML = '<span>Loading playlist...</span><span></span>';

  const stage = document.createElement('div');
  stage.className = 'playlist-stage';

  el.append(meta, stage);

  const items = Array.isArray(widget.items) ? widget.items : [];
  if (!items.length) {
    reportWidgetError({
      widgetType: type,
      message: 'No playlist items configured',
      target: stage,
      asHtml: true
    });
    return el;
  }

  let itemIndex = 0;

  async function playNext() {
    const item = items[itemIndex];
    const left = `${itemIndex + 1} / ${items.length}`;
    const right = getItemTypeLabel(item.type);
    meta.innerHTML = `<span>${escapeHtml(left)}</span><span>${escapeHtml(right)}</span>`;

    const player = ITEM_PLAYERS[item.type];
    if (!player || !player.playItem) {
      reportWidgetError({
        widgetType: type,
        message: `Unknown playlist item type: ${item.type || ''}`,
        target: stage,
        asHtml: true
      });
      itemIndex = (itemIndex + 1) % items.length;
      setTimeout(playNext, 3000);
      return;
    }

    try {
      await player.playItem(stage, item, config);
    } catch (error) {
      reportWidgetError({
        widgetType: type,
        message: `Error playing item: ${error.message}`,
        error,
        target: stage,
        asHtml: true
      });
    }

    itemIndex = (itemIndex + 1) % items.length;
    setTimeout(playNext, 25);
  }

  playNext();
  return el;
}

function getItemTypeLabel(type) {
  const labels = {
    'image': 'Image',
    'rss-feed': 'RSS',
    'xkcd': 'XKCD'
  };
  return labels[type] || type;
}
