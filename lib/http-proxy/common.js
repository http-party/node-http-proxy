var common = exports,
    url    = require('url'),
    extend = require('util')._extend;

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

  ['host', 'hostname', 'socketPath'].forEach(
    function(e) { outgoing[e] = options[forward || 'target'][e]; }
  );

  ['method', 'headers'].forEach(
    function(e) { outgoing[e] = req[e]; }
  );

  if (options.headers){
    extend(outgoing.headers, options.headers);
  }

  if (options[forward || 'target'].protocol == 'https:') {
    outgoing.rejectUnauthorized = (typeof options.secure === "undefined") ? true : options.secure;
  }


  outgoing.agent = options.agent || false;
  if(outgoing.agent === false) {
    // Do not allow keepAlive if we have no agent, since this will cause us to leak sockets.
    outgoing.keepAlive = false
  }
  outgoing.path = url.parse(req.url).path;
  return outgoing;
};

/**
 * Set the proper configuration for sockets,
 * set no delay and set keep alive, also set
 * the timeout to 0.
 *
 * Examples:
 *
 *    common.setupSocket(socket)
 *    // => Socket
 *
 * @param {Socket} Socket instance to setup
 * 
 * @return {Socket} Return the configured socket.
 *
 * @api private
 */

common.setupSocket = function(socket) {
  socket.setTimeout(0);
  socket.setNoDelay(true);

  socket.setKeepAlive(true, 0);

  return socket;
};

common.getPort = function(req) {
  var res = req.headers.host.match(/:(\d+)/);
  return res ? 
    res[1] :
    req.connection.pair ? '443' : '80' ; 
}
