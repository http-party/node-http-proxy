# node-http-proxy - v0.2.0

<img src = "http://i.imgur.com/dSSUX.png"/>

## Battle-hardened node.js http proxy

### Features

- reverse-proxies incoming http.Server requests
- can be used as a CommonJS module in node.js
- uses event buffering to support application latency in proxied requests
- minimal request overhead and latency
- fully-tested
- battled-hardened through production usage @ nodejitsu.com
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

see the [demo](http://github.com/nodejitsu/node-http-proxy/blob/master/demo.js) for further examples.

### How to setup a proxy server with custom server logic
<pre>
  var http = require('http'),
      httpProxy = require('http-proxy');

  // create a proxy server with custom application logic
  httpProxy.createServer(function (req, res, proxyRequest) {
    // Put your custom server logic here
    proxyRequest(9000, 'localhost');
  }).listen(8000);

  http.createServer(function (req, res){
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write('request successfully proxied: ' + req.url +'\n' + JSON.stringify(req.headers, true, 2));
    res.end();
  }).listen(9000);
  
</pre>

### How to proxy requests with latent operations (IO, etc.)

node-http-proxy supports event buffering, that means if an event (like 'data', or 'end') is raised by the incoming request before you have a chance to perform your custom server logic, those events will be captured and re-raised when you later proxy the request. Here's a simple example:

<pre>
  httpProxy.createServer(function (req, res, proxyRequest) {
    setTimeout(function () {
      proxyRequest(port, server);
    }, latency);
  }).listen(8081);
</pre>

### Why doesn't node-http-proxy have more advanced features like x, y, or z?

If you have a suggestion for a feature currently not supported, feel free to open a [support issue](http://github.com/nodejitsu/node-http-proxy/issues). node-http-proxy is designed to just proxy http requests from one server to another, but we will be soon releasing many other complimentary projects that can be used in conjunction with node-http-proxy.

<br/>
### License

(The MIT License)

Copyright (c) 2010 Mikeal Rogers, Charlie Robbins & Marak Squires

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
