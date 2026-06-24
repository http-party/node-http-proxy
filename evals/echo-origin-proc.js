'use strict';

//
// Deterministic echo origin for the differential wire oracle. Reflects the
// request the proxy forwarded (method, url, selected headers) into a stable
// JSON body, and emits a fixed, interesting response header set (Set-Cookie,
// custom casing) so that BOTH request-forwarding and response-copying changes
// surface as wire diffs.
//

var http = require('http');

// Headers we reflect — the ones a proxy rewrite is most likely to disturb.
var REFLECT = ['host', 'connection', 'content-length', 'transfer-encoding',
  'x-forwarded-for', 'x-forwarded-host', 'cookie', 'x-request-id'];

var server = http.createServer(function (req, res) {
  var chunks = [];
  req.on('data', function (c) { chunks.push(c); });
  req.on('end', function () {
    var reflected = {};
    REFLECT.forEach(function (h) { if (req.headers[h] !== undefined) reflected[h] = req.headers[h]; });
    var body = JSON.stringify({
      method: req.method,
      url: req.url,
      httpVersion: req.httpVersion,
      bodyLength: Buffer.concat(chunks).length,
      headers: reflected
    });
    res.writeHead(200, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
      'x-origin': 'echo',
      'set-cookie': ['sid=xyz; Domain=origin.example; Path=/', 'pref=dark']
    });
    res.end(body);
  });
  req.on('error', function () {});
});

server.on('clientError', function (err, socket) {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(0, '127.0.0.1', function () {
  if (process.send) process.send({ type: 'ready', port: server.address().port });
});

process.on('message', function (m) {
  if (m === 'shutdown') server.close(function () { process.exit(0); });
});
