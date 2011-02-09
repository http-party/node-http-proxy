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
    events = require('events'),
    pool = require('pool'),
    ProxyTable = require('./proxy-table').ProxyTable,
    min = 0, 
    max = 100,
    maxEventListeners = 1000;

// Setup the PoolManager
var manager = pool.createPoolManager();
manager.setMinClients(min);
manager.setMaxClients(max);

exports.createServer = function () {
  var args, callback, port, host, forward, 
      silent, proxyTable, options = {};
  
  args = Array.prototype.slice.call(arguments);
  callback = typeof args[args.length - 1] === 'function' && args.pop();
  
  if (args.length >= 2) {
    port = args[0];
    host = args[1];
    options = args[2] || {};
  } else if (args.length === 1) {
    options = args[0] || {};
    if (!options.router && !callback) {
      throw new Error('Cannot create server with no router and no callback');
    }
  }
  
  router = options.router;
  forward = options.forward;
  silent = typeof options.silent !== 'undefined' ? options.silent : true;
  
  if (router) {
    proxyTable = new ProxyTable(router, options.silent, options.hostname_only);
    proxyTable.on('updateRoutes', function (routes) {
      server.emit('updateRoutes', routes);
    });
  }

  var server = http.createServer(function (req, res) {
    function log (message) {
      if (!silent) {
        util.log(message);
      }
    }
    
    var proxy = new HttpProxy(req, res);
    log('Incoming HTTP request to: ' + req.headers.host + req.url);

    if (forward) {
      var forwardProxy = new HttpProxy(req, res);
      log('Forwarding HTTP request to: ' + forward.host + ':' + forward.port);
      forwardProxy.forwardRequest(forward.port, forward.host);
    }

    // If we were passed a callback to process the request
    // or response in some way, then call it.
    if (callback) {
      callback(req, res, proxy);
    } else if (port && host) {
      log('Proxying HTTP request to: ' + host + ':' + port);
      proxy.proxyRequest(port, host);
    } else if (proxyTable) {
      proxyTable.proxyRequest(proxy);
    } else {
      throw new Error('Cannot proxy without port, host, or router.')
    }
  });
  
  server.setMaxListeners(maxEventListeners);
  server.on('close', function () {
    if (proxyTable) proxyTable.close();
  });

  if (!callback) {
    // WebSocket support: if callback is empty tunnel 
    // websocket request automatically
    server.on('upgrade', function(req, socket, head) {
      var proxy = new HttpProxy(req, socket, head);

      // Tunnel websocket requests too
      proxy.proxyWebSocketRequest(port, host);
    });
  }

  return server;
};

exports.setMin = function (value) {
  min = value;
  manager.setMinClients(min);
};

exports.setMax = function (value) {
  max = value;
  manager.setMaxClients(max);
};

var HttpProxy = function (req, res, head) {
  this.events = {};
  this.req = req;
  
  // If this request is upgrade request
  // No response will be passed
  if (!req.headers.upgrade) {
    this.res = res;
    this.watch(req);
  } else {
    // Second argument will be socket
    this.sock = res;
    this.head = head;
    this.watch(res);
  }
};

HttpProxy.prototype = {
  toArray: function (obj) {
    var len = obj.length,
        arr = new Array(len);
    for (var i = 0; i < len; ++i) {
        arr[i] = obj[i];
    }
    return arr;
  },

  watch: function (req) {
    this.events = [];
    var self = this;

    this.onData = function () {
      self.events.push(['data'].concat(self.toArray(arguments)));
    };
    this.onEnd = function () {
      self.events.push(['end'].concat(self.toArray(arguments)));
    };

    req.addListener('data', this.onData);
    req.addListener('end', this.onEnd);
  },

  unwatch: function (req) {
    req.removeListener('data', this.onData);
    req.removeListener('end', this.onEnd);

    // Rebroadcast any events that have been buffered
    for (var i = 0, len = this.events.length; i < len; ++i) {
      req.emit.apply(req, this.events[i]);
    }
  },

  proxyRequest: function (port, server) {
    var self = this, req = this.req, res = this.res;
    
    // Open new HTTP request to internal resource with will act as a reverse proxy pass
    var p = manager.getPool(port, server);

    p.on('error', function (err) {
      // Remark: We should probably do something here
      // but this is a hot-fix because I don't think 'pool'
      // should be emitting this event.
    });
    
    p.request(req.method, req.url, req.headers, function (reverse_proxy) {
      // Create an error handler so we can use it temporarily
      function error (obj) {
        var fn = function (err) {
          res.writeHead(500, {'Content-Type': 'text/plain'});

          if (req.method !== 'HEAD') {
            res.write('An error has occurred: ' + JSON.stringify(err));
          }
        
          // Response end may never come so removeListener here
          obj.removeListener('error', fn);
          res.end();
        };
      
        return fn;
      };

      // Add a listener for the connection timeout event
      var reverseProxyError = error(reverse_proxy);
      reverse_proxy.addListener('error', reverseProxyError);
    
      // Add a listener for the reverse_proxy response event
      reverse_proxy.addListener('response', function (response) {
        if (response.headers.connection) {
          if (req.headers.connection) response.headers.connection = req.headers.connection;
          else response.headers.connection = 'close';
        }

        // Set the response headers of the client response
        res.writeHead(response.statusCode, response.headers);

        // Status code = 304
        // No 'data' event and no 'end'
        if (response.statusCode === 304) {
          res.end();
          return;
        }

        // Add event handler for the proxied response in chunks
        response.addListener('data', function (chunk) {
          if (req.method !== 'HEAD') {
            res.write(chunk, 'binary');
            self.body += chunk;
          }
        });

        // Add event listener for end of proxied response
        response.addListener('end', function () {
          reverse_proxy.removeListener('error', reverseProxyError);
          res.end();
        });
      });

      // Chunk the client request body as chunks from the proxied request come in
      req.addListener('data', function (chunk) {
        reverse_proxy.write(chunk, 'binary');
      })

      // At the end of the client request, we are going to stop the proxied request
      req.addListener('end', function () {
        reverse_proxy.end();
      });
    
      self.unwatch(req);
    });
  },
  
  forwardRequest: function (port, server) {
    var self = this, req = this.req;

    // Open new HTTP request to internal resource with will act as a reverse proxy pass
    var p = manager.getPool(port, server);

    p.on('error', function (err) {
      // Remark: We should probably do something here
      // but this is a hot-fix because I don't think 'pool'
      // should be emitting this event.
    });
    
    p.request(req.method, req.url, req.headers, function (forward_proxy) {
      // Add a listener for the connection timeout event
      forward_proxy.addListener('error', function (err) {
        // Remark: Ignoring this error in the event 
        //         forward target doesn't exist.
      });
    
      // Chunk the client request body as chunks from the proxied request come in
      req.addListener('data', function (chunk) {
        forward_proxy.write(chunk, 'binary');
      })

      // At the end of the client request, we are going to stop the proxied request
      req.addListener('end', function () {
        forward_proxy.end();
      });
    
      self.unwatch(req);
    });
  },

  proxyWebSocketRequest: function (port, server, host) {
    var self = this, req = self.req, socket = self.sock, head = self.head, 
        headers = new _headers(req.headers), CRLF = '\r\n';

    // Will generate clone of headers
    // To not change original
    function _headers(headers) {
      var h = {};
      for (var i in headers) {
        h[i] = headers[i];
      }
      return h;
    }

    // WebSocket requests has method = GET
    if (req.method !== 'GET' || headers.upgrade.toLowerCase() !== 'websocket') {
      // This request is not WebSocket request
      return;
    }

    // Turn of all bufferings
    // For server set KeepAlive
    // For client set encoding
    function _socket(socket, server) {
      socket.setTimeout(0);
      socket.setNoDelay(true);
      if (server) {
        socket.setKeepAlive(true, 0);
      } 
      else {
        socket.setEncoding('utf8');
      }
    }

    // Client socket
    _socket(socket);

    // If host is undefined
    // Get it from headers
    if (!host) {
      host = headers.Host;
    }
    
    // Remote host address
    var remote_host = server + (port - 80 === 0 ? '' : ':' + port);

    // Change headers
    headers.Host = remote_host;
    headers.Origin = 'http://' + remote_host;

    // Open request
    var p = manager.getPool(port, server);

    p.getClient(function(client) {
      // Based on 'pool/main.js'
      var request = client.request('GET', req.url, headers);

      var errorListener = function (error) {
        client.removeListener('error', errorListener);
        
        // Remove the client from the pool's available clients since it has errored
        p.clients.splice(p.clients.indexOf(client), 1);
        socket.end();
      }

      // Not disconnect on update
      client.on('upgrade', function(request, remote_socket, head) {
        // Prepare socket
        _socket(remote_socket, true);

        // Emit event
        onUpgrade(remote_socket);
      });

      client.on('error', errorListener);
      request.on('response', function (response) {
        response.on('end', function () {
          client.removeListener('error', errorListener);
          client.busy = false;
          p.onFree(client);
        })
      })
      client.busy = true;

      var handshake;
      request.socket.on('data', handshake = function(data) {
        // Handshaking

        // Ok, kind of harmfull part of code
        // Socket.IO is sending hash at the end of handshake
        // If protocol = 76
        // But we need to replace 'host' and 'origin' in response
        // So we split data to printable data and to non-printable
        // (Non-printable will come after double-CRLF)
        var sdata = data.toString();

        // Get Printable
        sdata = sdata.substr(0, sdata.search(CRLF + CRLF));

        // Get Non-Printable
        data = data.slice(Buffer.byteLength(sdata), data.length);

        // Replace host and origin
        sdata = sdata.replace(remote_host, host)
                     .replace(remote_host, host);

        try {
          // Write printable
          socket.write(sdata);

          // Write non-printable
          socket.write(data);
        } 
        catch (e) {
          request.end();
          socket.end();
        }

        // Catch socket errors
        socket.on('error', function() {
          request.end();
        });

        // Remove data listener now that the 'handshake' is complete
        request.socket.removeListener('data', handshake);
      });

      // Write upgrade-head
      try {
        request.write(head);
      } 
      catch(e) {
        request.end();
        socket.end();
      }
      self.unwatch(socket);
    });

    // Request

    function onUpgrade(reverse_proxy) {
      var listeners = {};
      
      // We're now connected to the server, so lets change server socket
      reverse_proxy.on('data', listeners._r_data = function(data) {
        // Pass data to client
        if (socket.writable) {
          try {
            socket.write(data);
          } 
          catch (e) {
            socket.end();
            reverse_proxy.end();
          }
        }
      });

      socket.on('data', listeners._data = function(data) {
        // Pass data from client to server
        try {
          reverse_proxy.write(data);
        } 
        catch (e) {
          reverse_proxy.end();
          socket.end();
        }
      });

      // Detach event listeners from reverse_proxy
      function detach() {
        reverse_proxy.removeListener('close', listeners._r_close);
        reverse_proxy.removeListener('data', listeners._r_data);
        socket.removeListener('data', listeners._data);
        socket.removeListener('close', listeners._close);
      }

      // Hook disconnections
      reverse_proxy.on('end', listeners._r_close = function() {
        socket.end();
        detach();
      });

      socket.on('end', listeners._close = function() {
        reverse_proxy.end();
        detach();
      });
    };
  }
};

exports.HttpProxy = HttpProxy;
exports.ProxyTable = ProxyTable;