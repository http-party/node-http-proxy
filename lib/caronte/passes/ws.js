var WebsocketStream = require('../streams/websocket'),
    passes          = exports;

/*!
 * Array of passes.
 * 
 * A `pass` is just a function that is executed on `req, res, options`
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

function checkMethodAndHeader (req, res, options) {
  if (req.method !== 'GET' || !req.headers.upgrade) {
    req.end();  return true;
  }

  if (req.headers.upgrade.toLowerCase() !== 'websocket') {
    req.end();  return true;
  }
},

/**
 * Sets `x-forwarded-*` headers if specified in config.
 *
 */

function XHeaders(req, res, options) {
  if(!options.xfwd) return;

  var values = {
    for  : req.connection.remoteAddress || req.socket.remoteAddress,
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
function stream(req, res, options, instance) {
  req.pipe(new WebsocketStream(options, instance)).pipe(res);
}

] // <--
  .forEach(function(func) {
    passes[func.name] = func;   
  });
