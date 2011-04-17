/*
 * helpers.js: Helpers for node-http-proxy tests.
 *
 * (C) 2010, Charlie Robbins
 *
 */

var fs = require('fs'),
    http = require('http'),
    https = require('https'),
    path = require('path'),
    vows = require('vows'),
    assert = require('assert'),
    request = require('request'),
    httpProxy = require('./../lib/node-http-proxy');

function merge (target) {
  var objs = Array.prototype.slice.call(arguments, 1);
  objs.forEach(function(o) {
    Object.keys(o).forEach(function (attr) {
      if (! o.__lookupGetter__(attr)) {
        target[attr] = o[attr];
      }
    });
  });
  return target;
}

var loadHttps = exports.loadHttps = function () {
  return {
    key: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-key.pem'), 'utf8'),
    cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-cert.pem'), 'utf8')
  };
};

var TestRunner = exports.TestRunner = function (protocol) {
  this.options     = {};
  this.protocol    = protocol;
  this.testServers = [];
  
  if (protocol === 'https') {
    this.options.https = loadHttps();
  }
};

TestRunner.prototype.assertProxied = function (host, proxyPort, port, createProxy) {
  var self = this,
      assertion = "should receive 'hello " + host + "'",
      output = 'hello ' + host;
  
  var test = {
    topic: function () {
      var that = this, options = {
        method: 'GET', 
        uri: self.protocol + '://localhost:' + proxyPort,
        headers: {
          host: host
        }
      };
      
      function startTest () {
        if (port) {
          return self.startTargetServer(port, output, function () {
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

TestRunner.prototype.assertResponseCode = function (proxyPort, statusCode, createProxy) {
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
};

//
// Creates the reverse proxy server
//
TestRunner.prototype.startProxyServer = function (port, targetPort, host, callback) {
  var that = this, proxyServer = httpProxy.createServer(targetPort, host); 
  
  proxyServer.listen(port, function () {
    that.testServers.push(proxyServer);
    callback(null, proxyServer);
  });  
};

// 
// Creates the reverse proxy server with a specified latency
//
TestRunner.prototype.startLatentProxyServer = function (port, targetPort, host, latency, callback) {
  // Initialize the nodeProxy and start proxying the request
  var that = this, proxyServer = httpProxy.createServer(function (req, res, proxy) {
    var buffer = proxy.buffer(req);
    
    setTimeout(function () {
      proxy.proxyRequest(req, res, {
        port: targetPort, 
        host: host, 
        buffer: buffer
      });
    }, latency);
  }, this.options);

  proxyServer.listen(port, function () {
    that.testServers.push(proxyServer);
    callback();
  });
};

//
// Creates the reverse proxy server with a ProxyTable
//
TestRunner.prototype.startProxyServerWithTable = function (port, options, callback) {
  var that = this, proxyServer = httpProxy.createServer(merge({}, options, this.options)); 
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
  var proxyServer, that = this, proxy = new httpProxy.HttpProxy(merge({}, options, this.options));
  proxyServer = http.createServer(function (req, res) {
    var buffer = proxy.buffer(req);
    setTimeout(function () {
      proxy.proxyRequest(req, res, {
        buffer: buffer
      });
    }, latency);
  }, this.options);
  
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
  var that = this, proxyServer = httpProxy.createServer(targetPort, host, merge({}, options, this.options)); 
  proxyServer.listen(port, function () {
    that.testServers.push(proxyServer);
    callback(null, proxyServer);
  });
};

//
// Creates the 'hellonode' server
//
TestRunner.prototype.startTargetServer = function (port, output, callback) {
  var that = this, targetServer, handler = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write(output);
  	res.end();
  };
  
  targetServer = this.options.https 
    ? https.createServer(this.options.https, handler)
    : http.createServer(handler);
  
  targetServer.listen(port, function () {
    that.testServers.push(targetServer);
    callback(null, targetServer);
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