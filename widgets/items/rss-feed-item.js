import { wait, reportWidgetError } from '../utils.js';

const WIDGET_TYPE = 'playlist.rss-feed-item';

export async function playItem(stage, item = {}, config = {}) {
  const feedUrl = item.url;
  if (!feedUrl) {
    reportWidgetError({
      widgetType: WIDGET_TYPE,
      message: 'RSS feed URL is required',
      target: stage,
      asHtml: true
    });
    await wait(2500);
    return;
  }

  const pageSize = item.itemsPerPage
    || config.rss?.itemsPerPage
    || 3;
  const itemDurationMs = item.itemDurationMs
    || config.rss?.itemDurationMs
    || 2000;

  let feed;
  try {
    feed = await fetchFeed(feedUrl, item, config);
  } catch (error) {
    reportWidgetError({
      widgetType: WIDGET_TYPE,
      message: `Could not load feed: ${feedUrl}`,
      error,
      target: stage,
      asHtml: true
    });
    await wait(2500);
    return;
  }

  const maxItems = item.maxItems
    ?? config.rss?.maxItems
    ?? 12;
  const limit = maxItems <= 0 ? Infinity : maxItems;
  const allItems = (feed.items || []).slice(0, limit);
  if (!allItems.length) {
    reportWidgetError({
      widgetType: WIDGET_TYPE,
      message: `No items in feed: ${feedUrl}`,
      target: stage,
      asHtml: true
    });
    await wait(2500);
    return;
  }

  for (let start = 0; start < allItems.length; start += pageSize) {
    const pageItems = allItems.slice(start, start + pageSize);
    const pageDurationMs = itemDurationMs * pageItems.length;
    showRssPage(stage, {
      title: item.title || feed.feed?.title || 'RSS Feed',
      url: feedUrl,
      source: feed.source || 'rss',
      items: pageItems,
      showQR: resolveShowQR(item, config),
      showThumbnails: resolveShowThumbnails(item, config),
      qrSize: item.qrSize || 120,
      fontScale: resolveFontScale(item, config)
    });
    await wait(pageDurationMs);
  }
}

async function fetchFeed(feedUrl, item = {}, config = {}) {
  let xmlText;

  try {
    xmlText = await fetchFeedViaRssServer(feedUrl);
  } catch (error) {
    console.warn(`[RSS] Server failed: ${error.message}, trying direct fetch...`);
    try {
      const proxy = item.proxy !== undefined ? item.proxy : (config.rss?.proxy || null);
      const finalUrl = proxy ? proxy + feedUrl : feedUrl;
      const response = await fetch(finalUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      xmlText = await response.text();
      console.log(`[RSS] Got direct response: ${xmlText.length} bytes`);
    } catch (directError) {
      throw new Error(`Direct feed fetch failed: ${directError.message}`);
    }
  }

  const result = parseRssXml(xmlText, feedUrl);
  console.log(`[RSS] Parsed ${result.items?.length || 0} items`);
  return result;
}

async function fetchFeedViaRssServer(feedUrl) {
  const rssServerUrl = `http://localhost:3000/fetch-rss?url=${encodeURIComponent(feedUrl)}`;
  console.log(`[RSS] Fetching from server: ${feedUrl}`);
  const response = await fetch(rssServerUrl);
  if (!response.ok) {
    const text = await response.text();
    console.error(`[RSS] Server error ${response.status}:`, text);
    throw new Error(`RSS server returned ${response.status}: ${text}`);
  }
  const text = await response.text();
  console.log(`[RSS] Got ${text.length} bytes from server`);
  return text;
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
    contentSnippet: item.querySelector('description')?.textContent?.trim() || '',
    thumbnailUrl: extractThumbnailFromXmlItem(item)
  }));

  return {
    source: 'rss',
    feed: {
      title: feedTitle,
      link: feedLink,
      description: feedDescription
    },
    items
  };
}

function showRssPage(stage, data) {
  stage.innerHTML = '';

  const slide = document.createElement('div');
  slide.className = 'playlist-slide rss-slide';
  slide.style.setProperty('--rss-font-scale', String(data.fontScale || 1));

  const main = document.createElement('div');
  main.className = 'rss-main';

  const header = document.createElement('div');
  header.className = 'rss-header';

  const headerText = document.createElement('div');
  headerText.className = 'rss-header-text';

  const title = document.createElement('div');
  title.className = 'rss-feed-title';
  title.textContent = data.title;

  const url = document.createElement('div');
  url.className = 'rss-feed-url';
  url.textContent = data.url;

  headerText.append(title, url);
  header.appendChild(headerText);

  if (data.showQR) {
    const qrWrap = document.createElement('div');
    qrWrap.className = 'rss-qr-wrap';

    const qr = document.createElement('img');
    qr.alt = 'QR code for feed';
    qr.src = buildQrUrl(data.url, data.qrSize);

    const label = document.createElement('div');
    label.className = 'rss-qr-label';
    label.textContent = 'Scan feed';

    qrWrap.append(qr, label);
    header.appendChild(qrWrap);
  }

  const itemsEl = document.createElement('div');
  itemsEl.className = 'rss-items';

  for (const item of data.items) {
    const row = document.createElement('div');
    row.className = 'rss-item';

    const body = document.createElement('div');
    body.className = 'rss-item-body';

    const showThumbnails = data.showThumbnails !== false;
    if (showThumbnails) {
      const media = document.createElement('div');
      media.className = 'rss-thumb-wrap';

      if (item.thumbnailUrl) {
        const thumb = document.createElement('img');
        thumb.className = 'rss-thumb';
        thumb.src = item.thumbnailUrl;
        thumb.alt = item.title ? `Thumbnail for ${item.title}` : 'RSS item thumbnail';
        thumb.loading = 'lazy';
        thumb.onerror = () => {
          media.innerHTML = '';
          media.appendChild(createRssStaticFallback());
        };
        media.appendChild(thumb);
      } else {
        media.appendChild(createRssStaticFallback());
      }

      row.appendChild(media);
    }

    const h = document.createElement('div');
    h.className = 'rss-title';
    h.textContent = item.title || '(untitled)';

    const d = document.createElement('div');
    d.className = 'rss-date';
    d.textContent = item.pubDate || '';

    body.append(h, d);

    row.appendChild(body);

    const snippet = truncateWords(stripHtml(item.contentSnippet || ''), 100);
    if (snippet) {
      const s = document.createElement('div');
      s.className = 'rss-snippet';
      s.textContent = snippet;
      row.appendChild(s);
    }

    itemsEl.appendChild(row);
  }

  main.append(header, itemsEl);
  slide.appendChild(main);
  stage.appendChild(slide);
}

function resolveFontScale(item = {}, config = {}) {
  const raw = item.fontScale
    ?? config.rss?.fontScale
    ?? 1;

  const scale = Number(raw);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function resolveShowThumbnails(item = {}, config = {}) {
  const raw = item.showThumbnails
    ?? config.rss?.showThumbnails;

  if (raw === undefined) {
    return true;
  }

  return raw !== false;
}

function resolveShowQR(item = {}, config = {}) {
  const raw = item.showQR
    ?? config.rss?.showQR;

  if (raw === undefined) {
    return true;
  }

  return raw !== false;
}

function buildQrUrl(value, size = 120) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function truncateWords(text, maxWords) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ') + '…';
}

function createRssStaticFallback() {
  const staticEl = document.createElement('div');
  staticEl.className = 'rss-static-fallback';

  const image = document.createElement('img');
  image.className = 'rss-static-image';
  image.src = 'images/SMPTE_Color_Bars.svg';
  image.alt = 'Fallback color bars';
  image.loading = 'lazy';

  staticEl.appendChild(image);
  return staticEl;
}

function extractThumbnailFromXmlItem(itemEl) {
  const mediaThumbnail = itemEl.querySelector('media\\:thumbnail, thumbnail, thumbnail[url]');
  const mediaThumbnailUrl = mediaThumbnail?.getAttribute('url')?.trim();
  if (mediaThumbnailUrl) {
    return mediaThumbnailUrl;
  }

  const mediaContent = itemEl.querySelector('media\\:content, content');
  const mediaContentUrl = mediaContent?.getAttribute('url')?.trim();
  if (mediaContentUrl) {
    return mediaContentUrl;
  }

  const enclosure = itemEl.querySelector('enclosure');
  const enclosureType = enclosure?.getAttribute('type')?.toLowerCase() || '';
  const enclosureUrl = enclosure?.getAttribute('url')?.trim() || '';
  if (enclosureUrl && enclosureType.startsWith('image/')) {
    return enclosureUrl;
  }

  const descriptionHtml = itemEl.querySelector('description')?.textContent || '';
  const descriptionImage = extractFirstImageFromHtml(descriptionHtml);
  if (descriptionImage) {
    return descriptionImage;
  }

  const encodedHtml = itemEl.querySelector('content\\:encoded')?.textContent || '';
  const encodedImage = extractFirstImageFromHtml(encodedHtml);
  if (encodedImage) {
    return encodedImage;
  }

  return '';
}

function extractFirstImageFromHtml(html = '') {
  if (!html.trim()) {
    return '';
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const src = doc.querySelector('img')?.getAttribute('src')?.trim();
  return src || '';
}
