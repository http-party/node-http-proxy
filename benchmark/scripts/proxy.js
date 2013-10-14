var http = require('http'),
    httpProxy = require('../../lib/node-http-proxy');
//
// Create your proxy server
//
httpProxy.createServer(9000, 'localhost').listen(8000);
