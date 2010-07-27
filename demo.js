/*
 * node-proxy-test.js: Tests for node-proxy. Reverse proxy for node.js
 *
 * (C) 2010 Charlie Robbins, Marak Squires
 * MIT LICENSE
 *
 */
 
var vows = require('vows'),
    sys = require('sys'),
    colors = require('colors')
    assert = require('assert'),
    http = require('http');

var httpProxy = require('./lib/node-http-proxy');
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
httpProxy.createServer('localhost', 9000, function (req, res){

  sys.puts('any requests going to 8002 will get proxied to 9000');

}).listen('localhost', 8002);

sys.puts('http proxy server'.blue + ' started '.green.bold + 'on port '.blue + '8000'.yellow);



// create regular http proxy server
http.createServer(function (req, res){
  var proxy = new httpProxy.httpProxy;
  proxy.init(req, res);
  sys.puts('proxying request to http://localhost:9000');
  proxy.proxyRequest('localhost', '9000', req, res);
}).listen(8000);
sys.puts('http proxy server'.blue + ' started '.green.bold + 'on port '.blue + '8000'.yellow);

// http proxy server with latency
http.createServer(function (req, res){
  var proxy = new (httpProxy);
  proxy.init(req, res);
  setTimeout(function(){
    proxy.proxyRequest('localhost', '9000', req, res);
  }, 200)
}).listen(8001);
sys.puts('http proxy server '.blue + 'started '.green.bold + 'on port '.blue + '8001 '.yellow + 'with latency'.magenta.underline );

// create regular http server 
http.createServer(function (req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('request successfully proxied!' + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9000);
sys.puts('http server '.blue + 'started '.green.bold + 'on port '.blue + '9000 '.yellow);
