var httpProxy = require('../lib/http-proxy'),
    expect    = require('expect.js'),
    http      = require('http'),
    ws        = require('ws')
    io        = require('socket.io'),
    ioClient  = require('socket.io-client');


describe('lib/http-proxy.js', function() {
  describe('#createProxyServer', function() {
    it('should throw without options', function() {
      var error;
      try {
        httpProxy.createProxyServer();
      } catch(e) {
        error = e;
      }

      expect(error).to.be.an(Error);
    })

    it('should return an object otherwise', function() {
      var obj = httpProxy.createProxyServer({
        target: 'http://www.google.com:80'
      });

      expect(obj.web).to.be.a(Function);
      expect(obj.ws).to.be.a(Function);
      expect(obj.listen).to.be.a(Function);
    });
  });

  describe('#createProxyServer with forward options and using web-incoming passes', function () {
    it('should pipe the request using web-incoming#stream method', function (done) {
      var proxy = httpProxy.createProxyServer({
        forward: 'http://127.0.0.1:8080'
      }).listen('8081')

      var source = http.createServer(function(req, res) {
        expect(req.method).to.eql('GET');
        expect(req.headers.host.split(':')[1]).to.eql('8081');
        source.close();
        proxy._server.close();
        done();
      });

      source.listen('8080');
      
      http.request('http://127.0.0.1:8081', function() {}).end();
    })
  });

  describe('#createProxyServer using the web-incoming passes', function () {
    it('should make the request on pipe and finish it', function(done) {
      var proxy = httpProxy.createProxyServer({
        target: 'http://127.0.0.1:8080'
      }).listen('8081');

      var source = http.createServer(function(req, res) {
        expect(req.method).to.eql('POST');
        expect(req.headers['x-forwarded-for']).to.eql('127.0.0.1');
        expect(req.headers.host.split(':')[1]).to.eql('8081');
        source.close();
        proxy._server.close();
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

  describe('#createProxyServer using the web-incoming passes', function () {
    it('should make the request, handle response and finish it', function(done) {
      var proxy = httpProxy.createProxyServer({
        target: 'http://127.0.0.1:8080'
      }).listen('8081');

      var source = http.createServer(function(req, res) {
        expect(req.method).to.eql('GET');
        expect(req.headers.host.split(':')[1]).to.eql('8081');
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
          proxy._server.close();
          done();
        });
      }).end();
    });
  });

  describe('#createProxyServer() method with error response', function () {
    it('should make the request and emit the error event', function(done) {
      var proxy = httpProxy.createProxyServer({
        target: 'http://127.0.0.1:8080'
      });

      proxy.on('error', function (err) {
        expect(err).to.be.an(Error);
        expect(err.code).to.be('ECONNREFUSED');
        proxy._server.close();
        done();
      })

      proxy.listen('8081');
      
      http.request({
        hostname: '127.0.0.1',
        port: '8081',
        method: 'GET',
      }, function() {}).end();
    });
  });

  describe('#createProxyServer setting the correct timeout value', function () {
    it('should hang up the socket at the timeout', function (done) {
      this.timeout(30);
      var proxy = httpProxy.createProxyServer({
        target: 'http://127.0.0.1:8080',
        timeout: 3
      }).listen('8081');

      var source = http.createServer(function(req, res) {
        setTimeout(function () {
          res.end('At this point the socket should be closed');
        }, 5)
      }).listen('8080');

      var testReq = http.request({
        hostname: '127.0.0.1',
        port: '8081',
        method: 'GET',
      }, function() {});

      testReq.on('error', function (e) {
        expect(e).to.be.an(Error);
        expect(e.code).to.be.eql('ECONNRESET');
        proxy._server.close();
        source.close();
        done();
      });

      testReq.end();
    })
  })

  // describe('#createProxyServer using the web-incoming passes', function () {
  //   it('should emit events correclty', function(done) {
  //     var proxy = httpProxy.createProxyServer({
  //       target: 'http://127.0.0.1:8080'
  //     }),

  //     proxyServer = proxy.listen('8081'),

  //     source = http.createServer(function(req, res) {
  //       expect(req.method).to.eql('GET');
  //       expect(req.headers.host.split(':')[1]).to.eql('8081');
  //       res.writeHead(200, {'Content-Type': 'text/plain'})
  //       res.end('Hello from ' + source.address().port);
  //     }),

  //     events = [];

  //     source.listen('8080');

  //     proxy.ee.on('http-proxy:**', function (uno, dos, tres) {
  //       events.push(this.event);
  //     })
      
  //     http.request({
  //       hostname: '127.0.0.1',
  //       port: '8081',
  //       method: 'GET',
  //     }, function(res) {
  //       expect(res.statusCode).to.eql(200);

  //       res.on('data', function (data) {
  //         expect(data.toString()).to.eql('Hello from 8080');
  //       });

  //       res.on('end', function () {
  //         expect(events).to.contain('http-proxy:outgoing:web:begin');
  //         expect(events).to.contain('http-proxy:outgoing:web:end');
  //         source.close();
  //         proxyServer._server.close();
  //         done();
  //       });
  //     }).end();
  //   });
  // });

  describe('#createProxyServer using the ws-incoming passes', function () {
    it('should proxy the websockets stream', function (done) {
      var proxy = httpProxy.createProxyServer({
        target: 'ws://127.0.0.1:8080',
        ws: true
      }),
      proxyServer = proxy.listen('8081'),
      destiny = new ws.Server({ port: 8080 }, function () {
        var client = new ws('ws://127.0.0.1:8081');

        client.on('open', function () {
          client.send('hello there');
        });

        client.on('message', function (msg) {
          expect(msg).to.be('Hello over websockets');
          client.close();
          proxyServer._server.close();
          destiny.close();
          done();
        });
      });

      destiny.on('connection', function (socket) {
        socket.on('message', function (msg) {
          expect(msg).to.be('hello there');
          socket.send('Hello over websockets');
        });
      });
    });
  });

  describe('#createProxyServer using the ws-incoming passes', function () {
    it('should proxy a socket.io stream', function (done) {
      var proxy = httpProxy.createProxyServer({
        target: 'ws://127.0.0.1:8080',
        ws: true
      }),
      proxyServer = proxy.listen('8081'),
      destiny = io.listen(8080, function () {
        var client = ioClient.connect('ws://127.0.0.1:8081');

        client.on('connect', function () {
          client.emit('incoming', 'hello there');
        });

        client.on('outgoing', function (data) {
          expect(data).to.be('Hello over websockets');
          proxyServer._server.close();
          destiny.server.close();
          done();
        });
      });

      destiny.sockets.on('connection', function (socket) {
        socket.on('incoming', function (msg) {
          expect(msg).to.be('hello there');
          socket.emit('outgoing', 'Hello over websockets');
        });
      })
    });
  });

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

describe('#createProxyServer using the ws-incoming passes', function () {
  it('should call the callback with the error');
})