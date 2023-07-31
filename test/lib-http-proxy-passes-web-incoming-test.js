var webPasses = require('../module/http-proxy/passes/web-incoming').default,
    httpProxy = require('../module'),
    expect    = require('expect.js'),
    concat    = require('concat-stream'),
    async     = require('async'),
    url       = require('url'),
    http      = require('http');

describe('module/http-proxy/passes/web.js', function() {
  describe('#deleteLength', function() {
    it('should change `content-length` for DELETE requests', function() {
      var stubRequest = {
        method: 'DELETE',
        headers: {}
      };
      webPasses.deleteLength(stubRequest, {}, {});
      expect(stubRequest.headers['content-length']).to.eql('0');
    });

    it('should change `content-length` for OPTIONS requests', function() {
      var stubRequest = {
        method: 'OPTIONS',
        headers: {}
      };
      webPasses.deleteLength(stubRequest, {}, {});
      expect(stubRequest.headers['content-length']).to.eql('0');
    });

    it('should remove `transfer-encoding` from empty DELETE requests', function() {
      var stubRequest = {
        method: 'DELETE',
        headers: {
          'transfer-encoding': 'chunked'
        }
      };
      webPasses.deleteLength(stubRequest, {}, {});
      expect(stubRequest.headers['content-length']).to.eql('0');
      expect(stubRequest.headers).to.not.have.key('transfer-encoding');
    });
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
      socket: {
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

  it('should detect a upstreamReq event and modify headers', function (done) {
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:8080',
    });

    proxy.on('upstreamReq', function(upstreamReq, req, res, options) {
      upstreamReq.setHeader('X-Special-Proxy-Header', 'foobar');
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

  it('should skip upstreamReq event when handling a request with header "expect: 100-continue" [https://www.npmjs.com/advisories/1486]', function (done) {
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:8080',
    });

    proxy.on('upstreamReq', function(upstreamReq, req, res, options) {
      upstreamReq.setHeader('X-Special-Proxy-Header', 'foobar');
    });

    function requestHandler(req, res) {
      proxy.web(req, res);
    }

    var proxyServer = http.createServer(requestHandler);

    var source = http.createServer(function(req, res) {
      source.close();
      proxyServer.close();
      expect(req.headers['x-special-proxy-header']).to.not.eql('foobar');
      done();
    });

    proxyServer.listen('8081');
    source.listen('8080');

    const postData = ''.padStart(1025, 'x');

    const postOptions = {
      hostname: '127.0.0.1',
      port: 8081,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'expect': '100-continue'
      }
    };

    const req = http.request(postOptions, function() {});
    req.write(postData);
    req.end();
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

  it('should forward the request and handle error via event listener', function(done) {
    var proxy = httpProxy.createProxyServer({
      forward: 'http://127.0.0.1:8080'
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


  it('response should end', function(done) {
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:45002',
      handleErrors: true
    });


    proxy.on('upstreamReq', function(upstreamReq, req, res, options) {
      upstreamReq.on("response", function (upstreamRes) {
        console.log('up response');
        upstreamRes.on('end', () => {
          console.log('up res end');
        })
        upstreamRes.on('close', () => {
          console.log('up res close');
        done();

        })
        upstreamRes.on('error', () => {
          console.log('up res error');
        })
      });
      upstreamReq.on('close', () => {
        console.log('up req close');
      })
      console.log('upstreamReq');
      // upstreamReq.setHeader('X-Special-Proxy-Header', 'foobar');
    });

     const source =  http.createServer(function(req, res) {
      setTimeout(() => {
        res.destroy();
        res.end('ok');
      }, 1000);
      res.write('ok');
      console.log('source');
    }).listen(45002);

 
    source.on('clientError', (err, socket) => {
      console.log('clientError', err);
      // socket.destroy();
    });

    var proxyServer = http.createServer(requestHandler);


    proxyServer.on('clientError', (err, socket) => {
      console.log('clientError', err);
      // socket.destroy();
    });

    function requestHandler(req, res) {
      // proxy.once('error', function (err, errReq, errRes) {
      //   proxyServer.close();
      //   expect(err).to.be.an(Error);
      //   expect(errReq).to.be.equal(req);
      //   expect(errRes).to.be.equal(res);
      //   expect(new Date().getTime() - started).to.be.greaterThan(99);
      //   expect(err.code).to.be('ECONNRESET');
      //   done();
      // });
      // setTimeout(() => {
      //   req.socket.emit('error', new Error('test'));
      // }, 200);
      req.on('close', () => {
        console.log('down req close');
      })
      res.on('close', () => {
        console.log('down res close');

      })
      res.on('finish', () => {
        console.log('down res finish');
      })
      proxy.web(req, res);
    }

    proxyServer.listen('8010');

    const req= http.request({
      hostname: '127.0.0.1',
      port: '8010',
      method: 'GET',
    }, function() {}).end();
    setTimeout(() => {
      // req.destroy();
    } , 400);
    req.on('error', (err) => {
      // logger.error('req error', err);
    }
    );
  });

  it('should proxy the request and handle timeout error', function(done) {
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:45001',
      timeout: 100
    });

    require('net').createServer().listen(45001);

    var proxyServer = http.createServer(requestHandler);

    var started = new Date().getTime();
    function requestHandler(req, res) {
      // proxy.on('error', function (err, errReq, errRes) {
      //   console.log(err);
      //   proxyServer.close();
      //   expect(err).to.be.an(Error);
      //   expect(errReq).to.be.equal(req);
      //   expect(errRes).to.be.equal(res);
      //   expect(err.code).to.be('ECONNRESET');
      //   doneOne();
      // });

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
      proxyServer.close();
      done();
    });
    req.end();
  });

  it('should proxy the request and provide a upstreamRes event with the request and response parameters', function(done) {
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:8080'
    });

    function requestHandler(req, res) {
      proxy.once('upstreamRes', function (upstreamRes, pReq, pRes) {
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

    proxyServer.listen('8036');
    source.listen('8080');
    http.request('http://127.0.0.1:8036', function() {}).end();
  });

  it('should proxy the request and provide and respond to manual user response when using modifyResponse', function(done) {
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:8080',
      selfHandleResponse: true
    });

    function requestHandler(req, res) {
      proxy.once('upstreamRes', function (upstreamRes, pReq, pRes) {
        upstreamRes.pipe(concat(function (body) {
          expect(body.toString('utf8')).eql('Response');
          pRes.end(Buffer.from('my-custom-response'));
        }))
      });

      proxy.web(req, res);
    }

    var proxyServer = http.createServer(requestHandler);

    var source = http.createServer(function(req, res) {
      res.end('Response');
    });

    async.parallel([
      next => proxyServer.listen(8036, next),
      next => source.listen(8080, next)
    ], function (err) {
      http.get('http://127.0.0.1:8036', function(res) {
        res.pipe(concat(function(body) {
          expect(body.toString('utf8')).eql('my-custom-response');
          source.close();
          proxyServer.close();
          done();
        }));
      }).once('error', done);
    })
  });

  it('should proxy the request and handle changeOrigin option', function (done) {
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:8080',
      changeOrigin: true
    });

    function requestHandler(req, res) {
      proxy.web(req, res);
    }

    var proxyServer = http.createServer(requestHandler);

    var source = http.createServer(function(req, res) {
      source.close();
      proxyServer.close();
      expect(req.method).to.eql('GET');
      expect(req.headers.host.split(':')[1]).to.eql('8080');
      done();
    });

    proxyServer.listen('8081');
    source.listen('8080');

    http.request('http://127.0.0.1:8081', function() {}).end();
  });

  it('should proxy the request with the Authorization header set', function (done) {
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:8080',
      auth: 'user:pass'
    });

    function requestHandler(req, res) {
      proxy.web(req, res);
    }

    var proxyServer = http.createServer(requestHandler);

    var source = http.createServer(function(req, res) {
      source.close();
      proxyServer.close();
      var auth = Buffer.from(req.headers.authorization.split(' ')[1], 'base64');
      expect(req.method).to.eql('GET');
      expect(auth.toString()).to.eql('user:pass');
      done();
    });

    proxyServer.listen('8081');
    source.listen('8080');

    http.request('http://127.0.0.1:8081', function() {}).end();
  });

  it('should proxy requests to multiple servers with different options', function (done) {
    var proxy = httpProxy.createProxyServer({});

    // proxies to two servers depending on url, rewriting the url as well
    // http://127.0.0.1:8080/s1/ -> http://127.0.0.1:8081/
    // http://127.0.0.1:8080/ -> http://127.0.0.1:8082/
    function requestHandler(req, res) {
      if (req.url.indexOf('/s1/') === 0) {
        proxy.web(req, res, {
          ignorePath: true,
          target: 'http://127.0.0.1:8081' + req.url.substring(3)
        });
      } else {
        proxy.web(req, res, {
          target: 'http://127.0.0.1:8082'
        });
      }
    }

    var proxyServer = http.createServer(requestHandler);

    var source1 = http.createServer(function(req, res) {
      expect(req.method).to.eql('GET');
      expect(req.headers.host.split(':')[1]).to.eql('8080');
      expect(req.url).to.eql('/test1');
    });

    var source2 = http.createServer(function(req, res) {
      source1.close();
      source2.close();
      proxyServer.close();
      expect(req.method).to.eql('GET');
      expect(req.headers.host.split(':')[1]).to.eql('8080');
      expect(req.url).to.eql('/test2');
      done();
    });

    proxyServer.listen('8080');
    source1.listen('8081');
    source2.listen('8082');

    http.request('http://127.0.0.1:8080/s1/test1', function() {}).end();
    http.request('http://127.0.0.1:8080/test2', function() {}).end();
  });
});

describe('#followRedirects', function () {
  it('should proxy the request follow redirects', function (done) {
    var proxy = httpProxy.createProxyServer({
      target: 'http://127.0.0.1:8080',
      followRedirects: true
    });

    function requestHandler(req, res) {
      proxy.web(req, res);
    }

    var proxyServer = http.createServer(requestHandler);

    var source = http.createServer(function(req, res) {

      if (url.parse(req.url).pathname === '/redirect') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      }

      res.writeHead(301, { 'Location': '/redirect' });
      res.end();
    });

    proxyServer.listen('8081');
    source.listen('8080');

    http.request('http://127.0.0.1:8081', function(res) {
      source.close();
      proxyServer.close();
      expect(res.statusCode).to.eql(200);
      done();
    }).end();
  });
});
