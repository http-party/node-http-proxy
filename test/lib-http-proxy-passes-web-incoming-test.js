var webPasses = require('../lib/http-proxy/passes/web-incoming'),
    httpProxy = require('../lib/http-proxy'),
    expect    = require('expect.js'),
    http      = require('http');

describe('lib/http-proxy/passes/web.js', function() {
  describe('#deleteLength', function() {
    it('should change `content-length`', function() {
      var stubRequest = {
        method: 'DELETE',
        headers: {}
      };
      webPasses.deleteLength(stubRequest, {}, {});
      expect(stubRequest.headers['content-length']).to.eql('0');
    })
  });

  describe('#timeout', function() {
    it('should set timeout on the socket', function() {
      var done = false, stubRequest = {
        socket: {
          setTimeout: function(value) { done = value; }
        }
      }

      webPasses.timeout(stubRequest, {}, { timeout: 5000});
      expect(done).to.eql(5000);
    });
  });

  describe('#XHeaders', function () {
    var stubRequest = {
      connection: {
        remoteAddress: '192.168.1.2',
        remotePort: '8080'
      },
      headers: {
        host: '192.168.1.2:8080'
      }
    }

    it('set the correct x-forwarded-* headers', function () {
      webPasses.XHeaders(stubRequest, {}, { xfwd: true });
      expect(stubRequest.headers['x-forwarded-for']).to.be('192.168.1.2');
      expect(stubRequest.headers['x-forwarded-port']).to.be('8080');
      expect(stubRequest.headers['x-forwarded-proto']).to.be('http');
    });
  });
});

describe('#createProxyServer.web() using own http server', function () {
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
      expect(req.headers.host.split(':')[1]).to.eql('8081');
      done();
    });

    proxyServer.listen('8081');
    source.listen('8080');

    http.request('http://127.0.0.1:8081', function() {}).end();
  });

  it('should detect a proxyReq event and modify headers', function (done) {
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:8080',
    });

    proxy.on('proxyReq', function(proxyReq, req, res, options) {
      proxyReq.setHeader('X-Special-Proxy-Header', 'foobar');
    });

    function requestHandler(req, res) {
      proxy.web(req, res);
    }

    var proxyServer = http.createServer(requestHandler);

    var source = http.createServer(function(req, res) {
      source.close();
      proxyServer.close();
      expect(req.headers['x-special-proxy-header']).to.eql('foobar');
      done();
    });

    proxyServer.listen('8081');
    source.listen('8080');

    http.request('http://127.0.0.1:8081', function() {}).end();
  });

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

  it('should proxy the request and handle error via event listener', function(done) {
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

    proxyServer.listen('8083');

    http.request({
      hostname: '127.0.0.1',
      port: '8083',
      method: 'GET',
    }, function() {}).end();
  });

  it('should proxy the request and handle timeout error (proxyTimeout)', function(done) {
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:45000',
      proxyTimeout: 100
    });

    require('net').createServer().listen(45000);

    var proxyServer = http.createServer(requestHandler);

    var started = new Date().getTime();
    function requestHandler(req, res) {
      proxy.once('error', function (err, errReq, errRes) {
        proxyServer.close();
        expect(err).to.be.an(Error);
        expect(errReq).to.be.equal(req);
        expect(errRes).to.be.equal(res);
        expect(new Date().getTime() - started).to.be.greaterThan(99);
        expect(err.code).to.be('ECONNRESET');
        done();
      });

      proxy.web(req, res);
    }

    proxyServer.listen('8084');

    http.request({
      hostname: '127.0.0.1',
      port: '8084',
      method: 'GET',
    }, function() {}).end();
  });

  it('should proxy the request and handle timeout error', function(done) {
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:45001',
      timeout: 100
    });

    require('net').createServer().listen(45001);

    var proxyServer = http.createServer(requestHandler);

    var cnt = 0;
    var doneOne = function() {
      cnt += 1;
      if(cnt === 2) done();
    }

    var started = new Date().getTime();
    function requestHandler(req, res) {
      proxy.once('error', function (err, errReq, errRes) {
        proxyServer.close();
        expect(err).to.be.an(Error);
        expect(errReq).to.be.equal(req);
        expect(errRes).to.be.equal(res);
        expect(err.code).to.be('ECONNRESET');
        doneOne();
      });

      proxy.web(req, res);
    }

    proxyServer.listen('8085');

    var req = http.request({
      hostname: '127.0.0.1',
      port: '8085',
      method: 'GET',
    }, function() {});

    req.on('error', function(err) {
      expect(err).to.be.an(Error);
      expect(err.code).to.be('ECONNRESET');
      expect(new Date().getTime() - started).to.be.greaterThan(99);
      doneOne();
    });
    req.end();
  });

  it('should proxy the request and provide a proxyRes event with the request and response parameters', function(done) {
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:8080'
    });

    function requestHandler(req, res) {
      proxy.once('proxyRes', function (proxyRes, pReq, pRes) {
        source.close();
        proxyServer.close();
        expect(pReq).to.be.equal(req);
        expect(pRes).to.be.equal(res);
        done();
      });

      proxy.web(req, res);
    }

    var proxyServer = http.createServer(requestHandler);

    var source = http.createServer(function(req, res) {
      res.end('Response');
    });

    proxyServer.listen('8086');
    source.listen('8080');
    http.request('http://127.0.0.1:8086', function() {}).end();
  });
});