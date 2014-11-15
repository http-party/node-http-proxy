var util = require('util'),
  colors = require('colors'),
  http = require('http'),
  httpProxy = require('../../lib/http-proxy');


//
// Basic Http Proxy Server
//

var proxy = httpProxy.createProxyServer();
http.createServer(function(req, res) {
  proxy.web(req, res, {
    target: 'http://localhost:9003'
  })
}).listen(8003);
proxy.on('proxyRes', function(proxyRes, req, res, done) {
  //check for redirects and follow them
  if (proxyRes.statusCode <= 399 && proxyRes.statusCode >= 300 && proxyRes.headers.location) {
    proxy.web(req, res, {
      target: proxyRes.headers.location
    });
    done();
  }
});
//
// Target Http Server
//
http.createServer(function(req, res) {
  res.writeHead(302, {
    'Location': 'http://localhost:9004'
  });
  res.end();
}).listen(9003);

http.createServer(function(req, res) {
  res.write('request successfully redirected to localhost:9004: ' + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9004);