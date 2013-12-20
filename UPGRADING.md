`caronte` is a from-scratch implementation of `http-proxy` and, as such
brings some breaking changes to APIs.

## Server creation

Available through `.createServer()` or `.createProxyServer()`.
Check the README.md for a more detailed explanation of the parameters.

## Proxying

Web proying is done by calling the `.web()` method on a Proxy instance. Websockets
are proxied by the `.ws()` method.

## Error Handling

It is possible to listen globally on the `error` event on the server. In alternative, a 
callback passed to `.web()` or `.ws()` as last parameter is also accepted.

## Dropped

Since the API was rewritten to be extremely flexible we decided to drop some features 
which were in the core and delegate them to eventual "user-land" modules.

- Middleware API
- ProxyTable API

