/*
  standalone-websocket-proxy.js: Example of proxying websockets over HTTP with a standalone HTTP server.

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

var util = require('util'),
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
  util.debug('Got websocket connection');

  client.on('message', function (msg) {
    util.debug('Got message from client: ' + msg);
  });

  socket.broadcast('from server');
});

//
// Setup our server to proxy standard HTTP requests
//
var proxy = new httpProxy.HttpProxy({
  target: {
    host: 'localhost', 
    port: 8080
  }
});
var proxyServer = http.createServer(function (req, res) {
  proxy.proxyRequest(req, res);
});

//
// Listen to the `upgrade` event and proxy the 
// WebSocket requests as well.
//
proxyServer.on('upgrade', function (req, socket, head) {
  var buffer = httpProxy.buffer(socket);
  
  setTimeout(function () {
    proxy.proxyWebSocketRequest(req, socket, head, buffer);
  }, 1000);
});

proxyServer.listen(8081);

//
// Setup the web socket against our proxy
//
var ws = new websocket.WebSocket('ws://localhost:8081/socket.io/websocket/', 'borf');

ws.on('open', function () {
  ws.send(utils.encode('from client'));
});

ws.on('message', function (msg) {
  util.debug('Got message: ' + utils.decode(msg));
});
