
var balancingProxy = require('./../lib/balancing-proxy');

var server = balancingProxy.createServer();

server.listen(8080);