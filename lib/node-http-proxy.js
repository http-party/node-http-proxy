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

exports.httpProxy = function () {
  var self = this;
  this.emitter = new(events.EventEmitter);

  // If we were passed more than two arguments, 
  // assume the first two are request and response.
  if(arguments.length >= 2) {
    this.init(arguments[0], arguments[1]);
  }
};

exports.createServer = function(callback){
  sys.puts('httpProxy.createServer');
  this.listen = function(host, port){
    sys.puts(host + port);
  };
  return this;
};


exports.httpProxy.prototype = {
  init: function (req, res) {
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

  proxyRequest: function (server, port, req, res) {
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

    req.removeListener('data', this.onData);
    req.removeListener('end', this.onEnd);

    // Rebroadcast any events that have been buffered
    for (var i = 0, len = this.events.length; i < len; ++i) {
        req.emit.apply(req, this.events[i]);
    }
  },
  toArray: function (obj){
    var len = obj.length,
        arr = new Array(len);
    for (var i = 0; i < len; ++i) {
        arr[i] = obj[i];
    }
    return arr;
  }
};
