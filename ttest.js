var caronte = require('./'),
    http    = require('http'),
    ws      = require('ws');
  
var proxyTo = new ws.Server({ port: 9090 });

proxyTo.on('connection', function(ws) {
  console.log('connection!');
  ws.on('message', function(msg) {
    console.log('received: ' + msg);
  });
  ws.send('derpity?');
});

/*caronte.createProxyServer({
  ws    : true,
  target: 'http://127.0.0.1:9090'
}).listen(8000);*/


var client = new ws('ws://127.0.0.1:8000');
client.on('open', function() {
  client.send('baaaka');
  console.log('sent: baaaaka');
});


var srv = http.createServer(function(req, res) {
  res.end('1');
}).listen(8000);

srv.on('connection', function(s) {
  s.pipe(process.stdout);
});

srv.on('upgrade', function(req, socket, head) {

  var options = {
    port: 9090,
    hostname: '127.0.0.1',
    headers: req.headers
  }
  var r = http.request(options);
   
  r.on('upgrade', function(res, sock, hd) {
    if (hd && hd.length) sock.unshift(hd);


    socket.pipe(sock).pipe(socket);
  });

  r.end();
});
