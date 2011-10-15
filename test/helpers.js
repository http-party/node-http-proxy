/*
 * helpers.js: Helpers for node-http-proxy tests.
 *
 * (C) 2010, Charlie Robbins
 *
 */

var assert = require('assert'),
    fs = require('fs'),
    http = require('http'),
    https = require('https'),
    path = require('path'),
    argv = require('optimist').argv,
    request = require('request'),
    vows = require('vows'),
    websocket = require('../vendor/websocket'),
    httpProxy = require('../lib/node-http-proxy');

var loadHttps = exports.loadHttps = function () {
  return {
    key: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-key.pem'), 'utf8'),
    cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-cert.pem'), 'utf8')
  };
};

var parseProtocol = exports.parseProtocol = function () {  
  function setupProtocol (secure) {
    return {
      secure: secure,
      protocols: {
        http: secure ? 'https' : 'http',
        ws: secure ? 'wss' : 'ws'
      }
    }
  }
  
  return {
    source: setupProtocol(argv.source === 'secure'),
    target: setupProtocol(argv.target === 'secure')
  };
}

var TestRunner = exports.TestRunner = function (options) {
  options          = options || {};
  this.source      = options.source || {};
  this.target      = options.target || {};
  this.testServers = [];

  if (this.source.secure) {
    this.source.https = loadHttps();
  }
  
  if (this.target.secure) {
    this.target.https = loadHttps();
  }
};

TestRunner.prototype.assertProxied = function (host, proxyPort, port, requestPath, targetPath, createProxy) {
  if (!targetPath) targetPath = "";
  
  var self = this,
      output = "hello " + host + targetPath,
      assertion = "should receive '" + output + "'";

  var test = {
    topic: function () {
      var that = this, 
          options;
          
      options = {
        method: 'GET',
        uri: self.source.protocols.http + '://localhost:' + proxyPort,
        headers: {
          host: host
        }
      };
      
      if (requestPath) options.uri += requestPath;

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

  test[assertion] = function (err, res, body) {
    assert.isNull(err);
    assert.equal(body, output);
  };

  return test;
};

TestRunner.prototype.assertResponseCode = function (proxyPort, statusCode, createProxy) {
  var assertion = "should receive " + statusCode + " responseCode",
      protocol = this.source.protocols.http;

  var test = {
    topic: function () {
      var that = this, options = {
        method: 'GET',
        uri: protocol + '://localhost:' + proxyPort,
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

// A test helper to check and see if the http headers were set properly.
TestRunner.prototype.assertHeaders = function (proxyPort, headerName, createProxy) {
  var assertion = "should receive http header \"" + headerName + "\"",
      protocol = this.source.protocols.http;

  var test = {
    topic: function () {
      var that = this, options = {
        method: 'GET',
        uri: protocol + '://localhost:' + proxyPort,
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
    assert.isNotNull(res.headers[headerName]);
  };

  return test;
};


//
// WebSocketTest
//
TestRunner.prototype.webSocketTest = function (options) {
  var self = this;
  
  this.startTargetServer(options.ports.target, 'hello websocket', function (err, target) {
    var socket = options.io.listen(target);

    if (options.onListen) {
      options.onListen(socket);
    }

    self.startProxyServer(
      options.ports.proxy, 
      options.ports.target, 
      options.host, 
      function (err, proxy) {
        if (options.onServer) { options.onServer(proxy) }
        
        //
        // Setup the web socket against our proxy
        //
        var uri = options.wsprotocol + '://' + options.host + ':' + options.ports.proxy;
        var ws = new websocket.WebSocket(uri + '/socket.io/websocket/', 'borf', {
          origin: options.protocol + '://' + options.host
        });
        
        if (options.onWsupgrade) { ws.on('wsupgrade', options.onWsupgrade) }
        if (options.onMessage) { ws.on('message', options.onMessage) }
        if (options.onOpen) { ws.on('open', function () { options.onOpen(ws) }) }
      }
    );
  });
}

//
// WebSocketTestWithTable
//
TestRunner.prototype.webSocketTestWithTable = function (options) {
  var self = this;
  
  this.startTargetServer(options.ports.target, 'hello websocket', function (err, target) {
    var socket = options.io.listen(target);

    if (options.onListen) {
      options.onListen(socket);
    }

    self.startProxyServerWithTable(
      options.ports.proxy,
      { router: options.router }, 
      function (err, proxy) {
        if (options.onServer) { options.onServer(proxy) }
        
        //
        // Setup the web socket against our proxy
        //
        var uri = options.wsprotocol + '://' + options.host + ':' + options.ports.proxy;
        var ws = new websocket.WebSocket(uri + '/socket.io/websocket/', 'borf', {
          origin: options.protocol + '://' + options.host
        });
        
        if (options.onWsupgrade) { ws.on('wsupgrade', options.onWsupgrade) }
        if (options.onMessage) { ws.on('message', options.onMessage) }
        if (options.onOpen) { ws.on('open', function () { options.onOpen(ws) }) }
      }
    );
  });
}

//
// Creates the reverse proxy server
//
TestRunner.prototype.startProxyServer = function (port, targetPort, host, callback) {
  var that = this,
      proxyServer = httpProxy.createServer(host, targetPort, this.getOptions());

  proxyServer.listen(port, function () {
    that.testServers.push(proxyServer);
    callback(null, proxyServer);
  });
};

//
// Creates the reverse proxy server with a specified latency
//
TestRunner.prototype.startLatentProxyServer = function (port, targetPort, host, latency, callback) {
  //
  // Initialize the nodeProxy and start proxying the request
  //
  var that = this, 
      proxyServer;
    
  proxyServer = httpProxy.createServer(host, targetPort, function (req, res, proxy) {
    var buffer = httpProxy.buffer(req);

    setTimeout(function () {
      proxy.proxyRequest(req, res, buffer);
    }, latency);
  }, this.getOptions());

  proxyServer.listen(port, function () {
    that.testServers.push(proxyServer);
    callback();
  });
};

//
// Creates the reverse proxy server with a ProxyTable
//
TestRunner.prototype.startProxyServerWithTable = function (port, options, callback) {
  var that = this, 
      proxyServer = httpProxy.createServer(merge({}, options, this.getOptions()));

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
  //
  // Initialize the nodeProxy and start proxying the request
  //
  var that = this,
      proxy = new httpProxy.RoutingProxy(merge({}, options, this.getOptions())),
      proxyServer;

  var handler = function (req, res) {
    var buffer = httpProxy.buffer(req);
    setTimeout(function () {
      proxy.proxyRequest(req, res, {
        buffer: buffer
      });
    }, latency);
  };

  proxyServer = this.source.https
    ? https.createServer(this.source.https, handler)
    : http.createServer(handler);

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
  var that = this, 
      proxyServer = httpProxy.createServer(targetPort, host, merge({}, options, this.getOptions()));
  
  proxyServer.listen(port, function () {
    that.testServers.push(proxyServer);
    callback(null, proxyServer);
  });
};

//
// Creates the 'hellonode' server
//
TestRunner.prototype.startTargetServer = function (port, output, callback) {
  var that = this, 
      targetServer, 
      handler;
      
  handler = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write(output);
    res.end();
  };
  
  targetServer = this.target.https
    ? https.createServer(this.target.https, handler)
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

//
// Creates a new instance of the options to 
// pass to `httpProxy.createServer()`
//
TestRunner.prototype.getOptions = function () {
  return {
    https: clone(this.source.https),
    target: {
      https: clone(this.target.https)
    }
  };
};

//
// ### @private function clone (object)
// #### @object {Object} Object to clone
// Shallow clones the specified object.
//
function clone (object) {
  if (!object) { return null }
  
  return Object.keys(object).reduce(function (obj, k) {
    obj[k] = object[k];
    return obj;
  }, {});
}

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
