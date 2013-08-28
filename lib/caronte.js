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
      "   ssl    : <object to be passed to https.createServer()> ",
      "   ws     : <true/false, if you want to proxy websockets> ",
      "   xfwd   : <true/false, adds x-forward headers>          ",
      "   maxSock: <maximum number of sockets>                   ",
      " }                                                        ",
      "                                                          ",
      "NOTE: `options.ws` and `options.ssl` are optional.        ",
      "      `options.target and `options.forward` cannot be     ",
      "      both missing                                        "
    ].join("\n"));
  }

  ['target', 'forward'].forEach(function(key) {
    if(!options[key]) return;
    options[key] = url.parse(options[key]);

    options[key].maxSockets = options.maxSock;
    options[key].agent = new (options.ssl ? https.Agent : http.Agent)(options[key].maxSockets || 100);
  });

  return {
    __proto__: new events.EventEmitter2({ wildcard: true, delimiter: ':' }), 
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

