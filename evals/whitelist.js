'use strict';

//
// Intentional, declared wire changes — the ONLY way a candidate is allowed to
// differ from the baseline in the oracle. Keyed by corpus entry name, each
// value is an array of dotted field paths permitted to change, e.g.:
//
//   module.exports = { 'simple-get': ['headers.connection'] };
//
// Pure performance optimizations should add NOTHING here: a faster proxy that
// changes the wire is a behavioural change, not an optimization, and must be
// justified explicitly.
//

module.exports = {};
