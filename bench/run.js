'use strict';

//
// Network scenario runner — the Tier-2 (lab) measurement.
//
//   node bench/run.js <label>     e.g. `node bench/run.js BASELINE`
//
// Design (panel-agreed):
//   * 3-process topology: loadgen (here) / proxy / origin, each isolated.
//   * A/A self-calibration FIRST: baseline-vs-baseline must report ~0% within
//     the noise floor, or the suite declares itself untrustworthy and refuses
//     to certify sub-threshold deltas (Gregg: the box is the experiment).
//   * A/B/A/B interleaving across N restarts to cancel thermal/neighbour drift
//     (PHK: never compare against a number from a warmer box).
//   * Per-variant median + coefficient of variation; CoV-gated significance.
//   * Vector score: one cell per scenario, each scored on its own objective.
//

var fs = require('fs');
var path = require('path');
var loadgen = require('./lib/loadgen');
var harness = require('./lib/harness');
var SCENARIOS = require('./lib/scenarios');

var TRIALS = parseInt(process.env.BENCH_TRIALS || '4', 10);
var NOISE_FLOOR_PCT = parseFloat(process.env.BENCH_NOISE_FLOOR || '5'); // %
var MAX_COV_PCT = parseFloat(process.env.BENCH_MAX_COV || '8');          // %

function getPath(obj, p) {
  return p.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
}

function stats(xs) {
  var s = xs.slice().sort(function (a, b) { return a - b; });
  var n = s.length;
  var mean = xs.reduce(function (a, b) { return a + b; }, 0) / n;
  var variance = xs.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / n;
  var sd = Math.sqrt(variance);
  return { median: s[Math.floor(n / 2)], mean: mean, cov: mean ? (sd / mean) * 100 : 0, min: s[0], max: s[n - 1] };
}

// One measurement of one variant on one scenario.
function measure(scenario, lib) {
  return harness.withStack(
    { lib: lib, bodySize: scenario.origin.bodySize },
    function (proxyPort) {
      return loadgen.run(Object.assign({ port: proxyPort }, scenario.load));
    }
  ).then(function (out) {
    var rec = out.result;
    var rssPeakMB = out.stats ? out.stats.rssPeak / (1024 * 1024) : null;
    rec.proxy = { rssPeakMB: rssPeakMB, gcCount: out.stats ? out.stats.gcCount : null };
    return rec;
  });
}

// Interleaved A/B/A/B trials for a scenario; returns sample records per variant.
function runScenario(scenario, libA, libB) {
  var samples = { A: [], B: [] };
  var seq = Promise.resolve();
  for (var t = 0; t < TRIALS; t++) {
    (function () {
      seq = seq
        .then(function () { return measure(scenario, libA); })
        .then(function (r) { samples.A.push(r); })
        .then(function () { return measure(scenario, libB); })
        .then(function (r) { samples.B.push(r); });
    })();
  }
  return seq.then(function () { return samples; });
}

function summarizeVariant(scenario, records) {
  var vals = records.map(function (r) { return getPath(r, scenario.primary); }).filter(function (v) { return v != null; });
  var st = stats(vals);
  return { primaryValues: vals, median: st.median, cov: st.cov, full: records };
}

function deltaPct(scenario, baseMed, candMed) {
  if (baseMed === 0) return 0;
  var raw = ((candMed - baseMed) / baseMed) * 100;
  // Normalise so negative = improvement regardless of metric direction.
  return scenario.betterWhen === 'lower' ? raw : -raw;
}

function main() {
  var label = process.argv[2] || 'RUN';
  var outDir = path.join(__dirname, 'results', label);
  fs.mkdirSync(outDir, { recursive: true });

  console.log('\n=== http-proxy bench :: label=' + label + ' trials=' + TRIALS + ' ===\n');

  var report = { label: label, trials: TRIALS, noiseFloorPct: NOISE_FLOOR_PCT, maxCovPct: MAX_COV_PCT, node: process.version, calibration: null, scenarios: [] };

  // --- Stage 0: A/A self-calibration ----------------------------------------
  var calScenario = SCENARIOS[0];
  console.log('[calibration] A/A null run on "' + calScenario.name + '" (baseline vs baseline)...');
  return runScenario(calScenario, 'baseline', 'baseline')
    .then(function (s) {
      var a = summarizeVariant(calScenario, s.A);
      var b = summarizeVariant(calScenario, s.B);
      var d = deltaPct(calScenario, a.median, b.median);
      var trustworthy = Math.abs(d) <= NOISE_FLOOR_PCT && a.cov <= MAX_COV_PCT && b.cov <= MAX_COV_PCT;
      report.calibration = { aaDeltaPct: d, covA: a.cov, covB: b.cov, trustworthy: trustworthy };
      console.log('  A/A delta=' + d.toFixed(2) + '%  covA=' + a.cov.toFixed(1) + '% covB=' + b.cov.toFixed(1) + '%  -> ' +
        (trustworthy ? 'TRUSTWORTHY' : 'NOISY (sub-' + NOISE_FLOOR_PCT + '% deltas not certifiable)'));
    })
    .then(function () {
      // --- Stage 1: scenario matrix (baseline vs candidate) ------------------
      var chain = Promise.resolve();
      SCENARIOS.forEach(function (scenario) {
        chain = chain.then(function () {
          console.log('\n[scenario] ' + scenario.name + ' — ' + scenario.description);
          return runScenario(scenario, 'baseline', 'candidate').then(function (s) {
            var base = summarizeVariant(scenario, s.A);
            var cand = summarizeVariant(scenario, s.B);
            var d = deltaPct(scenario, base.median, cand.median);
            var covOk = base.cov <= MAX_COV_PCT && cand.cov <= MAX_COV_PCT;
            var significant = covOk && Math.abs(d) > NOISE_FLOOR_PCT;
            var verdict = !significant ? 'no-change' : (d < 0 ? 'IMPROVED' : 'REGRESSED');
            report.scenarios.push({
              name: scenario.name, primary: scenario.primary, betterWhen: scenario.betterWhen,
              baselineMedian: base.median, candidateMedian: cand.median,
              deltaPct: d, covBaseline: base.cov, covCandidate: cand.cov,
              significant: significant, verdict: verdict,
              baselineSamples: base.primaryValues, candidateSamples: cand.primaryValues
            });
            console.log('  ' + scenario.primary + ': baseline=' + base.median.toFixed(3) +
              ' candidate=' + cand.median.toFixed(3) + '  delta=' + d.toFixed(2) + '% [' + verdict + ']' +
              (covOk ? '' : ' (CoV too high: ' + Math.max(base.cov, cand.cov).toFixed(1) + '%)'));
          });
        });
      });
      return chain;
    })
    .then(function () {
      fs.writeFileSync(path.join(outDir, 'scenarios.json'), JSON.stringify(report, null, 2) + '\n');
      fs.writeFileSync(path.join(outDir, 'scorecard.md'), renderScorecard(report));
      console.log('\nwrote ' + path.relative(process.cwd(), outDir) + '/{scenarios.json,scorecard.md}\n');
    })
    .catch(function (err) {
      console.error('bench failed:', err);
      process.exitCode = 1;
    });
}

function renderScorecard(report) {
  var lines = [];
  lines.push('# Bench scorecard — ' + report.label);
  lines.push('');
  lines.push('- Node: `' + report.node + '`  trials: ' + report.trials + '  noise floor: ' + report.noiseFloorPct + '%  max CoV: ' + report.maxCovPct + '%');
  if (report.calibration) {
    lines.push('- **A/A calibration:** delta ' + report.calibration.aaDeltaPct.toFixed(2) + '% — ' +
      (report.calibration.trustworthy ? '✅ trustworthy' : '⚠️ noisy'));
  }
  lines.push('');
  lines.push('| Scenario | Metric | Baseline | Candidate | Δ% | Verdict |');
  lines.push('|---|---|---:|---:|---:|---|');
  report.scenarios.forEach(function (s) {
    lines.push('| ' + s.name + ' | ' + s.primary + ' | ' + s.baselineMedian.toFixed(3) + ' | ' +
      s.candidateMedian.toFixed(3) + ' | ' + s.deltaPct.toFixed(2) + ' | ' + s.verdict + ' |');
  });
  lines.push('');
  lines.push('_Δ% is normalised so negative = improvement. `no-change` = within noise floor._');
  lines.push('');
  return lines.join('\n');
}

if (require.main === module) main();
module.exports = { main: main };
