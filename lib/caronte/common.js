var   common = exports
    , http = require('http')
    , https = require('https')
    , extend = require('util')._extend
    ;

/**
 * Copies the right headers from `options` and `req` to 
 * `outgoing` which is then used to fire the proxied 
 * request.
 *
 * Examples:
 *
 *    common.setupOutgoing(outgoing, options, req)
 *    // => { host: ..., hostname: ...}
 *
 * @param {Object} Outgoing Base object to be filled with required properties
 * @param {Object} Options Config object passed to the proxy
 * @param {ClientRequest} Req Request Object
 * @param {String} Forward String to select forward or target
 * 
 * @return {Object} Outgoing Object with all required properties set
 *
 * @api private
 */

common.setupOutgoing = function(outgoing, options, req, forward) {
  outgoing.port = options[forward || 'target'].port || 
                  (~['https:', 'wss:'].indexOf(options[forward || 'target'].protocol) ? 443 : 80);
 
  ['host', 'hostname', 'socketPath', 'agent'].forEach(
    function(e) { outgoing[e] = options[forward || 'target'][e]; }
  );

  ['method', 'headers'].forEach(
    function(e) { outgoing[e] = req[e]; }
  );

  if (options.headers){
    extend(outgoing.headers, options.headers);
  }

  if (options.agent){
    outgoing.agent = options.agent;
  }

  if (!outgoing.agent){
    var Agent = (~['https:', 'wss:'].indexOf(options[forward || 'target'].protocol) ? https.Agent : http.Agent);
    outgoing.agent = new Agent(options.maxSock || 100);  
  }

  outgoing.path = req.url;

  return outgoing;
};

common.setupSocket = function(socket) {
  socket.setTimeout(0);
  socket.setNoDelay(true);

  socket.setKeepAlive(true, 0);

  return socket;
};
