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
      target   = this.target(options),
      location,
      outgoing,
      draining,
      buffer,
      pReq;

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
  // Setup outgoing proxy with relevant properties.
  //
  outgoing.host       = target.host;
  outgoing.hostname   = target.hostname;
  outgoing.port       = target.port;
  outgoing.socketPath = target.socketPath;
  outgoing.agent      = target.agent;
  outgoing.method     = req.method;
  outgoing.path       = req.url;
  outgoing.headers    = req.headers;

  //
  // If the changeOrigin option is specified, change the
  // origin of the host header to the target URL! Please
  // don't revert this without documenting it!
  //
  if (this.changeOrigin) {
    outgoing.headers.host = target.host + ':' + target.port;
  }

  //
  // Open new HTTP request to internal resource with will act
  // as a reverse proxy pass
  //
  pReq = target.protocol.request(outgoing, function (pRes) {
    var pDraining = false,
        pBuffer,
        ended;
    
    //
    // Process the `pReq` `pRes` when it's received.
    //
    if (req.httpVersion === '1.0') {
      if (req.headers.connection) {
        pRes.headers.connection = req.headers.connection
      } else {
        pRes.headers.connection = 'close'
      }
    } else if (!pRes.headers.connection) {
      if (req.headers.connection) { pRes.headers.connection = req.headers.connection }
      else {
        pRes.headers.connection = 'keep-alive'
      }
    }

    // Remove `Transfer-Encoding` header if client's protocol is HTTP/1.0
    // or if this is a DELETE request with no content-length header.
    // See: https://github.com/nodejitsu/node-http-proxy/pull/373
    if (req.httpVersion === '1.0' || (req.method === 'DELETE'
      && !req.headers['content-length'])) {
      delete pRes.headers['transfer-encoding'];
    }

    if ((pRes.statusCode === 301 || pRes.statusCode === 302)
      && typeof pRes.headers.location !== 'undefined') {
      location = url.parse(pRes.headers.location);
      if (location.host === req.headers.host) {
        if (self.source.https && !self.target.https) {
          pRes.headers.location = pRes.headers.location.replace(/^http\:/, 'https:');
        }
        if (self.target.https && !self.source.https) {
          pRes.headers.location = pRes.headers.location.replace(/^https\:/, 'http:');
        }
      }
    }

    //
    // When the `pReq` `pRes` ends, end the
    // corresponding outgoing `res` unless we have entered
    // an error state. In which case, assume `res.end()` has
    // already been called and the 'error' event listener
    // removed.
    //
    pRes.on('close', function () {
      if (!ended) { pRes.emit('end') }
    });

    pRes.on('end', function () {
      ended = true;
      if (!errState) {
        try { res.end() }
        catch (ex) { console.error('res.end error: %s', ex.message) }

        // Emit the `end` event now that we have completed proxying
        self.emit('end', req, res, pRes);
      }
    });

    // Allow observer to modify headers or abort pRes
    try { self.emit('proxyResponse', req, res, pRes) }
    catch (ex) {
      errState = true;
      return;
    }

    // Set the headers of the client pRes
    Object.keys(pRes.headers).forEach(function (key) {
      res.setHeader(key, pRes.headers[key]);
    });
    
    res.writeHead(pRes.statusCode);

    pRes.on('readable', function onreadable() {
      var bytes = pRes.read();
      if (bytes && res.writable) {
        if (pDraining) {
          if (pBuffer) { return buffer.push(bytes) }
          pBuffer = [bytes];
          return;
        }
        
        // Only pause if the underlying buffers are full,
        // *and* the connection is not in 'closing' state.
        // Otherwise, the pause will cause pending data to
        // be discarded and silently lost.
        if (false === res.write(bytes)) {
          pDraining = true;
        }
      }
    });

    res.on('drain', function ondrain() {
      pDraining = false;
      if (pBuffer.length) {
        for (var i = 0; i < pBuffer.length; i++) {
          //
          // Remark: Should we check to see if `.write()`
          // returns false here?
          //
          res.write(pBuffer[i]);
        }

        pBuffer.length = 0;
      }
    });
  });

  //
  // Handle 'error' events from the `pReq`. Setup timeout override if needed
  //
  pReq.once('error', proxyError);

  // Set a timeout on the socket if `this.timeout` is specified.
  pReq.once('socket', function (socket) {
    if (self.timeout) {
      socket.setTimeout(self.timeout);
    }
  });

  //
  // Handle 'error' events from the `req` (e.g. `Parse Error`).
  //
  req.on('error', proxyError);

  //
  // For each data `chunk` received from the incoming
  // `req` write it to the `pReq` request.
  //
  req.on('readable', function () {
    if (!errState) {
      var bytes = req.read();
      
      if (draining) {
        if (buffer) { return buffer.push(bytes) }
        buffer = [bytes];
        return;
      }
      
      if (false === pReq.write(bytes)) {
        draining = true;
      }
    }
  });
  
  req.on('drain', function () {
    draining = false;
    if (buffer.length) {
      for (var i = 0; i < buffer.length; i++) {
        //
        // Remark: Should we check to see if `.write()`
        // returns false here?
        //
        res.write(buffer[i]);
      }

      pBuffer.length = 0;
    }
  });

  //
  // When the incoming `req` ends, end the corresponding `pReq`
  // request unless we have entered an error state.
  //
  req.on('end', function () {
    if (!errState) {
      pReq.end();
    }
  });

  //Aborts pReq if client aborts the connection.
  req.on('close', function () {
    if (!errState) {
      pReq.abort();
    }
  });
};