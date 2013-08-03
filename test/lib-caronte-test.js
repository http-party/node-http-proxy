var caronte = require('../lib/caronte'),
    expect = require('expect.js');

describe('lib/caronte.js', function() {
  describe('#createProxyServer', function() {
    it('should throw without options', function() {
      var error;
      try {
        caronte.createProxyServer();
      } catch(e) {
        error = e;
      }

      expect(error).to.be.an(Error);
    })

    it('should return an object otherwise', function() {
      var obj = caronte.createProxyServer({
        target: 'http://www.google.com:80'
      });

      expect(obj.web).to.be.a(Function);
      expect(obj.ws).to.be.a(Function);
      expect(obj.listen).to.be.a(Function);
    });
  });
});
