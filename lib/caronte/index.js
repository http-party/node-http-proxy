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
  passes = type === 'ws' ? ws : web;
  return function(options) { 

    passes = Object.keys(passes).map(function(pass) {
      return passes[pass];
    });

    return function(req, res) {
      var self = this,
          ev   = 'caronte:' + type + ':';
      
      self.emit(ev + 'begin', req, res); 

      passes.forEach(function(pass) {
        var event = ev + pass.name.toLowerCase();
        
        self.emit(event + 'begin', req, res);   
        pass(req, res, options, self); 
        self.emit(event + 'end');
      });

      self.emit(ev + 'end');
    };   
  };
}

