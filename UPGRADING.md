Looking to upgrade from `http-proxy@0.x.x` to `http-proxy@1.0`? You've come to the right place!
`http-proxy@1.0` is a from-scratch implementation of `http-proxy` and, as such
brings some breaking changes to APIs.

## Server creation

Available through `.createServer()` or `.createProxyServer()`.

```javascript
httpProxy.createServer({
  target:'http://localhost:9003'
}).listen(8003);
```

Check the [README.md](https://github.com/http-party/node-http-proxy/blob/caronte/README.md) for a more detailed explanation of the parameters.

## Proxying

Web proxying is done by calling the `.web()` method on a Proxy instance. You can check among some use cases in the [examples folder](https://github.com/http-party/node-http-proxy/tree/caronte/examples/http)

```javascript
//
// Create a HTTP Proxy server with a HTTPS target
//
httpProxy.createProxyServer({
  target: 'https://google.com',
  agent : https.globalAgent,
  headers: {
    host: 'google.com'
  }
}).listen(8011);

```

Websockets are proxied by the `.ws()` method. The [examples folder](https://github.com/http-party/node-http-proxy/tree/caronte/examples/websocket) again provides a lot of useful snippets!

```javascript
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
```

## Error Handling

It is possible to listen globally on the `error` event on the server. In alternative, a 
callback passed to `.web()` or `.ws()` as last parameter is also accepted.

```javascript
var proxy = httpProxy.createServer({
  target:'http://localhost:9005'
});

//
// Tell the proxy to listen on port 8000
//
proxy.listen(8005);

//
// Listen for the `error` event on `proxy`.
proxy.on('error', function (err, req, res) {
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  });
  
  res.end('Something went wrong. And we are reporting a custom error message.');
});
```

## Dropped

Since the API was rewritten to be extremely flexible we decided to drop some features 
which were in the core and delegate them to eventual "userland" modules.

- Middleware API
- ProxyTable API

### Middleware API

The new API makes it really easy to implement code that behaves like the old Middleware API. You can check some examples [here](https://github.com/http-party/node-http-proxy/tree/caronte/examples/middleware)

### ProxyTable API

See this [link](https://github.com/donasaur/http-proxy-rules/) for an add-on proxy rules module that you can use to simulate the old ProxyTable API.
