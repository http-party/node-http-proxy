var url    = require('url'),
    common = require('../common');


var redirectRegex = /^201|30(1|2|7|8)$/;

/*!
 * Array of passes.
 *
 * A `pass` is just a function that is executed on `req, res, options`
 * so that you can easily add new checks while still keeping the base
 * flexible.
 */

module.exports = { // <--

  /**
   * If is a HTTP 1.0 request, remove chunk headers
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {proxyResponse} Res Response object from the proxy request
   *
   * @api private
   */
  removeChunked: function removeChunked(req, res, proxyRes) {
    if (req.httpVersion === '1.0') {
      delete proxyRes.headers['transfer-encoding'];
    }
  },

  /**
   * If is a HTTP 1.0 request, set the correct connection header
   * or if connection header not present, then use `keep-alive`
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {proxyResponse} Res Response object from the proxy request
   *
   * @api private
   */
  setConnection: function setConnection(req, res, proxyRes) {
    if (req.httpVersion === '1.0') {
      proxyRes.headers.connection = req.headers.connection || 'close';
    } else if (req.httpVersion !== '2.0' && !proxyRes.headers.connection) {
      proxyRes.headers.connection = req.headers.connection || 'keep-alive';
    }
  },

  setRedirectHostRewrite: function setRedirectHostRewrite(req, res, proxyRes, options) {
    if ((options.hostRewrite || options.autoRewrite || options.protocolRewrite)
        && proxyRes.headers['location']
        && redirectRegex.test(proxyRes.statusCode)) {
      var target = url.parse(options.target);
      var u = url.parse(proxyRes.headers['location']);

      // make sure the redirected host matches the target host before rewriting
      if (target.host != u.host) {
        return;
      }

      if (options.hostRewrite) {
        u.host = options.hostRewrite;
      } else if (options.autoRewrite) {
        u.host = req.headers['host'];
      }
      if (options.protocolRewrite) {
        u.protocol = options.protocolRewrite;
      }

      proxyRes.headers['location'] = u.format();
    }
  },
  /**
   * Copy headers from proxyResponse to response
   * set each header in response object.
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {proxyResponse} Res Response object from the proxy request
   * @param {Object} Options options.cookieDomainRewrite: Config to rewrite cookie domain
   *
   * @api private
   */
  writeHeaders: function writeHeaders(req, res, proxyRes, options) {
    var i,
        rawHeaderMap,
        rewriteCookieDomainConfig = options.cookieDomainRewrite,
        preserveHeaderKeyCase = options.preserveHeaderKeyCase,
        preserveHeaderDuplications = options.preserveHeaderDuplications,
        setHeader = function(key, header) {
          if (header == undefined) return;
          if (rewriteCookieDomainConfig && key.toLowerCase() === 'set-cookie') {
            header = common.rewriteCookieDomain(header, rewriteCookieDomainConfig);
          }
          res.setHeader(String(key).trim(), header);
        };

    if (typeof rewriteCookieDomainConfig === 'string') { //also test for ''
      rewriteCookieDomainConfig = { '*': rewriteCookieDomainConfig };
    }

    if ((preserveHeaderKeyCase || preserveHeaderDuplications) && proxyRes.rawHeaders != undefined) {
      rawHeaderMap = {};

      for (i = 0; i < proxyRes.rawHeaders.length; i += 2) {
        var name = proxyRes.rawHeaders[i];
        var nameL = name.toLowerCase();

        if (!rawHeaderMap[nameL]) {
          rawHeaderMap[nameL] = {name: name, value: []};
        }

        rawHeaderMap[nameL].value.push(proxyRes.rawHeaders[i + 1]);
      }
    }


    // Code optimization: https://jsperf.com/object-keys-vs-for-in-with-closure/137
    var keys = Object.keys(proxyRes.headers);
    var key;
    var header;

    for (i = 0; i < keys.length; i++) {
      key = keys[i];

      if (preserveHeaderDuplications && rawHeaderMap && rawHeaderMap[key]) {
        header = rawHeaderMap[key].value || proxyRes.headers[key];
        if (Array.isArray(header) && header.length === 1) {
          header = header[0];
        }
      } else {
        header = proxyRes.headers[key];
      }

      if (preserveHeaderKeyCase && rawHeaderMap && rawHeaderMap[key]) {
        key = rawHeaderMap[key].name || key;
      }

      setHeader(key, header);
    }
  },

  /**
   * Set the statusCode from the proxyResponse
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {proxyResponse} Res Response object from the proxy request
   *
   * @api private
   */
  writeStatusCode: function writeStatusCode(req, res, proxyRes) {
    // From Node.js docs: response.writeHead(statusCode[, statusMessage][, headers])
    if(proxyRes.statusMessage) {
      res.writeHead(proxyRes.statusCode, proxyRes.statusMessage);
    } else {
      res.writeHead(proxyRes.statusCode);
    }
  }

};
