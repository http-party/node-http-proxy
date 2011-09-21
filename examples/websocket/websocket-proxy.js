/*
  web-socket-proxy.js: Example of proxying over HTTP and WebSockets.

  Copyright (c) 2010 Charlie Robbins, Mikeal Rogers, Fedor Indutny, & Marak Squires.

  Permission is hereby granted, free of charge, to any person obtaining
  a copy of this software and associated documentation files (the
  "Software"), to deal in the Software without restriction, including
  without limitation the rights to use, copy, modify, merge, publish,
  distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so, subject to
  the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
  LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
  WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

var sys = require('sys'),
    http = require('http'),
    colors = require('colors'),
    websocket = require('../../vendor/websocket'),
    httpProxy = require('../../lib/node-http-proxy');

try {
  var utils = require('socket.io/lib/socket.io/utils'),
      io = require('socket.io');
}
catch (ex) {
  console.error('Socket.io is required for this example:');
  console.error('npm ' + 'install'.green + ' socket.io@0.6.18'.magenta);
  process.exit(1);
}

//
// Create the target HTTP server
//
var server = http.createServer(function (req, res) {
  res.writeHead(200);
  res.end();
});

server.listen(8080);

//
// Setup socket.io on the target HTTP server
//
var socket = io.listen(server);
socket.on('connection', function (client) {
  sys.debug('Got websocket connection');

  client.on('message', function (msg) {
    sys.debug('Got message from client: ' + msg);
  });

  socket.broadcast('from server');
});

//
// Create a proxy server with node-http-proxy
//
var proxy = httpProxy.createServer(8080, 'localhost');
proxy.listen(8081);

//
// Setup the web socket against our proxy
//
var ws = new websocket.WebSocket('ws://localhost:8081/socket.io/websocket/', 'borf');

ws.on('open', function () {
  ws.send(utils.encode('from client'));
});

ws.on('message', function (msg) {
  sys.debug('Got message: ' + utils.decode(msg));
});
