/*
 * ws.js: Macros for proxying Websocket requests
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENCE
 *
 */
 
var assert = require('assert'),
    io = require('socket.io-client'),
    helpers = require('../helpers/index');

//
// ### function assertProxied (options)
// #### @options {Object} Options for this test
// ####    @latency {number} Latency in milliseconds for the proxy server.
// ####    @ports   {Object} Ports for the request (target, proxy).
// ####    @input   {string} Input to assert sent to the target ws server.  
// ####    @output  {string} Output to assert from the taget ws server.  
//
// Creates a complete end-to-end test for requesting against an
// http proxy.
//
exports.assertProxied = function (options) {
  options = options || {};
  
  var ports  = options.ports  || helpers.nextPortPair,
      input  = options.input  || 'hello world to ' + ports.target,
      output = options.output || 'hello world from ' + ports.target;
    
  return {
    topic: function () {
      helpers.ws.createServerPair({
        target: {
          input: input,
          output: output,
          port: ports.target
        },
        proxy: {
          latency: options.latency,
          port: ports.proxy,
          proxy: {
            target: {
              host: 'localhost',
              port: ports.target
            }
          }
        }
      }, this.callback);
    },
    "the proxy WebSocket": {
      topic: function () {
        var socket = io.connect('http://localhost:' + ports.proxy);
        socket.on('outgoing', this.callback.bind(this, null));
        socket.emit('incoming', input);
      },
      "should send input and receive output": function (_, data) {
        assert.equal(data, output);
      }
    }
  };
};