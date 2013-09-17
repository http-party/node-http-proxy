var common = require('../lib/caronte/common'),
    expect = require('expect.js');

describe('lib/caronte/common.js', function () {
  describe('#setupOutgoing', function () {
    it('should setup the correct headers', function () {
      var outgoing = {};
      common.setupOutgoing(outgoing,
      {
        agent     : '?',
        target: {
          host      : 'hey',
          hostname  : 'how',
          socketPath: 'are',
          port      : 'you',
        }
      },
      {
        method    : 'i',
        url      : 'am',
        headers   : 'proxy' 
      });

      expect(outgoing.host).to.eql('hey');
      expect(outgoing.hostname).to.eql('how');
      expect(outgoing.socketPath).to.eql('are');
      expect(outgoing.port).to.eql('you');
      expect(outgoing.agent).to.eql('?');

      expect(outgoing.method).to.eql('i');
      expect(outgoing.path).to.eql('am');
      expect(outgoing.headers).to.eql('proxy')
    });

    it('set the port according to the protocol', function () {
      var outgoing = {};
      common.setupOutgoing(outgoing,
      { 
        agent     : '?',
        target: {
          host      : 'how',
          hostname  : 'are',
          socketPath: 'you',
          protocol: 'https:'
        }
      },
      {
        method    : 'i',
        url      : 'am',
        headers   : 'proxy' 
      });

      expect(outgoing.host).to.eql('how');
      expect(outgoing.hostname).to.eql('are');
      expect(outgoing.socketPath).to.eql('you');
      expect(outgoing.agent).to.eql('?');

      expect(outgoing.method).to.eql('i');
      expect(outgoing.path).to.eql('am');
      expect(outgoing.headers).to.eql('proxy')

      expect(outgoing.port).to.eql(443);
    });
  });

  describe('#setupSocket', function () {
    it('should setup a socket', function () {
      var socketConfig = {
        timeout: null,
        nodelay: false,
        keepalive: false
      },
      stubSocket = {
        setTimeout: function (num) {
          socketConfig.timeout = num;
        },
        setNoDelay: function (bol) {
          socketConfig.nodelay = bol;
        },
        setKeepAlive: function (bol) {
          socketConfig.keepalive = bol;
        }
      }
      returnValue = common.setupSocket(stubSocket);

      expect(socketConfig.timeout).to.eql(0);
      expect(socketConfig.nodelay).to.eql(true);
      expect(socketConfig.keepalive).to.eql(true);
    });
  });
});