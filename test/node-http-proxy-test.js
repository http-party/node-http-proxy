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
    TestRunner = require('./helpers').TestRunner;
    
var runner = new TestRunner();

vows.describe('node-http-proxy').addBatch({
  "When using server created by httpProxy.createServer()": {
    "an incoming request to the helloNode server": {
      "with no latency" : {
        "and a valid target server": {
          topic: function () {
            this.output = 'hello world';
            var options = {
              method: 'GET', 
              uri: 'http://localhost:8080'
            };

            runner.startProxyServer(8080, 8081, 'localhost'),
            runner.startTargetServer(8081, this.output);

            
            request(options, this.callback);
          },
          "should received 'hello world'": function (err, res, body) {
            assert.equal(body, this.output);
          }
        },
        "and without a valid target server": {
          topic: function () {
            runner.startProxyServer(8082, 9000, 'localhost');
            var options = {
              method: 'GET', 
              uri: 'http://localhost:8082'
            };
            
            request(options, this.callback);
          },
          "should receive 500 response code": function (err, res, body) {
            assert.equal(res.statusCode, 500);
          }
        }
      },
      "with latency": {
        "and a valid target server": {
          topic: function () {
            this.output = 'hello world';
            var options = {
              method: 'GET', 
              uri: 'http://localhost:8083'
            };
            
            runner.startLatentProxyServer(8083, 8084, 'localhost', 1000),
            runner.startTargetServer(8084, this.output);
            
            
            request(options, this.callback);
          },
          "should receive 'hello world'": function (err, res, body) {
            assert.equal(body, this.output);
          }
        },
        "and without a valid target server": {
          topic: function () {
            runner.startLatentProxyServer(8085, 9000, 'localhost', 1000);
            var options = {
              method: 'GET', 
              uri: 'http://localhost:8085'
            };
            
            request(options, this.callback);
          },
          "should receive 500 response code": function (err, res, body) {
            assert.equal(res.statusCode, 500);
          }
        }
      }
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