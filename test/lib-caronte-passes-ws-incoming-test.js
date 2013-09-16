var caronte = require('../lib/caronte/passes/ws'),
    expect = require('expect.js');

describe('lib/caronte/passes/ws.js', function () {
  describe('#checkMethodAndHeader', function () {
    it('should drop non-GET connections', function () {
      var endCalled = false,
      stubRequest = {
        method: 'DELETE',
        headers: {},
        end: function () {
          // Simulate Stream.end() method when call
          endCalled = true;
        }
      },
      returnValue = caronte.checkMethodAndHeader(stubRequest, {}, {});
      expect(returnValue).to.be(true);
      expect(endCalled).to.be(true);
    })

    it('should drop connections when no upgrade header', function () {
      var endCalled = false,
      stubRequest = {
        method: 'GET',
        headers: {},
        end: function () {
          // Simulate Stream.end() method when call
          endCalled = true;
        }
      },
      returnValue = caronte.checkMethodAndHeader(stubRequest, {}, {});
      expect(returnValue).to.be(true);
      expect(endCalled).to.be(true);
    })

    it('should drop connections when upgrade header is different of `websocket`', function () {
      var endCalled = false,
      stubRequest = {
        method: 'GET',
        headers: {
          upgrade: 'anotherprotocol'
        },
        end: function () {
          // Simulate Stream.end() method when call
          endCalled = true;
        }
      },
      returnValue = caronte.checkMethodAndHeader(stubRequest, {}, {});
      expect(returnValue).to.be(true);
      expect(endCalled).to.be(true);
    })

    it('should return nothing when all is ok', function () {
      var endCalled = false,
      stubRequest = {
        method: 'GET',
        headers: {
          upgrade: 'websocket'
        },
        end: function () {
          // Simulate Stream.end() method when call
          endCalled = true;
        }
      },
      returnValue = caronte.checkMethodAndHeader(stubRequest, {}, {});
      expect(returnValue).to.be(undefined);
      expect(endCalled).to.be(false);
    })
  });

  describe('#XHeaders', function () {
    // var stubRequest = {
    //   connection: {
    //     remoteAddress: '192.168.1.2',
    //     remotePort: '8080'
    //   },
    //   headers: {}
    // }

    // it('set the correct x-forwarded-* headers', function () {
    //   caronte.XHeaders(stubRequest, {}, { xfwd: true });
    //   expect(stubRequest.headers['x-forwarded-for']).to.be('192.168.1.2');
    //   expect(stubRequest.headers['x-forwarded-port']).to.be('8080');
    //   expect(stubRequest.headers['x-forwarded-proto']).to.be('http');
    // });
  });
});
