'use strict';

//
// GATE 2 — Adversarial lifecycle corpus.
//
// Snell: the cases benchmarks skip and AIs regress. Each case stresses a
// teardown path, then asserts (a) the proxy process SURVIVED and still serves
// a normal request, and (b) active handles returned to ~baseline afterwards
// (no socket/FD leak). This is exactly where a `.pipe()` -> `pipeline()`
// refactor can silently win or lose.
//
//   node evals/lifecycle.js
//

var path = require('path');
var net = require('net');
var http = require('http');
var spawn = require('./lib/spawn');

var PROXY_PROC = path.join(__dirname, '..', 'bench', 'proxy-proc.js');
var ORIGIN_PROC = path.join(__dirname, '..', 'bench', 'origin-proc.js');

function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// Is the proxy still alive and serving? (liveness probe)
function probe(port) {
  return new Promise(function (resolve) {
    var req = http.request({ port: port, path: '/', agent: false }, function (res) {
      res.resume();
      res.on('end', function () { resolve(res.statusCode); });
    });
    req.on('error', function () { resolve(null); });
    req.setTimeout(2000, function () { req.destroy(); resolve(null); });
    req.end();
  });
}

// Run one adversarial case against a fresh stack; report survival + handle leak.
function runCase(name, stress, opts, lib) {
  opts = opts || {};
  var origin, proxy, rst;
  var start = opts.rstOrigin
    ? startRstOrigin().then(function (r) { rst = r; return { port: r.port }; })
    : spawn.forkReady(ORIGIN_PROC, {}).then(function (o) { origin = o; return o; });

  return start
    .then(function (o) {
      return spawn.forkReady(PROXY_PROC, { LIB: lib, TARGET: '127.0.0.1:' + o.port, WS: '1' })
        .then(function (p) { proxy = p; });
    })
    .then(function () { return spawn.ask(proxy, 'stats'); })
    .then(function (before) {
      return stress(proxy.port)
        .then(function () { return delay(400); })           // quiesce
        .then(function () { return probe(proxy.port); })     // liveness
        .then(function (status) {
          return spawn.ask(proxy, 'stats').then(function (after) {
            var b = before ? before.activeHandles : null;
            var a = after ? after.activeHandles : null;
            var leak = (a != null && b != null) ? a - b : null;
            return { name: name, survived: status != null, liveness: status, handlesBefore: b, handlesAfter: a, handleLeak: leak };
          });
        });
    })
    .then(function (result) {
      return cleanup().then(function () { return result; });
    })
    .catch(function (err) {
      return cleanup().then(function () { return { name: name, survived: false, error: String(err && err.message || err) }; });
    });

  function cleanup() {
    var jobs = [];
    if (proxy) jobs.push(spawn.shutdown(proxy));
    if (origin) jobs.push(spawn.shutdown(origin));
    if (rst) jobs.push(new Promise(function (r) { rst.server.close(function () { r(); }); }));
    return Promise.all(jobs);
  }
}

// An origin that accepts a connection and immediately RSTs it.
function startRstOrigin() {
  return new Promise(function (resolve) {
    var server = net.createServer(function (socket) {
      socket.on('error', function () {});
      socket.resetAndDestroy ? socket.resetAndDestroy() : socket.destroy();
    });
    server.listen(0, '127.0.0.1', function () { resolve({ server: server, port: server.address().port }); });
  });
}

// --- stressors ---------------------------------------------------------------

function stressClientAbort(port) {
  // Fire many requests and rip the socket away before the response arrives.
  var jobs = [];
  for (var i = 0; i < 40; i++) {
    jobs.push(new Promise(function (resolve) {
      var s = net.connect(port, '127.0.0.1', function () {
        s.write('GET / HTTP/1.1\r\nHost: x\r\n\r\n');
        setTimeout(function () { s.destroy(); resolve(); }, 5);
      });
      s.on('error', function () { resolve(); });
    }));
  }
  return Promise.all(jobs);
}

function stressSlowloris(port) {
  // Open sockets, dribble a partial request, never finish, then drop.
  var jobs = [];
  for (var i = 0; i < 20; i++) {
    jobs.push(new Promise(function (resolve) {
      var s = net.connect(port, '127.0.0.1', function () {
        s.write('GET / HTTP/1.1\r\n');
        s.write('Host: slow\r\n');
        setTimeout(function () { s.write('X-A: 1\r\n'); }, 50);
        setTimeout(function () { s.destroy(); resolve(); }, 150);
      });
      s.on('error', function () { resolve(); });
    }));
  }
  return Promise.all(jobs);
}

function stressHalfOpenUpgrade(port) {
  // Begin a WebSocket upgrade, then abandon it half-open.
  var jobs = [];
  for (var i = 0; i < 20; i++) {
    jobs.push(new Promise(function (resolve) {
      var s = net.connect(port, '127.0.0.1', function () {
        s.write('GET /ws HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n');
        setTimeout(function () { s.destroy(); resolve(); }, 30);
      });
      s.on('error', function () { resolve(); });
    }));
  }
  return Promise.all(jobs);
}

function stressOriginRst(port) {
  // Normal requests whose upstream RSTs — proxy must 502, not die.
  var jobs = [];
  for (var i = 0; i < 20; i++) {
    jobs.push(probe(port));
  }
  return Promise.all(jobs);
}

var HANDLE_SLACK = 2; // sampling jitter tolerance

function main() {
  console.log('\n=== GATE 2: adversarial lifecycle corpus (candidate vs baseline) ===\n');
  var cases = [
    ['client-abort', stressClientAbort, {}],
    ['slowloris', stressSlowloris, {}],
    ['half-open-upgrade', stressHalfOpenUpgrade, {}],
    ['origin-rst', stressOriginRst, { rstOrigin: true }]
  ];
  var rows = [];
  var chain = Promise.resolve();
  cases.forEach(function (c) {
    // Measure baseline then candidate for the same case.
    chain = chain
      .then(function () { return runCase(c[0], c[1], c[2], 'baseline'); })
      .then(function (b) { return runCase(c[0], c[1], c[2], 'candidate').then(function (cand) { rows.push({ name: c[0], base: b, cand: cand }); }); });
  });
  return chain.then(function () {
    var allOk = true;
    rows.forEach(function (r) {
      var bLeak = r.base.handleLeak, cLeak = r.cand.handleLeak;
      // Gate: candidate must survive AND not leak MORE than baseline.
      var noWorse = (bLeak == null || cLeak == null) ? true : cLeak <= bLeak + HANDLE_SLACK;
      var ok = r.cand.survived && noWorse;
      if (!ok) allOk = false;
      var improved = bLeak != null && cLeak != null && cLeak < bLeak - HANDLE_SLACK;
      console.log('  [' + (ok ? (improved ? 'IMPROVED' : 'ok') : 'FAIL') + '] ' + r.name +
        '  survived=' + r.cand.survived +
        '  handleLeak base=' + bLeak + ' cand=' + cLeak +
        (r.cand.error ? ' error=' + r.cand.error : ''));
    });
    console.log('\n  ' + (allOk ? '✅ PASS' : '❌ FAIL') + ' (candidate must survive and leak no more than baseline)\n');
    if (!allOk) process.exitCode = 1;
    return { pass: allOk, rows: rows };
  }).catch(function (err) { console.error('lifecycle error:', err); process.exitCode = 1; });
}

if (require.main === module) main();
module.exports = { main: main };
