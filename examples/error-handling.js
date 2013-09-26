var httpProxy = require('../index');
/*
 * Create your proxy server
 */
var proxyServer = httpProxy.createProxyServer({target:'http://localhost:30404', ws:true});

// Register an error handler for web requests
proxyServer.ee.on("http-proxy:outgoing:web:error", function(err, req, res){
	res.writeHead(502);
	res.end("There was an error proxying your request");
});

// Register an error handler for web-socket requests
proxyServer.ee.on("http-proxy:outgoing:ws:error", function(err, req, socket, head){
	socket.close();
});

// You may also use a wild card 
proxyServer.ee.on("*:*:*:error", function(err, req){
	console.log("The error event '" + this.event + "' happened errno: " + err.errno);
});


console.log("Proxy server is listening on port 8000");
proxyServer.listen(8000);

