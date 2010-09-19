/*
  node-http-proxy-test.js: http proxy for node.js

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
 
var vows = require('vows'),
    sys = require('sys'),
    assert = require('assert'),
    http = require('http');    


var httpProxy = require('./../lib/node-http-proxy');

var io = require('./io/server'),
    WebSocket = require('./node-websocket-client/lib/websocket').WebSocket;

var testServers = {};

//
// Creates the reverse proxy server
//
var startProxyServer = function (port, server) {
  var proxyServer = httpProxy.createServer(port, server); 
  
  proxyServer.listen(8080);
  return proxyServer;
};

// 
// Creates the reverse proxy server with a specified latency
//
var startLatentProxyServer = function (port, server, latency) {
  // Initialize the nodeProxy and start proxying the request
  var proxyServer = httpProxy.createServer(function (req, res, proxy) {
    setTimeout(function () {
      proxy.proxyRequest(port, server);
    }, latency);
  });
  
  proxyServer.listen(8081);
  return proxyServer;
};

//
// Creates the 'hellonode' server
//
var startTargetServer = function (port) {
  var targetServer = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write('hello world')
  	res.end();
  });
  
  targetServer.listen(port);
  return targetServer;
};

//
// The default test bootstrapper with no latency
//
var startTest = function (port) {
  var proxyServer = startProxyServer(port, 'localhost'),
      targetServer = startTargetServer(port);
      
  testServers.noLatency = [];
  testServers.noLatency.push(proxyServer);
  testServers.noLatency.push(targetServer);
  
  return proxyServer;
};

//
// The test bootstrapper with some latency
//
var startTestWithLatency = function (port) {
  var proxyServer = startLatentProxyServer(port, 'localhost', 2000),
      targetServer = startTargetServer(port);
      
  testServers.latency = [];
  testServers.latency.push(proxyServer);
  testServers.latency.push(targetServer);
  
  return proxyServer;
};

//
// The test bootstrapper with no latency
//
var startWebSocketTest = function(port, callback) {
  var proxyServer = startProxyServer(port, 'localhost'),
      targetServer = startTargetServer(port),
      ws = new WebSocket('ws://localhost:' + port + '/socket.io/websocket');
      
  var socketio = io.listen(targetServer, {log: function() {}});
  
  testServers.noLatencyWebSocket = [];
  testServers.noLatencyWebSocket.push(proxyServer);
  testServers.noLatencyWebSocket.push(targetServer);
  testServers.noLatencyWebSocket.push(ws);
  
  callback(socketio, ws);
}

//
// The test bootstrapper with latency
//
var startWebSocketLatencyTest = function(port, callback) {
  var proxyServer = startProxyServer(port, 'localhost', 2000),
      targetServer = startTargetServer(port),
      ws = new WebSocket('ws://localhost:' + port + '/socket.io/websocket');
      
  var socketio = io.listen(targetServer, {log: function() {}});
  
  testServers.LatencyWebSocket = [];
  testServers.LatencyWebSocket.push(proxyServer);
  testServers.LatencyWebSocket.push(targetServer);
  testServers.LatencyWebSocket.push(ws);
  
  callback(socketio, ws);
}


vows.describe('node-http-proxy').addBatch({
  "A node-http-proxy": {
    "when instantiated directly": {
      "and an incoming request is proxied to the helloNode server" : {
        "with no latency" : {
          topic: function () {
            var proxy = startTest(8082);
            proxy.addListener('proxy', this.callback);

            var client = http.createClient(8080, 'localhost');
            var request = client.request('GET', '/');
            request.end();
          },
          "it should received 'hello world'": function (err, body) {
            assert.equal(body, 'hello world');
            testServers.noLatency.forEach(function (server) {
              server.close();
            })
          }
        },
        "with latency": {
          topic: function () {
            var proxy = startTestWithLatency(8083);
            proxy.addListener('proxy', this.callback);

            var client = http.createClient(8081, 'localhost');
            var request = client.request('GET', '/');
            request.end();
          },
          "it should receive 'hello world'": function (err, body) {
            assert.equal(body, 'hello world');
            testServers.latency.forEach(function (server) {
              server.close();
            })
          }
        }
      },
      "and incoming request is proxied to the WebSocket server" : {
        "with no latency" : {
          topic: function () {
            var callback = this.callback;
            startWebSocketTest(8084, function(socketio, ws) {
              function sync() {
                sync.times ++;
                if (sync.times < 2) return;
                callback(0, true);
              }
              sync.times = 0;
              
              ws.on('open', sync);
              socketio.on('connection', sync);
            });
          },
          "it should connect": function(result) {
            assert.ok(result);
            testServers.noLatencyWebSocket.forEach(function (server) {
              try {
                server.close();
              } catch(E) {}
            });
          }
        },
        "with latency" : {
          topic: function () {
            var callback = this.callback;
            startWebSocketLatencyTest(8085, function(socketio, ws) {
              function sync() {
                sync.times ++;
                if (sync.times < 2) return;
                callback(0, true);
              }
              sync.times = 0;
              
              ws.on('open', sync);
              socketio.on('connection', sync);
            });
          },
          "it should connect": function(result) {
            assert.ok(result);
            testServers.LatencyWebSocket.forEach(function (server) {
              try {
                server.close();
              } catch(E) {}
            });
          }
        }
      }
    }
  }
}).export(module);