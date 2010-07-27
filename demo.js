/*
 * node-proxy-test.js: Tests for node-proxy. Reverse proxy for node.js
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENSE
 *
 */
 
var vows = require('vows'),
    sys = require('sys'),
    colors = require('colors')
    assert = require('assert'),
    http = require('http');

var HttpProxy = require('./lib/node-http-proxy').HttpProxy;
var testServers = {};


// ascii art from http://github.com/marak/asciimo
var welcome = '\
#    # ##### ##### #####        #####  #####   ####  #    # #   # \n\
#    #   #     #   #    #       #    # #    # #    #  #  #   # #  \n\
######   #     #   #    # ##### #    # #    # #    #   ##     #   \n\
#    #   #     #   #####        #####  #####  #    #   ##     #   \n\
#    #   #     #   #            #      #   #  #    #  #  #    #   \n\
#    #   #     #   #            #      #    #  ####  #    #   #   \n';
sys.puts(welcome.rainbow.bold);

// create regular http proxy server
http.createServer(function (req, res){
  var proxy = new (HttpProxy);
  proxy.init(req, res);
  proxy.proxyRequest('localhost', '9000', req, res);
}).listen(8000);
sys.puts('http proxy server'.blue + ' started '.green.bold + 'on port '.blue + '8000'.yellow);

// http proxy server with latency
http.createServer(function (req, res){
  var proxy = new (HttpProxy);
  proxy.init(req, res);
  setTimeout(function(){
    proxy.proxyRequest('localhost', '9000', req, res);
  }, 200)
}).listen(8001);
sys.puts('http proxy server '.blue + 'started '.green.bold + 'on port '.blue + '8001 '.yellow + 'with latency'.magenta.underline );

// create regular http server 
http.createServer(function (req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('foo');
  res.end();
}).listen(9000);
sys.puts('http server '.blue + 'started '.green.bold + 'on port '.blue + '9000 '.yellow);
//sys.puts('to test the proxy server, request http://localhost:8080/ in your browser.');
//sys.puts('your request will proxy to the server running on port 8081');