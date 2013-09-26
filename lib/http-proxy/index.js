var httpProxy = exports,
    extend    = require('util')._extend,
    parse_url = require('url').parse,
    web       = require('./passes/web-incoming'),
    ws        = require('./passes/ws-incoming');

httpProxy.createWebProxy = createRightProxy('web');
httpProxy.createWsProxy  = createRightProxy('ws');

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
  var passes = (type === 'ws') ? ws : web;

  return function(options) {

    passes = Object.keys(passes).map(function(pass) {
      return passes[pass];
    });

    return function(req, res /*, [head], [opts] */) {
      var self = this,
          args = [].slice.call(arguments),
          cntr = args.length - 1,
          ev   = 'http-proxy:' + type + ':incoming:',
          head;

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

      options.ee.emit(ev + 'begin', req, res);

      ['target', 'forward'].forEach(function(e) {
        if (typeof options[e] === 'string')
          options[e] = parse_url(options[e]);
      });

      passes.some(function(pass) {
        var evnt = ev + pass.name.toLowerCase() + ':', val;

        /**
         * Call of passes functions
         * pass(req, res, options, head)
         *
         * In WebSockets case the `res` variable
         * refer to the connection socket
         * pass(req, socket, options, head)
         */

        options.ee.emit(evnt + 'begin', req, res);
        val = pass(req, res, options, head);
        options.ee.emit(evnt + 'end');

        return val;
      });

      options.ee.emit(ev + 'end');
    };
  };
}

