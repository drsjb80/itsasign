const http = require('http');
const puppeteer = require('puppeteer');
const url = require('url');

const PORT = process.env.RSS_SERVER_PORT || 3002;
const RSS_PROXY_PORT = process.env.RSS_PROXY_PORT || 8080;

let browser = null;
let browserStarting = false;
const cache = new Map();
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

async function getBrowser() {
  if (browser) return browser;
  if (browserStarting) {
    while (browserStarting) {
      await new Promise(r => setTimeout(r, 100));
    }
    return browser;
  }

  browserStarting = true;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  } finally {
    browserStarting = false;
  }
  return browser;
}

async function fetchRssWithPuppeteer(feedUrl, timeoutMs = 15000) {
  const b = await getBrowser();
  const page = await b.newPage();
  let responseBody = null;

  await page.on('response', async (response) => {
    if (response.url() === feedUrl) {
      try {
        responseBody = await response.buffer();
      } catch (e) {
        // Response might not be bufferable, continue
      }
    }
  });

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(feedUrl, { waitUntil: 'networkidle2', timeout: timeoutMs });

    if (responseBody) {
      return responseBody.toString('utf-8');
    }

    const content = await page.content();
    return content;
  } finally {
    await page.close();
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

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
      console.log(`  ✓ Cached (${cached.length} bytes)`);
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(cached);
      return;
    }

    console.log(`  Fetching: ${feedUrl}`);

    try {
      const content = await fetchRssWithPuppeteer(feedUrl);
      setCacheContent(feedUrl, content);
      console.log(`  ✓ Success (${content.length} bytes)`);
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(content);
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
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
