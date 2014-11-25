var httpProxy = require('../lib/http-proxy/passes/web-outgoing'),
    expect = require('expect.js');

describe('lib/http-proxy/passes/web-outgoing.js', function () {
  describe('#setRedirectHostRewrite', function () {
    context('rewrites location host to option', function() {
      beforeEach(function() {
        this.proxyRes = {
          statusCode: 301,
          headers: {
            location: "http://f.com/"
          }
        };

        this.options = {
          hostRewrite: "x.com"
        };
      });

      it('on 301', function() {
        this.proxyRes.statusCode = 301;
        httpProxy.setRedirectHostRewrite({}, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('http://'+this.options.hostRewrite+'/');
      });

      it('on 302', function() {
        this.proxyRes.statusCode = 302;
        httpProxy.setRedirectHostRewrite({}, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('http://'+this.options.hostRewrite+'/');
      });

      it('on 307', function() {
        this.proxyRes.statusCode = 307;
        httpProxy.setRedirectHostRewrite({}, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('http://'+this.options.hostRewrite+'/');
      });

      it('on 308', function() {
        this.proxyRes.statusCode = 308;
        httpProxy.setRedirectHostRewrite({}, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('http://'+this.options.hostRewrite+'/');
      });

      it('not on 200', function() {
        this.proxyRes.statusCode = 200;
        httpProxy.setRedirectHostRewrite({}, {}, this.proxyRes, this.options);
        expect(this.proxyRes.headers.location).to.eql('http://f.com/');
      });

      it('not when hostRewrite is unset', function() {
        httpProxy.setRedirectHostRewrite({}, {}, this.proxyRes, {});
        expect(this.proxyRes.headers.location).to.eql('http://f.com/');
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
 
