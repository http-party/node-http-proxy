/*
 * proxy-table-test.js: Tests for the ProxyTable object.
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
    routeFile = path.join(__dirname, 'config.json'),
    assertProxiedWithTarget = helpers.assertProxiedWithTarget,
    assertProxiedWithNoTarget = helpers.assertProxiedWithNoTarget;

var fileOptions = {
  router: {
    "foo.com": "127.0.0.1:8101",
    "bar.com": "127.0.0.1:8102"
  }
};

var defaultOptions = {
  router: {
    "foo.com": "127.0.0.1:8091",
    "bar.com": "127.0.0.1:8092"
  }
};

vows.describe('node-http-proxy/proxy-table').addBatch({
  "When using server created by httpProxy.createServer()": {
    "when passed a routing table": {
      topic: function () {
        this.server = runner.startProxyServerWithTable(8090, defaultOptions);
        return null;
      },
      "an incoming request to foo.com": assertProxiedWithTarget(runner, 'foo.com', 8090, 8091),
      "an incoming request to bar.com": assertProxiedWithTarget(runner, 'bar.com', 8090, 8092),
      "an incoming request to unknown.com": assertProxiedWithNoTarget(runner, 8090, 404)
    },
    "when passed a routing file": {
      topic: function () {
        fs.writeFileSync(routeFile, JSON.stringify(fileOptions));
        this.server = runner.startProxyServerWithTable(8100, {
          router: routeFile
        });
        
        return null;
      },
      "an incoming request to foo.com": assertProxiedWithTarget(runner, 'foo.com', 8100, 8101),
      "an incoming request to bar.com": assertProxiedWithTarget(runner, 'bar.com', 8100, 8102),
      "an incoming request to unknown.com": assertProxiedWithNoTarget(runner, 8100, 404),
      "an incoming request to dynamic.com": {
        "after the file has been modified": {
          topic: function () {
            var that = this,
                data = fs.readFileSync(routeFile),
                config = JSON.parse(data);

            this.output = 'hello dynamic.com';
            config.router['dynamic.com'] = "127.0.0.1:8103"
            fs.writeFileSync(routeFile, JSON.stringify(config));
            
            this.server.on('updateRoutes', function () {
              var options = {
                method: 'GET', 
                uri: 'http://localhost:8100',
                headers: {
                  host: 'dynamic.com'
                }
              };

              runner.startTargetServer(8103, that.output);
              request(options, that.callback);
            });
          },
          "should receive 'hello dynamic.com'": function (err, res, body) {
            assert.equal(body, this.output);
          }
        }
      }
    }
  }
}).addBatch({
  "When using an instance of ProxyTable combined with HttpProxy directly": {
    topic: function () {
      this.server = runner.startProxyServerWithTableAndLatency(8110, 100, {
        'foo.com': 'localhost:8111',
        'bar.com': 'localhost:8112'
      });
      return null;
    },
    "an incoming request to foo.com": assertProxiedWithTarget(runner, 'foo.com', 8110, 8111),
    "an incoming request to bar.com": assertProxiedWithTarget(runner, 'bar.com', 8110, 8112),
    "an incoming request to unknown.com": assertProxiedWithNoTarget(runner, 8110, 404)
  }
}).addBatch({
  "When the tests are over": {
    topic: function () {
      fs.unlinkSync(routeFile);
      return runner.closeServers();
    },
    "the servers should clean up": function () {
      assert.isTrue(true);
    }
  }
}).export(module);