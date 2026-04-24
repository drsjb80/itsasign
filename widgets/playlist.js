import { createCard, wait, escapeHtml } from './utils.js';

export const type = 'playlist';

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
    stage.innerHTML = '<div class="error">No playlist items configured</div>';
    return el;
  }

  let itemIndex = 0;

  async function playNext() {
    const item = items[itemIndex];
    const left = `${itemIndex + 1} / ${items.length}`;
    const right = item.type === 'rss-feed' ? 'RSS' : item.type === 'image' ? 'Image' : item.type;
    meta.innerHTML = `<span>${escapeHtml(left)}</span><span>${escapeHtml(right)}</span>`;

    if (item.type === 'image') {
      const duration = item.durationMs || widget.defaultImageDurationMs || 10000;
      showImageSlide(stage, item);
      itemIndex = (itemIndex + 1) % items.length;
      setTimeout(playNext, duration);
      return;
    }

    if (item.type === 'rss-feed') {
      await playRssFeed(stage, item, widget, config);
      itemIndex = (itemIndex + 1) % items.length;
      setTimeout(playNext, 25);
      return;
    }

    stage.innerHTML = `<div class="error">Unknown playlist item type: ${escapeHtml(item.type || '')}</div>`;
    itemIndex = (itemIndex + 1) % items.length;
    setTimeout(playNext, 3000);
  }

  playNext();
  return el;
}

function showImageSlide(stage, item) {
  stage.innerHTML = '';
  const slide = document.createElement('div');
  slide.className = 'playlist-slide';

  const img = document.createElement('img');
  img.className = 'playlist-image';
  img.src = item.src;
  img.alt = item.title || '';
  if (item.fit === 'contain') {
    img.style.objectFit = 'contain';
  }

  slide.appendChild(img);
  stage.appendChild(slide);
}

async function playRssFeed(stage, item, widget, config) {
  const feedUrl = item.url;
  const pageSize = item.itemsPerPage || widget.defaultRssItemsPerPage || 3;
  const pageDurationMs = item.pageDurationMs || widget.defaultRssPageDurationMs || 7000;

  let feed;
  try {
    feed = await fetchFeed(feedUrl, item, config);
  } catch (error) {
    stage.innerHTML = `<div class="error">Could not load feed: ${escapeHtml(feedUrl)}</div>`;
    await wait(2500);
    return;
  }

  const maxItems = item.maxItems ?? widget.defaultRssMaxItems ?? 12;
  const limit = maxItems <= 0 ? Infinity : maxItems;
  const allItems = (feed.items || []).slice(0, limit);
  if (!allItems.length) {
    stage.innerHTML = `<div class="error">No items in feed: ${escapeHtml(feedUrl)}</div>`;
    await wait(2500);
    return;
  }

  for (let start = 0; start < allItems.length; start += pageSize) {
    const pageItems = allItems.slice(start, start + pageSize);
    showRssPage(stage, {
      title: item.title || feed.feed?.title || 'RSS Feed',
      url: feedUrl,
      items: pageItems,
      showQr: item.showQr !== false,
      qrSize: item.qrSize || 120
    });
    await wait(pageDurationMs);
  }
}

function showRssPage(stage, data) {
  stage.innerHTML = '';

  const slide = document.createElement('div');
  slide.className = 'playlist-slide rss-slide';

  const main = document.createElement('div');
  main.className = 'rss-main';

  const title = document.createElement('div');
  title.className = 'rss-feed-title';
  title.textContent = data.title;

  const url = document.createElement('div');
  url.className = 'rss-feed-url';
  url.textContent = data.url;

  const itemsEl = document.createElement('div');
  itemsEl.className = 'rss-items';

  for (const item of data.items) {
    const row = document.createElement('div');
    row.className = 'rss-item';

    const h = document.createElement('div');
    h.className = 'rss-title';
    h.textContent = item.title || '(untitled)';

    const d = document.createElement('div');
    d.className = 'rss-date';
    d.textContent = item.pubDate || '';

    row.append(h, d);
    itemsEl.appendChild(row);
  }

  main.append(title, url, itemsEl);
  slide.appendChild(main);

  if (data.showQr) {
    const qrWrap = document.createElement('div');
    qrWrap.className = 'rss-qr-wrap';

    const qr = document.createElement('img');
    qr.alt = 'QR code';
    qr.src = buildQrUrl(data.url, data.qrSize);

    const label = document.createElement('div');
    label.className = 'rss-qr-label';
    label.textContent = 'Scan feed';

    qrWrap.append(qr, label);
    slide.appendChild(qrWrap);
  }

  stage.appendChild(slide);
}

async function fetchFeed(feedUrl, item = {}, config = {}) {
  const proxy = item.proxy !== undefined ? item.proxy : (config.rss?.proxy || null);
  const finalUrl = proxy ? proxy + feedUrl : feedUrl;

  const response = await fetch(finalUrl);
  if (!response.ok) {
    throw new Error(`Feed fetch failed: ${finalUrl}`);
  }

  const xmlText = await response.text();
  return parseRssXml(xmlText, feedUrl);
}

function parseRssXml(xmlText, fallbackUrl = '') {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`Invalid RSS/XML from ${fallbackUrl}`);
  }

  const channel = doc.querySelector('channel');
  const feedTitle = channel?.querySelector('title')?.textContent?.trim() || 'RSS Feed';
  const feedLink = channel?.querySelector('link')?.textContent?.trim() || fallbackUrl;
  const feedDescription = channel?.querySelector('description')?.textContent?.trim() || '';

  const items = [...doc.querySelectorAll('item')].map(item => ({
    title: item.querySelector('title')?.textContent?.trim() || '(untitled)',
    link: item.querySelector('link')?.textContent?.trim() || '',
    pubDate: item.querySelector('pubDate')?.textContent?.trim() || '',
    contentSnippet: item.querySelector('description')?.textContent?.trim() || ''
  }));

  return {
    feed: {
      title: feedTitle,
      link: feedLink,
      description: feedDescription
    },
    items
  };
}

function buildQrUrl(value, size = 120) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
}
