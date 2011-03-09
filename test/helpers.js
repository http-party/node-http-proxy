/*
 * helpers.js: Helpers for node-http-proxy tests.
 *
 * (C) 2010, Charlie Robbins
 *
 */

var http = require('http'),
    vows = require('vows'),
    assert = require('assert'),
    request = require('request'),
    httpProxy = require('./../lib/node-http-proxy');

exports.assertProxiedWithTarget = function (runner, host, proxyPort, port, createProxy) {
  var assertion = "should receive 'hello " + host + "'",
      output = 'hello ' + host;
  
  var test = {
    topic: function () {
      var that = this, options = {
        method: 'GET', 
        uri: 'http://localhost:' + proxyPort,
        headers: {
          host: host
        }
      };
      
      function startTest () {
        if (port) {
          return runner.startTargetServer(port, output, function () {
            request(options, that.callback);
          });
        }

        request(options, this.callback);
      }
      
      return createProxy ? createProxy(startTest) : startTest();
    }
  };
  
  test[assertion] = function (err, res, body) {;
    assert.isNull(err);
    assert.equal(body, output);
  };
  
  return test;
};

exports.assertProxiedWithNoTarget = function (runner, proxyPort, statusCode, createProxy) {
  var assertion = "should receive " + statusCode + " responseCode";
  
  var test = {
    topic: function () {
      var that = this, options = {
        method: 'GET', 
        uri: 'http://localhost:' + proxyPort,
        headers: {
          host: 'unknown.com'
        }
      };
      
      if (createProxy) {
        return createProxy(function () {
          request(options, that.callback);          
        });
      }
      
      request(options, this.callback);
    }
  };
  
  test[assertion] = function (err, res, body) {
    assert.isNull(err);
    assert.equal(res.statusCode, statusCode);
  };
  
  return test;
}

var TestRunner = exports.TestRunner = function () {
  this.testServers = [];
};

//
// Creates the reverse proxy server
//
TestRunner.prototype.startProxyServer = function (port, targetPort, host, callback) {
  var that = this, proxyServer = httpProxy.createServer(targetPort, host); 
  
  proxyServer.listen(port, function () {
    that.testServers.push(proxyServer);
    callback();
  });  
};

// 
// Creates the reverse proxy server with a specified latency
//
TestRunner.prototype.startLatentProxyServer = function (port, targetPort, host, latency, callback) {
  // Initialize the nodeProxy and start proxying the request
  var that = this, proxyServer = httpProxy.createServer(function (req, res, proxy) {
    var data = proxy.pause(req);
    
    setTimeout(function () {
      proxy.proxyRequest(req, res, targetPort, host, data);
    }, latency);
  });
  
  proxyServer.listen(port, function () {
    that.testServers.push(proxyServer);
    callback();
  });
};

//
// Creates the reverse proxy server with a ProxyTable
//
TestRunner.prototype.startProxyServerWithTable = function (port, options, callback) {
  var that = this, proxyServer = httpProxy.createServer(options); 
  proxyServer.listen(port, function () {
    that.testServers.push(proxyServer);
    callback();
  });
  
  return proxyServer;
};

//
// Creates a latent reverse proxy server using a ProxyTable
//
TestRunner.prototype.startProxyServerWithTableAndLatency = function (port, latency, options, callback) {
  // Initialize the nodeProxy and start proxying the request
  var proxyServer, that = this, proxy = new httpProxy.HttpProxy(options);
  proxyServer = http.createServer(function (req, res) {
    var paused = proxy.pause(req);
    setTimeout(function () {
      proxy.proxyRequest(req, res, paused);
    }, latency);
  });
  
  proxyServer.listen(port, function () {
    that.testServers.push(proxyServer);
    callback();
  });
  
  return proxyServer;
};

//
// Creates proxy server forwarding to the specified options
//
TestRunner.prototype.startProxyServerWithForwarding = function (port, targetPort, host, options, callback) {
  var that = this, proxyServer = httpProxy.createServer(targetPort, host, options); 
  proxyServer.listen(port, function () {
    that.testServers.push(proxyServer);
    callback();
  });
};

//
// Creates the 'hellonode' server
//
TestRunner.prototype.startTargetServer = function (port, output, callback) {
  var that = this, targetServer = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write(output);
  	res.end();
  });
  
  targetServer.listen(port, function () {
    that.testServers.push(targetServer);
    callback();
  });
};

//
// Close all of the testServers
//
TestRunner.prototype.closeServers = function () {
  this.testServers.forEach(function (server) {
    server.close();
  });

  return this.testServers;
};