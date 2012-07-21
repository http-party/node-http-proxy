/*
 * index.js: Top level include for node-http-proxy helpers
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENCE
 *
 */

//
// @nextPort {number} 
// Returns an auto-incrementing port for tests.
//
Object.defineProperty(exports, 'nextPort', {
  get: function () {
    var current = this.port || 8000;
    this.port = current + 1;
    return current;
  }
});

//
// @nextPortPair {Object} 
// Returns an auto-incrementing pair of ports for tests.
//
Object.defineProperty(exports, 'nextPortPair', {
  get: function () {
    return {
      target: this.nextPort,
      proxy: this.nextPort
    };
  }
});

//
// Export additional helpers for `http` and `websockets`.
//
exports.http = require('./http');
exports.ws   = require('./ws');