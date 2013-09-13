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

srv.on('upgrade', function(req, socket, head) {
  var options = {
    port: 9090,
    hostname: '127.0.0.1',
    headers: req.headers
  }
  var req = http.request(options);
  req.end();
  socket.on('data', function(d) {
    console.log('yoo');
    console.log(d);
  });
  var s;
  req.on('socket', function(ss) {
    s = ss;
  });
  req.on('upgrade', function(res, sock, hd) {
    /*console.log(hd.toString('utf-8'));
    var str = Object.keys(res.headers).map(function(i) {
      return i + ": " + res.headers[i];
    }).join('\r\n');
    socket.write("HTTP/1.1 101 Switching Protocols\r\n" + str);

    socket.write(hd);
    socket.pipe(sock).pipe(socket);*/
  });
});
