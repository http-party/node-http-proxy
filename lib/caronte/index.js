var caronte = exports,
    web     = require('./passes/web');
    ws      = require('./passes/ws');

caronte.createWebProxy = createRightProxy('web');
caronte.createWsProxy  = createRightProxy('ws');

/**
 * Returns a function that creates the loader for 
 * either `ws` or `web`'s  passes.
 *
 * Examples:
 *
 *    caronte.createRightProxy('ws')
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
          ev   = 'caronte:' + type + ':',
          head;

      if(
        !(args[cntr] instanceof Buffer) &&
        args[cntr] !== res
      ) {  
        options = opts; 
        cntr--;
      } 
      
      if(args[cntr] instanceof Buffer) {
        head = args[cntr];
      }

      options.ee.emit(ev + 'begin', req, res); 

      
      passes.some(function(pass) {
        var evnt = ev + pass.name.toLowerCase();
        
        options.ee.emit(evnt + 'begin', req, res); 
        var val = pass(req, res, options, head); 
        options.ee.emit(evnt + 'end');
         
        return val;
      });

      options.ee.emit(ev + 'end');
    };   
  };
}

