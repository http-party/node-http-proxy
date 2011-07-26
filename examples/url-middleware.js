/*
  urls-middleware.js: Basic example of middleware in node-http-proxy

  Copyright (c) 2010 Charlie Robbins, Mikeal Rogers, Fedor Indutny, Marak Squires, & Dominic Tarr.

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
    httpProxy = require('./../lib/node-http-proxy');

//
// url proxying middleware example. 
//
// this is not optimised or tested but shows the basic approch to writing a middleware.
//
function matcher (url, dest) {
  var r = new RegExp (url)
  
  return function (url) {
    var m = r(url)
    if (!m) return
    var path = url.slice(m[0].length)
  console.log('proxy:', url, '->', path)
    return {url: path, dest: dest}
  }
}

exports.urls = function (urls) {

  var matchers = []
  for (var url in urls) {
    matchers.push(matcher(url, urls[url]))
  }

  return function (req, res, next) {
    //
    // in nhp middlewares, `proxy` is the prototype of `next`
    // (this means nhp middlewares support both connect API (req, res, next)
    // and nhp API (req, res, proxy)
    //
    var proxy = next;

    for (var k in matchers) {
      var m;
      if (m = matchers[k](req.url)) {
        req.url = m.url;
        return proxy.proxyRequest(req,res, m.dest);
      }
    }
  }
}

httpProxy.createServer(
  exports.urls({'/hello': {port: 9000, host: 'localhost'}})
).listen(8000);

//
// Target Http Server
//
http.createServer(
  function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
    res.end();
  }).listen(9000);

util.puts('http proxy server'.blue + ' started '.green.bold + 'on port '.blue + '8000'.yellow);
util.puts('http server '.blue + 'started '.green.bold + 'on port '.blue + '9000 '.yellow);
