 // Use explicit /index.js to help browserify negociation in require '/lib/http-proxy' (!)
var ProxyServer = require('./http-proxy/index.js').Server;


/**
 * Creates the proxy server.
 *
 * Examples:
 *
 *    httpProxy.createProxyServer({ .. }, 8000)
 *    // => '{ web: [Function], ws: [Function] ... }'
 *
 * @param {Object} Options Config object passed to the proxy
 *
 * @return {Object} Proxy Proxy object with handlers for `ws` and `web` requests
 *
 * @api public
 */


function createProxyServer(options) {
  /*
   *  `options` is needed and it must have the following layout:
   *
   *  {
   *    target : <url string to be parsed with the url module>
   *    forward: <url string to be parsed with the url module>
   *    agent  : <object to be passed to http(s).request>
   *    ssl    : <object to be passed to https.createServer()>
   *    ws     : <true/false, if you want to proxy websockets>
   *    xfwd   : <true/false, adds x-forward headers>
   *    secure : <true/false, verify SSL certificate>
   *    toProxy: <true/false, explicitly specify if we are proxying to another proxy>
   *    prependPath: <true/false, Default: true - specify whether you want to prepend the target's path to the proxy path>
   *    ignorePath: <true/false, Default: false - specify whether you want to ignore the proxy path of the incoming request>
   *    localAddress : <Local interface string to bind for outgoing connections>
   *    changeOrigin: <true/false, Default: false - changes the origin of the host header to the target URL>
   *    preserveHeaderKeyCase: <true/false, Default: false - specify whether you want to keep letter case of response header key >
   *    auth   : Basic authentication i.e. 'user:password' to compute an Authorization header.
   *    hostRewrite: rewrites the location hostname on (301/302/307/308) redirects, Default: null.
   *    autoRewrite: rewrites the location host/port on (301/302/307/308) redirects based on requested host/port. Default: false.
   *    protocolRewrite: rewrites the location protocol on (301/302/307/308) redirects to 'http' or 'https'. Default: null.
   *    cookieDomainRewrite: rewrites domain of set-cookie headers. Default: false. Possible values:
   *        * false: disable cookie rewriting
   *        * String: new domain, for example cookieDomainRewrite: "new.domain". To remove the domain, use cookieDomainRewrite: "".
   *        * Object: mapping of domains to new domains, use "*" to match all domains. For example keep one domain unchanged, rewrite one domain and remove other domains:
   *          ```
   *           cookieDomainRewrite: {
   *             "unchanged.domain": "unchanged.domain",
   *             "old.domain": "new.domain",
   *             "*": ""
   *           }
   *           ```
   *     cookiePathRewrite: rewrites path of set-cookie headers. Default: false. Possible values:
   *        * false: disable cookie rewriting
   *        * String: new path, for example cookiePathRewrite: "/newPath/". To remove the path, use cookiePathRewrite: "". To set path to root use cookiePathRewrite: "/".
   *        * Object: mapping of paths to new paths, use "*" to match all paths. For example, to keep one path unchanged, rewrite one path and remove other paths:
   *          ```
   *          cookiePathRewrite: {
   *            "/unchanged.path/": "/unchanged.path/",
   *            "/old.path/": "/new.path/",
   *            "*": ""
   *          }
   *          ```
   *     headers: object with extra headers to be added to target requests.
   *     proxyTimeout: timeout (in millis) for outgoing proxy requests
   *     timeout: timeout (in millis) for incoming requests
   *     followRedirects: true/false, Default: false - specify whether you want to follow redirects
   *     selfHandleResponse true/false, if set to true, none of the webOutgoing passes are called and it’s your responsibility to appropriately return the response by listening and acting on the proxyRes event
   *     buffer: stream of data to send as the request body. Maybe you have some middleware that consumes the request stream before proxying it on. 
   *        If you read the body of a request into a field called ‘req.rawbody’ you could restream this field in the buffer option:
   *        ```
   *        'use strict';
   *
   *        const streamify = require('stream-array');
   *        const HttpProxy = require('http-proxy');
   *        const proxy = new HttpProxy();
   *
   *        module.exports = (req, res, next) => {
   *
   *          proxy.web(req, res, {
   *            target: 'http://localhost:4003/',
   *            buffer: streamify(req.rawBody)
   *          }, next);
   *
   *        };
   *        ```
   *  }
   *
   *  NOTE: `options.ws` and `options.ssl` are optional.
   *    `options.target and `options.forward` cannot be
   *    both missing
   *  }
   */

  return new ProxyServer(options);
}


ProxyServer.createProxyServer = createProxyServer;
ProxyServer.createServer      = createProxyServer;
ProxyServer.createProxy       = createProxyServer;




/**
 * Export the proxy "Server" as the main export.
 */
module.exports = ProxyServer;

