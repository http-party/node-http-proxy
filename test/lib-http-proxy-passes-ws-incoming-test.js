var wsPasses = require('../lib/http-proxy/passes/ws-incoming'),
    expect = require('expect.js'),
    http = require('http'),
    httpProxy = require('../lib/http-proxy');

describe('lib/http-proxy/passes/ws-incoming.js', function () {
  describe('#checkMethodAndHeader', function () {
    it('should drop non-GET connections', function () {
      var destroyCalled = false,
      stubRequest = {
        method: 'DELETE',
        headers: {}
      },
      stubSocket = {
        destroy: function () {
          // Simulate Socket.destroy() method when call
          destroyCalled = true;
        }
      }
      returnValue = wsPasses.checkMethodAndHeader(stubRequest, stubSocket);
      expect(returnValue).to.be(true);
      expect(destroyCalled).to.be(true);
    })

    it('should drop connections when no upgrade header', function () {
      var destroyCalled = false,
      stubRequest = {
        method: 'GET',
        headers: {}
      },
      stubSocket = {
        destroy: function () {
          // Simulate Socket.destroy() method when call
          destroyCalled = true;
        }
      }
      returnValue = wsPasses.checkMethodAndHeader(stubRequest, stubSocket);
      expect(returnValue).to.be(true);
      expect(destroyCalled).to.be(true);
    })

    it('should drop connections when upgrade header is different of `websocket`', function () {
      var destroyCalled = false,
      stubRequest = {
        method: 'GET',
        headers: {
          upgrade: 'anotherprotocol'
        }
      },
      stubSocket = {
        destroy: function () {
          // Simulate Socket.destroy() method when call
          destroyCalled = true;
        }
      }
      returnValue = wsPasses.checkMethodAndHeader(stubRequest, stubSocket);
      expect(returnValue).to.be(true);
      expect(destroyCalled).to.be(true);
    })

    it('should return nothing when all is ok', function () {
      var destroyCalled = false,
      stubRequest = {
        method: 'GET',
        headers: {
          upgrade: 'websocket'
        }
      },
      stubSocket = {
        destroy: function () {
          // Simulate Socket.destroy() method when call
          destroyCalled = true;
        }
      }
      returnValue = wsPasses.checkMethodAndHeader(stubRequest, stubSocket);
      expect(returnValue).to.be(undefined);
      expect(destroyCalled).to.be(false);
    })

    it('should detect a proxyWsReq event and modify headers', function (done) {
      var proxy = httpProxy.createProxyServer({
        target: 'http://127.0.0.1:8080',
        ws: true
      });

      proxy.on('proxyWsReq', function(proxyWsReq, req, res, options) {
        proxyWsReq.setHeader('X-Special-Proxy-Header', 'foobar');
      });

      function requestHandler(req, res) {
        proxy.web(req, res);
      }

      var proxyServer = http.createServer(requestHandler);

      proxyServer.on('upgrade', function(req, res, head){
        proxy.ws(req, res, head);
      });

      var source = http.createServer(function(req, res) {
        res.end();
      });

      source.on('upgrade', function(req, res, head){
        expect(req.headers['x-special-proxy-header']).to.eql('foobar');
        source.close();
        proxyServer.close();
        done();
      });

      source.on('error', function(){});
      proxy.on('error', function(){});
      proxyServer.on('error', function(){});

      proxyServer.listen('8081');
      source.listen('8080');

      var request = http.request({
        host: '127.0.0.1',
        port: '8081',
        method: 'GET',
        path: '/',
        headers: {
          'upgrade': 'websocket',
          'connection': 'Upgrade',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'sec-websocket-protocol': 'chat, superchat',
          'sec-websocket-version': 13
        }
      }, function() {});
      request.on('error', function(){});
      request.end();
    });
  });

  describe('#XHeaders', function () {
    it('return if no forward request', function () {
      var returnValue = wsPasses.XHeaders({}, {}, {});
      expect(returnValue).to.be(undefined);
    });

    it('set the correct x-forwarded-* headers from req.connection', function () {
      var stubRequest = {
        connection: {
          remoteAddress: '192.168.1.2',
          remotePort: '8080'
        },
        headers: {
          host: '192.168.1.2:8080'
        }
      };
      wsPasses.XHeaders(stubRequest, {}, { xfwd: true });
      expect(stubRequest.headers['x-forwarded-for']).to.be('192.168.1.2');
      expect(stubRequest.headers['x-forwarded-port']).to.be('8080');
      expect(stubRequest.headers['x-forwarded-proto']).to.be('ws');
    });

    it('set the correct x-forwarded-* headers from req.socket', function () {
      var stubRequest = {
        socket: {
          remoteAddress: '192.168.1.3',
          remotePort: '8181'
        },
        connection: {
          pair: true
        },
        headers: {
          host: '192.168.1.3:8181'
        }
      };
      wsPasses.XHeaders(stubRequest, {}, { xfwd: true });
      expect(stubRequest.headers['x-forwarded-for']).to.be('192.168.1.3');
      expect(stubRequest.headers['x-forwarded-port']).to.be('8181');
      expect(stubRequest.headers['x-forwarded-proto']).to.be('wss');
    });
  });
});
