/*
  node-http-proxy.js: http proxy for node.js

  Copyright (c) 2010 Charlie Robbins, Mikeal Rogers, Marak Squires, Fedor Indutny

  Permission is hereby granted, free of charge, to any person obtaining
  a copy of this software and associated documentation files (the
  "Software"), to deal in the Software without restriction, including
  without limitation the rights to use, copy, modify, merge, publish,
  distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so, subject to
  the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
  LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
  WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

var events = require('events'),
    http = require('http'),
    util = require('util'),
    url = require('url'),
    httpProxy = require('../node-http-proxy'),
    ProxyStream = require('./proxy-stream'),
    ForwardStream = require('./forward-stream');

//
// ### function HttpProxy (options)
// #### @options {Object} Options for this instance.
// Constructor function for new instances of HttpProxy responsible
// for managing the life-cycle of streaming reverse proxyied HTTP requests.
//
// Example options:
//
//      {
//        timeout: 
//        forward: {
//          host: 'localhost',
//          port: 9001
//        }
//      }
//
var HttpProxy = exports.HttpProxy = function (options) {
  options = options || {};
  events.EventEmitter.call(this);

  var self  = this;

  //
  // Setup basic proxying options:
  //
  // * timeout {Number} Default socket timeout.
  // * targets {Object} HTTP Proxy targets.
  //
  this.timeout = options.timeout;
  this.targets = {};
  
  //
  // Setup opt-in features
  //
  this.enable          = options.enable || {};
  this.enable.xforward = typeof this.enable.xforward === 'boolean'
    ? this.enable.xforward
    : true;

  //
  // Setup additional options for WebSocket proxying. When forcing
  // the WebSocket handshake to change the `sec-websocket-location`
  // and `sec-websocket-origin` headers `options.source` **MUST**
  // be provided or the operation will fail with an `origin mismatch`
  // by definition.
  //
  this.changeOrigin = options.changeOrigin || false;
};

// Inherit from events.EventEmitter
util.inherits(HttpProxy, events.EventEmitter);

//
// ### function proxyRequest (req, res, target)
// #### @req {ServerRequest} Incoming HTTP Request to proxy.
// #### @res {ServerResponse} Outgoing HTTP Request to write proxied data to.
// #### @target {Object} Target to proxy to.
//
HttpProxy.prototype.proxyRequest = function (req, res, options) {
  var self     = this,
      errState = false,
      target   = this.target(options);

  // If this is a DELETE request then set the 'content-length'
  // header (if it is not already set)
  if (req.method === 'DELETE') {
    req.headers['content-length'] = req.headers['content-length'] || '0';
  }

  //
  // Add common proxy headers to the request so that they can
  // be availible to the proxy target server. If the proxy is
  // part of proxy chain it will append the address:
  //
  // * `x-forwarded-for`: IP Address of the original request
  // * `x-forwarded-proto`: Protocol of the original request
  // * `x-forwarded-port`: Port of the original request.
  //
  if (this.enable.xforward && req.connection && req.socket) {
    if (req.headers['x-forwarded-for']) {
      var addressToAppend = ',' + req.connection.remoteAddress || req.socket.remoteAddress;
      req.headers['x-forwarded-for'] += addressToAppend;
    }
    else {
      req.headers['x-forwarded-for'] = req.connection.remoteAddress || req.socket.remoteAddress;
    }

    if (req.headers['x-forwarded-port']) {
      var portToAppend = ',' + req.connection.remotePort || req.socket.remotePort;
      req.headers['x-forwarded-port'] += portToAppend;
    }
    else {
      req.headers['x-forwarded-port'] = req.connection.remotePort || req.socket.remotePort;
    }

    if (req.headers['x-forwarded-proto']) {
      var protoToAppend = ',' + getProto(req);
      req.headers['x-forwarded-proto'] += protoToAppend;
    }
    else {
      req.headers['x-forwarded-proto'] = getProto(req);
    }
  }

  if (this.timeout) {
    req.socket.setTimeout(this.timeout);
  }

  //
  // Emit the `start` event indicating that we have begun the proxy operation.
  //
  this.emit('start', req, res, target);
  req.pipe(new ProxyStream(options)).pipe(res);

  //
  // If forwarding is enabled for this instance, foward proxy the
  // specified request to the address provided in `this.forward`
  //
  if (options.forward) {
    this.emit('forward', req, res, options.forward);
    req.pipe(new ForwardStream(options.forward));
  }

  //
  // #### function proxyError (err)
  // #### @err {Error} Error contacting the proxy target
  // Short-circuits `res` in the event of any error when
  // contacting the proxy target at `host` / `port`.
  //
  function proxyError(err) {
    errState = true;

    //
    // Emit an `error` event, allowing the application to use custom
    // error handling. The error handler should end the response.
    //
    if (self.emit('proxyError', err, req, res)) {
      return;
    }

    res.writeHead(500, { 'Content-Type': 'text/plain' });

    if (req.method !== 'HEAD') {
      //
      // This NODE_ENV=production behavior is mimics Express and
      // Connect.
      //
      if (process.env.NODE_ENV === 'production') {
        res.write('Internal Server Error');
      }
      else {
        res.write('An error has occurred: ' + JSON.stringify(err));
      }
    }

    try { res.end() }
    catch (ex) { console.error('res.end error: %s', ex.message) }
  }

  //
  // Handle 'error' events from the `req` (e.g. `Parse Error`).
  //
  req.on('error', proxyError);

  //Aborts pReq if client aborts the connection.
  req.on('close', function () {
    if (!errState) {
      pReq.abort();
    }
  });
};