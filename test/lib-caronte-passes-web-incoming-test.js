var caronte = require('../lib/caronte/passes/web'),
    expect = require('expect.js');

describe('lib/caronte/passes/web.js', function() {
  describe('#deleteLength', function() {
    it('should change `content-length`', function() {
      var stubRequest = {
        method: 'DELETE',
        headers: {}
      };
      caronte.deleteLength(stubRequest, {}, {});
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

      caronte.timeout(stubRequest, {}, { timeout: 5000});
      expect(done).to.eql(5000);
    });
  });

  describe('#XHeaders', function () {
    var stubRequest = {
      connection: {
        remoteAddress: '192.168.1.2',
        remotePort: '8080'
      },
      headers: {}
    }

    it('set the correct x-forwarded-* headers', function () {
      caronte.XHeaders(stubRequest, {}, { xfwd: true });
      expect(stubRequest.headers['x-forwarded-for']).to.be('192.168.1.2');
      expect(stubRequest.headers['x-forwarded-port']).to.be('8080');
      expect(stubRequest.headers['x-forwarded-proto']).to.be('http');
    });
  });
});
