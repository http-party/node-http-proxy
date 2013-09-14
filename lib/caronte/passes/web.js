var http   = require('http'),
    https  = require('https'),
    common = require('../common'),
    passes = exports;

/*!
 * Array of passes.
 * 
 * A `pass` is just a function that is executed on `req, res, options`
 * so that you can easily add new checks while still keeping the base
 * flexible.
 */

[ // <--

/**
 * Sets `content-length` to '0' if request is of DELETE type.
 *
 * @param {ClientRequest} Req Request object
 * @param {IncomingMessage} Res Response object  
 * @param {Object} Options Config object passed to the proxy
 *
 * @api private
 */

function deleteLength(req, res, options) {
  if(req.method === 'DELETE' && !req.headers['content-length']) {
    req.headers['content-length'] = '0';
  }
},

/**
 * Sets timeout in request socket if it was specified in options.
 *
 * @param {ClientRequest} Req Request object
 * @param {IncomingMessage} Res Response object  
 * @param {Object} Options Config object passed to the proxy
 *
 * @api private
 */

function timeout(req, res, options) {
  if(options.timeout) {
    req.socket.setTimeout(options.timeout);
  }
},

/**
 * Sets `x-forwarded-*` headers if specified in config.
 *
 * @param {ClientRequest} Req Request object
 * @param {IncomingMessage} Res Response object  
 * @param {Object} Options Config object passed to the proxy
 *
 * @api private
 */

function XHeaders(req, res, options) {
  if(!options.xfwd) return;

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
},

/**
 * Does the actual proxying. If `forward` is enabled fires up
 * a ForwardStream, same happens for ProxyStream. The request
 * just dies otherwise.
 *
 * @param {ClientRequest} Req Request object
 * @param {IncomingMessage} Res Response object  
 * @param {Object} Options Config object passed to the proxy
 *
 * @api private
 */

function stream(req, res, options) {
  if(options.forward) {
    var forwardReq = (options.ssl ? https : http).request(
      common.setupOutgoing(options.ssl || {}, options, req, 'forward')
    );
    req.pipe(forwardReq);
    return res.end();
  }

  var proxyReq = (options.ssl ? https : http).request(
    common.setupOutgoing(options.ssl || {}, options, req)
  );

  req.pipe(proxyReq);

  proxyReq.on('response', function(proxyRes) {
    proxyRes.pipe(res);  
  });

  proxyReq.end();
   
  /*if(options.forward) {
    req.pipe(new ForwardStream(options));
  }

  if(options.target) {
    return req.pipe(new ProxyStream(options, res)).pipe(res);
  }

  res.end();*/
}

] // <--
  .forEach(function(func) {
    passes[func.name] = func;   
  });
