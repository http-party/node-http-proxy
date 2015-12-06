/*
  proxy-http2-to-http.js: Basic example of proxying over HTTP2 to a target HTTP server

  Copyright (c) Nodejitsu 2013

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

var http  = require('http'),
    path  = require('path'),
    fs    = require('fs'),
    colors = require('colors'),
    httpProxy = require('../../lib/http-proxy'),
    fixturesDir = path.join(__dirname, '..', '..', 'test', 'fixtures');

//
// Create the target HTTP server 
//
var source = http.createServer(function(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from HTTP2');
});

source.listen(9009);

//
// Create the HTTP2 proxy server listening on port 8009
//
var proxy = httpProxy.createProxyServer({
  target: 'http://127.0.0.1:9009',
  http2: {
    key: fs.readFileSync(path.join(fixturesDir, 'agent2-key.pem'), 'utf8'),
    cert: fs.readFileSync(path.join(fixturesDir, 'agent2-cert.pem'), 'utf8'),
    ciphers: 'AES128-GCM-SHA256',
  }
});

proxy.listen(8009);

console.log('http2 proxy server'.blue + ' started '.green.bold + 'on port '.blue + '8009'.yellow);
console.log('http server '.blue + 'started '.green.bold + 'on port '.blue + '9009 '.yellow);
