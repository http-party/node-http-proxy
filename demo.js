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

var HttpProxy = require('./lib/node-http-proxy').HttpProxy;
var testServers = {};


// regular http server
http.createServer(function (req, res){
  // Initialize the nodeProxy and start proxying the request
  var proxy = new (HttpProxy);
  proxy.init(req, res);
  // lets proxy the request to another service
  proxy.proxyRequest('localhost', '8081', req, res);
  
}).listen(8080);
sys.puts('started a http server on port 8080'.green)

// http server with latency
http.createServer(function (req, res){
  // Initialize the nodeProxy and start proxying the request
  var proxy = new (HttpProxy);
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
