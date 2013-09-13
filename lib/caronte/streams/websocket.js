var Duplex = require('stream').Duplex,
    common = require('../common'),
    http   = require('http'),
    https  = require('https');

module.exports = WebsocketStream;

function WebsocketStream(options, res) {
  Duplex.call(this);

  this.options       = options;
  this.res           = res;
  this.handshakeDone = false;

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

  this.proxyReq.once('socket', function(proxySocket) {
    self.onSocket(proxySocket);
  });
  this.proxyReq.on('upgrade', function(proxyRes, proxySocket, proxyHead) {
    self.onUpgrade(proxyRes, proxySocket, proxyHead);
  });

  this.proxyReq.on('error', function(e) {
    self.onError(e);
  });
};

WebsocketStream.prototype.onFinish = function() {
  this.proxyReq.end();
};

WebsocketStream.prototype.onSocket = function(proxySocket) {


};

WebsocketStream.prototype.onUpgrade = function(proxyRes, proxySocket, proxyHead) {
  this.handshake = {
    headers    : proxyRes.headers,
    statusCode : proxyRes.statusCode
  };

  this.proxyRes    = proxyRes;
  this.proxySocket = proxySocket;
  this.proxyHead   = proxyHead;
 
  proxySocket.setTimeout(0);
  proxySocket.setNoDelay(true);

  proxySocket.setKeepAlive(true, 0);


};

WebsocketStream.prototype.onError = function(e) {

};


WebsocketStream.prototype._write = function(chunk, encoding, callback) {
  this.proxySocket.write(chunk, encoding, callback);
};

WebsocketStream.prototype._read = function(size) {
  var chunk = (this.proxySocket ? this.proxySocket.read(size) : '') || '';
  
  if(chunk && !this.handshakeDone) {
    var headers = '';

    if (this.handshake.statusCode && this.handshake.statusCode == 101) {
      headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Accept: ' + this.handshake.headers['sec-websocket-accept']
      ];

      headers = headers.concat('', '').join('\r\n');
    }   
    
    /*
     * Socket.IO specific code
     */

    var sdata = chunk.toString();
    sdata = sdata.substr(0, sdata.search(CRLF + CRLF));
    chunk = data.slice(Buffer.byteLength(sdata), data.length);
    
    if (self.source.https && !self.target.https) { sdata = sdata.replace('ws:', 'wss:'); }

    this.push(headers + sdata);
    this.push(data);

    this.handshakeDone = true;
    return;  
  }
  
  this.push(chunk);
};
