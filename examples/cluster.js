
/**
 * Module dependencies.
 */

var proxy = require('../')
  , cluster = require('cluster');

var server = proxy.createServer({
  router: {
      'foo.com': 3001
    , 'bar.com': 3002
  }
});

cluster(server)
  .use(cluster.debug())
  .listen(3000);

