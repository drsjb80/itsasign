var os = require('os');

// Listen on a specific host via the HOST environment variable
var host = process.env.HOST || '0.0.0.0';
// Listen on a specific port via the PORT environment variable
var port = process.env.PORT || 8080;

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

var http = require('http');
var cors_proxy = require('cors-anywhere');

var proxy = cors_proxy.createServer({
    originWhitelist: [], // Allow all origins
    requireHeader: ['origin', 'x-requested-with'],
    removeHeaders: ['cookie', 'cookie2']
});

function isIpRequest(reqUrl) {
  try {
    var parsed = new URL(reqUrl, 'http://local');
    return parsed.pathname === '/ip' || parsed.pathname === '/ip/';
  } catch {
    var pathOnly = String(reqUrl || '').split('?')[0];
    return pathOnly === '/ip' || pathOnly === '/ip/';
  }
}

function normalizeEncodedProxyUrl(reqUrl) {
  if (!/^\/https?%3A%2F%2F/i.test(reqUrl || '')) {
    return reqUrl;
  }

  try {
    return '/' + decodeURIComponent(String(reqUrl).slice(1));
  } catch {
    return reqUrl;
  }
}

http.createServer(function(req, res) {
  if (isIpRequest(req.url)) {
    var ip = getLocalIp();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ ip: ip }));
    return;
  }
  req.url = normalizeEncodedProxyUrl(req.url);
  proxy.emit('request', req, res);
}).listen(port, host, function() {
    console.log('Running CORS Anywhere on ' + host + ':' + port);
    console.log('Local IP endpoint: http://' + getLocalIp() + ':' + port + '/ip');
});

