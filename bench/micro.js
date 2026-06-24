'use strict';

//
// Deterministic, network-free microbenchmark of the per-request hot path.
//
// Collina's point: micro-opts (killing per-request closures, util._extend,
// url.parse) barely move RPS on a fast box because the kernel dominates — but
// they move *allocations per request* and *ns/op* cleanly and reproducibly.
// This is the CI-tier signal. Run with --expose-gc for bytes/op:
//
//   node --expose-gc bench/micro.js
//
// It loads the BASELINE snapshot and the CANDIDATE working tree side-by-side
// and reports the delta. (Run `node bench/freeze-baseline.js` first.)
//

var url = require('url');
var perf = require('perf_hooks');
var loaders = require('./lib/loaders');

// Count GCs so allocation samples contaminated by a mid-loop collection can be
// discarded (a scavenge during the window reads either falsely high — from
// promotion — or falsely low — from reclamation; only zero-GC windows are clean).
var gcTicks = 0;
new perf.PerformanceObserver(function (list) { gcTicks += list.getEntries().length; })
  .observe({ entryTypes: ['gc'] });

var ITERS = 200000;       // timing iterations
var GC_ITERS = 8000;      // alloc iterations — small enough to stay under the
                          // young-gen so NO scavenge fires mid-loop (else the
                          // heapUsed delta is meaningless). ~8k * ~80B < 1MB.
var TRIALS = 15;          // independent trials

// A representative incoming request + proxy options.
function makeReq() {
  return {
    method: 'GET',
    url: '/api/v2/users/42/profile?include=avatar&fields=name,email',
    httpVersion: '1.1',
    headers: {
      host: 'example.com',
      'user-agent': 'bench/1.0',
      accept: '*/*',
      'accept-encoding': 'gzip, deflate, br',
      cookie: 'session=abc123; theme=dark',
      'x-request-id': '7f3e9c1a-2b4d-4e8f-9a1b-3c5d7e9f1a2b'
    },
    connection: { remoteAddress: '203.0.113.7' },
    socket: { remoteAddress: '203.0.113.7' }
  };
}

var OPTIONS = {
  target: url.parse('http://127.0.0.1:8080/upstream'),
  changeOrigin: true,
  headers: { 'x-proxied-by': 'http-proxy' }
};

function median(xs) {
  var s = xs.slice().sort(function (a, b) { return a - b; });
  return s[Math.floor(s.length / 2)];
}
function clean(xs) { return xs.filter(function (x) { return x != null; }); }

function timeOnce(common, req) {
  var start = process.hrtime.bigint();
  for (var i = 0; i < ITERS; i++) common.setupOutgoing({}, OPTIONS, req);
  return Number(process.hrtime.bigint() - start) / ITERS; // ns/op
}

// One CLEAN allocation sample: RETAIN every result so heapUsed reflects the
// true bytes allocated (short-lived garbage is invisible to heapUsed sampling).
// Retry until a window completes with zero GCs; contaminated windows are
// discarded rather than averaged in. Returns null if it can't get a clean one.
function bytesOnce(common, req) {
  for (var attempt = 0; attempt < 12; attempt++) {
    var sink = new Array(GC_ITERS);
    global.gc(); global.gc();
    var g0 = gcTicks;
    var before = process.memoryUsage().heapUsed;
    for (var i = 0; i < GC_ITERS; i++) sink[i] = common.setupOutgoing({}, OPTIONS, req);
    var after = process.memoryUsage().heapUsed;
    var clean = gcTicks === g0;
    sink.length = 0; // release
    if (clean) return (after - before) / GC_ITERS;
  }
  return null;
}

function loadCommon(which) { return require(loaders.commonPath(which)); }

function pct(base, cand) { return base === 0 ? 0 : ((cand - base) / base) * 100; }

function main() {
  var baseCommon = loadCommon('baseline');
  var candCommon = loadCommon('candidate');
  var req = makeReq();
  var gcOk = typeof global.gc === 'function';

  // Warm both so TurboFan optimizes before measuring (Indutny: steady state).
  for (var w = 0; w < 30000; w++) { baseCommon.setupOutgoing({}, OPTIONS, req); candCommon.setupOutgoing({}, OPTIONS, req); }

  // Interleave baseline/candidate trials to cancel heap-state drift (PHK: A/B/A/B).
  var nsBase = [], nsCand = [], byBase = [], byCand = [];
  for (var t = 0; t < TRIALS; t++) {
    // Alternate which side is measured first so neither gets a consistently
    // cleaner heap (positional bias would otherwise fake a delta).
    if (t % 2 === 0) {
      nsBase.push(timeOnce(baseCommon, req));
      nsCand.push(timeOnce(candCommon, req));
      if (gcOk) { byBase.push(bytesOnce(baseCommon, req)); byCand.push(bytesOnce(candCommon, req)); }
    } else {
      nsCand.push(timeOnce(candCommon, req));
      nsBase.push(timeOnce(baseCommon, req));
      if (gcOk) { byCand.push(bytesOnce(candCommon, req)); byBase.push(bytesOnce(baseCommon, req)); }
    }
  }

  var result = {
    iters: ITERS,
    gcIters: GC_ITERS,
    trials: TRIALS,
    gcAvailable: gcOk,
    setupOutgoing: {
      baseline: { nsPerOp: median(nsBase), bytesPerOp: gcOk ? median(clean(byBase)) : null, bytesSamples: gcOk ? clean(byBase).length : 0 },
      candidate: { nsPerOp: median(nsCand), bytesPerOp: gcOk ? median(clean(byCand)) : null, bytesSamples: gcOk ? clean(byCand).length : 0 }
    }
  };

  var s = result.setupOutgoing;
  s.delta = {
    nsPerOpPct: pct(s.baseline.nsPerOp, s.candidate.nsPerOp),
    bytesPerOpPct: s.baseline.bytesPerOp ? pct(s.baseline.bytesPerOp, s.candidate.bytesPerOp) : null
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (require.main === module) main();
module.exports = { main: main };
