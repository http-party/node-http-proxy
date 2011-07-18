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

var util = require('util'),
    http = require('http'),
    https = require('https'),
    events = require('events'),
    ProxyTable = require('./proxy-table').ProxyTable,
    maxSockets = 100;

//
// ### Version 0.5.7 // 5/19/2011
//
exports.version = [0, 5, 7];

//
// Track our own list of agents internal to `node-http-proxy`
//
var _agents = {};

//
// ### function _getAgent (host, port, secure)
// #### @host {string} Host of the agent to get
// #### @port {number} Port of the agent to get
// #### @secure {boolean} Value indicating whether or not to use HTTPS
// Retreives an agent from the `http` or `https` module
// and sets the `maxSockets` property appropriately.
//
function _getAgent (host, port, secure) {
  var Agent, id = [host, port].join(':');
  
  if (!port) {
    port = secure ? 443 : 80;
  }
  
  if (!_agents[id]) {
    Agent = secure ? https.Agent : http.Agent;

    _agents[id] = new Agent({ 
      host: host, 
      port: port,
      maxSockets: maxSockets
    });
  }

  return _agents[id];
}

//
// ### function _getProtocol (secure, outgoing) 
// #### @secure {Object|boolean} Settings for `https`
// #### @outgoing {Object} Outgoing request options
// Returns the appropriate protocol based on the settings in 
// `secure`. If the protocol is `https` this function will update
// the options in `outgoing` as appropriate by adding `ca`, `key`,
// and `cert` if they exist in `secure`.
//
function _getProtocol (secure, outgoing) {
  var protocol = secure ? https : http;
  
  if (typeof secure === 'object') {
    outgoing = outgoing || {};
    ['ca', 'cert', 'key'].forEach(function (prop) {
      if (secure[prop]) {
        outgoing[prop] = secure[prop];
      }
    })
  }
  
  return protocol;
}

//
// ### function getMaxSockets ()
// Returns the maximum number of sockets
// allowed on __every__ outgoing request
// made by __all__ instances of `HttpProxy`
//
exports.getMaxSockets = function () {
  return maxSockets;
};

//
// ### function setMaxSockets ()
// Sets the maximum number of sockets
// allowed on __every__ outgoing request
// made by __all__ instances of `HttpProxy`
//
exports.setMaxSockets = function (value) {
  maxSockets = value;
};

//
// ### function createServer ([port, host, options, handler])
// #### @port {number} **Optional** Port to use on the proxy target host.
// #### @host {string} **Optional** Host of the proxy target.
// #### @options {Object} **Optional** Options for the HttpProxy instance used
// #### @handler {function} **Optional** Request handler for the server
// Returns a server that manages an instance of HttpProxy. Flexible arguments allow for:
//
// * `httpProxy.createServer(9000, 'localhost')`
// * `httpProxy.createServer(9000, 'localhost', options)
// * `httpPRoxy.createServer(function (req, res, proxy) { ... })`
//
exports.createServer = function () {
  var args = Array.prototype.slice.call(arguments), 
      callback = typeof args[0] === 'function' && args.shift(),
      options = {}, port, host, forward, silent, proxy, server;
  
  if (args.length >= 2) {
    port = args[0];
    host = args[1];
    options = args[2] || {};
  } 
  else if (args.length === 1) {
    options = args[0] || {};
    if (!options.router && !callback) {
      throw new Error('Cannot create server with no router and no callback');
    }
  }

  proxy = new HttpProxy(options);
  
  handler = function (req, res) {
    if (callback) {
      //
      // If we were passed a callback to process the request
      // or response in some way, then call it.
      //
      callback(req, res, proxy);
    } 
    else if (port && host) {
      //
      // If we have a target host and port for the request
      // then proxy to the specified location.
      //
      proxy.proxyRequest(req, res, {
        port: port, 
        host: host
      });
    }
    else if (proxy.proxyTable) {
      //
      // If the proxy is configured with a ProxyTable
      // instance then use that before failing.
      //
      proxy.proxyRequest(req, res);
    }
    else {
      //
      // Otherwise this server is improperly configured.
      //
      throw new Error('Cannot proxy without port, host, or router.')
    }
  };
  
  server = options.https 
    ? https.createServer(options.https, handler)
    : http.createServer(handler);
  
  server.on('close', function () {
    proxy.close();
  });
  
  proxy.on('routes', function (routes) {
    server.emit('routes', routes);
  });

  if (!callback) {
    // WebSocket support: if callback is empty tunnel 
    // websocket request automatically
    server.on('upgrade', function (req, socket, head) {
      // Tunnel websocket requests too
      
      proxy.proxyWebSocketRequest(req, socket, head, {
        port: port,
        host: host
      });
    });
  }
  
  //
  // Set the proxy on the server so it is available
  // to the consumer of the server
  //
  server.proxy = proxy;
  
  return server;
};

//
// ### function HttpProxy (options)
// #### @options {Object} Options for this instance.
// Constructor function for new instances of HttpProxy responsible
// for managing the life-cycle of streaming reverse proxyied HTTP requests.
//
// Example options:
//
//      {
//        router: {
//          'foo.com': 'localhost:8080',
//          'bar.com': 'localhost:8081'
//        },
//        forward: {
//          host: 'localhost',
//          port: 9001
//        }
//      } 
//
var HttpProxy = exports.HttpProxy = function (options) {
  events.EventEmitter.call(this);
  
  var self          = this;
  options           = options || {};
  
  //
  // Setup basic proxying options
  //
  this.https        = options.https;
  this.forward      = options.forward;
  this.target       = options.target || {};
  
  //
  // Setup additional options for WebSocket proxying. When forcing 
  // the WebSocket handshake to change the `sec-websocket-location`
  // and `sec-websocket-origin` headers `options.source` **MUST**
  // be provided or the operation will fail with an `origin mismatch`
  // by definition.
  //
  this.source       = options.source || { host: 'localhost', port: 8000 };
  this.changeOrigin = options.changeOrigin || false;
  
  if (options.router) {
    this.proxyTable = new ProxyTable(options.router, options.silent, options.hostnameOnly);
    this.proxyTable.on('routes', function (routes) {
      self.emit('routes', routes);
    });
  }
};

// Inherit from events.EventEmitter
util.inherits(HttpProxy, events.EventEmitter);

//
// ### function buffer (obj) 
// #### @obj {Object} Object to pause events from
// Buffer `data` and `end` events from the given `obj`.
// Consumers of HttpProxy performing async tasks 
// __must__ utilize this utility, to re-emit data once
// the async operation has completed, otherwise these
// __events will be lost.__
//
//      var buffer = httpProxy.buffer(req);
//      fs.readFile(path, function(){
//         httpProxy.proxyRequest(req, res, host, port, buffer);
//      });
//
// __Attribution:__ This approach is based heavily on 
// [Connect](https://github.com/senchalabs/connect/blob/master/lib/utils.js#L157).
// However, this is not a big leap from the implementation in node-http-proxy < 0.4.0. 
// This simply chooses to manage the scope of  the events on a new Object literal as opposed to
// [on the HttpProxy instance](https://github.com/nodejitsu/node-http-proxy/blob/v0.3.1/lib/node-http-proxy.js#L154).
//
HttpProxy.prototype.buffer = function (obj) {
  var onData, onEnd, events = [];

  obj.on('data', onData = function (data, encoding) {
    events.push(['data', data, encoding]);
  });

  obj.on('end', onEnd = function (data, encoding) {
    events.push(['end', data, encoding]);
  });

  return {
    end: function () {
      obj.removeListener('data', onData);
      obj.removeListener('end', onEnd);
    },
    resume: function () {
      this.end();
      for (var i = 0, len = events.length; i < len; ++i) {
        obj.emit.apply(obj, events[i]);
      }
    }
  };
};

//
// ### function close ()
// Frees the resources associated with this instance,
// if they exist. 
//
HttpProxy.prototype.close = function () {
  if (this.proxyTable) this.proxyTable.close();
};

//
// ### function proxyRequest (req, res, [port, host, paused])
// #### @req {ServerRequest} Incoming HTTP Request to proxy.
// #### @res {ServerResponse} Outgoing HTTP Request to write proxied data to.
// #### @options {Object} Options for the outgoing proxy request.
//
//     options.port {number} Port to use on the proxy target host.
//     options.host {string} Host of the proxy target.
//     options.buffer {Object} Result from `httpProxy.buffer(req)`
//     options.https {Object|boolean} Settings for https.
//     options.allow_xforwarded_headers {boolean} Don't clobber x-forwarded headers to allow layered proxies.
//
HttpProxy.prototype.proxyRequest = function (req, res, options) {
  var self = this, errState = false, location, outgoing, protocol, reverseProxy;
  
  //
  // Create an empty options hash if none is passed.
  // If default options have been passed to the constructor 
  // of this instance, use them by default.
  //
  options      = options || {};
  options.host = options.host || this.target.host;
  options.port = options.port || this.target.port;
  options.allow_xforwarded_headers = options.allow_xforwarded_headers || false;
  
  //
  // Check the proxy table for this instance to see if we need
  // to get the proxy location for the request supplied. We will
  // always ignore the proxyTable if an explicit `port` and `host`
  // arguments are supplied to `proxyRequest`.
  //
  if (this.proxyTable && !options.host) {
    location = this.proxyTable.getProxyLocation(req);
    
    //
    // If no location is returned from the ProxyTable instance
    // then respond with `404` since we do not have a valid proxy target.
    //
    if (!location) {
      res.writeHead(404);
      return res.end();
    }
    
    //
    // When using the ProxyTable in conjunction with an HttpProxy instance
    // only the following arguments are valid:
    // 
    // * `proxy.proxyRequest(req, res, { host: 'localhost' })`: This will be skipped
    // * `proxy.proxyRequest(req, res, { buffer: buffer })`: Buffer will get updated appropriately
    // * `proxy.proxyRequest(req, res)`: Options will be assigned appropriately. 
    //
    options.port = location.port;
    options.host = location.host;
  }
  
  //
  // Add common proxy headers to the request so that they can 
  // be availible to the proxy target server:
  // 
  // * `x-forwarded-for`: IP Address of the original request
  // * `x-forwarded-proto`: Protocol of the original request
  // * `x-forwarded-port`: Port of the original request. 
  //
  if (options.allow_xforwarded_headers == true) {
    req.headers['x-forwarded-for']   = req.connection.remoteAddress || req.connection.socket.remoteAddress;
    req.headers['x-forwarded-port']  = req.connection.remotePort || req.connection.socket.remotePort;
    req.headers['x-forwarded-proto'] = res.connection.pair ? 'https' : 'http';
  }
  
  //
  // Emit the `start` event indicating that we have begun the proxy operation.
  //
  this.emit('start', req, res, options);
  
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
  
    res.end();
  }
  
  outgoing = {
    host: options.host,
    port: options.port,
    agent: _getAgent(options.host, options.port, options.https || this.target.https),
    method: req.method,
    path: req.url,
    headers: req.headers
  };
  
  protocol = _getProtocol(options.https || this.target.https, outgoing);
  
  // Open new HTTP request to internal resource with will act as a reverse proxy pass
  reverseProxy = protocol.request(outgoing, function (response) {
    
    // Process the `reverseProxy` `response` when it's received.
    if (response.headers.connection) {
      if (req.headers.connection) response.headers.connection = req.headers.connection;
      else response.headers.connection = 'close';
    }

    // Set the headers of the client response
    res.writeHead(response.statusCode, response.headers);

    // `response.statusCode === 304`: No 'data' event and no 'end'
    if (response.statusCode === 304) {
      return res.end();
    }

    // For each data `chunk` received from the `reverseProxy`
    // `response` write it to the outgoing `res`.
    response.on('data', function (chunk) {
      if (req.method !== 'HEAD') {
        res.write(chunk);
      }
    });

    // When the `reverseProxy` `response` ends, end the
    // corresponding outgoing `res` unless we have entered
    // an error state. In which case, assume `res.end()` has
    // already been called and the 'error' event listener
    // removed.
    response.on('end', function () {
      if (!errState) {
        reverseProxy.removeListener('error', proxyError);
        res.end();
        
        // Emit the `end` event now that we have completed proxying
        self.emit('end', req, res);
      }
    });
  });
  
  // Handle 'error' events from the `reverseProxy`.
  reverseProxy.once('error', proxyError);
  
  // For each data `chunk` received from the incoming 
  // `req` write it to the `reverseProxy` request.
  req.on('data', function (chunk) {
    if (!errState) {
      reverseProxy.write(chunk);
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

  // If we have been passed buffered data, resume it.
  if (options.buffer && !errState) {
    options.buffer.resume();
  }
};
  
//
// ### @private function _forwardRequest (req)
// #### @req {ServerRequest} Incoming HTTP Request to proxy.
// Forwards the specified `req` to the location specified
// by `this.forward` ignoring errors and the subsequent response.
//
HttpProxy.prototype._forwardRequest = function (req) {
  var self = this, port, host, outgoing, protocol, forwardProxy;

  port = this.forward.port;
  host = this.forward.host;
  
  outgoing = {
    host: host,
    port: port,
    agent: _getAgent(host, port, this.forward.https),
    method: req.method,
    path: req.url,
    headers: req.headers
  };
  
  // Force the `connection` header to be 'close' until
  // node.js core re-implements 'keep-alive'.
  outgoing.headers['connection'] = 'close';
  
  protocol = _getProtocol(this.forward.https, outgoing);
  
  // Open new HTTP request to internal resource with will act as a reverse proxy pass
  forwardProxy = protocol.request(outgoing, function (response) {
    //
    // Ignore the response from the forward proxy since this is a 'fire-and-forget' proxy.
    // Remark (indexzero): We will eventually emit a 'forward' event here for performance tuning.
    //
  });
  
  // Add a listener for the connection timeout event.
  //
  // Remark: Ignoring this error in the event 
  //         forward target doesn't exist.
  //
  forwardProxy.once('error', function (err) { });

  // Chunk the client request body as chunks from the proxied request come in
  req.on('data', function (chunk) {
    forwardProxy.write(chunk);
  })

  // At the end of the client request, we are going to stop the proxied request
  req.on('end', function () {
    forwardProxy.end();
  });
};

//
// ### function proxyWebSocketRequest (req, socket, head, options)
// #### @req {ServerRequest} Websocket request to proxy. 
// #### @socket {net.Socket} Socket for the underlying HTTP request
// #### @head {string} Headers for the Websocket request.
// #### @options {Object} Options to use when proxying this request.
//
//     options.port {number} Port to use on the proxy target host.
//     options.host {string} Host of the proxy target.
//     options.buffer {Object} Result from `httpProxy.buffer(req)`
//     options.https {Object|boolean} Settings for https.
//
HttpProxy.prototype.proxyWebSocketRequest = function (req, socket, head, options) {
  var self      = this, 
      listeners = {},
      errState  = false, 
      CRLF      = '\r\n',
      outgoing;

  //
  // WebSocket requests must have the `GET` method and 
  // the `upgrade:websocket` header
  //
  if (req.method !== 'GET' || req.headers.upgrade.toLowerCase() !== 'websocket') {
    //
    // This request is not WebSocket request
    //
    return;
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
          reverseProxy.incoming.socket.write(data);
        } 
        catch (e) {
          reverseProxy.incoming.socket.end();
          proxySocket.end();
        }
      }
    });

    //
    // Any outgoing data on this Websocket from the proxy target
    // will be written to the `proxySocket` socket.
    //
    reverseProxy.incoming.socket.on('data', listeners.onOutgoing = function(data) {
      try {
        self.emit('websocket:incoming', reverseProxy, reverseProxy.incoming, head, data);
        proxySocket.write(data);
      } 
      catch (e) {
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

  // Setup the incoming client socket.
  _socket(socket);
  
  function getPort (port) {
    port = port || 80;
    return port - 80 === 0 ? '' : ':' + port
  }
  
  //
  // Get the protocol, and host for this request and create an instance
  // of `http.Agent` or `https.Agent` from the pool managed by `node-http-proxy`.
  //
  var protocolName = options.https || this.target.https ? 'https' : 'http',
      portUri      = getPort(this.source.port),
      remoteHost   = options.host + portUri,
      agent        = _getAgent(options.host, options.port, options.https || this.target.https);

  // Change headers (if requested).
  if (this.changeOrigin) {
    req.headers.host   = remoteHost;
    req.headers.origin = protocolName + '://' + remoteHost;
  }
  
  //
  // Make the outgoing WebSocket request
  //
  outgoing = {
    host: options.host,
    port: options.port,
    method: 'GET',
    path: req.url,
    headers: req.headers,
  };
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
  // there is no mapping of the 
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
      
      if (self.https && !self.target.https) {
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
        socket.write(data);
      } 
      catch (ex) {
        proxyError(ex)
      }

      // Catch socket errors
      socket.on('error', proxyError);

      // Remove data listener now that the 'handshake' is complete
      reverseProxy.socket.removeListener('data', handshake);
    });
  }
  
  reverseProxy.on('error', proxyError);

  try {
    //
    // Attempt to write the upgrade-head to the reverseProxy request.
    //
    reverseProxy.write(head);
  } 
  catch (ex) {
    proxyError(ex);
  }
  
  //
  // If we have been passed buffered data, resume it.
  //
  if (options.buffer && !errState) {
    options.buffer.resume();
  }
};