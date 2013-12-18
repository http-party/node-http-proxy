var httpProxy = require('../lib/http-proxy/passes/ws-incoming'),
    expect = require('expect.js');

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
      returnValue = httpProxy.checkMethodAndHeader(stubRequest, stubSocket);
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
      returnValue = httpProxy.checkMethodAndHeader(stubRequest, stubSocket);
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
      returnValue = httpProxy.checkMethodAndHeader(stubRequest, stubSocket);
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
      returnValue = httpProxy.checkMethodAndHeader(stubRequest, stubSocket);
      expect(returnValue).to.be(undefined);
      expect(destroyCalled).to.be(false);
    })
  });

  describe('#XHeaders', function () {
    it('return if no forward request', function () {
      var returnValue = httpProxy.XHeaders({}, {}, {});
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
      }
      httpProxy.XHeaders(stubRequest, {}, { xfwd: true });
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
      httpProxy.XHeaders(stubRequest, {}, { xfwd: true });
      expect(stubRequest.headers['x-forwarded-for']).to.be('192.168.1.3');
      expect(stubRequest.headers['x-forwarded-port']).to.be('8181');
      expect(stubRequest.headers['x-forwarded-proto']).to.be('wss');
    });
  });
});
