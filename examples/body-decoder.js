#!/usr/local/bin/node

var httpProxy = require('http-proxy'),
    http = require('http'),
    util = require('util'),
    colors = require('colors');


exports.bodyMod = function () {
  console.log('middleware has been started.'.green);
  return function (req, res, next) {
    var proxy = next,
        total = '';

    req.on('data', function (data) {
      console.log('ON DATA')
      total += data;
    });
    req.on('end', function () {
      console.log('ON END')
      console.log(total);
      // This line, uncommented, hangs forever.
      // proxy.proxyRequest(req, res, { port: 9000, host: 'localhost' });
      // The following also hangs forever.
      // next.proxyRequest(req, res, { port: 9000, host: 'localhost' });
    })
    // The following fires just fine.
    //proxy.proxyRequest(req, res, { port: 9000, host: 'localhost' });
    console.log('request proxied...'.blue); 
  }
}

var proxyServer = httpProxy.createServer(
  // Your middleware stack goes here.  
  exports.bodyMod()
).listen(8000);


var httpServer = http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9000);