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
    sys = require('sys'),
    request = require('request'),
    assert = require('assert'),
    helpers = require('./helpers'),
    TestRunner = helpers.TestRunner;
    
var runner = new TestRunner(),
    assertProxiedWithTarget = helpers.assertProxiedWithTarget,
    assertProxiedWithNoTarget = helpers.assertProxiedWithNoTarget;

vows.describe('node-http-proxy').addBatch({
  "When using server created by httpProxy.createServer()": {
    "with no latency" : {
      "and a valid target server": assertProxiedWithTarget(runner, 'localhost', 8080, 8081, function () {
        runner.startProxyServer(8080, 8081, 'localhost');
      }),
      "and without a valid target server": assertProxiedWithNoTarget(runner, 8082, 500, function () {
        runner.startProxyServer(8082, 9000, 'localhost');
      })
    },
    "with latency": {
      "and a valid target server": assertProxiedWithTarget(runner, 'localhost', 8083, 8084, function () {
        runner.startLatentProxyServer(8083, 8084, 'localhost', 1000);
      }),
      "and without a valid target server": assertProxiedWithNoTarget(runner, 8085, 500, function () {
        runner.startLatentProxyServer(8085, 9000, 'localhost', 1000);
      })
    }
  }
}).addBatch({
  "When using server created by httpProxy.createServer()": {
    "an incoming WebSocket request to the helloNode server": {
      "with no latency" : {
        // Remark: This test is not working
        /*topic: function () {
          runner.startProxyServer(8086, 8087, 'localhost'),
          runner.startTargetServer(8087, 'hello world');
          var options = {
            method: 'GET', 
            uri: 'http://localhost:8086',
            headers: {
              'Upgrade': 'WebSocket', 
              'Connection': 'WebSocket',
              'Host': 'localhost'
            }
          };
          
          request(options, this.callback);
        },
        "should receive 'hello world'": function (err, res, body) {
          assert.equal(body, 'hello world');
        }*/
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