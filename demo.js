/*
  demo.js: http proxy for node.js

  Copyright (c) 2010 Charlie Robbins, Mikeal Rogers, Fedor Indutny, & Marak Squires.

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

var util = require('util'),
    colors = require('colors')
    http = require('http'),
    httpProxy = require('./lib/node-http-proxy');

// ascii art from http://github.com/marak/asciimo
var welcome = '\
#    # ##### ##### #####        #####  #####   ####  #    # #   # \n\
#    #   #     #   #    #       #    # #    # #    #  #  #   # #  \n\
######   #     #   #    # ##### #    # #    # #    #   ##     #   \n\
#    #   #     #   #####        #####  #####  #    #   ##     #   \n\
#    #   #     #   #            #      #   #  #    #  #  #    #   \n\
#    #   #     #   #            #      #    #  ####  #    #   #   \n';
util.puts(welcome.rainbow.bold);

//
// Basic Http Proxy Server
//
httpProxy.createServer(9000, 'localhost').listen(8000);
util.puts('http proxy server'.blue + ' started '.green.bold + 'on port '.blue + '8000'.yellow);

//
// Http Proxy Server with Proxy Table
//
httpProxy.createServer({
  router: {
    'localhost': 'localhost:9000'
  }
}).listen(8001);
util.puts('http proxy server '.blue + 'started '.green.bold + 'on port '.blue + '8001 '.yellow + 'with proxy table'.magenta.underline)

//
// Http Proxy Server with Latency
//
httpProxy.createServer(function (req, res, proxy) {
  var paused = proxy.pause(req);
  setTimeout(function() {
    proxy.proxyRequest(req, res, 9000, 'localhost', paused);
  }, 200)
}).listen(8002);
util.puts('http proxy server '.blue + 'started '.green.bold + 'on port '.blue + '8002 '.yellow + 'with latency'.magenta.underline);

//
//
//
httpProxy.createServer(9000, 'localhost', {
  forward: {
    port: 9001,
    host: 'localhost'
  }
}).listen(8003);
util.puts('http proxy server '.blue + 'started '.green.bold + 'on port '.blue + '8003 '.yellow + 'with forward proxy'.magenta.underline)

//
// Http Server with proxyRequest Handler and Latency
//
var standAloneProxy = new httpProxy.HttpProxy();
http.createServer(function (req, res) {
  var paused = standAloneProxy.pause(req);
  setTimeout(function() {
    proxy.proxyRequest(req, res, 9000, 'localhost', paused);
  }, 200);
}).listen(8004);
util.puts('http server '.blue + 'started '.green.bold + 'on port '.blue + '8004 '.yellow + 'with proxyRequest handler'.cyan.underline + ' and latency'.magenta);

//
// Target Http Server
//
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9000);
util.puts('http server '.blue + 'started '.green.bold + 'on port '.blue + '9000 '.yellow);

//
// Target Http Forwarding Server
//
http.createServer(function (req, res) {
  util.puts('Receiving forward for: ' + req.url)
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('request successfully forwarded to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9001);
util.puts('http forward server '.blue + 'started '.green.bold + 'on port '.blue + '9001 '.yellow);
