'use strict';

//
// Seeded request corpus for the differential wire oracle. Each entry exercises
// a piece of the proxy's request/response rewriting that an "optimization"
// could silently break. The set is deliberately diverse: methods, header
// shapes, query-string edge cases, bodies, and (via `raw`) HTTP/1.0 framing
// that the high-level http client cannot express.
//
// Held-out by construction: the corpus is fixed and versioned, so a candidate
// cannot special-case the benchmark's request shape (PHK / Goodhart).
//

module.exports = [
  { name: 'simple-get', method: 'GET', path: '/' },
  { name: 'nested-path-query', method: 'GET', path: '/api/v2/users/42/profile?include=avatar&fields=name,email' },
  { name: 'double-question-mark', method: 'GET', path: '/search?q=a?b&p=1' },
  { name: 'trailing-slash', method: 'GET', path: '/a/b/c/' },
  { name: 'encoded-path', method: 'GET', path: '/files/a%20b/c%2Fd?x=1' },
  { name: 'empty-query', method: 'GET', path: '/items?' },

  { name: 'post-body', method: 'POST', path: '/submit',
    headers: { 'content-type': 'application/json' }, body: '{"hello":"world","n":42}' },

  // DELETE/OPTIONS without content-length exercise the deleteLength pass.
  { name: 'delete-no-length', method: 'DELETE', path: '/resource/1' },
  { name: 'options-no-length', method: 'OPTIONS', path: '/resource/1' },

  // Header preservation / forwarding.
  { name: 'many-headers', method: 'GET', path: '/h',
    headers: {
      'x-request-id': '7f3e9c1a-2b4d-4e8f-9a1b',
      'accept-encoding': 'gzip, deflate, br',
      cookie: 'session=abc123; theme=dark',
      'x-custom-1': 'one', 'x-custom-2': 'two'
    } },
  { name: 'duplicate-cookie', method: 'GET', path: '/c',
    headers: { cookie: 'a=1; b=2; a=3' } },

  // Paths containing characters url.parse() normalises (backslash -> slash,
  // space -> %20) MUST be forwarded identically by the fast-path/slow-path
  // split — a security-relevant regression guard. Sent raw because the
  // high-level client rejects spaces/backslashes in the path.
  { name: 'backslash-path', raw: true, httpVersion: '1.1', method: 'GET', path: '/a\\b/c?x=1' },
  { name: 'space-path', raw: true, httpVersion: '1.1', method: 'GET', path: '/a b/c?q=1' },

  // HTTP/1.0 over a raw socket exercises removeChunked / setConnection.
  { name: 'http10-get', raw: true, httpVersion: '1.0', method: 'GET', path: '/ten' },
  { name: 'http10-connection-keepalive', raw: true, httpVersion: '1.0', method: 'GET', path: '/ten',
    headers: { connection: 'keep-alive' } }
];
