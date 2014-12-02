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

    it('should not override agentless upgrade header', function () {
      var outgoing = {};
      common.setupOutgoing(outgoing,
        {
          agent: undefined,
          target: {
            host      : 'hey',
            hostname  : 'how',
            socketPath: 'are',
            port      : 'you',
          },
          headers: {'connection': 'upgrade'},
        },
        {
          method    : 'i',
          url      : 'am',
          headers   : {'pro':'xy','overwritten':false}
        });
      expect(outgoing.headers.connection).to.eql('upgrade');
    });

    it('should not override agentless connection: contains upgrade', function () {
      var outgoing = {};
      common.setupOutgoing(outgoing,
        {
          agent: undefined,
          target: {
            host      : 'hey',
            hostname  : 'how',
            socketPath: 'are',
            port      : 'you',
          },
          headers: {'connection': 'keep-alive, upgrade'}, // this is what Firefox sets
        },
        {
          method    : 'i',
          url      : 'am',
          headers   : {'pro':'xy','overwritten':false}
        });
      expect(outgoing.headers.connection).to.eql('keep-alive, upgrade');
    });

    it('should override agentless connection: contains improper upgrade', function () {
      // sanity check on upgrade regex
      var outgoing = {};
      common.setupOutgoing(outgoing,
        {
          agent: undefined,
          target: {
            host      : 'hey',
            hostname  : 'how',
            socketPath: 'are',
            port      : 'you',
          },
          headers: {'connection': 'keep-alive, not upgrade'},
        },
        {
          method    : 'i',
          url      : 'am',
          headers   : {'pro':'xy','overwritten':false}
        });
      expect(outgoing.headers.connection).to.eql('close');
    });

    it('should override agentless non-upgrade header to close', function () {
      var outgoing = {};
      common.setupOutgoing(outgoing,
        {
          agent: undefined,
          target: {
            host      : 'hey',
            hostname  : 'how',
            socketPath: 'are',
            port      : 'you',
          },
          headers: {'connection': 'xyz'},
        },
        {
          method    : 'i',
          url      : 'am',
          headers   : {'pro':'xy','overwritten':false}
        });
      expect(outgoing.headers.connection).to.eql('close');
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
        headers   : {pro:'xy'}
      });

      expect(outgoing.host).to.eql('how');
      expect(outgoing.hostname).to.eql('are');
      expect(outgoing.socketPath).to.eql('you');
      expect(outgoing.agent).to.eql('?');

      expect(outgoing.method).to.eql('i');
      expect(outgoing.path).to.eql('am');
      expect(outgoing.headers.pro).to.eql('xy');

      expect(outgoing.port).to.eql(443);
    });

    it('should keep the original target path in the outgoing path', function(){
      var outgoing = {};
      common.setupOutgoing(outgoing, {target:
        { path: 'some-path' }
      }, { url : 'am' });

      expect(outgoing.path).to.eql('some-path/am');
    });

    it('should keep the original forward path in the outgoing path', function(){
      var outgoing = {};
      common.setupOutgoing(outgoing, {
        target: {},
        forward: {
          path: 'some-path'
        }
      }, {
        url : 'am'
      }, 'forward');

      expect(outgoing.path).to.eql('some-path/am');
    });

    it('should not prepend the target path to the outgoing path with prependPath = false', function () {
      var outgoing = {};
      common.setupOutgoing(outgoing, {
        target: { path: 'hellothere' },
        prependPath: false
      }, { url: 'hi' });

      expect(outgoing.path).to.eql('hi');
    })

    it('should properly join paths', function () {
      var outgoing = {};
      common.setupOutgoing(outgoing, {
        target: { path: '/forward' },
      }, { url: '/static/path' });

      expect(outgoing.path).to.eql('/forward/static/path');
    })

    it('should not modify the query string', function () {
      var outgoing = {};
      common.setupOutgoing(outgoing, {
        target: { path: '/forward' },
      }, { url: '/?foo=bar//&target=http://foobar.com/?a=1%26b=2&other=2' });

      expect(outgoing.path).to.eql('/forward/?foo=bar//&target=http://foobar.com/?a=1%26b=2&other=2');
    })
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
