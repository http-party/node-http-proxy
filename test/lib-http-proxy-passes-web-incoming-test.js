var webPasses = require('../lib/http-proxy/passes/web-incoming'),
    httpProxy = require('../lib/http-proxy'),
    expect    = require('expect.js'),
    http      = require('http'),
    zlib      = require('zlib');

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

 it('a proxy request to a backend returning gzip content will succeed', function(done) {
    
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:8080'
    });

    function requestHandler(req, res) {
      proxy.web(req, res);
    }

    var proxyServer = http.createServer(requestHandler);

    var source = http.createServer(function(req, res) {

      res.writeHead(200, {'Content-Type': 'text/html', 'Content-Encoding': 'gzip'});
      var text = "GZIP Content";
      var buf = new Buffer(text, 'utf-8');   // Choose encoding for the string.
      zlib.gzip(buf, function (_, result) {  // The callback will give you the 
        res.end(result);                     // result, so just send it.
      });

    });

    proxyServer.listen('8081');
    source.listen('8080');

    http.request('http://127.0.0.1:8081', function(res) {
      
      res.on('data', function (body) {
        expect(body.toString()).to.be.equal("GZIP Content");
        source.close();
        proxyServer.close();
        done();
      });

    }).end();

  });

});