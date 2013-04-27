/*
  proxy-stream.js: Duplex HTTP proxy stream.

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

var stream = require('stream'),
    util = require('util');

var ProxyStream = module.exports = function (options) {
  stream.Duplex.call(this);
  
  this.errState = false;
  this.options  = options;

  var self = this;
  this.once('pipe', function (req) {
    self.start(req);
  });
};

util.inherits(ProxyStream, stream.Duplex);

ProxyStream.prototype._write = function (chunk, encoding, callback) {
  this.pReq.write(chunk, encoding, callback);
};

ProxyStream.prototype._read = function (size) {
  
};

ProxyStream.prototype.start = function (req) {
  var outgoing = this.options.target,
      location;
      
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
};