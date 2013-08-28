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

  describe('caronte createProxyServer() method', function () {
    it('should make the request on pipe and finish it', function(done) {
      var proxy = caronte.createProxyServer({
        target: 'http://127.0.0.1:8080'
      }).listen('8081');

      var source = http.createServer(function(req, res) {
        expect(req.headers['x-forwarded-for']).to.eql('127.0.0.1');
        source.close();
        proxy.close();
        done();
      });

      source.listen('8080');
      
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

  describe('caronte createProxyServer() method with response', function () {
    it('should make the request, handle response and finish it', function(done) {
      var proxy = caronte.createProxyServer({
        target: 'http://127.0.0.1:8080'
      }).listen('8081');

      var source = http.createServer(function(req, res) {
        expect(req.method).to.eql('GET');
        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.end('Hello from ' + source.address().port);
      });

      source.listen('8080');
      
      http.request({
        hostname: '127.0.0.1',
        port: '8081',
        method: 'GET',
      }, function(res) {
        expect(res.statusCode).to.eql(200);

        res.on('data', function (data) {
          expect(data.toString()).to.eql('Hello from 8080');
        });

        res.on('end', function () { 
          source.close();
          proxy.close();
          done();
        });
      }).end();
    });
  });
});
