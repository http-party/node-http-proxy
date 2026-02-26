var common = require('../lib/http-proxy/common'),
    url = require('url'),
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
        auth:'username:pass'
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
      expect(outgoing.auth).to.eql('username:pass');
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

    it('should properly detect https/wss protocol without the colon', function () {
      var outgoing = {};
      common.setupOutgoing(outgoing, {
        target: {
          protocol: 'https',
          host: 'whatever.com'
        }
      }, { url: '/' });

      expect(outgoing.port).to.eql(443);
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

    //
    // This is the proper failing test case for the common.join problem
    //
    it('should correctly format the toProxy URL', function () {
      var outgoing = {};
      var google = 'https://google.com'
      common.setupOutgoing(outgoing, {
        target: url.parse('http://sometarget.com:80'),
        toProxy: true,
      }, { url: google });

      expect(outgoing.path).to.eql('/' + google);
    });

    it('should not replace :\ to :\\ when no https word before', function () {
      var outgoing = {};
      var google = 'https://google.com:/join/join.js'
      common.setupOutgoing(outgoing, {
        target: url.parse('http://sometarget.com:80'),
        toProxy: true,
      }, { url: google });

      expect(outgoing.path).to.eql('/' + google);
    });

    it('should not replace :\ to :\\ when no http word before', function () {
      var outgoing = {};
      var google = 'http://google.com:/join/join.js'
      common.setupOutgoing(outgoing, {
        target: url.parse('http://sometarget.com:80'),
        toProxy: true,
      }, { url: google });

      expect(outgoing.path).to.eql('/' + google);
    });

    describe('when using ignorePath', function () {
      it('should ignore the path of the `req.url` passed in but use the target path', function () {
        var outgoing = {};
        var myEndpoint = 'https://whatever.com/some/crazy/path/whoooo';
        common.setupOutgoing(outgoing, {
          target: url.parse(myEndpoint),
          ignorePath: true
        }, { url: '/more/crazy/pathness' });

        expect(outgoing.path).to.eql('/some/crazy/path/whoooo');
      });

      it('and prependPath: false, it should ignore path of target and incoming request', function () {
         var outgoing = {};
        var myEndpoint = 'https://whatever.com/some/crazy/path/whoooo';
        common.setupOutgoing(outgoing, {
          target: url.parse(myEndpoint),
          ignorePath: true,
          prependPath: false
        }, { url: '/more/crazy/pathness' });

        expect(outgoing.path).to.eql('');
      });
    });

    describe('when using changeOrigin', function () {
      it('should correctly set the port to the host when it is a non-standard port using url.parse', function () {
        var outgoing = {};
        var myEndpoint = 'https://myCouch.com:6984';
        common.setupOutgoing(outgoing, {
          target: url.parse(myEndpoint),
          changeOrigin: true
        }, { url: '/' });

        expect(outgoing.headers.host).to.eql('mycouch.com:6984');
      });

      it('should correctly set the port to the host when it is a non-standard port when setting host and port manually (which ignores port)', function () {
        var outgoing = {};
        common.setupOutgoing(outgoing, {
          target: {
            protocol: 'https:',
            host: 'mycouch.com',
            port: 6984
          },
          changeOrigin: true
        }, { url: '/' });
        expect(outgoing.headers.host).to.eql('mycouch.com:6984');
      })
    });

    it('should pass through https client parameters', function () {
      var outgoing = {};
      common.setupOutgoing(outgoing,
      {
        agent     : '?',
        target: {
          host      : 'how',
          hostname  : 'are',
          socketPath: 'you',
          protocol: 'https:',
          pfx: 'my-pfx',
          key: 'my-key',
          passphrase: 'my-passphrase',
          cert: 'my-cert',
          ca: 'my-ca',
          ciphers: 'my-ciphers',
          secureProtocol: 'my-secure-protocol'
        }
      },
      {
        method    : 'i',
        url      : 'am'
      });

      expect(outgoing.pfx).eql('my-pfx');
      expect(outgoing.key).eql('my-key');
      expect(outgoing.passphrase).eql('my-passphrase');
      expect(outgoing.cert).eql('my-cert');
      expect(outgoing.ca).eql('my-ca');
      expect(outgoing.ciphers).eql('my-ciphers');
      expect(outgoing.secureProtocol).eql('my-secure-protocol');
    });

    it('should handle overriding the `method` of the http request', function () {
      var outgoing = {};
      common.setupOutgoing(outgoing, {
        target: url.parse('https://whooooo.com'),
        method: 'POST' ,
      }, { method: 'GET', url: '' });

      expect(outgoing.method).eql('POST');
    });

    // url.parse('').path => null
    it('should not pass null as last arg to #urlJoin', function(){
      var outgoing = {};
      common.setupOutgoing(outgoing, {target:
        { path: '' }
      }, { url : '' });

      expect(outgoing.path).to.be('');
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
