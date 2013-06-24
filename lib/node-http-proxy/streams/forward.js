var Writable = require('stream').Writable,
    proxy    = require('../../node-http-proxy');
    http     = require('http'),
    https    = require('https'),
    util     = require('util');

var ForwardStream = module.exports = function ForwardStream(options) {
  Writable.call(this);

  var self = this;

  this.once('pipe', function(req) {
    var protocol = options.https ? https : http,
        outgoing = proxy._getBase(options);

    proxy._setupOutgoing(outgoing, options, req);

    // pipe throw-safe? do we need to add a ` on 'error' ` handler?
    self.request = protocol.request(outgoing, function() {});
  });

};

ForwardStream.prototype._write = function(chunk, encoding, callback) {
  this.request.write(chunk, encoding, callback);
};

util.inherits(ForwardStream, Writable);

