var common = require('../lib/http-proxy/common'),
    expect = require('expect.js');

describe('lib/http-proxy/common.js', function () {
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
        },
        headers: {'fizz': 'bang', 'overwritten':true},
        localAddress: 'local.address',
      },
      {
        method    : 'i',
        url      : 'am',
        headers   : {'pro':'xy','overwritten':false} 
      });

      expect(outgoing.host).to.eql('hey');
      expect(outgoing.hostname).to.eql('how');
      expect(outgoing.socketPath).to.eql('are');
      expect(outgoing.port).to.eql('you');
      expect(outgoing.agent).to.eql('?');

      expect(outgoing.method).to.eql('i');
      expect(outgoing.path).to.eql('am');

      expect(outgoing.headers.pro).to.eql('xy');
      expect(outgoing.headers.fizz).to.eql('bang');
      expect(outgoing.headers.overwritten).to.eql(true);
      expect(outgoing.localAddress).to.eql('local.address');
    });

    it('should set the agent to false if none is given', function () {
      var outgoing = {};
      common.setupOutgoing(outgoing, {target:
        'http://localhost'
      }, { url: '/' });
      expect(outgoing.agent).to.eql(false);
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