/*
  node-http-proxy.js: Lookup table for proxy targets in node.js

  Copyright (c) 2010 Charlie Robbins 

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

var util = require('util'),
    events = require('events'),
    fs = require('fs');

//
// ### function ProxyTable (router, silent) 
// #### @router {Object} Object containing the host based routes
// #### @silent {Boolean} Value indicating whether we should suppress logs
// #### @hostnameOnly {Boolean} Value indicating if we should route based on __hostname string only__
// Constructor function for the ProxyTable responsible for getting
// locations of proxy targets based on ServerRequest headers; specifically
// the HTTP host header.
//
var ProxyTable = exports.ProxyTable = function (router, silent, hostnameOnly) {
  events.EventEmitter.call(this);
  
  this.silent = typeof silent !== 'undefined' ? silent : true;
  this.hostnameOnly = typeof hostnameOnly !== 'undefined' ? hostnameOnly : false;
  
  if (typeof router === 'object') {
    //
    // If we are passed an object literal setup 
    // the routes with RegExps from the router 
    //
    this.setRoutes(router);
  }
  else if (typeof router === 'string') {
    //
    // If we are passed a string then assume it is a 
    // file path, parse that file and watch it for changes
    //
    var self = this;
    this.routeFile = router;
    this.setRoutes(JSON.parse(fs.readFileSync(router)).router);
    
    fs.watchFile(this.routeFile, function () {
      fs.readFile(self.routeFile, function (err, data) {
        if (err) throw err;
        self.setRoutes(JSON.parse(data).router);
        self.emit('routes', self.hostnameOnly === false ? self.routes : self.router);
      });
    });
  }
  else {
    throw new Error('Cannot parse router with unknown type: ' + typeof router);
  }
};

// Inherit from events.EventEmitter
util.inherits(ProxyTable, events.EventEmitter);

//
// ### function setRoutes (router) 
// #### @router {Object} Object containing the host based routes
// Sets the host-based routes to be used by this instance. 
//
ProxyTable.prototype.setRoutes = function (router) {
  if (!router) throw new Error('Cannot update ProxyTable routes without router.');
  
  this.router = router;
  
  if (this.hostnameOnly === false) {
    var self = this;
    this.routes = [];

    Object.keys(router).forEach(function (path) {
      var route = new RegExp(path, 'i');

      self.routes.push({
        route: route,
        target: router[path]
      });
    });
  }
};

//
// ### function getProxyLocation (req) 
// #### @req {ServerRequest} The incoming server request to get proxy information about.
// Returns the proxy location based on the HTTP Headers in the  ServerRequest `req`
// available to this instance.
//
ProxyTable.prototype.getProxyLocation = function (req) {
  if (!req || !req.headers || !req.headers.host) {
    return null;
  }
  
  var target = req.headers.host.split(':')[0];
  if (this.hostnameOnly == true) {
    if (this.router.hasOwnProperty(target)) {
      var location = this.router[target].split(':'),
          host = location[0],
          port = location.length === 1 ? 80 : location[1];
      
      return {
        port: port,
        host: host
      };
    }
  }
  else {
    target += req.url;
    for (var i in this.routes) {
      var match, route = this.routes[i];
      if (match = target.match(route.route)) {
        var location = route.target.split(':'),
            host = location[0],
            port = location.length === 1 ? 80 : location[1];

        return {
          port: port,
          host: host
        };
      }
    }
  }
  
  return null;
};

//
// ### close function ()
// Cleans up the event listeneners maintained
// by this instance.
//
ProxyTable.prototype.close = function () {
  if (typeof this.routeFile === 'string') {
    fs.unwatchFile(this.routeFile);
  }
};