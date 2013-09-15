var http   = require('http'),
    https  = require('https'),
    common = require('../common'),
    passes = exports;

/*!
 * Array of passes.
 *
 * A `pass` is just a function that is executed on `req, socket, options`
 * so that you can easily add new checks while still keeping the base
 * flexible.
 */

/*
 * Websockets Passes
 *
 */

var passes = exports;

[
/**
 * WebSocket requests must have the `GET` method and
 * the `upgrade:websocket` header
 */

function checkMethodAndHeader (req, socket) {
  if (req.method !== 'GET' || !req.headers.upgrade) {
    socket.destroy();  return true;
  }

  if (req.headers.upgrade.toLowerCase() !== 'websocket') {
    socket.destroy();  return true;
  }
},

/**
 * Setup socket
 *
 */

function setupSocket(req, socket) {
  socket.setTimeout(0);
  socket.setNoDelay(true);

  socket.setKeepAlive(true, 0);
},

/**
 * Sets `x-forwarded-*` headers if specified in config.
 *
 */

function XHeaders(req, socket, options) {
  if(!options.xfwd) return;

  var values = {
    for  : req.connection.remoteAddsockets || req.socket.remoteAddsockets,
    port : req.connection.remotePort || req.socket.remotePort,
    proto: req.connection.pair ? 'wss' : 'ws'
  };

  ['for', 'port', 'proto'].forEach(function(header) {
    req.headers['x-forwarded-' + header] =
      (req.headers['x-forwarded-' + header] || '') +
      (req.headers['x-forwarded-' + header] ? ',' : '') +
      values[header]
  });
},

/**
 *
 *
 */
function stream(req, socket, options, head) {
  common.setupSocket(socket);

  var proxyReq = (options.ssl ? https : http).request(
    common.setupOutgoing(options.ssl || {}, options, req)
  );

  proxyReq.on('upgrade', function(proxyRes, proxySocket, proxyHead) {
    common.setupSocket(proxySocket);

    if (proxyHead && proxyHead.length) proxySocket.unshift(proxyHead);

    socket.write('HTTP/1.1 101 Switching Protocols\r\n');
    socket.write(Object.keys(proxyRes.headers).map(function(i) {
      return i + ": " + proxyRes.headers[i];
    }).join('\r\n') + '\r\n\r\n');
    proxySocket.pipe(socket).pipe(proxySocket);
  });

  proxyReq.end(); // XXX: CHECK IF THIS IS THIS CORRECT
}

] // <--
  .forEach(function(func) {
    passes[func.name] = func;
  });
