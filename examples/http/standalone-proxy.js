/*
  standalone-proxy.js: Example of proxying over HTTP with a standalone HTTP server.

  Copyright (c) 2013 - 2016 Charlie Robbins, Jarrett Cruger & the Contributors.

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
    colors = require('colors'),
    http = require('http'),
    httpProxy = require('../../lib/http-proxy');

//
// Http Server with proxyRequest Handler and Latency
//
var proxy = new httpProxy.createProxyServer();
http.createServer(function (req, res) {
  setTimeout(function () {
    proxy.web(req, res, {
      target: 'http://localhost:9002'
    });
  }, 200);
}).listen(8002);

//
// Target Http Server
//
http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9002);

util.puts('http server '.blue + 'started '.green.bold + 'on port '.blue + '8002 '.yellow + 'with proxy.web() handler'.cyan.underline + ' and latency'.magenta);
util.puts('http server '.blue + 'started '.green.bold + 'on port '.blue + '9002 '.yellow);
