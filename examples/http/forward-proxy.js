/*
  forward-proxy.js: Example of proxying over HTTP with additional forward proxy

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
// Setup proxy server with forwarding
//
httpProxy.createServer({
  forward: {
    port: 9019,
    host: 'localhost'
  }
}).listen(8019);

//
// Target Http Forwarding Server
//
http.createServer(function (req, res) {
  util.puts('Receiving forward for: ' + req.url);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('request successfully forwarded to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9019);

util.puts('http proxy server '.blue + 'started '.green.bold + 'on port '.blue + '8019 '.yellow + 'with forward proxy'.magenta.underline);
util.puts('http forward server '.blue + 'started '.green.bold + 'on port '.blue + '9019 '.yellow);