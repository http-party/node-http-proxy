
/**
 * Module dependencies.
 */

var proxy = require('../')
  , cluster = require('cluster');

var server = proxy.createServer({
  router: {
      'foo.com': 'localhost:3001'
    , 'bar.com': 'localhost:3002'
  }
});

cluster(server)
  .use(cluster.debug())
  .listen(3000);

