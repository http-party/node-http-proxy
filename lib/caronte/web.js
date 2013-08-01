var passes = require('./web/');

module.exports = createWebProxy;

function createWebProxy(options) {
  passes = Object.keys(passes).map(function(pass) {
    return passes[pass];
  });

  return function(req, res) {
    var self = this;
    
    self.emit('caronte:web:begin', req, res); 

    passes.forEach(function(pass) {
      var event = 'caronte:web:' + pass.name.toLowerCase();
      
      self.emit(event + ':begin', req, res);   
      pass(req, res, options); 
      self.emit(event + ':end');
    });

    self.emit('caronte:web:end');
  }; 
};