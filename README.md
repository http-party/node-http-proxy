# node-http-proxy - v0.1.0

## Battle-hardened node.js http reverse proxy

### Features

- reverse-proxies incoming http.Server requests
- can be used as a CommonJS module in node.js
- can handled malformed http requests
- uses event buffering to support application latency in proxied requests
- minimal request overhead and latency
- fully-tested
- battled-hardened through production usage @ nodejitsu.com
- written entirely in javascript
- easy to use api

### Todo
- add ability to black list ip addresses

### When to use node-http-proxy

Let's suppose you were running multiple http application servers, but you only wanted to expose one machine to the internet. You could setup node-http-proxy on that one machine and then reverse-proxy the incoming http requests to locally running services which were not exposed to the outside network. 

### Installing node-http-proxy

     npm install http-proxy

### How to use node-http-proxy

#### &nbsp;&nbsp;&nbsp;proxying requests using http.Server

      var sys = require('sys'),
          colors = require('colors')
          http = require('http');

      var httpProxy = require('./lib/node-http-proxy').httpProxy;

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

if you have a suggestion for a feature currently not supported, feel free to open a [support issue](https://github.com/nodejitsu/node-http-proxy/issues). node-http-proxy is designed to just proxy https request from one server to another, but we will be soon releasing many other complimentary projects that can be used in conjunction with node-http-proxy