/*
  balancing-proxy.js: Transparent Load-Balancing Optimized HTTP Proxy 

  Copyright (c) 2011 Charlie Robbins 

  Permission is hereby granted, free of charge, to any person obtaining
  a copy of this software and associated documentation files (the
  "Software"), to deal in the Software without restriction, including
  without limitation the rights to use, copy, modify, merge, publish,
  distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so, subject to
  the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
  LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
  WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

var net = require('net'),
    HTTPParser = process.binding('http_parser').HTTPParser,
    streams = require('morestreams');

exports.createServer = function () {
  var args = Array.prototype.slice.call(arguments), 
      callback = typeof args[0] === 'function' && args.shift(),
      options = {}, port, host, server;
      
  server = net.createServer(function (socket) {
    var buffer = new streams.BufferedStream(),
        parser = new HTTPParser('request');
    
    parser.onHeaderField = function(b, start, len) {
      var slice = b.toString('ascii', start, start + len).toLowerCase();
      if (parser.value != undefined) {
        require('eyes').inspect(parser.value, parser.field);
        parser.field = null;
        parser.value = null;
      }
      if (parser.field) {
        parser.field += slice;
      } else {
        parser.field = slice;
      }
    };

    parser.onHeaderValue = function(b, start, len) {
      var slice = b.toString('ascii', start, start + len);
      if (parser.value) {
        parser.value += slice;
      } else {
        parser.value = slice;
      }
    };
    
    parser.socket = socket;
    
    socket.ondata = function (d, start, end) {
      var ret = parser.execute(d, start, end - start);
      console.log(ret);
    };
    
    socket.onend = function() {
      var ret = parser.finish();

      if (ret instanceof Error) {
        socket.destroy(ret);
        return;
      }

      if (socket.writable) {
        socket.end();
      }
    };
    
    socket.write('hello world');
    socket.end();
  });
  
  return server;
};