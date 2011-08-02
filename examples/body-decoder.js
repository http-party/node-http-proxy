/*
  body-decoder.js: Example of body-decoder middleware with node-http-proxy 

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

var httpProxy = require('http-proxy'),
    http = require('http'),
    util = require('util'),
    colors = require('colors');

exports.bodyMod = function () {
  console.log('middleware has been started.'.green);
  return function (req, res, next) {
    var proxy = next,
        total = '';

    req.on('data', function (data) {
      console.log('ON DATA')
      total += data;
    });
    
    req.on('end', function () {
      console.log('ON END')
      console.log(total);
      //
      // This line, uncommented, hangs forever.
      // proxy.proxyRequest(req, res, { port: 9000, host: 'localhost' });
      // The following also hangs forever.
      // next.proxyRequest(req, res, { port: 9000, host: 'localhost' });
      //
    });
    
    //
    // The following fires just fine.
    //proxy.proxyRequest(req, res, { port: 9000, host: 'localhost' });
    //
    console.log('request proxied...'.blue); 
  }
}

var proxyServer = httpProxy.createServer(
  // Your middleware stack goes here.  
  exports.bodyMod()
).listen(8000);


var httpServer = http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9000);