var caronte = exports,
    web     = require('./passes/web');
    ws      = require('./passes/ws');

caronte.createWebProxy = createRightProxy('web');
caronte.createWsProxy  = createRightProxy('ws');

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
        pass(req, res, options); 
        self.emit(event + 'end');
      });

      self.emit(ev + 'end');
    };   
  };
}

