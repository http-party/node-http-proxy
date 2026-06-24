'use strict';

//
// Proxy-under-test, run as its own process so its RSS and GC are isolated from
// the load generator and origin (the 3-process topology the panel insisted on).
//
// Env:
//   LIB     = 'baseline' | 'candidate'   which lib/ to exercise
//   TARGET  = 'host:port'                origin to proxy to
//   WS      = '1'                        enable websocket proxying
//
// IPC protocol (fork):
//   -> {type:'ready', port}
//   <- 'stats'  ->  {type:'stats', rssPeak, gcCount, rssNow}
//   <- 'shutdown'
//

var http = require('http');
var perf = require('perf_hooks');
var loaders = require('./lib/loaders');

var which = process.env.LIB || 'candidate';
var httpProxy = require(loaders.proxyEntry(which));

var target = 'http://' + process.env.TARGET;
var proxy = httpProxy.createProxyServer({
  target: target,
  ws: process.env.WS === '1'
});

// A proxy must never crash on upstream errors; respond 502 like a real one.
proxy.on('error', function (err, req, res) {
  try {
    if (res && res.writeHead && !res.headersSent) res.writeHead(502);
    if (res && res.end) res.end('proxy error');
  } catch (e) { /* socket already gone */ }
});

// --- instrumentation ---------------------------------------------------------
var gcCount = 0;
var obs = new perf.PerformanceObserver(function (list) {
  gcCount += list.getEntries().length;
});
obs.observe({ entryTypes: ['gc'] });

var rssPeak = 0;
var sampler = setInterval(function () {
  var r = process.memoryUsage().rss;
  if (r > rssPeak) rssPeak = r;
}, 25);
sampler.unref();

// --- server ------------------------------------------------------------------
var server = http.createServer(function (req, res) {
  proxy.web(req, res);
});
if (process.env.WS === '1') {
  server.on('upgrade', function (req, socket, head) {
    proxy.ws(req, socket, head);
  });
}

server.listen(0, '127.0.0.1', function () {
  rssPeak = process.memoryUsage().rss;
  if (process.send) process.send({ type: 'ready', port: server.address().port });
});

process.on('message', function (m) {
  if (m === 'stats') {
    var handles = typeof process.getActiveResourcesInfo === 'function'
      ? process.getActiveResourcesInfo().length
      : null;
    process.send({
      type: 'stats',
      rssPeak: rssPeak,
      rssNow: process.memoryUsage().rss,
      gcCount: gcCount,
      activeHandles: handles
    });
  } else if (m === 'shutdown') {
    server.close(function () { process.exit(0); });
    // Force-exit if connections linger so the harness never hangs.
    setTimeout(function () { process.exit(0); }, 500).unref();
  }
});
