import { createCard, wait, escapeHtml, reportWidgetError } from './utils.js';

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
    const right = item.type === 'rss-feed' ? 'RSS' : item.type === 'image' ? 'Image' : item.type === 'xkcd' ? 'XKCD' : item.type;
    meta.innerHTML = `<span>${escapeHtml(left)}</span><span>${escapeHtml(right)}</span>`;

    if (item.type === 'image') {
      const duration = resolveImageDurationMs(item, config);
      showImageSlide(stage, item, config);
      itemIndex = (itemIndex + 1) % items.length;
      setTimeout(playNext, duration);
      return;
    }

    if (item.type === 'rss-feed') {
      await playRssFeed(stage, item, config);
      itemIndex = (itemIndex + 1) % items.length;
      setTimeout(playNext, 25);
      return;
    }

    if (item.type === 'xkcd') {
      await showXkcd(stage, item, config);
      itemIndex = (itemIndex + 1) % items.length;
      const duration = item.durationMs || 30000;
      setTimeout(playNext, duration);
      return;
    }

    reportWidgetError({
      widgetType: type,
      message: `Unknown playlist item type: ${item.type || ''}`,
      target: stage,
      asHtml: true
    });
    itemIndex = (itemIndex + 1) % items.length;
    setTimeout(playNext, 3000);
  }

  playNext();
  return el;
}

function showImageSlide(stage, item, config = {}) {
  stage.innerHTML = '';
  const slide = document.createElement('div');
  slide.className = 'playlist-slide';

  const img = document.createElement('img');
  img.className = 'playlist-image';
  img.src = item.src;
  img.alt = item.title || '';
  img.onerror = () => {
    reportWidgetError({
      widgetType: type,
      message: `Image failed to load: ${item.src || '(missing src)'}`,
      target: stage,
      asHtml: true
    });
  };
  const fit = resolveImageFit(item, config);
  if (fit) {
    img.style.objectFit = fit;
  }

  slide.appendChild(img);
  stage.appendChild(slide);
}

function resolveImageDurationMs(item = {}, config = {}) {
  const raw = item.durationMs
    ?? config.images?.durationMs
    ?? 10000;

  const durationMs = Number(raw);
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 10000;
}

function resolveImageFit(item = {}, config = {}) {
  return item.fit
    ?? config.images?.fit
    ?? 'cover';
}

async function playRssFeed(stage, item, config) {
  const feedUrl = item.url;
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
      widgetType: type,
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
      widgetType: type,
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
        showQR: resolveRssShowQR(item, config),
        showThumbnails: resolveRssShowThumbnails(item, config),
        qrSize: item.qrSize || 120,
        fontScale: resolveRssFontScale(item, config)
      });
    await wait(pageDurationMs);
  }
}

async function showXkcd(stage, item, config = {}) {
  stage.innerHTML = '';

  const slide = document.createElement('div');
  slide.className = 'playlist-slide';

  const image = document.createElement('img');
  image.className = 'playlist-image';
  image.alt = 'Current XKCD comic';

  const title = document.createElement('div');
  title.className = 'xkcd-title';
  title.textContent = 'Loading...';

  slide.append(image, title);
  stage.appendChild(slide);

  try {
    const xkcdUrl = 'https://xkcd.com/info.0.json';
    const rssServerUrl = `http://localhost:3002/fetch-rss?url=${encodeURIComponent(xkcdUrl)}`;

    const response = await fetch(rssServerUrl);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const text = await response.text();
    const json = JSON.parse(text);
    image.src = json.img;
    title.textContent = json.title;
    image.onerror = () => {
      reportWidgetError({
        widgetType: type,
        message: 'Failed to load XKCD image',
        target: stage,
        asHtml: true
      });
    };
  } catch (error) {
    reportWidgetError({
      widgetType: type,
      message: `Failed to fetch XKCD: ${error.message}`,
      target: stage,
      asHtml: true
    });
  }
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
      console.warn(`[RSS] Direct fetch failed: ${directError.message}, trying rss2json...`);
      const fallback = await fetchFeedViaRss2Json(feedUrl);
      if (fallback) {
        return fallback;
      }
      throw new Error(`All feed fetch methods failed for ${feedUrl}`);
    }
  }

  try {
    const result = parseRssXml(xmlText, feedUrl);
    console.log(`[RSS] Parsed ${result.items?.length || 0} items`);
    return result;
  } catch (error) {
    console.error(`[RSS] Parse error: ${error.message}`);
    const fallback = await fetchFeedViaRss2Json(feedUrl);
    if (fallback) {
      return fallback;
    }
    throw error;
  }
}

async function fetchFeedViaRssServer(feedUrl) {
  const rssServerUrl = `http://localhost:3002/fetch-rss?url=${encodeURIComponent(feedUrl)}`;
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

async function fetchFeedViaRss2Json(feedUrl) {
  const fallbackUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;

  try {
    const response = await fetch(fallbackUrl);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data?.status !== 'ok' || !Array.isArray(data.items)) {
      return null;
    }

    return {
      source: 'rss2json',
      feed: {
        title: data.feed?.title || 'RSS Feed',
        link: data.feed?.link || feedUrl,
        description: data.feed?.description || ''
      },
      items: data.items.map(item => ({
        title: item?.title || '(untitled)',
        link: item?.link || '',
        pubDate: item?.pubDate || '',
        contentSnippet: item?.description || item?.content || '',
        thumbnailUrl: extractThumbnailFromRss2JsonItem(item)
      }))
    };
  } catch {
    return null;
  }
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

function resolveRssFontScale(item = {}, config = {}) {
  const raw = item.fontScale
    ?? config.rss?.fontScale
    ?? 1;

  const scale = Number(raw);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function resolveRssShowThumbnails(item = {}, config = {}) {
  const raw = item.showThumbnails
    ?? config.rss?.showThumbnails;

  if (raw === undefined) {
    return true;
  }

  return raw !== false;
}

function resolveRssShowQR(item = {}, config = {}) {
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

function extractThumbnailFromRss2JsonItem(item = {}) {
  if (typeof item?.thumbnail === 'string' && item.thumbnail.trim()) {
    return item.thumbnail.trim();
  }

  if (typeof item?.enclosure?.link === 'string' && item.enclosure.link.trim()) {
    return item.enclosure.link.trim();
  }

  if (typeof item?.description === 'string') {
    const fromDescription = extractFirstImageFromHtml(item.description);
    if (fromDescription) {
      return fromDescription;
    }
  }

  if (typeof item?.content === 'string') {
    const fromContent = extractFirstImageFromHtml(item.content);
    if (fromContent) {
      return fromContent;
    }
  }

  return '';
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
