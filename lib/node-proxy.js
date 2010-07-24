/*
 * node-proxy.js: Reverse proxy for node.js
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENSE
 *
 */
 
var sys = require('sys'),
    http = require('http'),
    events = require('events');

//
// Creates a new instance of NodeProxy
//
//exports.create = function (req, res) { 
//  return new exports.nodeProxy(req, res);
//};
    
//
// The NodeProxy factory
//
exports.NodeProxy = function () {
  var self = this;
  this.emitter = new(events.EventEmitter);

  // If we were passed more than two arguments, 
  // assume they are request and response.
  if(arguments.length >= 2) {
    this.init(arguments[0], arguments[1]);
  }
};

exports.NodeProxy.prototype = {
  toArray: function (obj){
    var len = obj.length,
        arr = new Array(len);
    for (var i = 0; i < len; ++i) {
        arr[i] = obj[i];
    }
    return arr;
  },
  
  init: function (req, res) {
    this.events = [];
    
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
  }
};
