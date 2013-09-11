var Duplex   = require('stream').Duplex,
    common   = require('../common'),
    http     = require('http'),
    https    = require('https');

module.exports = ProxyStream;

function ProxyStream(options, res) {
  Duplex.call(this);

  this.options  = options;
  this.res      = res;

  var self = this;

  this.once('pipe', function(pipe) { self.onPipe(pipe); }); 
  this.once('finish', function() { self.onFinish(); }); 
}

require('util').inherits(ProxyStream, Duplex);

ProxyStream.prototype.onPipe = function(req) {
  this.req = req;

  var self = this;

  this.proxyReq = (self.options.ssl ? https : http).request(
    common.setupOutgoing(self.options.ssl || {}, self.options, req)
  );
  //console.log(common.setupOutgoing(self.options.ssl || {}, self.options, req));
  this.proxyReq.once('response', function(proxyRes) {
    self.onResponse(proxyRes);
  });
  this.proxyReq.on('error', function(e) {
    self.onError(e);
  }); 
};

ProxyStream.prototype.onFinish = function() {
  this.proxyReq.end(); 
};

ProxyStream.prototype.onResponse = function(proxyRes) {
  this.proxyRes = proxyRes;

  var self = this;

  if(this.req.httpVersion === '1.0') {
    proxyRes.headers.connection = this.req.headers.connection || 'close';
  }
  else if(!proxyRes.headers.connection) {
    proxyRes.headers.connection = this.req.headers.connection || 'keep-alive';
  }

  if(this.req.httpVersion === '1.0' || (this.req.method === 'DELETE' && !this.req.headers['content-length'])) {
    delete proxyRes.headers['transfer-encoding'];
  }

  /*if(~[301,302].indexOf(this.res.statusCode) && typeof this.res.headers.location !== 'undefined') {
    var location = url.parse(this.res.headers.location);
    if (
      location.host === this.req.headers.host &&
      (
        source.https && !target.https ||
        target.https && !source.https
      )
    ) {
      this.res.headers.location = this.res.headers.location.replace(/^https\:/, 'http:');
    }
  }*/

  Object.keys(proxyRes.headers).forEach(function (key) {
    self.res.setHeader(key, proxyRes.headers[key]);
  });

  this.res.writeHead(proxyRes.statusCode);
  
  proxyRes.on('readable', function() {
    self.read(0);
  });

  proxyRes.on('end', function() {
    self.push(null);
  });

  self.emit('readable');
};

ProxyStream.prototype.onError = function(e) {
  if(this.options.ee.emit('proxyError', this.req, this.res, e)) return;
  
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
