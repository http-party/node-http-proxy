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
    fs = require('fs'),
    maxEventListeners = 1000;

var ProxyTable = function (router, silent, hostname_only) {
  events.EventEmitter.call(this);
  this.setMaxListeners(maxEventListeners);
  this.silent = typeof silent !== 'undefined' ? silent : true;
  this.hostname_only = typeof hostname_only !== 'undefined' ? hostname_only : false;
  if (typeof router === 'object') {
    // If we are passed an object literal setup 
    // the routes with RegExps from the router 
    this.updateRoutes(router);
  }
  else if (typeof router === 'string') {
    // If we are passed a string then assume it is a 
    // file path, parse that file and watch it for changes
    var self = this;
    this.routeFile = router;
    this.updateRoutes(JSON.parse(fs.readFileSync(router)).router);
    
    fs.watchFile(this.routeFile, function (c,p) {
      console.log("watchFile");
      fs.readFile(self.routeFile, function (err, data) {
        if (err) throw err;
        self.updateRoutes(JSON.parse(data).router);
        if (self.hostname_only === true) {
          self.emit('updateRoutes', self.router);
        }
        else {
          self.emit('updateRoutes', self.routes);
        }
      });
    });
  }
  else {
    throw new Error('Cannot parse router with unknown type: ' + typeof router);
  }
};

util.inherits(ProxyTable, events.EventEmitter);

ProxyTable.prototype.updateRoutes = function (router) {
  if (!router) throw new Error('Cannot update ProxyTable routes without router.');
  
  var self = this;
  this.router = router;
  if (self.hostname_only !== true) {
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

ProxyTable.prototype.proxyRequest = function (proxy) {
  if (typeof proxy.req.headers.host !== 'undefined') {
    if (this.hostname_only === true) {
      var target = proxy.req.headers.host.split(':')[0];
      if (this.router.hasOwnProperty(target)) {
        var location = this.router[target].split(':'),
            host = location[0],
            port = location.length === 1 ? 80 : location[1];
        if (!this.silent) {
          util.log('Proxy Table proxying request to: ' + host + ':' + port);
        }

        proxy.proxyRequest(port, host);
        return;
      }
    }
    else {
      var target = proxy.req.headers.host.split(':')[0] + proxy.req.url;
      for (var i in this.routes) {
        var match, route = this.routes[i];
        if (match = target.match(route.route)) {
          var location = route.target.split(':'),
              host = location[0],
              port = location.length === 1 ? 80 : location[1];

          if (!this.silent) {
            util.log('Proxy Table proxying request to: ' + host + ':' + port);
          }

          proxy.proxyRequest(port, host);
          return;
        }
      }
    }
  }
  if (proxy.res) {
    proxy.res.writeHead(404, {'Content-Type': 'text/plain'});
    proxy.res.end();
  }
  else if (proxy.sock) {
    // Remark: How do we perform '404' over a socket?
    proxy.sock.destroy();
  }
};

ProxyTable.prototype.close = function () {
  if (typeof this.routeFile === 'string') {
    fs.unwatchFile(this.routeFile);
  }
};

exports.ProxyTable = ProxyTable;
