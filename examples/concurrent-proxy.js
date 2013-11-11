var http = require('http'),
    httpProxy = require('../lib/http-proxy');

var connections = [],
    go;


//
// Target Http Server
//
// to check apparent problems with concurrent connections
// make a server which only responds when there is a given nubmer on connections
//
http.createServer(function (req, res) {
  connections.push(function () {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
    res.end();
  });
  
  process.stdout.write(connections.length + ', ');
  
  if (connections.length > 10 || go) {
    go = true;
    while (connections.length) {
      connections.shift()();
    }
  }
}).listen(9000);
console.log("Web server listening on port 9000");

//
// Basic Http Proxy Server
//
httpProxy.createProxyServer({target:'http://localhost:9000'}).listen(8000);
console.log("Proxy server listening on port 8000");