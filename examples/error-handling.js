var httpProxy = require('../lib/http-proxy'),
    http = require('http');
/*
 * Create your proxy server
 */
var proxy = httpProxy.createProxyServer({target:'http://localhost:30404', ws:true});

var proxyServer = http.createServer(requestHandler);

function requestHandler(req, res) {
  // Pass a callback to the web proxy method
  // and catch the error there.
  proxy.web(req, res, function (err) {
    // Now you can get the err
    // and handle it by your self
    // if (err) throw err;
    res.writeHead(502);
    res.end("There was an error proxying your request");
  });

  // In a websocket request case
  req.on('upgrade', function (req, socket, head) {
    proxy.ws(req, socket, head, function (err) {
      // Now you can get the err
      // and handle it by your self
      // if (err) throw err;
      socket.close();
    })
  })
}

console.log("Proxy server is listening on port 8000");
proxyServer.listen(8000)