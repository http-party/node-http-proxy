var   http = require('http')
    , https = require('https')
    , caronte = require('caronte')
    ;
//
// Create your proxy server
//
var options = {target:'https://google.com',
               agent: new https.Agent({rejectUnauthorized:false}),
               };

var proxyServer = caronte.createProxyServer(options);

proxyServer.ee.on('*:error', function(err, req, res){
	res.end('There was an error proxying your request');
});

console.log("Proxy server listening on port 8000");
proxyServer.listen(8000);


//
// Create your proxy server
//
var options2 = {target:'https://google.com',
               headers: {'host':'google.com'},
               };

var proxyServer2 = caronte.createProxyServer(options2);

proxyServer2.ee.on('*:error', function(err, req, res){
  res.end('There was an error proxying your request');
});

console.log("Proxy server 2 listening on port 8001");
proxyServer2.listen(8001);

//
// Create your proxy server
//
var options3 = {target:'https://google.com'};

var proxyServer3 = caronte.createProxyServer(options3);

proxyServer3.ee.on('*:error', function(err, req, res){
  res.end('There was an error proxying your request');
});

console.log("Proxy server 3 listening on port 8002");
proxyServer3.listen(8002);




