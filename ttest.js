'use strict'; /* jshint node:true */
var caronte = require('./'),
    http    = require('http'),
    ws      = require('ws');
  
/*var proxyTo = new ws.Server({ port: 9090 });

proxyTo.on('connection', function(ws) {
  console.log('connection!');
  ws.on('message', function(msg) {
    ws.send('ohai: ' + msg);
    setTimeout(function() {
      ws.send('HAHAHHA');
    }, 10000);
  });
  ws.send('derpity?');
});

var client = new ws('ws://127.0.0.1:8000');
client.on('open', function() {
  client.send('baaaka');
  console.log('sent: baaaaka');
  setTimeout(function() {
    client.send('cacca');
  }, 5000);
  client.on('message', function(msg) {
    console.log('server said: ' + msg);
  });
});
*/


caronte.createProxyServer({
    ws    : true,
  target: 'http://127.0.0.1:9090'
}).listen(8080);



var srv = http.createServer(function(req, res) {
  res.end('ciao proxy');
}).listen(9090);
/*
srv.on('upgrade', function(req, sock, head) {

  var options = {
    port: 9090,
    hostname: '127.0.0.1',
    headers: req.headers
  }
  var r = http.request(options);
   
  r.on('upgrade', function(res, proxySock, hd) {
    if (hd && hd.length) proxySock.unshift(hd);

    sock.write('HTTP/1.1 101 Switching Protocols\r\n');
    sock.write(Object.keys(res.headers).map(function(i) {
      return i + ": " + res.headers[i];
    }).join('\r\n') + '\r\n\r\n');
    proxySock.pipe(sock).pipe(proxySock);
  });

  r.end();
});

*/
