'use strict';

//
// Minimal fork-and-wait-for-ready helper (absolute module paths) shared by the
// eval gates. Mirrors bench/lib/harness but path-agnostic so it can launch the
// echo origin (evals/) and the proxy-under-test (bench/) together.
//

var fork = require('child_process').fork;

function forkReady(absPath, env) {
  return new Promise(function (resolve, reject) {
    var proc = fork(absPath, [], {
      env: Object.assign({}, process.env, env),
      stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    });
    var timer = setTimeout(function () { proc.kill('SIGKILL'); reject(new Error(absPath + ' not ready')); }, 10000);
    proc.once('message', function (m) {
      if (m && m.type === 'ready') { clearTimeout(timer); resolve({ proc: proc, port: m.port }); }
    });
    proc.once('error', reject);
  });
}

function ask(handle, msg, timeoutMs) {
  return new Promise(function (resolve) {
    var timer = setTimeout(function () { resolve(null); }, timeoutMs || 2000);
    handle.proc.once('message', function (m) { clearTimeout(timer); resolve(m); });
    try { handle.proc.send(msg); } catch (e) { clearTimeout(timer); resolve(null); }
  });
}

function shutdown(handle) {
  return new Promise(function (resolve) {
    if (!handle || !handle.proc || handle.proc.killed) return resolve();
    var done = false;
    var fin = function () { if (!done) { done = true; resolve(); } };
    handle.proc.once('exit', fin);
    try { handle.proc.send('shutdown'); } catch (e) {}
    setTimeout(function () { try { handle.proc.kill('SIGKILL'); } catch (e) {} fin(); }, 1500);
  });
}

module.exports = { forkReady: forkReady, ask: ask, shutdown: shutdown };
