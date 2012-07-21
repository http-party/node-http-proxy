/*
 * ws.js: Top level include for node-http-proxy websocket helpers
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENCE
 *
 */
 
var assert = require('assert'),
    async = require('async'),
    io = require('socket.io'),
    http = require('./http');

//
// ### function createServerPair (options, callback)
// #### @options {Object} Options to create target and proxy server.
// #### @callback {function} Continuation to respond to when complete.
//
// Creates http target and proxy servers 
//
exports.createServerPair = function (options, callback) {
  async.series([
    //
    // 1. Create the target server
    //
    function createTarget(next) {
      exports.createServer(options.target, next);
    },
    //
    // 2. Create the proxy server
    //
    function createTarget(next) {
      http.createProxyServer(options.proxy, next);
    }
  ], callback);
};

exports.createServer = function (options, callback) {
  var server = io.listen(options.port, callback);
  
  server.sockets.on('connection', function (socket) {
    socket.on('incoming', function (data) {
      assert.equal(data, options.input);
      socket.emit('outgoing', options.output);
    });
  });
};

