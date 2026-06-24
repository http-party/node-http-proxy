'use strict';

//
// GATE 1 — Differential wire oracle.
//
// Drives the fixed corpus through the BASELINE proxy and the CANDIDATE proxy
// (both pointed at one deterministic echo origin) and asserts the
// client-visible responses are byte-identical modulo an explicit whitelist.
//
// Indutny's point: don't hand-write golden bytes, they rot — diff the candidate
// against the frozen baseline. Any UNDECLARED change to status, headers, body,
// or framing fails the gate, no matter how much faster the candidate is.
//
//   node evals/oracle.js
//
// Declare intentional wire changes in evals/whitelist.js to allow them.
//

var path = require('path');
var spawn = require('./lib/spawn');
var client = require('./lib/client');
var corpus = require('./corpus');
var whitelist = require('./whitelist');

var PROXY_PROC = path.join(__dirname, '..', 'bench', 'proxy-proc.js');
var ECHO_PROC = path.join(__dirname, 'echo-origin-proc.js');

function captureFor(which, originPort) {
  var results = {};
  return spawn.forkReady(PROXY_PROC, { LIB: which, TARGET: '127.0.0.1:' + originPort, WS: '0' })
    .then(function (proxy) {
      var chain = Promise.resolve();
      corpus.forEach(function (entry) {
        chain = chain.then(function () {
          return client.send(proxy.port, entry).then(function (resp) { results[entry.name] = resp; });
        });
      });
      return chain.then(function () { return spawn.shutdown(proxy); }).then(function () { return results; });
    });
}

function diff(name, base, cand) {
  var wl = whitelist[name] || [];
  // Compare structurally; collect field-level mismatches not covered by the
  // per-entry whitelist (array of dotted field names, e.g. "headers.connection").
  var mismatches = [];
  function walk(prefix, a, b) {
    var ja = JSON.stringify(a), jb = JSON.stringify(b);
    if (ja === jb) return;
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      var keys = {};
      Object.keys(a).forEach(function (k) { keys[k] = 1; });
      Object.keys(b).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (k) { walk(prefix ? prefix + '.' + k : k, a[k], b[k]); });
    } else {
      if (wl.indexOf(prefix) === -1) mismatches.push({ field: prefix, baseline: a, candidate: b });
    }
  }
  walk('', base, cand);
  return mismatches;
}

function main() {
  console.log('\n=== GATE 1: differential wire oracle ===\n');
  var origin;
  return spawn.forkReady(ECHO_PROC, {})
    .then(function (o) { origin = o; return captureFor('baseline', origin.port); })
    .then(function (baseResults) {
      return captureFor('candidate', origin.port).then(function (candResults) {
        return { base: baseResults, cand: candResults };
      });
    })
    .then(function (caps) {
      return spawn.shutdown(origin).then(function () { return caps; });
    })
    .then(function (caps) {
      var failures = [];
      corpus.forEach(function (entry) {
        var b = caps.base[entry.name], c = caps.cand[entry.name];
        var ms = diff(entry.name, b, c);
        var status = ms.length ? 'FAIL' : 'ok';
        console.log('  [' + status + '] ' + entry.name);
        if (ms.length) {
          failures.push({ entry: entry.name, mismatches: ms });
          ms.forEach(function (m) {
            console.log('        ' + m.field + ': baseline=' + JSON.stringify(m.baseline) + ' candidate=' + JSON.stringify(m.candidate));
          });
        }
      });
      var pass = failures.length === 0;
      console.log('\n  ' + (pass ? '✅ PASS' : '❌ FAIL') + ' — ' + (corpus.length - failures.length) + '/' + corpus.length + ' entries identical\n');
      if (!pass) process.exitCode = 1;
      return { pass: pass, failures: failures };
    })
    .catch(function (err) { console.error('oracle error:', err); process.exitCode = 1; });
}

if (require.main === module) main();
module.exports = { main: main };
