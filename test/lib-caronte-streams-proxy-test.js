var caronte       = require('../'),
    ProxyStream   = require('../lib/caronte/streams/proxy');
    expect        = require('expect.js'),
    Duplex        = require('stream').Duplex,
    http          = require('http');


describe('lib/caronte/streams/proxy.js', function () {
	describe('proxy stream constructor', function () {
    it('should be an instance of Duplex stream and get the correct options and methods', function () {
      var stubOptions = {
        key: 'value'
      };
      var proxyStream = new ProxyStream(stubOptions);

      expect(proxyStream).to.be.a(Duplex);
      expect(proxyStream.options).to.eql({ key: 'value' });
      expect(proxyStream.onPipe).to.be.a('function');
      expect(proxyStream.onFinish).to.be.a('function');
      expect(proxyStream._events).to.have.property('pipe');
      expect(proxyStream._events).to.have.property('finish');
    });
  });

  describe('should pipe the request and finish it', function () {
    it('should make the request on pipe and finish it', function(done) {
      var result;
      
      var p = caronte.createProxyServer({
        target: 'http://127.0.0.1:8080'
      }).listen('8081');

      var s = http.createServer(function(req, res) {
        expect(req.headers['x-forwarded-for']).to.eql('127.0.0.1');
        s.close();
        p.close();
        done();
      });

      s.listen('8080');
      
      http.request({
        hostname: '127.0.0.1',
        port: '8081',
        method: 'POST',
        headers: {
          'x-forwarded-for': '127.0.0.1'
        } 
      }, function() {}).end();
    });
  });
});
