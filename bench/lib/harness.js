'use strict';

//
// Process orchestration: fork an origin and a proxy-under-test, wait for both
// to report ready, hand back ports + a stats() probe, and tear down cleanly so
// the harness never hangs (node skill: deterministic teardown in the
// resource-creation scope).
//

var path = require('path');
var fork = require('child_process').fork;

function forkReady(modulePath, env) {
  return new Promise(function (resolve, reject) {
    var proc = fork(path.join(__dirname, '..', modulePath), [], {
      env: Object.assign({}, process.env, env),
      stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    });
    var timer = setTimeout(function () {
      proc.kill('SIGKILL');
      reject(new Error(modulePath + ' did not become ready in time'));
    }, 10000);
    proc.once('message', function (m) {
      if (m && m.type === 'ready') {
        clearTimeout(timer);
        resolve({ proc: proc, port: m.port });
      }
    });
    proc.once('error', reject);
  });
}

function shutdown(handle) {
  return new Promise(function (resolve) {
    if (!handle || !handle.proc || handle.proc.killed) return resolve();
    var done = false;
    var fin = function () { if (!done) { done = true; resolve(); } };
    handle.proc.once('exit', fin);
    try { handle.proc.send('shutdown'); } catch (e) { /* dead */ }
    setTimeout(function () { try { handle.proc.kill('SIGKILL'); } catch (e) {} fin(); }, 1500);
  });
}

function proxyStats(handle) {
  return new Promise(function (resolve) {
    var timer = setTimeout(function () { resolve(null); }, 2000);
    handle.proc.once('message', function (m) {
      if (m && m.type === 'stats') { clearTimeout(timer); resolve(m); }
    });
    try { handle.proc.send('stats'); } catch (e) { clearTimeout(timer); resolve(null); }
  });
}

//
// Bring up origin + proxy for one variant, run `fn(proxyPort)`, collect proxy
// stats, tear everything down. Returns { result, stats }.
//
function withStack(opts, fn) {
  var origin, proxy;
  return forkReady('origin-proc.js', { BODY_SIZE: String(opts.bodySize || 64) })
    .then(function (o) {
      origin = o;
      return forkReady('proxy-proc.js', {
        LIB: opts.lib,
        TARGET: '127.0.0.1:' + origin.port,
        WS: opts.ws ? '1' : '0'
      });
    })
    .then(function (p) {
      proxy = p;
      return fn(proxy.port);
    })
    .then(function (result) {
      return proxyStats(proxy).then(function (stats) {
        return { result: result, stats: stats };
      });
    })
    .then(function (out) {
      return Promise.all([shutdown(proxy), shutdown(origin)]).then(function () { return out; });
    })
    .catch(function (err) {
      return Promise.all([shutdown(proxy), shutdown(origin)]).then(function () { throw err; });
    });
}

module.exports = { forkReady: forkReady, shutdown: shutdown, proxyStats: proxyStats, withStack: withStack };
