var http = require('http'),
    httpProxy = require('../lib/http-proxy');

//
// Target Http Server
//
http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9000);
console.log("Web server listening on port 9000");

//
// Target Http Forwarding Server
//
http.createServer(function (req, res) {
  console.log('Receiving forward for: ' + req.url);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('request successfully forwarded to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9001);

//
// Basic Http Proxy Server
// Forward example: send requests without care about response
//
httpProxy.createServer({
  target: 'http://localhost:9000',
  forward: 'http://localhost:9001'
}).listen(8000)
console.log("Proxy server listening on port 8000");

