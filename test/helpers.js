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
      var options = {
        method: 'GET', 
        uri: 'http://localhost:' + proxyPort,
        headers: {
          host: host
        }
      };
      
      if (createProxy) createProxy();
      if (port) runner.startTargetServer(port, output);
      request(options, this.callback);
    }
  };
  
  test[assertion] = function (err, res, body) {
    assert.equal(body, output);
  };
  
  return test;
};

exports.assertProxiedWithNoTarget = function (runner, proxyPort, statusCode, createProxy) {
  var assertion = "should receive " + statusCode + " responseCode";
  
  var test = {
    topic: function () {
      var options = {
        method: 'GET', 
        uri: 'http://localhost:' + proxyPort,
        headers: {
          host: 'unknown.com'
        }
      };
      
      if (createProxy) createProxy();
      request(options, this.callback);
    }
  };
  
  test[assertion] = function (err, res, body) {
    assert.equal(res.statusCode, statusCode);
  };
  
  return test;
}

var TestRunner = exports.TestRunner = function () {
  this.testServers = [];
}

//
// Creates the reverse proxy server
//
TestRunner.prototype.startProxyServer = function (port, targetPort, host) {
  var proxyServer = httpProxy.createServer(targetPort, host); 
  proxyServer.listen(port);
  this.testServers.push(proxyServer);
  return proxyServer;
};

// 
// Creates the reverse proxy server with a specified latency
//
TestRunner.prototype.startLatentProxyServer = function (port, targetPort, host, latency) {
  // Initialize the nodeProxy and start proxying the request
  var proxyServer = httpProxy.createServer(function (req, res, proxy) {
    setTimeout(function () {
      proxy.proxyRequest(targetPort, host);
    }, latency);
  });
  
  proxyServer.listen(port);
  this.testServers.push(proxyServer);
  return proxyServer;
};

//
// Creates the reverse proxy server with a ProxyTable
//
TestRunner.prototype.startProxyServerWithTable = function (port, options) {
  var proxyServer = httpProxy.createServer(options); 
  proxyServer.listen(port);
  this.testServers.push(proxyServer);
  return proxyServer;
};

//
// Creates a latent reverse proxy server using a ProxyTable
//
TestRunner.prototype.startProxyServerWithTableAndLatency = function (port, latency, router) {
  // Initialize the nodeProxy and start proxying the request
  var proxyTable = new httpProxy.ProxyTable(router);
  var proxyServer = http.createServer(function (req, res) {
    var proxy = new httpProxy.HttpProxy(req, res);
    setTimeout(function () {
      proxyTable.proxyRequest(proxy);
    }, latency);
  });
  
  proxyServer.on('close', function () {
    proxyTable.close();
  });
  
  proxyServer.listen(port);
  this.testServers.push(proxyServer);
  return proxyServer;
};

//
// Creates proxy server forwarding to the specified options
//
TestRunner.prototype.startProxyServerWithForwarding = function (port, targetPort, host, options) {
  var proxyServer = httpProxy.createServer(targetPort, host, options); 
  proxyServer.listen(port);
  this.testServers.push(proxyServer);
  return proxyServer;
};

//
// Creates the 'hellonode' server
//
TestRunner.prototype.startTargetServer = function (port, output) {
  var targetServer = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write(output)
  	res.end();
  });
  
  targetServer.listen(port);
  this.testServers.push(targetServer);
  return targetServer;
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