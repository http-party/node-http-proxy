var Duplex = require('stream').Duplex,
    common = require('common'),
    http   = require('http'),
    https  = require('https');

function WebsocketStream(options, res, instance) {
  Duplex.call(this);

  this.options  = options;
  this.res      = res;
  this.instance = intance;

  var self = this;

  this.once('pipe', function(pipe) { self.onPipe(pipe); });
  this.once('finish', function() { self.onFinish(); });
}

require('util').inherits(WebsocketStream, Duplex);

WebsocketStream.prototype.onPipe = function(req) {
  this.req = req;

  var self = this;

  this.proxyReq = (self.options.ssl ? https : http).request(
    common.setupOutgoing(self.options.ssl || {}, self.options, req)
  );

  this.proxyReq.once('response', function(proxyRes) {
    self.onResponse(proxyRes);
  });
  this.proxyReq.on('error', function(e) {
    self.onError(e);
  });
};

WebsocketStream.prototye.onFinish = function() {
  this.proxyReq.end();
};

WebsocketStream.prototype.onResponse = function(proxyRes) {
  this.proxyRes = proxyRes;


};

WebsocketStream.prototype.onError = function(e) {

};


WebsocketStream.prototype._write = function(chunk, encoding, callback) {

};

WebsocketStream.prototype._read = function(size) {

};


WebsocketStream.prototype
