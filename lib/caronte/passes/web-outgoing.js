var passes = exports;

/*!
 * Array of passes.
 * 
 * A `pass` is just a function that is executed on `req, res, options`
 * so that you can easily add new checks while still keeping the base
 * flexible.
 */

[ // <--

  function setConnection(req, res, proxyRes) {
    if (req.httpVersion === '1.0') {
      if (req.headers.connection) {
        proxyRes.headers.connection = req.headers.connection
      } else {
        proxyRes.headers.connection = 'close'
      }
    } else if (!proxyRes.headers.connection) {
      if (req.headers.connection) { proxyRes.headers.connection = req.headers.connection }
      else {
        proxyRes.headers.connection = 'keep-alive'
      }
    }
  },

  function writeHeaders(req, res, proxyRes) {
    Object.keys(proxyRes.headers).forEach(function(key) {
      res.setHeader(key, proxyRes.headers[key]);
    });
  },

  function writeStatusCode(req, res, proxyRes) {
    res.writeHead(proxyRes.statusCode);
  }

] // <--
  .forEach(function(func) {
    passes[func.name] = func;   
  });
