/*
 * forward-proxy-test.js: Tests for node-http-proxy forwarding functionality.
 *
 * (C) 2010, Charlie Robbins
 *
 */

var fs = require('fs'),
    vows = require('vows'),
    sys = require('sys'),
    path = require('path'),
    request = require('request'),
    assert = require('assert'),
    helpers = require('./helpers'),
    TestRunner = helpers.TestRunner;
    
var runner = new TestRunner(),
    assertProxiedWithTarget = helpers.assertProxiedWithTarget,
    assertProxiedWithNoTarget = helpers.assertProxiedWithNoTarget;

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

vows.describe('node-http-proxy').addBatch({
  "When using server created by httpProxy.createServer()": {
    "with forwarding enabled": {
      topic: function () {
        runner.startTargetServer(8300, 'forward proxy');
        return null;
      },
      "with no latency" : {
        "and a valid target server": assertProxiedWithTarget(runner, 'localhost', 8120, 8121, function () {
          runner.startProxyServerWithForwarding(8120, 8121, 'localhost', forwardOptions);
        }),
        "and without a valid forward server": assertProxiedWithTarget(runner, 'localhost', 8122, 8123, function () {
          runner.startProxyServerWithForwarding(8122, 8123, 'localhost', badForwardOptions);
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