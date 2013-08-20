var Duplex   = require('stream').Duplex,
    common   = require('../common'),
    http     = require('http'),
    https    = require('https');

function ProxyStream(options, res, instance) {
  Duplex.call(this);

  this.options  = options;
  this.res      = res;
  this.instance = instance;

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
    console.log(proxyRes);
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

  // rewrite
      if(req.httpVersion === '1.0') {
        res.headers.connection = req.headers.connection || 'close';
      }
      else if(!res.headers.connection) {
        res.headers.connection = req.headers.connection || 'keep-alive';
      }

      if(req.httpVersion === '1.0' || (req.method === 'DELETE' && !req.headers['content-length'])) {
        delete res.headers['transfer-encoding'];
      }

      if(~[301,302].indexOf(res.statusCode) && typeof res.headers.location !== 'undefined') {
        var location = url.parse(res.headers.location);
        if (
          location.host === req.headers.host &&
          (
            source.https && !target.https ||
            target.https && !source.https
          )
        ) {
          res.headers.location = res.headers.location.replace(/^https\:/, 'http:');
        }
      }

      self.emit('proxyResponse', req, response, res);

      Object.keys(res.headers).forEach(function (key) {
        response.setHeader(key, res.headers[key]);
      });
      response.writeHead(response.statusCode);
      
      res.on('readable', function() {
        self.read(0);
      });

      res.on('end', function() {
        self.push(null);
      });
      self.emit('readable');
};

ProxyStream.prototype.onError = function(e) {
  if(this.instance.emit('proxyError', this.req, this.res, e)) return;
  
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

module.exports = ProxyStream;