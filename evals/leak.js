'use strict';

//
// GATE 3 — Resource safety (the hard binary gate).
//
// Indutny: a patch that's 5% faster but leaks one FD per 10k requests is a
// failure, full stop. After a sustained HTTP burst AND a WebSocket churn burst,
// the proxy's active-handle count must return to ~baseline and RSS must not
// balloon. websocket-churn is scored here on leak-free teardown (Snell).
//
//   node evals/leak.js
//

var path = require('path');
var net = require('net');
var http = require('http');
var crypto = require('crypto');
var spawn = require('./lib/spawn');

var PROXY_PROC = path.join(__dirname, '..', 'bench', 'proxy-proc.js');
var ORIGIN_PROC = path.join(__dirname, '..', 'bench', 'origin-proc.js');

var HTTP_REQUESTS = 2000;
var WS_CYCLES = 300;
var HANDLE_SLACK = 3;          // candidate may exceed baseline by at most this
var RSS_SLACK_MB = 15;         // candidate RSS growth slack over baseline

function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// Burst of keep-alive HTTP requests over a small connection pool.
function httpBurst(port) {
  var agent = new http.Agent({ keepAlive: true, maxSockets: 20 });
  var remaining = HTTP_REQUESTS;
  return new Promise(function (resolve) {
    var inflight = 20;
    function one() {
      if (remaining-- <= 0) { if (--inflight === 0) { agent.destroy(); resolve(); } return; }
      var req = http.request({ port: port, path: '/', agent: agent }, function (res) {
        res.resume();
        res.on('end', one);
        res.on('error', one);
      });
      req.on('error', one);
      req.end();
    }
    for (var i = 0; i < 20; i++) one();
  });
}

// WebSocket churn: full handshake, one frame, clean close — repeated.
function wsChurn(port) {
  var done = 0;
  var concurrency = 15;
  return new Promise(function (resolve) {
    var inflight = concurrency;
    function cycle() {
      if (done++ >= WS_CYCLES) { if (--inflight === 0) resolve(); return; }
      var key = crypto.randomBytes(16).toString('base64');
      var s = net.connect(port, '127.0.0.1', function () {
        s.write('GET /ws HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
          'Sec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
      });
      var got = false;
      s.on('data', function () {
        if (got) return;
        got = true;
        // send a masked close frame, then end
        s.end(Buffer.from([0x88, 0x80, 0x00, 0x00, 0x00, 0x00]));
        setTimeout(cycle, 1);
      });
      s.on('error', function () { setTimeout(cycle, 1); });
      s.setTimeout(2000, function () { s.destroy(); });
    }
    for (var i = 0; i < concurrency; i++) cycle();
  });
}

// Run the HTTP + WS-churn burst against one lib; return handle/RSS deltas.
function measureStack(lib) {
  var origin, proxy;
  return spawn.forkReady(ORIGIN_PROC, {})
    .then(function (o) {
      origin = o;
      return spawn.forkReady(PROXY_PROC, { LIB: lib, TARGET: '127.0.0.1:' + o.port, WS: '1' });
    })
    .then(function (p) { proxy = p; return delay(200); })
    .then(function () { return spawn.ask(proxy, 'stats'); })
    .then(function (before) {
      return httpBurst(proxy.port)
        .then(function () { return wsChurn(proxy.port); })
        .then(function () { return delay(800); })
        .then(function () { return spawn.ask(proxy, 'stats'); })
        .then(function (after) {
          return {
            handleLeak: after.activeHandles - before.activeHandles,
            rssGrowthMB: (after.rssNow - before.rssNow) / 1048576
          };
        });
    })
    .then(function (r) {
      return Promise.all([spawn.shutdown(proxy), spawn.shutdown(origin)]).then(function () { return r; });
    })
    .catch(function (err) {
      return Promise.all([spawn.shutdown(proxy), spawn.shutdown(origin)]).then(function () { throw err; });
    });
}

function main() {
  console.log('\n=== GATE 3: resource safety (candidate vs baseline) ===\n');
  console.log('  burst: ' + HTTP_REQUESTS + ' HTTP reqs + ' + WS_CYCLES + ' WS churn cycles per lib\n');
  var base, cand;
  return measureStack('baseline')
    .then(function (b) { base = b; console.log('  baseline:  handleLeak=' + b.handleLeak + '  rssGrowth=' + b.rssGrowthMB.toFixed(1) + 'MB'); return measureStack('candidate'); })
    .then(function (c) { cand = c; console.log('  candidate: handleLeak=' + c.handleLeak + '  rssGrowth=' + c.rssGrowthMB.toFixed(1) + 'MB'); })
    .then(function () {
      var handleOk = cand.handleLeak <= base.handleLeak + HANDLE_SLACK;
      var rssOk = cand.rssGrowthMB <= base.rssGrowthMB + RSS_SLACK_MB;
      var pass = handleOk && rssOk;
      var improved = cand.handleLeak < base.handleLeak - HANDLE_SLACK;
      console.log('\n  ' + (pass ? (improved ? '✅ PASS (IMPROVED — fewer leaked handles than baseline)' : '✅ PASS') : '❌ FAIL (candidate leaks more than baseline)') + '\n');
      if (!pass) process.exitCode = 1;
      return { pass: pass, baseline: base, candidate: cand };
    })
    .catch(function (err) { console.error('leak gate error:', err); process.exitCode = 1; });
}

if (require.main === module) main();
module.exports = { main: main };
