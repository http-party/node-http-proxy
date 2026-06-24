'use strict';

//
// Dependency-free keep-alive HTTP load generator. Lives in the runner process
// (the client). Drives N concurrent keep-alive connections at a target for a
// fixed wall-clock duration and records per-request latency, so we can report
// the full tail (Tarreau: RPS is the vanity metric, the tail is the product).
//

var http = require('http');

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  var idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function summarize(latenciesMs, durationMs, errors) {
  var sorted = latenciesMs.slice().sort(function (a, b) { return a - b; });
  var n = sorted.length;
  var sum = 0;
  for (var i = 0; i < n; i++) sum += sorted[i];
  return {
    requests: n,
    errors: errors,
    rps: n / (durationMs / 1000),
    latencyMs: {
      mean: n ? sum / n : 0,
      p50: percentile(sorted, 50),
      p90: percentile(sorted, 90),
      p99: percentile(sorted, 99),
      p99_9: percentile(sorted, 99.9),
      p99_99: percentile(sorted, 99.99),
      max: n ? sorted[n - 1] : 0
    }
  };
}

//
// opts: { port, path, method, connections, durationMs, body, slowReadBytesPerTick }
//
function run(opts) {
  var port = opts.port;
  var reqPath = opts.path || '/';
  var method = opts.method || 'GET';
  var connections = opts.connections || 50;
  var durationMs = opts.durationMs || 3000;
  var body = opts.body || null;
  var slow = opts.slowReadBytesPerTick || 0;

  var agent = new http.Agent({
    keepAlive: true,
    maxSockets: connections,
    maxFreeSockets: connections
  });

  var latencies = [];
  var errors = 0;
  var deadline = Date.now() + durationMs;
  var startedAt = Date.now();

  return new Promise(function (resolve) {
    var inflight = connections;

    function worker() {
      if (Date.now() >= deadline) {
        if (--inflight === 0) {
          agent.destroy();
          resolve(summarize(latencies, Date.now() - startedAt, errors));
        }
        return;
      }

      var t0 = process.hrtime.bigint();
      var req = http.request(
        { port: port, path: reqPath, method: method, agent: agent,
          headers: body ? { 'content-length': Buffer.byteLength(body) } : {} },
        function (res) {
          if (slow > 0) {
            // Slow consumer: trickle the body to force backpressure back
            // through the proxy to the origin (large-streaming memory test).
            res.pause();
            var pump = setInterval(function () {
              var chunk = res.read(slow);
              if (chunk === null && res.readableEnded) { /* drained */ }
              res.resume();
              res.pause();
            }, 5);
            res.on('end', function () { clearInterval(pump); finish(); });
            res.on('error', function () { clearInterval(pump); errors++; finish(); });
          } else {
            res.resume();
            res.on('end', finish);
            res.on('error', function () { errors++; finish(); });
          }
          function finish() {
            var dt = Number(process.hrtime.bigint() - t0) / 1e6;
            latencies.push(dt);
            worker();
          }
        }
      );
      req.on('error', function () { errors++; worker(); });
      if (body) req.write(body);
      req.end();
    }

    for (var c = 0; c < connections; c++) worker();
  });
}

module.exports = { run: run, summarize: summarize, percentile: percentile };
