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

### When to use node-http-proxy

Let's suppose you were running multiple http application servers, but you only wanted to expose one machine to the internet. You could setup node-http-proxy on that one machine and then reverse-proxy the incoming http requests to locally running services which were not exposed to the outside network. 

### Installing node-http-proxy

<pre>
  npm install http-proxy
</pre>

### How to use node-http-proxy
