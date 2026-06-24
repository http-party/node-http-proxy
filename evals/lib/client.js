'use strict';

//
// Wire client for the oracle. Captures the *client-visible* response and
// normalises it for comparison: header names lowercased and sorted, volatile
// headers (Date) dropped, set-cookie kept as an array. Supports raw socket
// sends so we can drive HTTP/1.0 framing the high-level client can't express.
//

var http = require('http');
var net = require('net');

var VOLATILE = { date: true };

// A stable Host so the forwarded value doesn't carry the proxy's random listen
// port (which differs between the baseline and candidate runs).
var STABLE_HOST = 'proxy.test';

function normalize(status, statusMessage, headers, body) {
  var keys = Object.keys(headers).map(function (k) { return k.toLowerCase(); }).filter(function (k) { return !VOLATILE[k]; }).sort();
  var norm = {};
  keys.forEach(function (k) { norm[k] = headers[k]; });
  return { status: status, headers: norm, body: body };
}

function sendNormal(port, entry) {
  return new Promise(function (resolve) {
    var req = http.request(
      { port: port, method: entry.method || 'GET', path: entry.path || '/',
        headers: Object.assign({ host: STABLE_HOST }, entry.headers || {}), agent: false },
      function (res) {
        var chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () {
          resolve(normalize(res.statusCode, res.statusMessage, res.headers, Buffer.concat(chunks).toString('utf8')));
        });
      }
    );
    req.on('error', function (e) { resolve({ error: String(e.code || e.message) }); });
    if (entry.body) req.write(entry.body);
    req.end();
  });
}

// Parse a raw HTTP response buffer into status + header map (+ set-cookie array) + body.
function parseRaw(buf) {
  var text = buf.toString('latin1');
  var sep = text.indexOf('\r\n\r\n');
  var head = text.slice(0, sep);
  var body = text.slice(sep + 4);
  var lines = head.split('\r\n');
  var statusLine = lines.shift();
  var status = parseInt(statusLine.split(' ')[1], 10);
  var headers = {};
  lines.forEach(function (line) {
    var i = line.indexOf(':');
    if (i < 0) return;
    var k = line.slice(0, i).trim().toLowerCase();
    var v = line.slice(i + 1).trim();
    if (k === 'set-cookie') { (headers[k] = headers[k] || []).push(v); }
    else if (headers[k] !== undefined) { headers[k] = [].concat(headers[k], v); }
    else { headers[k] = v; }
  });
  return normalize(status, null, headers, body);
}

// Has the full response arrived? Resolve eagerly on content-length completion
// so keep-alive responses (which never close the socket) don't hang the gate.
function complete(buf) {
  var text = buf.toString('latin1');
  var sep = text.indexOf('\r\n\r\n');
  if (sep < 0) return false;
  var head = text.slice(0, sep).toLowerCase();
  var m = head.match(/\r\ncontent-length:\s*(\d+)/);
  if (m) return Buffer.byteLength(text.slice(sep + 4), 'latin1') >= parseInt(m[1], 10);
  if (/\r\ntransfer-encoding:\s*chunked/.test(head)) return /\r\n0\r\n\r\n$/.test(text);
  return false;
}

function sendRaw(port, entry) {
  return new Promise(function (resolve) {
    var socket = net.connect(port, '127.0.0.1');
    var bufs = [];
    var settled = false;
    function done(val) { if (settled) return; settled = true; socket.destroy(); resolve(val); }
    var ver = entry.httpVersion || '1.0';
    var lines = [(entry.method || 'GET') + ' ' + (entry.path || '/') + ' HTTP/' + ver];
    var hdrs = Object.assign({ host: STABLE_HOST }, entry.headers || {});
    Object.keys(hdrs).forEach(function (k) { lines.push(k + ': ' + hdrs[k]); });
    lines.push('', entry.body || '');
    socket.setTimeout(3000, function () { done(bufs.length ? parseRaw(Buffer.concat(bufs)) : { error: 'timeout' }); });
    socket.on('connect', function () { socket.write(lines.join('\r\n')); });
    socket.on('data', function (c) { bufs.push(c); if (complete(Buffer.concat(bufs))) done(parseRaw(Buffer.concat(bufs))); });
    socket.on('end', function () { done(parseRaw(Buffer.concat(bufs))); });
    socket.on('error', function (e) { done({ error: String(e.code || e.message) }); });
  });
}

function send(port, entry) {
  return entry.raw ? sendRaw(port, entry) : sendNormal(port, entry);
}

module.exports = { send: send, normalize: normalize };
