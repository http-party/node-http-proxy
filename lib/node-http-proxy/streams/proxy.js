var Duplex = require('stream').Duplex,
    proxy  = require('../../node-http-proxy');
    http   = require('http'),
    https  = require('https'),
    url    = require('url'),
    util   = require('util');

var ProxyStream = module.exports = function ProxyStream(target, changeOrigin) {
  Duplex.call(this);

  var self = this;

  this.once('pipe', function(req) {
    var protocol = target.https ? https : http,
        outgoing = proxy._getBase(target);

    proxy._setupOutgoing(outgoing, target, req);

    if (changeOrigin) {
      outgoing.headers.host = target.host + ':' + target.port;
    }

    self.request = protocol.request(outgoing, function(res) {
      if(req.httpVersion === '1.0') {
        res.headers.connection = req.headers.connection || 'close';
      }
      else if(!res.headers.connection) {
        res.headers.connection = req.headers.connection || 'keep-alive';
      }

      if(req.httpVersion === '1.0' || (req.method === 'DELETE' && !req.headers['content-length'])) {
        delete response.headers['transfer-encoding'];
      }

      if(~[301,302].indexOf(res.statusCode) && typeof response.headers.location !== 'undefined') {
        location = url.parse(response.headers.location);
      }

    });
  });

};

ForwardStream.prototype._write = function(chunk, encoding, callback) {
  this.request.write(chunk, encoding, callback);
};

util.inherits(ForwardStream, Duplex);
