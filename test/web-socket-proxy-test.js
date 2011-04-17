/*
  node-http-proxy-test.js: http proxy for node.js

  Copyright (c) 2010 Charlie Robbins, Marak Squires and Fedor Indutny

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
 
var vows = require('vows'),
    util = require('util'),
    colors = require('colors'),
    request = require('request'),
    assert = require('assert'),
    websocket = require('./../vendor/websocket'),
    helpers = require('./helpers');

try {
  var utils = require('socket.io/lib/socket.io/utils'),
      io = require('socket.io');  
}
catch (ex) {
  console.error('Socket.io is required for this test:');
  console.error('npm ' + 'install'.green + ' socket.io'.magenta);
  process.exit(1);
}

var runner = new helpers.TestRunner();

vows.describe('node-http-proxy/websocket').addBatch({
  "When using server created by httpProxy.createServer()": {
    "with no latency" : {
      "when an inbound message is sent from a WebSocket client": {
        topic: function () {
          var that = this;
          
          runner.startTargetServer(8130, 'hello websocket', function (err, target) {
            var socket = io.listen(target);
            
            socket.on('connection', function (client) {
              client.on('message', function (msg) {
                that.callback(null, msg);
              });
            });
            
            runner.startProxyServer(8131, 8130, 'localhost', function (err, proxy) {
              //
              // Setup the web socket against our proxy
              //
              var ws = new websocket.WebSocket('ws://localhost:8131/socket.io/websocket/', 'borf');

              ws.on('open', function () {
                ws.send(utils.encode('from client'));
              });
            });
          })
        },
        "the target server should receive the message": function (err, msg) {
          assert.equal(msg, 'from client');
        } 
      },
      "when an outbound message is sent from the target server": {
        topic: function () {
          var that = this;
          
          runner.startTargetServer(8132, 'hello websocket', function (err, target) {
            var socket = io.listen(target);
            
            socket.on('connection', function (client) {
              socket.broadcast('from server');
            });
            
            runner.startProxyServer(8133, 8132, 'localhost', function (err, proxy) {
              //
              // Setup the web socket against our proxy
              //
              var ws = new websocket.WebSocket('ws://localhost:8133/socket.io/websocket/', 'borf');

              ws.on('message', function (msg) {
                msg = utils.decode(msg);
                if (!/\d+/.test(msg)) {
                  that.callback(null, msg);
                }
              });
            });
          })
        },
        "the client should receive the message": function (err, msg) {
          assert.equal(msg, 'from server');
        } 
      }
    }
  }
}).addBatch({
  "When the tests are over": {
    topic: function () {
      return runner.closeServers();
    },
    "the servers should clean up": function () {
      assert.isTrue(true);
    }
  }
}).export(module);