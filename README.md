<p align="center">
  <img src="doc/logo.png?raw=true"/>
</p>

node-http-proxy
=======

`node-http-proxy` is an HTTP programmable proxying library that supports 
websockets. It is suitable for implementing components such as
proxies and load balancers.

### Build Status

<p align="center">
 <a href="https://travis-ci.org/nodejitsu/node-http-proxy" target="_blank">
 	<img src="https://travis-ci.org/nodejitsu/node-http-proxy.png?branch=caronte"/></a>&nbsp;&nbsp;
 <a href="https://coveralls.io/r/nodejitsu/node-http-proxy" target="_blank">
 	<img src="https://coveralls.io/repos/nodejitsu/node-http-proxy/badge.png?branch=caronte"/></a>
</p>

### Core Concept

A new proxy is created by calling `createProxyServer` and passing
an `options` object as argument ([valid properties are available here](tree/master/lib/http-proxy.js#L26-L39)) 

```javascript
var httpProxy = require('http-proxy');

var proxy = httpProxy.createProxyServer(options);
```

An object will be returned with four values:

* web `req, res, [options]` (used for proxying regular HTTP(S) requests)
* ws `req, socket, head, [options]` (used for proxying WS(S) requests)
* ee (an EventEmitter2 that emits events, you can hook into them to customize behaviour)
* listen `port` (a function that wraps the object in a webserver, for your convenience)

Is it then possible to proxy requests by calling these functions

```javascript
require('http').createServer(function(req, res) {
  proxy.web(req, res, { target: 'http://mytarget.com:8080' });
});
```

When a request is proxied it follows two different pipelines ([available here](tree/master/lib/http-proxy/passes))
which apply transformations to both the `req` and `res` object. 
The first pipeline (ingoing) is responsible for the creation and manipulation of the stream that connects your client to the target.
The second pipeline (outgoing) is responsible for the creation and manipulation of the stream that, from your target, returns data 
to the client.

You can easily add a `pass` (stages) into both the pipelines (XXX: ADD API).

In addition, every stage emits a corresponding event so introspection during the process is always available.

#### Setup a basic stand-alone proxy server

```js
var http = require('http'),
    httpProxy = require('http-proxy');
//
// Create your proxy server
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

``` js
var http = require('http'),
    httpProxy = require('http-proxy');
    
//
// Create a proxy server with custom application logic
//
var proxy = httpProxy.createProxyServer({});

var server = require('http').createServer(function(req, res) {
  proxy.web(req, res, { target: 'http://127.0.0.1:5060' });
});

console.log("listening on port 5050")
server.listen(5050);
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

If you are using the `proxyServer.listen` method, the following options are also applicable:

 *  **ssl**: object to be passed to https.createServer()
 *  **ws**: true/false, if you want to proxy websockets
 *  **xfwd**: true/false, adds x-forward headers


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


