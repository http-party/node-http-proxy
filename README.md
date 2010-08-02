# node-http-proxy - v0.1.0

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

### How to use node-http-proxy
<pre>
  var http = require('http'),
      httpProxy = require('http-proxy');

  httpProxy.createServer('localhost', '9000').listen(8000);

  http.createServer(function (req, res){
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write('request successfully proxied!' + '\n' + JSON.stringify(req.headers, true, 2));
    res.end();
  }).listen(9000);
</pre>

see the [demo](http://github.com/nodejitsu/node-http-proxy/blob/master/demo.js) for further examples.

### How to use node-http-proxy with custom server logic
<pre>
  var http = require('http'),
      httpProxy = require('http-proxy');

  httpProxy.createServer(function (req, res, proxy) {
    //
    // Put your custom server logic here
    //
    proxy.proxyRequest('localhost', '9000', req, res);
  }).listen(8000);

  http.createServer(function (req, res){
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write('request successfully proxied!' + '\n' + JSON.stringify(req.headers, true, 2));
    res.end();
  }).listen(9000);
</pre>

### Why doesn't node-http-proxy have more advanced features like x, y, or z?

If you have a suggestion for a feature currently not supported, feel free to open a [support issue](http://github.com/nodejitsu/node-http-proxy/issues). node-http-proxy is designed to just proxy http requests from one server to another, but we will be soon releasing many other complimentary projects that can be used in conjunction with node-http-proxy.

<br/><br/><br/><br/><br/>

### License

(The MIT License)

Copyright (c) 2010 Charlie Robbins & Marak Squires http://github.com/nodejitsu/

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
