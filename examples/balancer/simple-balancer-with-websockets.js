/*
  simple-balancer.js: Example of a simple round robin balancer for websockets

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

var http = require('http'),
    httpProxy = require('../../lib/http-proxy');

//
// A simple round-robin load balancing strategy.
// 
// First, list the servers you want to use in your rotation.
//
var addresses = [
  {
    host: 'ws1.0.0.0',
    port: 80
  },
  {
    host: 'ws2.0.0.0',
    port: 80
  }
];

//
// Create a HttpProxy object for each target
//

var proxies = addresses.map(function (target) {
  return new httpProxy.createProxyServer({
    target: target
  });
});

//
// Get the proxy at the front of the array, put it at the end and return it
// If you want a fancier balancer, put your code here
//

function nextProxy() {
  var proxy = proxies.shift();
  proxies.push(proxy);
  return proxy;
}

// 
// Get the 'next' proxy and send the http request 
//

var server = http.createServer(function (req, res) {    
  nextProxy().web(req, res);
});

// 
// Get the 'next' proxy and send the upgrade request 
//

server.on('upgrade', function (req, socket, head) {
  nextProxy().ws(req, socket, head);
});

server.listen(8001);
  