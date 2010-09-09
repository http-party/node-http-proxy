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
    eyes = require('eyes'),
    events = require('events'),
    pool = require('pool'),
    min = 0, 
    max = 100;

// Setup the PoolManager
var manager = pool.createPoolManager();
manager.setMinClients(min);
manager.setMaxClients(max);

exports.createServer = function () {
  // Initialize the nodeProxy to start proxying requests
  var proxy = new (exports.HttpProxy);
  return proxy.createServer.apply(proxy, arguments);
};

exports.setMin = function (value) {
  min = value;
  manager.setMinClients(min);
};

exports.setMax = function (value) {
  max = value;
  manager.setMaxClients(max);
};

exports.HttpProxy = function () {
  this.emitter = new(events.EventEmitter);
  this.events = {};
  this.listeners = {};
  this.collisions = {};
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
    
    // Create a unique id for this request so
    // we can reference it later. 
    var id = new Date().getTime().toString();
    
    // If we get a request in the same tick, we need to 
    // append to the id so it stays unique. 
    if(typeof this.collisions[id] === 'undefined') {
      this.collisions[id] = 0;
    }
    else {
      this.collisions[id]++;
      id += this.collisions[id];
    }
    
    req.id = id;
    this.events[req.id] = [];
    
    this.listeners[req.id] = {
      onData: function () {
        self.events[req.id].push(['data'].concat(self.toArray(arguments)));
      },
      onEnd: function () {
        self.events[req.id].push(['end'].concat(self.toArray(arguments)));
      }
    };

    req.addListener('data', this.listeners[req.id].onData);
    req.addListener('end', this.listeners[req.id].onEnd);
    
  },
  
  unwatch: function (req, res) {
    req.removeListener('data', this.listeners[req.id].onData);
    req.removeListener('end', this.listeners[req.id].onEnd);
    
    // Rebroadcast any events that have been buffered
    while(this.events[req.id].length > 0) {
      var args = this.events[req.id].shift();
      req.emit.apply(req, args);
    }
     
    // Remove the data from the event and listeners hashes
    delete this.listeners[req.id];
    delete this.events[req.id];
    
    // If this request id is a base time, delete it
    if (typeof this.collisions[req.id] !== 'undefined') {
      delete this.collisions[req.id];
    }
  },

  proxyRequest: function (port, server, req, res) {
    // Remark: nodeProxy.body exists solely for testability
    this.body = '';
    var self = this;
    
    // Open new HTTP request to internal resource with will act as a reverse proxy pass
    var p =  manager.getPool(port, server);   
    eyes.inspect(req.headers);
    // Make request to internal server, passing along the method and headers
    p.request(req.method, req.url, req.headers, function (reverse_proxy) {
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

      self.unwatch(req, res);
    });
  }
};
