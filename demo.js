/*
 * node-proxy-test.js: Tests for node-proxy. Reverse proxy for node.js
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENSE
 *
 */
 
var vows = require('vows'),
    sys = require('sys'),
    colors = require('./vendor/colors')
    assert = require('assert'),
    http = require('http');

var NodeProxy = require('./lib/node-proxy').NodeProxy;
var testServers = {};


// regular http server
http.createServer(function (req, res){
  // Initialize the nodeProxy and start proxying the request
  var proxy = new (NodeProxy);
  proxy.init(req, res);
  // lets proxy the request to another service
  proxy.proxyRequest('localhost', '8081', req, res);
  
}).listen(8080);
sys.puts('started a http server on port 8080'.green)

// http server with latency
http.createServer(function (req, res){
  // Initialize the nodeProxy and start proxying the request
  var proxy = new (NodeProxy);
  proxy.init(req, res);
  
  // lets proxy the request to another service
  setTimeout(function(){
    proxy.proxyRequest('localhost', '8090', req, res);
  }, 200)
  
}).listen(8081);
sys.puts('started a http server with latency on port 8081'.green)



http.createServer(function (req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('foo');
  res.end();
}).listen(8090);
sys.puts('started another http server on port 8090'.green)


sys.puts('to test the proxy server, request http://localhost:8080/ in your browser.');
sys.puts('your request will proxy to the server running on port 8081');
  

/*

return;


//
// Simple 'hello world' response for test purposes
//
var helloWorld = function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('hello world')
	res.end();
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


sys.puts('node-http-proxy has started!'.green);

// start the http-proxy
var proxy = new (NodeProxy);
startTest(proxy, 8082);


// start a second http server (which we will reverse proxy our requests to)


return;


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

*/