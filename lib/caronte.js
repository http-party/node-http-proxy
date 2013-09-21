var http    = require('http'),
    https   = require('https'),
    url     = require('url'),
    caronte = require('./caronte/'),
    events  = require('eventemitter2'),
    proxy   = exports;

/**
 * Creates the proxy server.
 * 
 * Examples:
 * 
 *    caronte.createProxyServer({ .. }, 8000)
 *    // => '{ web: [Function], ws: [Function] ... }'
 *
 * @param {Object} Options Config object passed to the proxy 
 *
 * @return {Object} Proxy Proxy object with handlers for `ws` and `web` requests 
 *
 * @api public
 */

proxy.createProxyServer = function createProxyServer(options) {
  if(!options) {
    throw new Error([
      "`options` is needed and it must have the following layout:",
      "                                                          ",
      " {                                                        ",
      "   target : <url string to be parsed with the url module> ",
      "   forward: <url string to be parsed with the url module> ",
      "   agent  : <object to be passed to http(s).request> ",
      "   ssl    : <object to be passed to https.createServer()> ",
      "   ws     : <true/false, if you want to proxy websockets> ",
      "   xfwd   : <true/false, adds x-forward headers>          ",
      " }                                                        ",
      "                                                          ",
      "NOTE: `options.ws` and `options.ssl` are optional.        ",
      "      `options.target and `options.forward` cannot be     ",
      "      both missing                                        "
    ].join("\n"));
  }

  options.ee = new events.EventEmitter2({ wildcard: true, delimiter: ':' }); 

  return {
    ee       : options.ee,
    web      : caronte.createWebProxy(options),
    ws       : caronte.createWsProxy(options),
    listen   : function listen(port) {
      var server = options.ssl ? https.createServer(options.ssl, this.web) : http.createServer(this.web);

      if(options.ws) {
        server.on('upgrade', this.ws);
      }

      server.listen(port);

      return server;
    }
  };
};

