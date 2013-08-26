var ForwardStream = require('../lib/caronte/streams/forward'),
    expect        = require('expect.js'),
    Writable      = require('stream').Writable,
    http          = require('http');


describe('lib/caronte/passes/web.js', function () {
	describe('forward stream constructor', function () {
    it('should be an instance of Writable stream and get the correct options and methods', function () {
      var stubOptions = {
        key: 'value'
      };
      var forwardProxy = new ForwardStream(stubOptions);

      expect(forwardProxy).to.be.a(Writable);
      expect(forwardProxy.options).to.eql({ key: 'value' });
      expect(forwardProxy.onPipe).to.be.a('function');
      expect(forwardProxy.onFinish).to.be.a('function');
      expect(forwardProxy._events).to.have.property('pipe');
      expect(forwardProxy._events).to.have.property('finish');
    });
  });

  describe('should pipe the request and finish it', function () {
    it('should make the request on pipe and finish it');
    var stubOptions = {
      target: {
        hostname  : 'www.google.com',
        port      : '80',
        path       : '/'
      }
    };

    var forwardProxy = new ForwardStream({});

  });
});