/*
  demo.js: http proxy for node.js

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

var sys = require('sys'),
    colors = require('colors')
    http = require('http'),
    httpProxy = require('http-proxy');

// ascii art from http://github.com/marak/asciimo
var welcome = '\
#    # ##### ##### #####        #####  #####   ####  #    # #   # \n\
#    #   #     #   #    #       #    # #    # #    #  #  #   # #  \n\
######   #     #   #    # ##### #    # #    # #    #   ##     #   \n\
#    #   #     #   #####        #####  #####  #    #   ##     #   \n\
#    #   #     #   #            #      #   #  #    #  #  #    #   \n\
#    #   #     #   #            #      #    #  ####  #    #   #   \n';
sys.puts(welcome.rainbow.bold);


/****** basic http proxy server ******/ 
httpProxy.createServer(9000, 'localhost').listen(8000);
sys.puts('http proxy server'.blue + ' started '.green.bold + 'on port '.blue + '8000'.yellow);

/****** http proxy server with latency******/ 
httpProxy.createServer(function (req, res, proxy){
  setTimeout(function(){
    proxy.proxyRequest(9000, 'localhost', req, res);
  }, 200)
}).listen(8001);
sys.puts('http proxy server '.blue + 'started '.green.bold + 'on port '.blue + '8001 '.yellow + 'with latency'.magenta.underline );

/****** http server with proxyRequest handler and latency******/ 
http.createServer(function (req, res){
  var proxy = new httpProxy.HttpProxy;
  proxy.watch(req, res);

  setTimeout(function(){
    proxy.proxyRequest(9000, 'localhost', req, res);
  }, 200);
}).listen(8002);
sys.puts('http server '.blue + 'started '.green.bold + 'on port '.blue + '8002 '.yellow + 'with proxyRequest handler'.cyan.underline + ' and latency'.magenta);

/****** regular http server ******/ 
http.createServer(function (req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9000);
sys.puts('http server '.blue + 'started '.green.bold + 'on port '.blue + '9000 '.yellow);
