var http = require('http');
var caronte = require('./');
var Primus = require('primus');

var server = http.createServer(function (req, res) {
  res.writeHead(500);
  res.end('Not Implemented\n');
});

var primus = new Primus(server, { transformer: 'engine.io' });
var Socket = primus.Socket;

primus.on('error', function (err) {
  console.log('Primus ' + err);
});

primus.on('connection', function (spark) {
  spark.write({ from: 'server', to: 'client' });

  spark.on('data', function (data) {
    console.dir(data);
  });
});

primus.on('disconnection', function (spark) {
  console.log('disconnected');
});

server.listen(9000);

var proxy = caronte.createProxyServer({
  ws: true,
  target: 'http://localhost:9000'
});

var srv = proxy.listen(3000);

var socket = new Socket('http://localhost:3000');

socket.on('reconnecting', function () {
  console.log('reconnecting');
});

socket.on('open', function () {
  socket.write({ from: 'client', to: 'server' })
});

socket.on('data', function (data) {
  console.dir(data);
});
