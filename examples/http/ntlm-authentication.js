var httpProxy = require('http-proxy');
var http = require('http');

class customAgent extends http.Agent {
    getName(options) {
        return options.headers.remotePort + ':' + super(options);
    }
}

var agent = new customAgent({
    maxSockets: 100,
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxFreeSockets: 10,
    timeout: 60000
});

var proxy = httpProxy.createProxy({ target: 'http://whatever.com', agent: agent });

//
// Modify headers of the response before it gets sent
// So that we handle the NLTM authentication response
//
proxy.on('proxyRes', function (proxyRes) {
    var key = 'www-authenticate';
    proxyRes.headers[key] = proxyRes.headers[key] && proxyRes.headers[key].split(',');
});

require('http').createServer(function (req, res) {
    req.headers = req.headers || {};
    req.headers.remotePort = req.socket.remotePort;
    proxy.web(req, res);
}).listen(3000);
