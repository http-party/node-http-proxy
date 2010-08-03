/*
  node-http-proxy.js: http proxy for node.js

  Copyright (c) 2010 Charlie Robbins & Marak Squires http://github.com/nodejitsu/node-http-proxy

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
    events = require('events');

exports.HttpProxy = function () {
  this.emitter = new(events.EventEmitter);
  this.events = {};
  this.listeners = {};
};

exports.createServer = function () {
  // Initialize the nodeProxy to start proxying requests
  var proxy = new (exports.HttpProxy);
  return proxy.createServer.apply(proxy, arguments);
};

exports.HttpProxy.prototype = {
  toArray: function (obj){
    var len = obj.length,
        arr = new Array(len);
    for (var i = 0; i < len; ++i) {
        arr[i] = obj[i];
    }
    return arr;
  },
  
  createServer: function () {
    var self = this,
        server, 
        port,
        callback;
    
    if (typeof(arguments[0]) === "function") {
      callback = arguments[0];
    }
    else {
      port = arguments[0];
      server = arguments[1];
    }
    
    var proxyServer = http.createServer(function (req, res){
      self.watch(req, res);
      
      // If we were passed a callback to process the request
      // or response in some way, then call it.
      if(callback) {
        callback(req, res, self);
      }
      else {        
        self.proxyRequest(port, server, req, res);
      }
    });
    
    return proxyServer;
  },
  
  watch: function (req, res) {
    var self = this;
    
    this.events[req] = [];
    
    this.listeners[req] = {
      onData: function () {
        self.events[req].push(['data'].concat(self.toArray(arguments)));
      },
      onEnd: function () {
        self.events[req].push(['end'].concat(self.toArray(arguments)));
      }
    };

    req.addListener('data', this.listeners[req].onData);
    req.addListener('end', this.listeners[req].onEnd);
  },
  
  unwatch: function (req, res) {
    req.removeListener('data', this.listeners[req].onData);
    req.removeListener('end', this.listeners[req].onEnd);

    // Rebroadcast any events that have been buffered
    while(this.events[req].length > 0) {
      var args = this.events[req].shift();
      req.emit.apply(req, args);
    }
    
    // Remove the data from the event and listeners hashes
    delete this.listeners[req];
    delete this.events[req];
  },

  proxyRequest: function (port, server, req, res) {
    // Remark: nodeProxy.body exists solely for testability
    this.body = '';
    var self = this;
    
    // Open new HTTP request to internal resource with will act as a reverse proxy pass
    var c = http.createClient(port, server);

    // Make request to internal server, passing along the method and headers
    var reverse_proxy = c.request(req.method, req.url, req.headers);

    // Add a listener for the connection timeout event
    reverse_proxy.connection.addListener('error', function (err) {
      res.writeHead(200, {'Content-Type': 'text/plain'});

      if(req.method !== 'HEAD') {
        res.write('An error has occurred: ' + sys.puts(JSON.stringify(err)));
      }

      res.end();
    });

    // Add a listener for the reverse_proxy response event
    reverse_proxy.addListener('response', function (response) {
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
        self.emitter.emit('end', null, self.body);
        
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

    this.unwatch(req, res);
  }
};
