var httpProxy = require('../lib/http-proxy');
/*
 * Create your proxy server pointing to a secure domain
 */
var options = { target:'https://google.com',
                headers: {host: 'google.com'}
              };

var proxyServer = httpProxy.createProxyServer(options);
console.log("Proxy server listening on port 8000");
proxyServer.listen(8000);

