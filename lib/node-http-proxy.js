/*
  node-http-proxy.js: http proxy for node.js with pooling and event buffering

  Copyright (c) 2010 Mikeal Rogers, Charlie Robbins

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
    pool = require('pool'), 
    url = require('url'),
    events = require('events'), 
    min = 0, 
    max = 100;

// Setup the PoolManager
var manager = pool.createPoolManager();
manager.setMinClients(min);
manager.setMaxClients(max);

exports.createServer = function () {
  var args, action, port, host;
  args = Array.prototype.slice.call(arguments);
  action = typeof args[args.length - 1] === 'function' && args.pop();
  if (args[0]) port = args[0];
  if (args[1]) host = args[1];
  
  var proxy = createProxy();
  proxy.on('route', function (req, res, callback) {
    var uri = url.parse(req.url);
    if (action) {
      action(req, res, callback);
    } 
    else {
      port = port ? port : uri.port ? uri.port : 80;
      host = host ? host : uri.hostname;
      callback(port, host);
    }
  });
  return proxy;
};

exports.setMin = function (value) {
  min = value;
  manager.setMinClients(min);
};

exports.setMax = function (value) {
  max = value;
  manager.setMaxClients(max);
}

var createProxy = function () {
  var server = http.createServer(function (req, res) {
    var buffers = [], 
        b = function (chunk) { buffers.push(chunk) }, 
        e = function () { e = false };
    
    req.on('data', b);
    req.on('end', e);
    
    server.emit('route', req, res, function (port, hostname) {
      var p = manager.getPool(port, hostname);    
      
      p.request(req.method, req.url, req.headers, function (reverse_proxy) {
        var data = '';
        reverse_proxy.on('error', function (err) {
          res.writeHead(500, {'Content-Type': 'text/plain'});

          if(req.method !== 'HEAD') {
            res.write('An error has occurred: ' + sys.puts(JSON.stringify(err)));
          }

          res.end();
        });

        buffers.forEach(function (c) { 
          data += c;
          reverse_proxy.write(c);
        });
        
        buffers = null; 
        req.removeListener('data', b);
        sys.pump(req, reverse_proxy);
        
        if (e) {
          sys.puts('end outgoing request');
          req.removeListener('end', e); 
          req.addListener('end', function () {
            sys.puts('request ended'); 
            reverse_proxy.end() 
          });
        } 
        else {
          reverse_proxy.end();
        }

        // Add a listener for the reverse_proxy response event
        reverse_proxy.addListener('response', function (response) {
          // These two listeners are for testability and observation
          // of what's passed back from the target server
          response.addListener('data', function (chunk) {
            data += chunk;
          });
          
          response.addListener('end', function() {
            server.emit('proxy', null, data);
          });
          sys.puts('response');
          
          // Set the response headers of the client response
          res.writeHead(response.statusCode, response.headers);
          sys.pump(response, res);
        });
      });
    });
  })
  return server;
};