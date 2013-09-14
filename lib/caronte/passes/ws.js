var WebsocketStream = require('../streams/websocket'),
    http            = require('http'),
    common          = require('../common'),
    passes          = exports;

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
  var r = http.request(
    common.setupOutgoing(options.ssl || {}, options, req)
  );
   
  r.on('upgrade', function(res, proxySock, hd) {
    if (hd && hd.length) proxySock.unshift(hd);

    socket.write('HTTP/1.1 101 Switching Protocols\r\n');
    socket.write(Object.keys(res.headers).map(function(i) {
      return i + ": " + res.headers[i];
    }).join('\r\n') + '\r\n\r\n');
    proxySock.pipe(socket).pipe(proxySock);
  });

  r.end();

  
  //req.pipe(new WebsocketStream(options, head)).pipe(socket);
}

] // <--
  .forEach(function(func) {
    passes[func.name] = func;   
  });
