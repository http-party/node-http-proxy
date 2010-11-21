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
    request = require('request'),
    assert = require('assert'),
    http = require('http');
    
var httpProxy = require('./../lib/node-http-proxy');
var testServers = [];

//
// Creates the reverse proxy server
//
var startProxyServer = function (port, targetPort, server) {
  var proxyServer = httpProxy.createServer(targetPort, server); 
  proxyServer.listen(port);
  testServers.push(proxyServer);
};

// 
// Creates the reverse proxy server with a specified latency
//
var startLatentProxyServer = function (port, targetPort, server, latency) {
  // Initialize the nodeProxy and start proxying the request
  var proxyServer = httpProxy.createServer(function (req, res, proxy) {
    setTimeout(function () {
      proxy.proxyRequest(targetPort, server);
    }, latency);
  });
  
  proxyServer.listen(port);
  testServers.push(proxyServer);
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
  testServers.push(targetServer);
  return targetServer;
};

vows.describe('node-http-proxy').addBatch({
  "An instance of HttpProxy": {
    "an incoming request to the helloNode server": {
      "with no latency" : {
        "and a valid target server": {
          topic: function () {
            startProxyServer(8080, 8081, 'localhost'),
            startTargetServer(8081);
            var options = {
              method: 'GET', 
              uri: 'http://localhost:8080'
            };
            
            request(options, this.callback);
          },
          "it should received 'hello world'": function (err, res, body) {
            assert.equal(body, 'hello world');
          }
        },
        "and without a valid target server": {
          topic: function () {
            startProxyServer(8082, 9000, 'localhost');
            var options = {
              method: 'GET', 
              uri: 'http://localhost:8082'
            };
            
            request(options, this.callback);
          },
          "it should receive 500 response code": function (err, res, body) {
            assert.equal(res.statusCode, 500);
          }
        }
      },
      "with latency": {
        "and a valid target server": {
          topic: function () {
            startLatentProxyServer(8083, 8084, 'localhost', 1000),
            startTargetServer(8084);
            var options = {
              method: 'GET', 
              uri: 'http://localhost:8083'
            };
            
            request(options, this.callback);
          },
          "it should receive 'hello world'": function (err, res, body) {
            assert.equal(body, 'hello world');
          }
        },
        "and without a valid target server": {
          topic: function () {
            startLatentProxyServer(8085, 9000, 'localhost', 1000);
            var options = {
              method: 'GET', 
              uri: 'http://localhost:8085'
            };
            
            request(options, this.callback);
          },
          "it should receive 500 response code": function (err, res, body) {
            assert.equal(res.statusCode, 500);
          }
        }
      }
    }
  }
}).addBatch({
  "An instance of HttpProxy": {
    "an incoming WebSocket request to the helloNode server": {
      "with no latency" : {
        // Remark: This test is not working
        /*topic: function () {
          startProxyServer(8086, 8087, 'localhost'),
          startTargetServer(8087);
          var options = {
            method: 'GET', 
            uri: 'http://localhost:8086',
            headers: {
              'Upgrade': 'WebSocket', 
              'Connection': 'WebSocket',
              'Host': 'localhost'
            }
          };
          
          request(options, this.callback);
        },
        "it should receive 'hello world'": function (err, res, body) {
          assert.equal(body, 'hello world');
        }*/
      }
    }
  }
}).addBatch({
  "When the tests are over": {
    topic: function () {
      testServers.forEach(function (server) {
        server.close();
      });

      return testServers;
    },
    "the servers should clean up": function () {
      assert.isTrue(true);
    }
  }
}).export(module);