var httpProxy = exports,
    extend    = require('util')._extend,
    parse_url = require('url').parse,
    EE3       = require('eventemitter3').EventEmitter,
    http      = require('http'),
    https     = require('https'),
    web       = require('./passes/web-incoming'),
    ws        = require('./passes/ws-incoming');
    
httpProxy.Server = ProxyServer;

/**
 * Returns a function that creates the loader for
 * either `ws` or `web`'s  passes.
 *
 * Examples:
 *
 *    httpProxy.createRightProxy('ws')
 *    // => [Function]
 *
 * @param {String} Type Either 'ws' or 'web'
 * 
 * @return {Function} Loader Function that when called returns an iterator for the right passes
 *
 * @api private
 */

function createRightProxy(type) {
  return function(options) {
    return function(req, res /*, [head], [opts] */) {
      var passes = (type === 'ws') ? this.wsPasses : this.webPasses,
          args = [].slice.call(arguments),
          cntr = args.length - 1,
          head, cbl;

      /* optional args parse begin */ 
      if(typeof args[cntr] === 'function') {
        cbl = args[cntr];

        cntr--;
      }

      if(
        !(args[cntr] instanceof Buffer) &&
        args[cntr] !== res
      ) {
        //Copy global options
        options = extend({}, options);
        //Overwrite with request options
        extend(options, args[cntr]);

        cntr--;
      }

      if(args[cntr] instanceof Buffer) {
        head = args[cntr];
      }

      /* optional args parse end */

      ['target', 'forward'].forEach(function(e) {
        if (typeof options[e] === 'string')
          options[e] = parse_url(options[e]);
      });


      for(var i=0; i < passes.length; i++) { 
        /**
         * Call of passes functions
         * pass(req, res, options, head)
         *
         * In WebSockets case the `res` variable
         * refer to the connection socket
         * pass(req, socket, options, head)
         */
        if(passes[i](req, res, cbl ? false : this, head, cbl)) { // passes can return a truthy value to halt the loop
          break;
        }
      }
    };
  };
}


function ProxyServer(options) {
  EE3.call(this);

  this.web     = createRightProxy('web')(options);
  this.ws      = createRightProxy('ws')(options);
  this.options = options;

  this.webPasses = Object.keys(web).map(function(pass) {
    return web[pass];
  });

  this.wsPasses = Object.keys(ws).map(function(pass) {
    return ws[pass];
  });
}

ProxyServer.prototype.listen = function(port) {
  var self    = this,
      closure = function(req, res) { self.web(req, res); };
      
  this._server  = this.options.ssl ? 
    https.createServer(this.options.ssl, closure) : 
    http.createServer(closure);

  if(this.options.ws) {
    this._server.on('upgrade', function(req, socket, head) { self.ws(req, socket, head); });
  }

  this._server.listen(port);

  return this;
};

ProxyServer.prototype.before = function(passName, callback) {
  var i = false;
  this.passes.forEach(function(v, idx) { 
    if(v.name === passName) i = idx;
  })

  if(!i) throw new Error('No such pass');

  this.passes.splice(i, 0, callback);
};
ProxyServer.prototype.after = function(passName, callback) {
  var i = false;
  this.passes.forEach(function(v, idx) { 
    if(v.name === passName) i = idx;
  })

  if(!i) throw new Error('No such pass');

  this.passes.splice(i++, 0, callback);
};

//require('util').inherits(ProxyServer, EE3);
