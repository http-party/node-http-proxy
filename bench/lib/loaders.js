'use strict';

//
// Resolve the http-proxy entrypoint for either the frozen BASELINE snapshot
// or the live CANDIDATE working tree. The two live at different paths so they
// can be require()'d side-by-side in one process without cache collisions.
//
// The baseline snapshot is materialised from the baseline git ref by
// `node bench/freeze-baseline.js` and is intentionally gitignored.
//

var path = require('path');

var ROOTS = {
  baseline: path.join(__dirname, '..', '.baseline-snapshot', 'http-proxy.js'),
  candidate: path.join(__dirname, '..', '..', 'lib', 'http-proxy.js')
};

function proxyEntry(which) {
  var root = ROOTS[which];
  if (!root) throw new Error('unknown lib selector: ' + which);
  return root;
}

// Direct path to the `common` module for either tree (used by the microbench).
function commonPath(which) {
  return path.join(path.dirname(proxyEntry(which)), 'http-proxy', 'common.js');
}

module.exports = { proxyEntry: proxyEntry, commonPath: commonPath, ROOTS: ROOTS };
