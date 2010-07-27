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

#### usage 1:&nbsp;&nbsp;&nbsp;creating a stand-alone proxy server
 
#### usage 2:&nbsp;&nbsp;&nbsp;proxying existing http.Server requests

### Why doesn't node-http-proxy have more advanced features like x, y, or z?

if you have a suggestion for a feature currently not supported, feel free to open a [support issue](https://github.com/nodejitsu/node-http-proxy/issues). node-http-proxy is designed to just proxy https request from one server to another, but we will be soon releasing many other complimentary projects that can be used in conjunction with node-http-proxy