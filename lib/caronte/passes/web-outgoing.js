var passes = exports;

/*!
 * Array of passes.
 * 
 * A `pass` is just a function that is executed on `req, res, options`
 * so that you can easily add new checks while still keeping the base
 * flexible.
 */

[ // <--
  function writeHeaders(res, proxyRes) {
    Object.keys(proxyRes.headers).forEach(function(key) {
      res.setHeader(key, proxyRes.headers[key]);
    });
  }
] // <--
  .forEach(function(func) {
    passes[func.name] = func;   
  });
