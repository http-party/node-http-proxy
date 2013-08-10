var Duplex   = require('stream').Duplex,
    common   = require('../common'),
    http     = require('http'),
    https    = require('https');

function ProxyStream(options, res, instance) {
  this.options  = options;
  this.res      = res;
  this.instance = instance;

  var self = this;

  Duplex.call(this);

  this.once('pipe', function(pipe) { self.onPipe(pipe); }); 
  this.once('finish', function() { self.onFinish(); }); 
}

require('util').inherits(ProxyStream, Duplex);

ProxyStream.prototype.onPipe = function(req) {
  this.req = req;

  var self = this;

  this.proxyReq = (options.ssl ? https : http).request(
    common.setupOutgoing(options.ssl || {}, options, req)
  );

  this.proxyReq.once('response', function(proxyRes) {
    self.onResponse(proxyRes);
  });
  this.proxyReq.on('error', function(e) {
    self.onError(e);
  }); 
};

ProxyStream.prototype.onFinish = function() {
  
};

ProxyStream.prototype.onResponse = function(proxyRes) {
  this.proxyRes = proxyRes;
};

ProxyStream.prototype.onError = function(e) {
  if(this.instance.emit('error', this.req, this.res, e)) return;

  this.res.writeHead(500, { 'Content-Type': 'text/plain' });
  this.res.end('Internal Server Error');
};

ProxyStream.prototype._write = function(chunk, encoding, callback) {
  this.proxyReq.write(chunk, encoding, callback);
};

ProxyStream.prototype._read = function(size) {
  var chunk = (this.proxyRes ? this.proxyRes.read(size) : '') || '';

  this.push(chunk);
};

