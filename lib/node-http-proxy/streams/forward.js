var Writable = require('stream').Writable,
    http     = require('http'),
    https    = require('https'),
    util     = require('util');

var ForwardStream = module.exports = function ForwardStream(options) {
  Writable.call(this);

  var self = this;

  this.once('pipe', function(req) {
    self.outgoing =  options.https ? https : http;

    [
      'host', 
      'hostname', 
      'port', 
      'socketPath', 
      'agent'
    ].forEach(function(elem) {
      outgoing[elem] = target[elem];
    });

    [
      'method', 
      'path', 
      'headers'
    ].forEach(function(elem) {
      outgoing[elem] = req[elem];
    });
    
  });

}

ForwardStream.prototype._write = function() {



}

util.inherits(ForwardStream, Writable);

