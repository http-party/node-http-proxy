/*
  proxy-https-to-http.js: Basic example of proxying over HTTPS to a target HTTP server

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

var https = require('https'),
    http  = require('http'),
    util  = require('util'),
    path  = require('path'),
    fs    = require('fs'),
    colors = require('colors'),
    httpProxy = require('../../lib/http-proxy'),
    fixturesDir = path.join(__dirname, '..', '..', 'test', 'fixtures');
    
//
// Create the target HTTP server 
//
http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('hello http over https\n');
	res.end();
}).listen(9009);

//
// Create the HTTPS proxy server listening on port 8000
//
httpProxy.createServer({
  target: {
    host: 'localhost',
    port: 9009
  },
  ssl: {
    key: fs.readFileSync(path.join(fixturesDir, 'agent2-key.pem'), 'utf8'),
    cert: fs.readFileSync(path.join(fixturesDir, 'agent2-cert.pem'), 'utf8')
  }
}).listen(8009);

util.puts('https proxy server'.blue + ' started '.green.bold + 'on port '.blue + '8009'.yellow);
util.puts('http server '.blue + 'started '.green.bold + 'on port '.blue + '9009 '.yellow);
