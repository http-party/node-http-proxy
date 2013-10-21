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
   *
   * @param {ClientRequest} Req Request object
   * @param {Socket} Websocket
   *
   * @api private
   */

  function checkMethodAndHeader (req, socket) {
    if (req.method !== 'GET' || !req.headers.upgrade) {
      socket.destroy();
      return true;
    }

    if (req.headers.upgrade.toLowerCase() !== 'websocket') {
      socket.destroy();
      return true;
    }
  },

  /**
   * Set the proper configuration for sockets,
   * set no delay and set keep alive, also set
   * the timeout to 0.
   *
   * @param {ClientRequest} Req Request object
   * @param {Socket} Websocket
   *
   * @api private
   */

  function setupSocket(req, socket) {
    socket.setTimeout(0);
    socket.setNoDelay(true);

    socket.setKeepAlive(true, 0);
  },

  /**
   * Sets `x-forwarded-*` headers if specified in config.
   *
   * @param {ClientRequest} Req Request object
   * @param {Socket} Websocket
   * @param {Object} Options Config object passed to the proxy
   *
   * @api private
   */

  function XHeaders(req, socket, options) {
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
        values[header];
    });
  },

  /**
   * Does the actual proxying. Make the request and upgrade it
   * send the Switching Protocols request and pipe the sockets.
   *
   * @param {ClientRequest} Req Request object
   * @param {Socket} Websocket
   * @param {Object} Options Config object passed to the proxy
   *
   * @api private
   */
  function stream(req, socket, server, head, clb) {
    common.setupSocket(socket);

    if (head && head.length) socket.unshift(head);


    var proxyReq = (~['https:', 'wss:'].indexOf(server.options.target.protocol) ? https : http).request(
      common.setupOutgoing(server.options.ssl || {}, server.options, req)
    );
    // Error Handler
    proxyReq.on('error', function(err){
      if(server) {
        server.emit('error', err);
      } 
      else {
        clb(err);
      }
    });

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
