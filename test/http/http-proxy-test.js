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
 
var assert = require('assert'),
    util = require('util'),
    request = require('request'),
    vows = require('vows'),
    helpers = require('../helpers');

var forwardOptions = {
  forward: {
    port: 8300,
    host: 'localhost'
  }
};

var badForwardOptions = {
  forward: {
    port: 9000,
    host: 'localhost'
  }
};

var options = helpers.parseProtocol(),
    testName = [options.source.protocols.http, options.target.protocols.http].join('-to-'),
    runner = new helpers.TestRunner(options);

vows.describe('node-http-proxy/http-proxy/' + testName).addBatch({
  "When using server created by httpProxy.createServer()": {
    "with no latency" : {
      "and a valid target server": runner.assertProxied('localhost', 8080, 8081, false, false, function (callback) {
        runner.startProxyServer(8080, 8081, 'localhost', callback);
      }),
      "and without a valid target server": runner.assertResponseCode(8082, 500, function (callback) {
        runner.startProxyServer(8082, 9000, 'localhost', callback);
      })
    },
    "with latency": {
      "and a valid target server": runner.assertProxied('localhost', 8083, 8084, false, false, function (callback) {
        runner.startLatentProxyServer(8083, 8084, 'localhost', 1000, callback);
      }),
      "and without a valid target server": runner.assertResponseCode(8085, 500, function (callback) {
        runner.startLatentProxyServer(8085, 9000, 'localhost', 1000, callback);
      })
    },
    "with forwarding enabled": {
      topic: function () {
        runner.startTargetServer(8300, 'forward proxy', this.callback);
      },
      "with no latency" : {
        "and a valid target server": runner.assertProxied('localhost', 8120, 8121, false, false, function (callback) {
          runner.startProxyServerWithForwarding(8120, 8121, 'localhost', forwardOptions, callback);
        }),
        "and also a valid target server": runner.assertHeaders(8122, "x-forwarded-for", function (callback) {
          runner.startProxyServerWithForwarding(8122, 8123, 'localhost', forwardOptions, callback);
        }),
        "and without a valid forward server": runner.assertProxied('localhost', 8124, 8125, false, false, function (callback) {
          runner.startProxyServerWithForwarding(8124, 8125, 'localhost', badForwardOptions, callback);
        })
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
