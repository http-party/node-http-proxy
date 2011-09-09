var events = require('events'),
    util = require('util'),
    HttpProxy = require('./http-proxy').HttpProxy,
    ProxyTable = require('./proxy-table').ProxyTable;

//
// ### function RoutingProxy (options)
// #### @options {Object} Options for this instance
// Constructor function for the RoutingProxy object, a higher level
// reverse proxy Object which can proxy to multiple hosts and also interface
// easily with a RoutingTable instance.
//
var RoutingProxy = exports.RoutingProxy = function (options) {
  events.EventEmitter.call(this);
  
  if (options.router) {
    //
    // TODO: Consume the RoutingTable for various things: `this.proxyTable`
    //
  }
  
  //
  // Create a set of `HttpProxy` objects to be used later on calls 
  // to `.proxyRequest()` and `.proxyWebSocketRequest()`.
  //
  this.proxies = {};
};


//
// Inherit from `events.EventEmitter`.
//
util.inherits(RoutingProxy, events.EventEmitter);

//
// ### function add (options)
// #### @options {Object} Options for the `HttpProxy` to add.
// Adds a new instance of `HttpProxy` to this `RoutingProxy` instance
// for the specified `options.host` and `options.port`.
//
RoutingProxy.prototype.add = function (options) {
  
};

//
// ### function remove (options)
// #### @options {Object} Options mapping to the `HttpProxy` to remove.
// Removes an instance of `HttpProxy` from this `RoutingProxy` instance
// for the specified `options.host` and `options.port` (if they exist).
//
RoutingProxy.prototype.remove = function (options) {
  
};

//
// ### function close()
// Cleans up any state left behind (sockets, timeouts, etc)
// associated with this instance.
//
RoutingProxy.prototype.close = function () {
  var self = this;
  
  if (this.proxyTable) {
    //
    // Close the `RoutingTable` associated with 
    // this instance (if any).
    //
    this.proxyTable.close();
  }
  
  //
  // Close all sockets for all `HttpProxy` object(s)
  // associated with this instance. 
  //
  Object.keys(this.proxies).forEach(function (key) {
    self.proxies[key].close();
  });
};

//
// ### function proxyRequest (req, res, [port, host, paused])
// #### @req {ServerRequest} Incoming HTTP Request to proxy.
// #### @res {ServerResponse} Outgoing HTTP Request to write proxied data to.
// #### @options {Object} Options for the outgoing proxy request.
//
//     options.port {number} Port to use on the proxy target host.
//     options.host {string} Host of the proxy target.
//     options.buffer {Object} Result from `httpProxy.buffer(req)`
//     options.https {Object|boolean} Settings for https.
//
RoutingProxy.prototype.proxyRequest = function (req, res, options) {
  options = options || {};

  //
  // Check the proxy table for this instance to see if we need
  // to get the proxy location for the request supplied. We will
  // always ignore the proxyTable if an explicit `port` and `host`
  // arguments are supplied to `proxyRequest`.
  //
  if (this.proxyTable && !options.host) {
    location = this.proxyTable.getProxyLocation(req);

    //
    // If no location is returned from the ProxyTable instance
    // then respond with `404` since we do not have a valid proxy target.
    //
    if (!location) {
      try {
        res.writeHead(404);
        res.end();
      } 
      catch (er) {
        console.error("res.writeHead/res.end error: %s", er.message);
      }
      
      return;
    }

    //
    // When using the ProxyTable in conjunction with an HttpProxy instance
    // only the following arguments are valid:
    //
    // * `proxy.proxyRequest(req, res, { host: 'localhost' })`: This will be skipped
    // * `proxy.proxyRequest(req, res, { buffer: buffer })`: Buffer will get updated appropriately
    // * `proxy.proxyRequest(req, res)`: Options will be assigned appropriately.
    //
    options.port = location.port;
    options.host = location.host;
  }
  
  var key = options.host + ':' + options.port,
      proxy = this.proxies[key] || this._addTarget(options);
      
  proxy.proxyRequest(req, res, options.buffer);
};

//
// ### function proxyWebSocketRequest (req, socket, head, options)
// #### @req {ServerRequest} Websocket request to proxy.
// #### @socket {net.Socket} Socket for the underlying HTTP request
// #### @head {string} Headers for the Websocket request.
// #### @options {Object} Options to use when proxying this request.
//
//     options.port {number} Port to use on the proxy target host.
//     options.host {string} Host of the proxy target.
//     options.buffer {Object} Result from `httpProxy.buffer(req)`
//     options.https {Object|boolean} Settings for https.
//
RoutingProxy.prototype.proxyWebSocketRequest = function (req, socket, head, options) {
  options = options || {};
  
  if (this.proxyTable && !options.host) {
    location = this.proxyTable.getProxyLocation(req);

    if (!location) {
      return socket.destroy();
    }

    options.port = location.port;
    options.host = location.host;
  }
  
  var key = options.host + ':' + options.port,
      proxy = this.proxies[key] || this._addTarget(options);
      
  proxy.proxyWebSocketRequest(req, socket, head, options.buffer);
};