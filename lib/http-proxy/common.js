var common = exports,
    url    = require('url'),
    extend = require('util')._extend;

var upgradeHeader = /(^|,)\s*upgrade\s*($|,)/i;
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
  outgoing.localAddress = options.localAddress;

  //
  // Remark: If we are false and not upgrading, set the connection: close. This is the right thing to do
  // as node core doesn't handle this COMPLETELY properly yet.
  //
  if (!outgoing.agent) {
    outgoing.headers = outgoing.headers || {};
    if (typeof outgoing.headers.connection !== 'string'
        || !upgradeHeader.test(outgoing.headers.connection)
       ) { outgoing.headers.connection = 'close'; }
  }


  // the final path is target path + relative path requested by user:
  var target = options[forward || 'target'];
  var targetPath = target && options.prependPath !== false
    ? (target.path || '')
    : '';

  //
  // Remark: Can we somehow not use url.parse as a perf optimization?
  //
  var outgoingPath = !options.toProxy
    ? url.parse(req.url).path
    : req.url;

  outgoing.path = common.urlJoin(targetPath, outgoingPath);

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

/**
 * Get the port number from the host. Or guess it based on the connection type.
 *
 * @param {Request} req Incoming HTTP request.
 *
 * @return {String} The port number.
 *
 * @api private
 */
common.getPort = function(req) {
  var res = req.headers.host ? req.headers.host.match(/:(\d+)/) : '';

  return res ?
    res[1] :
    req.connection.pair ? '443' : '80';
};

/**
 * OS-agnostic join (doesn't break on URLs like path.join does on Windows)>
 *
 * @return {String} The generated path.
 *
 * @api private
 */

common.urlJoin = function() {
  var args = Array.prototype.slice.call(arguments);
  // Join all strings, but remove empty strings so we don't get extra slashes from
  // joining e.g. ['', 'am']
  return args.filter(function filter(a) {
    return !!a;
  }).join('/').replace(/\/+/g, '/');
};
