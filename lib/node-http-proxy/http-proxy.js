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
    util = require('util'),
    httpProxy = require('../node-http-proxy');

//
// ### function HttpProxy (options)
// #### @options {Object} Options for this instance.
// Constructor function for new instances of HttpProxy responsible
// for managing the life-cycle of streaming reverse proxyied HTTP requests.
//
// Example options:
//
//      {
//        target: {
//          host: 'localhost',
//          port: 9000
//        },
//        forward: {
//          host: 'localhost',
//          port: 9001
//        }
//      }
//
var HttpProxy = exports.HttpProxy = function (options) {
  if (!options || !options.target) {
    throw new Error('Both `options` and `options.target` are required.');
  }
    
  events.EventEmitter.call(this);
  
  var self  = this;

  //
  // Setup basic proxying options: 
  // 
  // * forward {Object} Options for a forward-proxy (if-any)
  // * target {Object} Options for the **sole** proxy target of this instance
  //
  this.forward  = options.forward;
  this.target   = options.target;

  //
  // Setup the necessary instances instance variables for
  // the `target` and `forward` `host:port` combinations
  // used by this instance. 
  //
  // * agent {http[s].Agent} Agent to be used by this instance.
  // * protocol {http|https} Core node.js module to make requests with.
  // * base {Object} Base object to create when proxying containing any https settings.
  //  
  function setupProxy (key) {
    self[key].agent    = httpProxy._getAgent(self[key]);
    self[key].protocol = httpProxy._getProtocol(self[key]);
    self[key].base     = httpProxy._getBase(self[key]); 
  }
  
  setupProxy('target');
  if (this.forward) { 
    setupProxy('forward'); 
  }
  
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
  this.source       = options.source       || { host: 'localhost', port: 8000 };
  this.source.https = this.source.https    || options.https;
  this.changeOrigin = options.changeOrigin || false;  
};

// Inherit from events.EventEmitter
util.inherits(HttpProxy, events.EventEmitter);

//
// ### function proxyRequest (req, res, [port, host, paused])
// #### @req {ServerRequest} Incoming HTTP Request to proxy.
// #### @res {ServerResponse} Outgoing HTTP Request to write proxied data to.
// #### @buffer {Object} Result from `httpProxy.buffer(req)`
//
HttpProxy.prototype.proxyRequest = function (req, res, buffer) {
  var self = this, 
      errState = false,
      outgoing = new(this.target.base),
      reverseProxy;

  //
  // Add common proxy headers to the request so that they can
  // be availible to the proxy target server:
  //
  // * `x-forwarded-for`: IP Address of the original request
  // * `x-forwarded-proto`: Protocol of the original request
  // * `x-forwarded-port`: Port of the original request.
  //

  if (this.enable.xforward && req.connection && req.socket) {
    req.headers['x-forwarded-for']   = req.connection.remoteAddress || req.socket.remoteAddress;
    req.headers['x-forwarded-port']  = req.connection.remotePort || req.socket.remotePort;
    req.headers['x-forwarded-proto'] = req.connection.pair ? 'https' : 'http';
  }

  //
  // Emit the `start` event indicating that we have begun the proxy operation.
  //
  this.emit('start', req, res, this.target);

  //
  // If forwarding is enabled for this instance, foward proxy the
  // specified request to the address provided in `this.forward`
  //
  if (this.forward) {
    this.emit('forward', req, res, this.forward);
    this._forwardRequest(req);
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
    catch (ex) { console.error("res.end error: %s", ex.message) }
  }

  //
  // Setup outgoing proxy with relevant properties.
  //
  outgoing.host    = this.target.host;
  outgoing.port    = this.target.port;
  outgoing.agent   = this.target.agent;
  outgoing.method  = req.method;
  outgoing.path    = req.url;
  outgoing.headers = req.headers;

  //
  // Open new HTTP request to internal resource with will act 
  // as a reverse proxy pass
  //
  reverseProxy = this.target.protocol.request(outgoing, function (response) {
    //
    // Process the `reverseProxy` `response` when it's received.
    //
    if (response.headers.connection) {
      if (req.headers.connection) { response.headers.connection = req.headers.connection }
      else { response.headers.connection = 'close' }
    }

    // Set the headers of the client response
    res.writeHead(response.statusCode, response.headers);

    // If `response.statusCode === 304`: No 'data' event and no 'end'
    if (response.statusCode === 304) {
      try { res.end() }
      catch (ex) { console.error("res.end error: %s", ex.message) }
      return;
    }

    //
    // For each data `chunk` received from the `reverseProxy`
    // `response` write it to the outgoing `res`.
    // If the res socket has been killed already, then write()
    // will throw. Nevertheless, try our best to end it nicely.
    //
    response.on('data', function (chunk) {
      if (req.method !== 'HEAD' && res.writable) {
        try {
          var flushed = res.write(chunk);
        } 
        catch (ex) {
          console.error("res.write error: %s", ex.message);
          
          try { res.end() } 
          catch (ex) { console.error("res.end error: %s", ex.message) }
          
          return;
        }
        
        if (!flushed) {
          response.pause();
          res.once('drain', function () {
            try { response.resume() } 
            catch (er) { console.error("response.resume error: %s", er.message) }
          });
          
          //
          // Force the `drain` event in 100ms if it hasn't
          // happened on its own. 
          //          
          setTimeout(function () {
            res.emit('drain');
          }, 100);
        }
      }
    });

    //
    // When the `reverseProxy` `response` ends, end the
    // corresponding outgoing `res` unless we have entered
    // an error state. In which case, assume `res.end()` has
    // already been called and the 'error' event listener
    // removed.
    //
    response.on('end', function () {
      if (!errState) {
        reverseProxy.removeListener('error', proxyError);
        
        try { res.end() }
        catch (ex) { console.error("res.end error: %s", ex.message) }
        
        // Emit the `end` event now that we have completed proxying
        self.emit('end', req, res);
      }
    });
  });

  //
  // Handle 'error' events from the `reverseProxy`.
  //
  reverseProxy.once('error', proxyError);

  //
  // For each data `chunk` received from the incoming
  // `req` write it to the `reverseProxy` request.
  //
  req.on('data', function (chunk) {
    if (!errState) {
      var flushed = reverseProxy.write(chunk);
      if (!flushed) {
        req.pause();
        reverseProxy.once('drain', function () {
          try { req.resume() } 
          catch (er) { console.error("req.resume error: %s", er.message) }
        });
        
        //
        // Force the `drain` event in 100ms if it hasn't
        // happened on its own. 
        //
        setTimeout(function () {
          reverseProxy.emit('drain');
        }, 100);
      }
    }
  });

  //
  // When the incoming `req` ends, end the corresponding `reverseProxy`
  // request unless we have entered an error state.
  //
  req.on('end', function () {
    if (!errState) {
      reverseProxy.end();
    }
  });

  //
  // If we have been passed buffered data, resume it.
  //
  if (buffer) {
    return !errState
      ? buffer.resume()
      : buffer.destroy();
  }
};

//
// ### function proxyWebSocketRequest (req, socket, head, buffer)
// #### @req {ServerRequest} Websocket request to proxy.
// #### @socket {net.Socket} Socket for the underlying HTTP request
// #### @head {string} Headers for the Websocket request.
// #### @buffer {Object} Result from `httpProxy.buffer(req)`
// Performs a WebSocket proxy operation to the location specified by 
// `this.target`.
//
HttpProxy.prototype.proxyWebSocketRequest = function (req, socket, head, buffer) {
  var self      = this,
      outgoing  = new(this.target.base),
      listeners = {},
      errState  = false,
      CRLF      = '\r\n';

  //
  // WebSocket requests must have the `GET` method and
  // the `upgrade:websocket` header
  //
  if (req.method !== 'GET' || req.headers.upgrade.toLowerCase() !== 'websocket') {
    //
    // This request is not WebSocket request
    //
    return socket.destroy();
  }
  
  //
  // Add common proxy headers to the request so that they can
  // be availible to the proxy target server:
  //
  // * `x-forwarded-for`: IP Address of the original request
  // * `x-forwarded-proto`: Protocol of the original request
  // * `x-forwarded-port`: Port of the original request.
  //
  if (this.enable.xforward && req.connection && req.connection.socket) {
    req.headers['x-forwarded-for']   = req.connection.remoteAddress || req.connection.socket.remoteAddress;
    req.headers['x-forwarded-port']  = req.connection.remotePort || req.connection.socket.remotePort;
    req.headers['x-forwarded-proto'] = req.connection.pair ? 'https' : 'http';
  }

  //
  // Helper function for setting appropriate socket values:
  // 1. Turn of all bufferings
  // 2. For server set KeepAlive
  // 3. For client set encoding
  //
  function _socket(socket, keepAlive) {
    socket.setTimeout(0);
    socket.setNoDelay(true);
    
    if (keepAlive) {
      if (socket.setKeepAlive) {
        socket.setKeepAlive(true, 0);
      }
      else if (socket.pair.cleartext.socket.setKeepAlive) {
        socket.pair.cleartext.socket.setKeepAlive(true, 0);
      }
    }
    else {
      socket.setEncoding('utf8');
    }
  }
  
  //
  // Setup the incoming client socket.
  //
  _socket(socket, true);

  //
  // On `upgrade` from the Agent socket, listen to
  // the appropriate events.
  //
  function onUpgrade (reverseProxy, proxySocket) {
    if (!reverseProxy) {
      proxySocket.end();
      socket.end();
      return;
    }

    //
    // Any incoming data on this WebSocket to the proxy target
    // will be written to the `reverseProxy` socket.
    //
    proxySocket.on('data', listeners.onIncoming = function (data) {
      if (reverseProxy.incoming.socket.writable) {
        try {
          self.emit('websocket:outgoing', req, socket, head, data);
          var flushed = reverseProxy.incoming.socket.write(data);
          if (!flushed) {
            proxySocket.pause();
            reverseProxy.incoming.socket.once('drain', function () {
              try { proxySocket.resume() } 
              catch (er) { console.error("proxySocket.resume error: %s", er.message) }
            });
            
            //
            // Force the `drain` event in 100ms if it hasn't
            // happened on its own. 
            //
            setTimeout(function () {
              reverseProxy.incoming.socket.emit('drain');
            }, 100);
          }
        }
        catch (ex) {
          detach();
          reverseProxy.incoming.socket.end();
          proxySocket.end();
        }
      }
    });

    //
    // Any outgoing data on this Websocket from the proxy target
    // will be written to the `proxySocket` socket.
    //
    reverseProxy.incoming.socket.on('data', listeners.onOutgoing = function (data) {
      try {
        self.emit('websocket:incoming', reverseProxy, reverseProxy.incoming, head, data);
        var flushed = proxySocket.write(data);
        if (!flushed) {
          reverseProxy.incoming.socket.pause();
          proxySocket.once('drain', function () {
            try { reverseProxy.incoming.socket.resume() } 
            catch (er) { console.error("reverseProxy.incoming.socket.resume error: %s", er.message) }
          });
          
          //
          // Force the `drain` event in 100ms if it hasn't
          // happened on its own. 
          //
          setTimeout(function () {
            proxySocket.emit('drain');
          }, 100);
        }
      }
      catch (ex) {
        detach();
        proxySocket.end();
        socket.end();
      }
    });

    //
    // Helper function to detach all event listeners
    // from `reverseProxy` and `proxySocket`.
    //
    function detach() {
      proxySocket.removeListener('end', listeners.onIncomingClose);
      proxySocket.removeListener('data', listeners.onIncoming);
      reverseProxy.incoming.socket.removeListener('end', listeners.onOutgoingClose);
      reverseProxy.incoming.socket.removeListener('data', listeners.onOutgoing);
    }

    //
    // If the incoming `proxySocket` socket closes, then
    // detach all event listeners.
    //
    proxySocket.on('end', listeners.onIncomingClose = function() {
      reverseProxy.incoming.socket.end();
      detach();

      // Emit the `end` event now that we have completed proxying
      self.emit('websocket:end', req, socket, head);
    });

    //
    // If the `reverseProxy` socket closes, then detach all
    // event listeners.
    //
    reverseProxy.incoming.socket.on('end', listeners.onOutgoingClose = function() {
      proxySocket.end();
      detach();
    });
  };

  function getPort (port) {
    port = port || 80;
    return port - 80 === 0 ? '' : ':' + port
  }

  //
  // Get the protocol, and host for this request and create an instance
  // of `http.Agent` or `https.Agent` from the pool managed by `node-http-proxy`.
  //
  var agent        = this.target.agent,
      protocolName = this.target.https ? 'https' : 'http',
      portUri      = getPort(this.source.port),
      remoteHost   = this.target.host + portUri;
  
  //
  // Change headers (if requested).
  //
  if (this.changeOrigin) {
    req.headers.host   = remoteHost;
    req.headers.origin = protocolName + '://' + remoteHost;
  }

  //
  // Make the outgoing WebSocket request
  //
  outgoing.host    = this.target.host;
  outgoing.port    = this.target.port;
  outgoing.method  = 'GET';
  outgoing.path    = req.url;
  outgoing.headers = req.headers;
  
  var reverseProxy = agent.appendMessage(outgoing);

  //
  // On any errors from the `reverseProxy` emit the
  // `webSocketProxyError` and close the appropriate
  // connections.
  //
  function proxyError (err) {
    reverseProxy.end();
    if (self.emit('webSocketProxyError', req, socket, head)) {
      return;
    }

    socket.end();
  }

  //
  // Here we set the incoming `req`, `socket` and `head` data to the outgoing
  // request so that we can reuse this data later on in the closure scope
  // available to the `upgrade` event. This bookkeeping is not tracked anywhere
  // in nodejs core and is **very** specific to proxying WebSockets.
  //
  reverseProxy.agent = agent;
  reverseProxy.incoming = {
    request: req,
    socket: socket,
    head: head
  };

  //
  // If the agent for this particular `host` and `port` combination
  // is not already listening for the `upgrade` event, then do so once.
  // This will force us not to disconnect.
  //
  // In addition, it's important to note the closure scope here. Since
  // there is no mapping of the socket to the request bound to it.
  //
  if (!agent._events || agent._events['upgrade'].length === 0) {
    agent.on('upgrade', function (_, remoteSocket, head) {
      //
      // Prepare the socket for the reverseProxy request and begin to
      // stream data between the two sockets. Here it is important to
      // note that `remoteSocket._httpMessage === reverseProxy`.
      //
      _socket(remoteSocket, true);
      onUpgrade(remoteSocket._httpMessage, remoteSocket);
    });
  }

  //
  // If the reverseProxy connection has an underlying socket,
  // then execute the WebSocket handshake.
  //
  if (typeof reverseProxy.socket !== 'undefined') {
    reverseProxy.socket.on('data', function handshake (data) {
      //
      // Ok, kind of harmfull part of code. Socket.IO sends a hash
      // at the end of handshake if protocol === 76, but we need
      // to replace 'host' and 'origin' in response so we split
      // data to printable data and to non-printable. (Non-printable
      // will come after double-CRLF).
      //
      var sdata = data.toString();

      // Get the Printable data
      sdata = sdata.substr(0, sdata.search(CRLF + CRLF));

      // Get the Non-Printable data
      data = data.slice(Buffer.byteLength(sdata), data.length);

      if (self.source.https && !self.target.https) {
        //
        // If the proxy server is running HTTPS but the client is running
        // HTTP then replace `ws` with `wss` in the data sent back to the client.
        //
        sdata = sdata.replace('ws:', 'wss:');
      }

      try {
        //
        // Write the printable and non-printable data to the socket
        // from the original incoming request.
        //
        self.emit('websocket:handshake', req, socket, head, sdata, data);
        socket.write(sdata);
        var flushed = socket.write(data);
        if (!flushed) {
          reverseProxy.socket.pause();
          socket.once('drain', function () {
            try { reverseProxy.socket.resume() } 
            catch (er) { console.error("reverseProxy.socket.resume error: %s", er.message) }
          });
          
          //
          // Force the `drain` event in 100ms if it hasn't
          // happened on its own. 
          //
          setTimeout(function () {
            socket.emit('drain');
          }, 100);
        }
      }
      catch (ex) {
        //
        // Remove data listener on socket error because the 
        // 'handshake' has failed.
        //
        reverseProxy.socket.removeListener('data', handshake);
        return proxyError(ex);
      }

      // Catch socket errors
      socket.on('error', proxyError);

      //
      // Remove data listener now that the 'handshake' is complete
      //
      reverseProxy.socket.removeListener('data', handshake);
    });
  }

  reverseProxy.on('error', proxyError);

  try {
    //
    // Attempt to write the upgrade-head to the reverseProxy 
    // request. This is small, and there's only ever one of 
    // it; no need for pause/resume.
    //
    // XXX This is very wrong and should be fixed in node's core
    //
    reverseProxy.write(head);
    if (head && head.length === 0) {
      reverseProxy._send('');
    }
  }
  catch (ex) {
    return proxyError(ex);
  }

  //
  // If we have been passed buffered data, resume it.
  //
  if (buffer) {
    return !errState
      ? buffer.resume()
      : buffer.destroy();
  }
};

//
// ### function close()
// Closes all sockets associated with the Agents
// belonging to this instance.
//
HttpProxy.prototype.close = function () {
  [this.forward, this.target].forEach(function (proxy) {
    if (proxy && proxy.agent) {
      proxy.agent.sockets.forEach(function (socket) {
        socket.end();
      });
    }
  });
};

//
// ### @private function _forwardRequest (req)
// #### @req {ServerRequest} Incoming HTTP Request to proxy.
// Forwards the specified `req` to the location specified
// by `this.forward` ignoring errors and the subsequent response.
//
HttpProxy.prototype._forwardRequest = function (req) {
  var self = this, 
      outgoing = new(this.forward.base),
      forwardProxy;

  //
  // Setup outgoing proxy with relevant properties.
  //
  outgoing.host    = this.forward.host;
  outgoing.port    = this.forward.port,
  outgoing.agent   = this.forward.agent;
  outgoing.method  = req.method;
  outgoing.path    = req.url;
  outgoing.headers = req.headers;

  //
  // Open new HTTP request to internal resource with will 
  // act as a reverse proxy pass.
  //
  forwardProxy = this.forward.protocol.request(outgoing, function (response) {
    //
    // Ignore the response from the forward proxy since this is a 'fire-and-forget' proxy.
    // Remark (indexzero): We will eventually emit a 'forward' event here for performance tuning.
    //
  });

  //
  // Add a listener for the connection timeout event.
  //
  // Remark: Ignoring this error in the event
  //         forward target doesn't exist.
  //
  forwardProxy.once('error', function (err) { });

  //
  // Chunk the client request body as chunks from
  // the proxied request come in
  //
  req.on('data', function (chunk) {
    var flushed = forwardProxy.write(chunk);
    if (!flushed) {
      req.pause();
      forwardProxy.once('drain', function () {
        try { req.resume() } 
        catch (er) { console.error("req.resume error: %s", er.message) }
      });

      //
      // Force the `drain` event in 100ms if it hasn't
      // happened on its own. 
      //
      setTimeout(function () {
        forwardProxy.emit('drain');
      }, 100);
    }
  });

  //
  // At the end of the client request, we are going to 
  // stop the proxied request
  //
  req.on('end', function () {
    forwardProxy.end();
  });
};
