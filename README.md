<p align="center">
  <img src="https://raw.github.com/nodejitsu/node-http-proxy/master/doc/logo.png"/>
</p>

node-http-proxy
=======

`node-http-proxy` is an HTTP programmable proxying library that supports 
websockets. It is suitable for implementing components such as
proxies and load balancers.

### Build Status

<p align="center">
 <a href="https://travis-ci.org/nodejitsu/node-http-proxy" target="_blank">
 	<img src="https://travis-ci.org/nodejitsu/node-http-proxy.png"/></a>&nbsp;&nbsp;
 <a href="https://coveralls.io/r/nodejitsu/node-http-proxy" target="_blank">
 	<img src="https://coveralls.io/repos/nodejitsu/node-http-proxy/badge.png"/></a>
</p>

### Looking to Upgrade from 0.8.x ? Click [here](UPGRADING.md)

### Core Concept

A new proxy is created by calling `createProxyServer` and passing
an `options` object as argument ([valid properties are available here](lib/http-proxy.js#L34-L51)) 

```javascript
var httpProxy = require('http-proxy');

var proxy = httpProxy.createProxyServer(options);
```

An object will be returned with four values:

* web `req, res, [options]` (used for proxying regular HTTP(S) requests)
* ws `req, socket, head, [options]` (used for proxying WS(S) requests)
* listen `port` (a function that wraps the object in a webserver, for your convenience)

Is it then possible to proxy requests by calling these functions

```javascript
require('http').createServer(function(req, res) {
  proxy.web(req, res, { target: 'http://mytarget.com:8080' });
});
```

Errors can be listened on either using the Event Emitter API

```javascript
proxy.on('error', function(e) { 
  ...
});
```

or using the callback API

```javascript
proxy.web(req, res, { target: 'http://mytarget.com:8080' }, function(e) { ... });
```

When a request is proxied it follows two different pipelines ([available here](lib/http-proxy/passes))
which apply transformations to both the `req` and `res` object. 
The first pipeline (ingoing) is responsible for the creation and manipulation of the stream that connects your client to the target.
The second pipeline (outgoing) is responsible for the creation and manipulation of the stream that, from your target, returns data 
to the client.


#### Setup a basic stand-alone proxy server

```js
var http = require('http'),
    httpProxy = require('http-proxy');
//
// Create your proxy server and set the target in the options.
//
httpProxy.createProxyServer({target:'http://localhost:9000'}).listen(8000);

//
// Create your target server
//
http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('request successfully proxied!' + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9000);
```

#### Setup a stand-alone proxy server with custom server logic
This example show how you can proxy a request using your own HTTP server
and also you can put your own logic to handle the request.

```js
var http = require('http'),
    httpProxy = require('http-proxy');
    
//
// Create a proxy server with custom application logic
//
var proxy = httpProxy.createProxyServer({});

//
// Create your custom server and just call `proxy.web()` to proxy 
// a web request to the target passed in the options
// also you can use `proxy.ws()` to proxy a websockets request
//
var server = require('http').createServer(function(req, res) {
  // You can define here your custom logic to handle the request
  // and then proxy the request.
  proxy.web(req, res, { target: 'http://127.0.0.1:5060' });
});

console.log("listening on port 5050")
server.listen(5050);
```

#### Setup a stand-alone proxy server with latency

```js
var http = require('http'),
    httpProxy = require('http-proxy');

//
// Create a proxy server with latency
//
var proxy = httpProxy.createProxyServer();

//
// Create your server that make an operation that take a while
// and then proxy de request
//
http.createServer(function (req, res) {
  // This simulate an operation that take 500ms in execute
  setTimeout(function () {
    proxy.web(req, res, {
      target: 'http://localhost:9008'
    });
  }, 500);
}).listen(8008);

//
// Create your target server
//
http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9008);
```

#### Listening for proxy events

* `error`: The error event is emitted if the request to the target fail.
* `proxyRes`: This event is emitted if the request to the target got a response.

```js
var httpProxy = require('http-proxy');
// Error example
//
// Http Proxy Server with bad target
//
var proxy = httpProxy.createServer({
  target:'http://localhost:9005'
});

proxy.listen(8005);

//
// Listen for the `error` event on `proxy`.
proxy.on('error', function (err, req, res) {
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  });
  
  res.end('Something went wrong. And we are reporting a custom error message.');
});

//
// Listen for the `proxyRes` event on `proxy`.
//
proxy.on('proxyRes', function (res) {
  console.log('RAW Response from the target', JSON.stringify(res.headers, true, 2));
});

```

#### Using HTTPS
You can activate the validation of a secure SSL certificate to the target connection (avoid self signed certs), just set `secure: true` in the options.

##### HTTPS -> HTTP

```js
//
// Create the HTTPS proxy server in front of a HTTP server
//
httpProxy.createServer({
  target: {
    host: 'localhost',
    port: 9009
  },
  ssl: {
    key: fs.readFileSync('valid-ssl-key.pem', 'utf8'),
    cert: fs.readFileSync('valid-ssl-cert.pem', 'utf8')
  }
}).listen(8009);
```

##### HTTPS -> HTTPS

```js
//
// Create the proxy server listening on port 443
//
httpProxy.createServer({
  ssl: {
    key: fs.readFileSync('valid-ssl-key.pem', 'utf8'),
    cert: fs.readFileSync('valid-ssl-cert.pem', 'utf8')
  },
  target: 'https://localhost:9010',
  secure: true // Depends on your needs, could be false.
}).listen(443);
```

#### Proxying WebSockets
You can activate the websocket support for the proxy using `ws:true` in the options.

```js
//
// Create a proxy server for websockets
//
httpProxy.createServer({
  target: 'ws://localhost:9014',
  ws: true
}).listen(8014);
```

Also you can proxy the websocket requests just calling the `ws(req, socket, head)` method.

```js
//
// Setup our server to proxy standard HTTP requests
//
var proxy = new httpProxy.createProxyServer({
  target: {
    host: 'localhost',
    port: 9015
  }
});
var proxyServer = http.createServer(function (req, res) {
  proxy.web(req, res);
});

//
// Listen to the `upgrade` event and proxy the 
// WebSocket requests as well.
//
proxyServer.on('upgrade', function (req, socket, head) {
  proxy.ws(req, socket, head);
});

proxyServer.listen(8015);
```

### Contributing and Issues

* Search on Google/Github 
* If you can't find anything, open an issue 
* If you feel comfortable about fixing the issue, fork the repo
* Commit to your local branch (which must be different from `master`)
* Submit your Pull Request (be sure to include tests and update documentation)

### Options

`httpProxy.createProxyServer` supports the following options:

 *  **target**: url string to be parsed with the url module 
 *  **forward**: url string to be parsed with the url module
 *  **agent**: object to be passed to http(s).request (see Node's [https agent](http://nodejs.org/api/https.html#https_class_https_agent) and [http agent](http://nodejs.org/api/http.html#http_class_http_agent) objects)
 *  **secure**: true/false, if you want to verify the SSL Certs

If you are using the `proxyServer.listen` method, the following options are also applicable:

 *  **ssl**: object to be passed to https.createServer()
 *  **ws**: true/false, if you want to proxy websockets
 *  **xfwd**: true/false, adds x-forward headers
 *  **extraHeaders**: an object that will attach extra headers (e.g. CORS) onto responses

### Test

```
$ npm test
```

### Logo

Logo created by [Diego Pasquali](http://dribbble.com/diegopq)

### License

>The MIT License (MIT)
>
>Copyright (c) 2010 - 2013 Nodejitsu Inc.
>
>Permission is hereby granted, free of charge, to any person obtaining a copy
>of this software and associated documentation files (the "Software"), to deal
>in the Software without restriction, including without limitation the rights
>to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
>copies of the Software, and to permit persons to whom the Software is
>furnished to do so, subject to the following conditions:
>
>The above copyright notice and this permission notice shall be included in
>all copies or substantial portions of the Software.
>
>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
>IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
>FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
>AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
>LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
>OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
>THE SOFTWARE.


