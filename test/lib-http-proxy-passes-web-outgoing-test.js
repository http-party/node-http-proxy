var httpProxy = require('../lib/http-proxy/passes/web-outgoing'),
    expect = require('expect.js');

describe('lib/http-proxy/passes/web-outgoing.js', function () {
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
 
