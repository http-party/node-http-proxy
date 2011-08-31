
/**
 * Parse proxy table host `target`.
 *
 * @param {String} target
 * @return {Object}
 * @api private
 */

exports.parseHost = function(target){
  switch (typeof target) {
    case 'number':
      return {
          host: '127.0.0.1'
        , port: target
      };
    default:
      var parts = target.split(':');
      return {
          host: parts[0]
        , port: parseInt(parts[1], 10) || 80
      }
  }
};