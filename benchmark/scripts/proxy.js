var http = require('http'),
    httpProxy = require('../../');
//
// Create your proxy server
//
httpProxy.createProxyServer({ target: 'http://localhost:9000' })
  .on('error', function(e) {
    // Silently drop the errors without terminate the proxy.
    // read / connection timeout errors are likely occur when performing
    // "wrk -c 100 -d5m -t 8 http://127.0.0.1:8000". wrk will accumualate
    // the errors.
    // console.log(e);
  })
  .listen(8000);