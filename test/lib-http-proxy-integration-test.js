var httpProxy = require('../lib/http-proxy'),
    expect    = require('expect.js'),
    http      = require('http');


describe('lib/http-proxy.js', function() {

  describe('#createProxyServer with target options for integration into existing server', function () {
    it('should proxy the request using the web proxy handler', function (done) {
      var proxy = httpProxy.createProxyServer({
        target: 'http://127.0.0.1:8080'
      });

      function requestHandler(req, res) {
        proxy.web(req, res);
      }

      var proxyServer = http.createServer(requestHandler);

      var source = http.createServer(function(req, res) {
        source.close();
        proxyServer.close();
        expect(req.method).to.eql('GET');
        expect(req.headers.host.split(':')[1]).to.eql('8082');
        done();
      });

      proxyServer.listen('8082');
      source.listen('8080');
      
      http.request('http://127.0.0.1:8082', function() {}).end();
    });
  });

  describe('#createProxyServer() for integration into existing server with error response', function () {
    it('should proxy the request and handle error via callback', function(done) {
      var proxy = httpProxy.createProxyServer({
        target: 'http://127.0.0.1:8080'
      });

      var proxyServer = http.createServer(requestHandler);

      function requestHandler(req, res) {
        proxy.web(req, res, function (err) {
          proxyServer.close();
          expect(err).to.be.an(Error);
          expect(err.code).to.be('ECONNREFUSED');
          done();
        });
      }

      proxyServer.listen('8082');
      
      http.request({
        hostname: '127.0.0.1',
        port: '8082',
        method: 'GET',
      }, function() {}).end();
    });

    it('should proxy the request and handle error event listener', function(done) {
      var proxy = httpProxy.createProxyServer({
        target: 'http://127.0.0.1:8080'
      });

      var proxyServer = http.createServer(requestHandler);

      function requestHandler(req, res) {
        proxy.once('error', function (err, errReq, errRes) {
          proxyServer.close();
          expect(err).to.be.an(Error);
          expect(errReq).to.be.equal(req);
          expect(errRes).to.be.equal(res);
          expect(err.code).to.be('ECONNREFUSED');
          done();
        });

        proxy.web(req, res);
      }

      proxyServer.listen('8082');
      
      http.request({
        hostname: '127.0.0.1',
        port: '8082',
        method: 'GET',
      }, function() {}).end();
    });

  });

});