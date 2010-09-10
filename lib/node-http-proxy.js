/*
  node-http-proxy.js: http proxy for node.js

  Copyright (c) 2010 Charlie Robbins, Mikeal Rogers, & Marak Squires

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
 
var sys = require('sys'),
    http = require('http'),
    events = require('events'),
    pool = require('pool'),
    min = 0, 
    max = 100;

// Setup the PoolManager
var manager = pool.createPoolManager();
manager.setMinClients(min);
manager.setMaxClients(max);

exports.createServer = function () {
  var args, callback, port, host;
  args = Array.prototype.slice.call(arguments);
  callback = typeof args[args.length - 1] === 'function' && args.pop();
  if (args[0]) port = args[0];
  if (args[1]) host = args[1];
  
  var server = http.createServer(function (req, res){
    var proxy = new HttpProxy(req, res);
    
    proxy.emitter.on('proxy', function (err, body) {
      server.emit('proxy', err, body);
    });
    
    // If we were passed a callback to process the request
    // or response in some way, then call it.
    if(callback) {
      callback(req, res, proxy);
    }
    else {        
      proxy.proxyRequest(port, server);
    }
  });
  
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

var HttpProxy = function (req, res) {
  this.emitter = new(events.EventEmitter);
  this.events = {};
  this.req = req;
  this.res = res;
  this.watch(req);
};

HttpProxy.prototype = {
  toArray: function (obj){
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
    // Remark: nodeProxy.body exists solely for testability
    var self = this, req = this.req, res = this.res;
    self.body = '';
    
    // Open new HTTP request to internal resource with will act as a reverse proxy pass
    var p = manager.getPool(port, server);

    p.request(req.method, req.url, req.headers, function (reverse_proxy) {
      // Create an error handler so we can use it temporarily
      var error = function (err) {
        res.writeHead(200, {'Content-Type': 'text/plain'});

        if(req.method !== 'HEAD') {
          res.write('An error has occurred: ' + sys.puts(JSON.stringify(err)));
        }

        res.end();
      };
      
      // Add a listener for the connection timeout event
      reverse_proxy.connection.addListener('error', error);

      // Add a listener for the reverse_proxy response event
      reverse_proxy.addListener('response', function (response) {
        if (response.headers.connection) {
          if (req.headers.connection) response.headers.connection = req.headers.connection;
          else response.headers.connection = 'close';
        }

        // Set the response headers of the client response
        res.writeHead(response.statusCode, response.headers);

        // Add event handler for the proxied response in chunks
        response.addListener('data', function (chunk) {
          if(req.method !== 'HEAD') {
            res.write(chunk, 'binary');
            self.body += chunk;
          }
        });

        // Add event listener for end of proxied response
        response.addListener('end', function () {
          // Remark: Emit the end event for testability
          self.emitter.emit('proxy', null, self.body);
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
        reverse_proxy.connection.removeListener('error', error);
      });

      self.unwatch(req);
    });
  }
};

exports.HttpProxy = HttpProxy;