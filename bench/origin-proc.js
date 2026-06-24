'use strict';

//
// Null origin server, run as its own process (PHK's rule: the origin must be
// effectively free, or the proxy's own cost never surfaces). Responds from a
// pre-allocated buffer with zero I/O. Supports:
//   - fixed-size bodies (BODY_SIZE bytes)
//   - a raw WebSocket upgrade handshake (for the websocket-churn leak gate)
//
// Speaks the fork() IPC protocol: sends {type:'ready', port} once listening.
//

var http = require('http');
var crypto = require('crypto');

var BODY_SIZE = parseInt(process.env.BODY_SIZE || '64', 10);
var body = Buffer.alloc(BODY_SIZE, 0x61);

var server = http.createServer(function (req, res) {
  // Drain the request body, then reply from the pre-allocated buffer.
  req.resume();
  req.on('end', function () {
    res.writeHead(200, {
      'content-type': 'text/plain',
      'content-length': body.length
    });
    res.end(body);
  });
  req.on('error', function () {});
});

// Minimal raw WebSocket upgrade — enough to exercise the proxy's ws pass and
// the teardown path. We do not echo frames; the leak gate only cares that
// sockets close cleanly.
server.on('upgrade', function (req, socket) {
  var key = req.headers['sec-websocket-key'] || '';
  var accept = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  socket.on('data', function () {});
  socket.on('error', function () {});
});

server.on('clientError', function (err, socket) {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(0, '127.0.0.1', function () {
  var port = server.address().port;
  if (process.send) process.send({ type: 'ready', port: port });
  else console.log('origin listening on ' + port);
});

process.on('message', function (m) {
  if (m === 'shutdown') server.close(function () { process.exit(0); });
});
