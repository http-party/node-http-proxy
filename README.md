# node-http-proxy - v0.1.0

## battle-hardened node.js http reverse proxy



###features

- reverse-proxies incoming http.Server requests
- can be used as a CommonJS module in node.js
- can handled malformed http requests
- uses event buffering to support application latency in proxied requests
- minimal request overhead and latency
- fully-tested
- battled-hardened through production usage @ nodejitsu.com
- written entirely in javascript
- easy to use api

###when to use node-http-proxy

let's suppose you were running multiple http application servers, but you only wanted to expose one machine to the internet. you could setup node-http-proxy on that one machine and then reverse-proxy the incoming http requests to locally running services which were not exposed to the outside network. 

### how to use node-http-proxy
