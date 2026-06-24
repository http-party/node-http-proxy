'use strict';

//
// Gate runner — the deterministic funnel that MUST pass before any performance
// number is trusted (the panel's core principle: the gates are the product).
//
//   node evals/run.js
//
// Runs, in order: wire oracle -> lifecycle corpus -> leak gate. Exits non-zero
// if any gate fails. Each gate also runs standalone (node evals/<gate>.js).
//

var oracle = require('./oracle');
var lifecycle = require('./lifecycle');
var leak = require('./leak');

function main() {
  var results = {};
  return oracle.main()
    .then(function (r) { results.oracle = r; return lifecycle.main(); })
    .then(function (r) { results.lifecycle = r; return leak.main(); })
    .then(function (r) { results.leak = r; })
    .then(function () {
      var gates = [
        ['wire-oracle', results.oracle && results.oracle.pass],
        ['lifecycle', results.lifecycle && results.lifecycle.pass],
        ['leak', results.leak && results.leak.pass]
      ];
      console.log('=== GATE SUMMARY ===');
      var allPass = true;
      gates.forEach(function (g) {
        if (!g[1]) allPass = false;
        console.log('  ' + (g[1] ? '✅' : '❌') + ' ' + g[0]);
      });
      console.log('');
      console.log(allPass ? '✅ ALL GATES PASS — performance numbers may be certified.'
        : '❌ GATES FAILED — performance numbers are NOT certifiable for this candidate.');
      console.log('');
      process.exitCode = allPass ? 0 : 1;
    });
}

if (require.main === module) main();
module.exports = { main: main };
