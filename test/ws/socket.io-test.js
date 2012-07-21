/*
 * socket.io-test.js: Test for proxying `socket.io` requests.
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENCE
 *
 */

var vows = require('vows'),
    macros = require('../macros'),
    helpers = require('../helpers/index');

vows.describe('node-http-proxy/ws').addBatch({
  "With a valid target server": {
    "and no latency": macros.ws.assertProxied(),
    // "and latency": macros.websocket.assertProxied({
    //   latency: 2000
    // })
  }
}).export(module);