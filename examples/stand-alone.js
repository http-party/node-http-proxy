var http = require('http'),
    httpProxy = require('http-proxy');
//
// Create your proxy server
//
console.log("Proxy server listening on port 8000");
httpProxy.createProxyServer({target:'http://localhost:9000'}).listen(8000);

//
// Create your target server
//
console.log("Web server listening on port 9000");
http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('request successfully proxied!' + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9000);