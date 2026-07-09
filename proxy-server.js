const http = require('http');
const puppeteer = require('puppeteer');
const url = require('url');
const querystring = require('querystring');

const PORT = process.env.RSS_SERVER_PORT || 3002;
const RSS_PROXY_PORT = process.env.RSS_PROXY_PORT || 8080;

let browser = null;
let browserStarting = false;
const cache = new Map();
const resourceCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCachedContent(url) {
  const cached = cache.get(url);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    cache.delete(url);
    return null;
  }
  return cached.content;
}

function setCacheContent(url, content) {
  cache.set(url, { content, timestamp: Date.now() });
}

function getCachedResource(url) {
  const cached = resourceCache.get(url);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    resourceCache.delete(url);
    return null;
  }
  return cached;
}

function setCachedResource(url, buffer, contentType) {
  resourceCache.set(url, { buffer, contentType, timestamp: Date.now() });
}

function logError(label, error) {
  console.error(`  ✗ ${label}: ${error.message}`);
  if (error.stack) console.error(error.stack);
  if (error.cause) console.error('  Cause:', error.cause);
}

async function fetchResource(resourceUrl, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  console.log(`  [fetch-url] GET ${resourceUrl}`);

  try {
    const response = await fetch(resourceUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': new url.URL(resourceUrl).origin
      }
    });

    const elapsed = Date.now() - start;
    console.log(
      `  [fetch-url] <- ${response.status} ${response.statusText} ` +
      `(${elapsed}ms) content-type=${response.headers.get('content-type')} ` +
      `content-length=${response.headers.get('content-length')} url=${resourceUrl}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${resourceUrl}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, contentType };
  } catch (error) {
    const elapsed = Date.now() - start;
    console.error(`  [fetch-url] FAILED after ${elapsed}ms for ${resourceUrl}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getBrowser() {
  if (browser) return browser;
  if (browserStarting) {
    console.log('  [browser] launch already in progress, waiting...');
    while (browserStarting) {
      await new Promise(r => setTimeout(r, 100));
    }
    return browser;
  }

  browserStarting = true;
  const start = Date.now();
  console.log('  [browser] launching puppeteer...');
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    browser.on('disconnected', () => {
      console.error('  [browser] disconnected/crashed, will relaunch on next request');
      browser = null;
    });
    console.log(`  [browser] launched in ${Date.now() - start}ms (pid ${browser.process()?.pid})`);
  } catch (error) {
    logError('browser launch failed', error);
    throw error;
  } finally {
    browserStarting = false;
  }
  return browser;
}

async function fetchRssWithPuppeteer(feedUrl, timeoutMs = 15000) {
  const start = Date.now();
  console.log(`  [puppeteer] GET ${feedUrl}`);

  const b = await getBrowser();
  const page = await b.newPage();
  let responseBody = null;
  let mainResponseStatus = null;

  page.on('response', async (response) => {
    console.log(`  [puppeteer]   <- ${response.status()} ${response.url()}`);
    if (response.url() === feedUrl) {
      mainResponseStatus = response.status();
      try {
        responseBody = await response.buffer();
      } catch (e) {
        console.error(`  [puppeteer]   could not buffer response body for ${feedUrl}: ${e.message}`);
      }
    }
  });

  page.on('requestfailed', (request) => {
    console.error(`  [puppeteer]   request failed: ${request.url()} (${request.failure()?.errorText})`);
  });

  page.on('console', (msg) => {
    console.log(`  [puppeteer]   page console [${msg.type()}]: ${msg.text()}`);
  });

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const navResponse = await page.goto(feedUrl, { waitUntil: 'networkidle2', timeout: timeoutMs });
    console.log(
      `  [puppeteer] navigation status=${navResponse ? navResponse.status() : '(none)'} ` +
      `mainResponseStatus=${mainResponseStatus} elapsed=${Date.now() - start}ms`
    );

    if (responseBody) {
      console.log(`  [puppeteer] using buffered response body (${responseBody.length} bytes)`);
      return responseBody.toString('utf-8');
    }

    console.log('  [puppeteer] no buffered response body, falling back to page.content()');
    const content = await page.content();
    console.log(`  [puppeteer] page.content() length=${content.length}`);
    return content;
  } catch (error) {
    console.error(`  [puppeteer] FAILED after ${Date.now() - start}ms for ${feedUrl}`);
    throw error;
  } finally {
    await page.close();
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (pathname === '/health' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (pathname === '/fetch-rss' && req.method === 'GET') {
    const feedUrl = parsedUrl.query.url;

    if (!feedUrl) {
      console.error('  Missing URL parameter. Query:', parsedUrl.query);
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing url parameter' }));
      return;
    }

    const cached = getCachedContent(feedUrl);
    if (cached) {
      console.log(`  ✓ Cached: ${feedUrl} (${cached.length} bytes)`);
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(cached);
      return;
    }

    console.log(`  Fetching (not cached): ${feedUrl}`);

    try {
      const content = await fetchRssWithPuppeteer(feedUrl);
      setCacheContent(feedUrl, content);
      console.log(`  ✓ Success: ${feedUrl} (${content.length} bytes)`);
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(content);
    } catch (error) {
      logError(`Error fetching ${feedUrl}`, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (pathname === '/fetch-url' && req.method === 'GET') {
    const resourceUrl = parsedUrl.query.url;

    if (!resourceUrl) {
      console.error('  Missing URL parameter. Query:', parsedUrl.query);
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing url parameter' }));
      return;
    }

    const cached = getCachedResource(resourceUrl);
    if (cached) {
      console.log(`  ✓ Cached resource: ${resourceUrl} (${cached.buffer.length} bytes)`);
      res.writeHead(200, { 'Content-Type': cached.contentType });
      res.end(cached.buffer);
      return;
    }

    console.log(`  Fetching resource (not cached): ${resourceUrl}`);

    try {
      const { buffer, contentType } = await fetchResource(resourceUrl);
      setCachedResource(resourceUrl, buffer, contentType);
      console.log(`  ✓ Success: ${resourceUrl} (${buffer.length} bytes, ${contentType})`);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(buffer);
    } catch (error) {
      logError(`Error fetching resource ${resourceUrl}`, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`RSS Server running on http://localhost:${PORT}`);
  console.log(`Proxy will be on http://localhost:${RSS_PROXY_PORT}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});
