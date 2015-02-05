var httpProxy = require('../lib/http-proxy/passes/web-outgoing'),
    expect = require('expect.js');

describe('lib/http-proxy/passes/web-outgoing.js', function () {
  describe('#setRedirectHostRewrite', function () {
    beforeEach(function() {
      this.req = {
        headers: {
          host: "x2.com"
        }
      };
      this.proxyRes = {
        statusCode: 301,
        headers: {
          location: "http://f.com/"
        }
      };
    });

    context('rewrites location host with hostRewrite', function() {
      beforeEach(function() {
        this.options = {
          hostRewrite: "x.com"
        };
      });
      [301, 302, 307, 308].forEach(function(code) {
        it('on ' + code, function() {
          this.proxyRes.statusCode = code;
          httpProxy.setRedirectHostRewrite(this.req, {}, this.proxyRes, this.options);
          expect(this.proxyRes.headers.location).to.eql('http://'+this.options.hostRewrite+'/');
        });
      });

      it('not on 200', function() {
        this.proxyRes.statusCode = 200;
        httpProxy.setRedirectHostRewrite(this.req, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('http://f.com/');
      });

      it('not when hostRewrite is unset', function() {
        delete this.options.hostRewrite;
        httpProxy.setRedirectHostRewrite(this.req, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('http://f.com/');
      });

      it('takes precedence over autoRewrite', function() {
        this.options.autoRewrite = true;
        httpProxy.setRedirectHostRewrite(this.req, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('http://'+this.options.hostRewrite+'/');
      });
    });

    context('rewrites location host with autoRewrite', function() {
      beforeEach(function() {
        this.options = {
          autoRewrite: true,
        };
      });
      [301, 302, 307, 308].forEach(function(code) {
        it('on ' + code, function() {
          this.proxyRes.statusCode = code;
          httpProxy.setRedirectHostRewrite(this.req, {}, this.proxyRes, this.options);
          expect(this.proxyRes.headers.location).to.eql('http://'+this.req.headers.host+'/');
        });
      });

      it('not on 200', function() {
        this.proxyRes.statusCode = 200;
        httpProxy.setRedirectHostRewrite(this.req, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('http://f.com/');
      });

      it('not when autoRewrite is unset', function() {
        delete this.options.autoRewrite;
        httpProxy.setRedirectHostRewrite(this.req, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('http://f.com/');
      });
    });

    context('rewrites location protocol with protocolRewrite', function() {
      beforeEach(function() {
        this.options = {
          protocolRewrite: 'https',
        };
      });
      [301, 302, 307, 308].forEach(function(code) {
        it('on ' + code, function() {
          this.proxyRes.statusCode = code;
          httpProxy.setRedirectHostRewrite(this.req, {}, this.proxyRes, this.options);
          expect(this.proxyRes.headers.location).to.eql('https://f.com/');
        });
      });

      it('not on 200', function() {
        this.proxyRes.statusCode = 200;
        httpProxy.setRedirectHostRewrite(this.req, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('http://f.com/');
      });

      it('not when protocolRewrite is unset', function() {
        delete this.options.protocolRewrite;
        httpProxy.setRedirectHostRewrite(this.req, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('http://f.com/');
      });

      it('works together with hostRewrite', function() {
        this.options.hostRewrite = 'x.com'
        httpProxy.setRedirectHostRewrite(this.req, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('https://x.com/');
      });

      it('works together with autoRewrite', function() {
        this.options.autoRewrite = true
        httpProxy.setRedirectHostRewrite(this.req, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('https://x2.com/');
      });
    });
  });

  describe('#setConnection', function () {
    it('set the right connection with 1.0 - `close`', function() {
      var proxyRes = { headers: {} };
      httpProxy.setConnection({
        httpVersion: '1.0',
        headers: {
          connection: null
        }
      }, {}, proxyRes);

      expect(proxyRes.headers.connection).to.eql('close');
    });

    it('set the right connection with 1.0 - req.connection', function() {
      var proxyRes = { headers: {} };
      httpProxy.setConnection({
        httpVersion: '1.0',
        headers: {
          connection: 'hey'
        }
      }, {}, proxyRes);

      expect(proxyRes.headers.connection).to.eql('hey');
    });

    it('set the right connection - req.connection', function() {
      var proxyRes = { headers: {} };
      httpProxy.setConnection({
        httpVersion: null,
        headers: {
          connection: 'hola'
        }
      }, {}, proxyRes);

      expect(proxyRes.headers.connection).to.eql('hola');
    });

    it('set the right connection - `keep-alive`', function() {
      var proxyRes = { headers: {} };
      httpProxy.setConnection({
        httpVersion: null,
        headers: {
          connection: null
        }
      }, {}, proxyRes);

      expect(proxyRes.headers.connection).to.eql('keep-alive');
    });

  });

  describe('#writeStatusCode', function () {
    it('should write status code', function() {
      var res = {
        writeHead: function(n) {
          expect(n).to.eql(200);
        }
      }

      httpProxy.writeStatusCode({}, res, { statusCode: 200 });
    });
  });

  describe('#writeHeaders', function() {
    var proxyRes = {
      headers: {
        hey: 'hello',
        how: 'are you?'
      }
    };

    var res = {
      setHeader: function(k, v) {
        this.headers[k] = v;
      },
      headers: {}
    };

    httpProxy.writeHeaders({}, res, proxyRes);

    expect(res.headers.hey).to.eql('hello');
    expect(res.headers.how).to.eql('are you?');
  });


  describe('#removeChunked', function() {
    var proxyRes = {
      headers: {
        'transfer-encoding': 'hello'
      }
    };


    httpProxy.removeChunked({ httpVersion: '1.0' }, {}, proxyRes);

    expect(proxyRes.headers['transfer-encoding']).to.eql(undefined);
  });

});

