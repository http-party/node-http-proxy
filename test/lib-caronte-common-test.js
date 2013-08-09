var common = require('../lib/caronte/common'),
    expect = require('expect.js');

describe('lib/caronte/common.js', function() {
  describe('#setupOutgoing', function() {
    it('should setup the right headers', function() {
      var outgoing = {};
      common.setupOutgoing(outgoing,
      {
        host      : 'hey',
        hostname  : 'how',
        socketPath: 'are',
        port      : 'you',
        agent     : '?'
      },
      {
        method    : 'i',
        path      : 'am',
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
  });
});