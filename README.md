# node-http-proxy - v0.3.0

<img src = "http://i.imgur.com/dSSUX.png"/>

## Battle-hardened node.js http proxy

### Features

- reverse-proxies incoming http.Server requests
- can be used as a CommonJS module in node.js
- uses event buffering to support application latency in proxied requests
- minimal request overhead and latency
- fully-tested
- battled-hardened through production usage @ [nodejitsu.com][0]
- written entirely in javascript
- easy to use api

### When to use node-http-proxy

Let's suppose you were running multiple http application servers, but you only wanted to expose one machine to the internet. You could setup node-http-proxy on that one machine and then reverse-proxy the incoming http requests to locally running services which were not exposed to the outside network. 

### Installing npm (node package manager)
<pre>
  curl http://npmjs.org/install.sh | sh
</pre>

### Installing node-http-proxy
<pre>
  npm install http-proxy
</pre>

### How to setup a basic proxy server
<pre>
  var http = require('http'),
      httpProxy = require('http-proxy');

  httpProxy.createServer(9000, 'localhost').listen(8000);

  http.createServer(function (req, res){
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write('request successfully proxied!' + '\n' + JSON.stringify(req.headers, true, 2));
    res.end();
  }).listen(9000);
</pre>

See the [demo](http://github.com/nodejitsu/node-http-proxy/blob/master/demo.js) for further examples.

### How to setup a proxy server with custom server logic
<pre>
  var http = require('http'),
      httpProxy = require('http-proxy');

  // create a proxy server with custom application logic
  httpProxy.createServer(function (req, res, proxy) {
    // Put your custom server logic here
    proxy.proxyRequest(9000, 'localhost');
  }).listen(8000);

  http.createServer(function (req, res){
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write('request successfully proxied: ' + req.url +'\n' + JSON.stringify(req.headers, true, 2));
    res.end();
  }).listen(9000);
</pre>

### How to setup a proxy server with latency (e.g. IO, etc)
<pre>
  var http = require('http'),
      httpProxy = require('http-proxy');

  // create a proxy server with custom application logic
  httpProxy.createServer(function (req, res, proxy) {
    // Wait for two seconds then respond
    setTimeout(function () {
      proxy.proxyRequest(9000, 'localhost');      
    }, 2000);
  }).listen(8000);

  http.createServer(function (req, res){
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write('request successfully proxied: ' + req.url +'\n' + JSON.stringify(req.headers, true, 2));
    res.end();
  }).listen(9000);
</pre>

### How to proxy requests with a regular http server
<pre>
  var http = require('http'),
      httpProxy = require('http-proxy');

  // create a regular http server and proxy its handler
  http.createServer(function (req, res){
    // Create a new instance of HttProxy for this request
    // each instance is only valid for serving one request
    // 
    // Don't worry benchmarks show the object 
    // creation is lightning fast 
    var proxy = new httpProxy.HttpProxy(req, res);
    
    // Put your custom server logic here, then proxy
    proxy.proxyRequest(9000, 'localhost', req, res);
  }).listen(8001);

  http.createServer(function (req, res){
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write('request successfully proxied: ' + req.url +'\n' + JSON.stringify(req.headers, true, 2));
    res.end();
  }).listen(9000); 
</pre>

### Why doesn't node-http-proxy have more advanced features like x, y, or z?

If you have a suggestion for a feature currently not supported, feel free to open a [support issue](http://github.com/nodejitsu/node-http-proxy/issues). node-http-proxy is designed to just proxy http requests from one server to another, but we will be soon releasing many other complimentary projects that can be used in conjunction with node-http-proxy.

<br/>
### License

(The MIT License)

Copyright (c) 2010 Charlie Robbins, Mikeal Rogers, & Marak Squires

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

[0]: http://nodejitsu.com