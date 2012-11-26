var httpProxy = require('../../lib/node-http-proxy');
//
// A simple round-robin load balancing strategy.
// 
// First, list the servers you want to use in your rotation.
//
var addresses = [
  {
    host: 'ws1.0.0.0',
    port: 80
  },
  {
    host: 'ws2.0.0.0',
    port: 80
  }
];

var proxies = addresses.map(function (target) {
  return new httpProxy.HttpProxy({
    target: target
  });
});

function nextProxy() {
  var proxy = proxies.shift();
  proxies.push(proxy);
  return proxy;
}

var server = http.createServer(function (req, res) {    
  nextProxy().proxyRequest(req, res);
});

server.on('upgrade', function(req, socket, head) {
  nextProxy().proxyWebSocketRequest(req, socket, head);
});

server.listen(8080);  
  