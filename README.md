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

     curl http://npmjs.org/install.sh | sh

### Installing node-http-proxy

     npm install http-proxy


### How to use node-http-proxy

      var sys = require('sys'),
          colors = require('colors')
          http = require('http'),
          httpProxy = require('./lib/node-http-proxy').httpProxy;

      http.createServer(function (req, res){
        var proxy = new httpProxy;
        proxy.init(req, res);
        sys.puts('proxying request to http://localhost:9000');
        proxy.proxyRequest('localhost', '9000', req, res);
      }).listen(8000);

      http.createServer(function (req, res){
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write('request successfully proxied!' + '\n' + JSON.stringify(req.headers, true, 2));
        res.end();
      }).listen(9000);

see the [demo](http://github.com/nodejitsu/node-http-proxy/blob/master/demo.js) for further examples.
### Why doesn't node-http-proxy have more advanced features like x, y, or z?

if you have a suggestion for a feature currently not supported, feel free to open a [support issue](http://github.com/nodejitsu/node-http-proxy/issues). node-http-proxy is designed to just proxy http request from one server to another, but we will be soon releasing many other complimentary projects that can be used in conjunction with node-http-proxy

<br/><br/><br/><br/><br/>
### License

(The MIT License)

Copyright (c) 2010 Charlie Robbins & Marak Squires

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.