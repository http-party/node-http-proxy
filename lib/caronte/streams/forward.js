var Writable = require('stream').Writable,
    common   = require('../common'),
    http     = require('http'),
    https    = require('https');

module.exports = ForwardStream;

/**
 * Forwards the request to the external target specified in options
 *
 * Examples:
 *
 *    new ForwardStream(options)
 *    // => { ... }
 *
 * @param {Object} Options Config object passed to the proxy
 * 
 * @return {ForwardStream} Stream A clone of ForwardStream
 *
 * @api private
 */

function ForwardStream(options) {
  var self = this;

  self.options = options;
  // To uncomment the line below, please see 
  // https://github.com/yawnt/caronte/commit/9ab8749a9bec33b49c495975e8364336ad7be1a3#commitcomment-3947117
  //self.res     = res;

  Writable.call(this);  

  this.once('pipe', function(pipe) { self.onPipe(pipe) });
  this.once('finish', function() { self.onFinish() });
}

require('util').inherits(ForwardStream, Writable);

/**
 * Fires up the request to the external target
 *
 * Examples:
 *
 *    (new ForwardStream(options)).onPipe(req)
 *    // => undefined
 *
 * @param {HttpRequest} Req Request object
 *
 * @api private
 */

ForwardStream.prototype.onPipe = function(request) {
  this.forwardReq = (options.ssl ? https : http).request(
    common.setupOutgoing(options.ssl || {}, options, request)
  );

  this.forwardReq.on('error', function() {}); /** Fire and forget */
};

/**
 * Closes forwarded request when `pipe` is finished.
 *
 * Examples:
 *
 *    (new ForwardStream(options)).onFinish()
 *    // => undefined
 *
 * @api private
 */

ForwardStream.prototype.onFinish = function() {
  this.forwardReq.end();
};

/**
 * Implements `stream.Writable`, writes to the forwarded request
 *
 * Examples:
 *
 *    (new ForwardStream(options))._write(chunk, encoding, clb)
 *    // => undefined
 *
 * @api private
 */

ForwardStream.prototype._write = function(chunk, encoding, clb) {
  this.forwardReq.write(chunk, encoding, clb);
};