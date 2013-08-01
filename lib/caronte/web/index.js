var ForwardStream = require('../streams/forward'),
    ProxyStream   = require('../streams/proxy'),
    passes        = exports;

/*!
 * List of passes.
 * 
 * A `pass` is just a function that is executed on `req, res, options`
 * so that you can easily add new checks while still keeping the base
 * flexible.
 *
 */

passes.XHeaders     = XHeaders;
passes.deleteLength = deleteLength;
passes.timeout      = timeout;
passes.stream       = stream;

function deleteLength(req, res, options) {
  if(req.method === 'DELETE' && !req.headers['content-length']) {
    req.headers['content-length'] = '0';
  }
}

function timeout(req, res, options) {
  if(options.timeout) {
    req.socket.setTimeout(options.timeout);
  }
}

function XHeaders(req, res, options) {
  var values = {
    for  : req.connection.remoteAddress || req.socket.remoteAddress,
    port : req.connection.remotePort || req.socket.remotePort,
    proto: req.isSpdy ? 'https' : (req.connection.pair ? 'https' : 'http')
  };

  ['for', 'port', 'proto'].forEach(function(header) {
    req.headers['x-forwarded-' + header] = 
      (req.headers['x-forwarded-' + header] || '') +
      (req.headers['x-forwarded-' + header] ? ',' : '') +
      values[header]
  });
}

function stream(req, res, options) {
  if(options.forward) {
    req.pipe(new ForwardStream(options.forward));
  }

  if(options.target) {
    return req.pipe(new ProxyStream(res, options)).pipe(res);
  }

  res.end();
}