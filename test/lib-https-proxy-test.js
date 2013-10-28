var httpProxy = require('../lib/http-proxy'),
    expect    = require('expect.js'),
    http      = require('http')
    https     = require('https'),
    path      = require('path'),
    fs        = require('fs');

//
// Expose a port number generator.
// thanks to @3rd-Eden
//
var initialPort = 1024, gen = {};
Object.defineProperty(gen, 'port', {
  get: function get() {
    return initialPort++;
  }
});

describe('lib/http-proxy.js', function() {
  describe('#createProxyServer using HTTPS', function() {
  	describe('HTTPS to HTTP', function () {
      it('should proxy the request en send back the response', function (done) {
        var ports = { source: gen.port, proxy: gen.port };
        var source = http.createServer(function(req, res) {
          console.log('Request:', req.headers);
          expect(req.method).to.eql('GET');
          expect(req.headers.host.split(':')[1]).to.eql(ports.proxy);
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Hello from ' + ports.source);
        });

        source.listen(ports.source);

        var proxy = httpProxy.createProxyServer({
          forward: 'http://127.0.0.1:' + ports.source,
          ssl: {
            key: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-key.pem')),
            cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-cert.pem')),
          }
        }).listen(ports.proxy);

        var req = https.request({
          host: 'localhost',
          port: ports.proxy,
          path: '/',
          method: 'GET',
          localAddress: '127.0.0.1',
          rejectUnauthorized: false
        }, function(res) {
          console.log(res);
          res.on('data', function (ch) {
            console.log('Chunks', ch)
          })
          console.log('Response:', res.statusCode);
          source.close();
          proxy._server.close();
          done();
        });

        req.on('error', function (err) { console.log('Erroring', err); });
        req.end();
      })
  	})
  });
});