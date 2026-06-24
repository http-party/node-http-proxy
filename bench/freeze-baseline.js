'use strict';

//
// Materialise the frozen BASELINE snapshot of lib/ from a git ref into
// bench/.baseline-snapshot/. The snapshot is the immutable reference that the
// A/B benchmark and the differential wire oracle compare the working tree
// against. It is gitignored and regenerated on demand.
//
//   node bench/freeze-baseline.js [git-ref]   (default: the BASELINE_REF below)
//
// We default to the last published release tag so "baseline" always means
// "what is live on npm", not "whatever HEAD happened to be".
//

var cp = require('child_process');
var fs = require('fs');
var path = require('path');

var BASELINE_REF = process.argv[2] || '9b96cd7'; // 1.18.1 — last published
var repoRoot = path.join(__dirname, '..');
var dest = path.join(__dirname, '.baseline-snapshot');

function sh(cmd) {
  return cp.execSync(cmd, { cwd: repoRoot, encoding: 'utf8' });
}

// Resolve the ref to a stable sha for provenance.
var sha = sh('git rev-parse ' + BASELINE_REF).trim();

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

// List every file under lib/ at the baseline ref and write it out verbatim.
var files = sh('git ls-tree -r --name-only ' + sha + ' lib')
  .split('\n')
  .filter(Boolean);

files.forEach(function (f) {
  // f looks like "lib/http-proxy/common.js" -> strip the leading "lib/"
  var rel = f.replace(/^lib\//, '');
  var out = path.join(dest, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, cp.execSync('git show ' + sha + ':' + f, { cwd: repoRoot }));
});

fs.writeFileSync(
  path.join(dest, 'PROVENANCE.txt'),
  'baseline ref: ' + BASELINE_REF + '\nresolved sha: ' + sha + '\nfiles: ' + files.length + '\n'
);

console.log('froze ' + files.length + ' files from ' + BASELINE_REF + ' (' + sha.slice(0, 7) + ') -> bench/.baseline-snapshot');
