/*
 * node-proxy-test.js: Tests for node-proxy. Reverse proxy for node.js
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENSE
 *
 */
 
var vows = require('vows'),
    sys = require('sys'),
    eyes = require('eyes'),
    assert = require('assert'),
    http = require('http');

require.paths.unshift(require('path').join(__dirname, '../lib/'));

var NodeProxy = require('node-proxy').NodeProxy;
var testServers = {};

//
// Simple 'hello world' response for test purposes
//
var helloWorld = function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('hello world')
	res.end();
};

//
// Creates the reverse proxy server
//
var startProxyServer = function (server, port, proxy) {
  var proxyServer = http.createServer(function (req, res){
    // Initialize the nodeProxy and start proxying the request
    proxy.init(req, res);
    proxy.proxyRequest(server, port, req, res);
  });
  
  proxyServer.listen(8080);
  return proxyServer;
};

// 
// Creates the reverse proxy server with a specified latency
//
var startLatentProxyServer = function (server, port, proxy, latency) {
  var proxyServer = http.createServer(function (req, res){
    // Initialize the nodeProxy and start proxying the request
    proxy.init(req, res);
    setTimeout(function () {
      proxy.proxyRequest(server, port, req, res);
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
    helloWorld(req, res);
  })
  
  targetServer.listen(port);
  return targetServer;
};

//
// The default test bootstrapper with no latency
//
var startTest = function (proxy, port) {
  testServers.noLatency = [];
  testServers.noLatency.push(startProxyServer('127.0.0.1', port, proxy));
  testServers.noLatency.push(startTargetServer(port));
};

//
// The test bootstrapper with some latency
//
var startTestWithLatency = function (proxy, port) {
  testServers.latency = [];
  testServers.latency.push(startLatentProxyServer('127.0.0.1', port, proxy, 2000));
  testServers.latency.push(startTargetServer(port));
};

vows.describe('node-proxy').addBatch({
  "When an incoming request is proxied to the helloNode server" : {
    "with no latency" : {
      topic: function () {
        var proxy = new (NodeProxy);
        startTest(proxy, 8082);
        proxy.emitter.addListener('end', this.callback);

        var client = http.createClient(8080, '127.0.0.1');
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
        var proxy = new (NodeProxy);
        startTestWithLatency(proxy, 8083);
        proxy.emitter.addListener('end', this.callback);

        var client = http.createClient(8081, '127.0.0.1');
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
  }
}).export(module);