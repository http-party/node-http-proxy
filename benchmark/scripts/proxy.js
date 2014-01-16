var http = require('http'),
    httpProxy = require('../../');
//
// Create your proxy server
//
httpProxy.createProxyServer({ target: 'http://localhost:9000' }).listen(8000);