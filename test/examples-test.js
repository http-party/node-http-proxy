/*
  examples-test.js: Test to run all the examples

  Copyright (c) Nodejitsu 2013

*/
var path = require('path'),
    fs   = require('fs'),
    spawn = require('child_process').spawn,
    expect = require('expect.js'),
    async = require('async');

var rootDir = path.join(__dirname, '..'),
    examplesDir = path.join(rootDir, 'examples');

describe.skip('http-proxy examples', function () {
  describe('Before testing examples', function () {
    // Set a timeout to avoid this error
    this.timeout(30 * 1000);
    it('should have installed dependencies', function (done) {
      async.waterfall([
        //
        // 1. Read files in examples dir
        //
        async.apply(fs.readdir, examplesDir),
        //
        // 2. If node_modules exists, continue. Otherwise
        // exec `npm` to install them
        //
        function checkNodeModules(files, next) {
          if (files.indexOf('node_modules') !== -1) {
            return next();
          }

          console.log('Warning: installing dependencies, this operation could take a while');

          var child = spawn('npm', ['install', '-f'], {
            cwd: examplesDir
          });

          child.on('exit', function (code) {
            return code
              ? next(new Error('npm install exited with non-zero exit code'))
              : next();
          });
        },
        //
        // 3. Read files in examples dir again to ensure the install
        // worked as expected.
        //
        async.apply(fs.readdir, examplesDir),
      ], done);
    })
  });

  describe('Requiring all the examples', function () {
    it('should have no errors', function (done) {
      async.each(['balancer', 'http', 'middleware', 'websocket'], function (dir, cb) {
        var name = 'examples/' + dir,
        files = fs.readdirSync(path.join(rootDir, 'examples', dir));

        async.each(files, function (file, callback) {
          var example;
          expect(function () { example = require(path.join(examplesDir, dir, file)); }).to.not.throwException();
          expect(example).to.be.an('object');
          callback();
        }, cb);
      }, done);
    })
  })
})