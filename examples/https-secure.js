var httpProxy = require('http-proxy'),
    https = require('https');
/*
 * Create your proxy server pointing to a secure domain
 * Enable ssl validation
 */
var options = {target : 'https://google.com',
			   agent  : https.globalAgent,
			   headers: {host: 'google.com'}
			   };

var proxyServer = httpProxy.createProxyServer(options);
console.log("Proxy server listening on port 8000");
proxyServer.listen(8000);

