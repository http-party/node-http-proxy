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
    FreeList = require('freelist').FreeList;
    HTTPParser = process.binding('http_parser').HTTPParser;

exports.serializeHeaders = function(firstLine, headers) {
  var sentConnectionHeader = false;
  var sentContentLengthHeader = false;
  var sentTransferEncodingHeader = false;
  var sentExpect = false;

  // firstLine in the case of request is: 'GET /index.html HTTP/1.1\r\n'
  // in the case of response it is: 'HTTP/1.1 200 OK\r\n'
  var messageHeader = firstLine;
  var field, value;
  var self = this;

  function store(field, value) {
    messageHeader += field + ': ' + value + CRLF;

    if (connectionExpression.test(field)) {
      sentConnectionHeader = true;
      if (closeExpression.test(value)) {
        self._last = true;
      } else {
        self.shouldKeepAlive = true;
      }

    } else if (transferEncodingExpression.test(field)) {
      sentTransferEncodingHeader = true;
      if (chunkExpression.test(value)) self.chunkedEncoding = true;

    } else if (contentLengthExpression.test(field)) {
      sentContentLengthHeader = true;

    } else if (expectExpression.test(field)) {
      sentExpect = true;
    }
  }

  if (headers) {
    var keys = Object.keys(headers);
    var isArray = (Array.isArray(headers));
    var field, value;

    for (var i = 0, l = keys.length; i < l; i++) {
      var key = keys[i];
      if (isArray) {
        field = headers[key][0];
        value = headers[key][1];
      } else {
        field = key;
        value = headers[key];
      }

      if (Array.isArray(value)) {
        for (var j = 0; j < value.length; j++) {
          store(field, value[j]);
        }
      } else {
        store(field, value);
      }
    }
  }

  // keep-alive logic
  if (sentConnectionHeader === false) {
    if (this.shouldKeepAlive &&
        (sentContentLengthHeader || this.useChunkedEncodingByDefault || this.agent)) {
      messageHeader += 'Connection: keep-alive\r\n';
    } else {
      this._last = true;
      messageHeader += 'Connection: close\r\n';
    }
  }

  if (sentContentLengthHeader == false && sentTransferEncodingHeader == false) {
    if (this._hasBody) {
      if (this.useChunkedEncodingByDefault) {
        messageHeader += 'Transfer-Encoding: chunked\r\n';
        this.chunkedEncoding = true;
      } else {
        this._last = true;
      }
    } else {
      // Make sure we don't end the 0\r\n\r\n at the end of the message.
      this.chunkedEncoding = false;
    }
  }

  this._header = messageHeader + CRLF;
  this._headerSent = false;

  // wait until the first body chunk, or close(), is sent to flush,
  // UNLESS we're sending Expect: 100-continue.
  if (sentExpect) this._send('');
};

var parsers = exports.parsers = new FreeList('parsers', 1000, function() {
  var parser = new HTTPParser(HTTPParser.REQUEST);

  parser._headers = [];
  parser._url = '';

  // Only called in the slow case where slow means
  // that the request headers were either fragmented
  // across multiple TCP packets or too large to be
  // processed in a single run. This method is also
  // called to process trailing HTTP headers.
  parser.onHeaders = function(headers, url) {
    console.dir(headers);
    parser._headers = parser._headers.concat(headers);
    parser._url += url;
  };

  // info.headers and info.url are set only if .onHeaders()
  // has not been called for this request.
  //
  // info.url is not set for response parsers but that's not
  // applicable here since all our parsers are request parsers.
  parser.onHeadersComplete = function(info) {
    console.dir(info);
    var headers = info.headers;
    var url = info.url;

    if (!headers) {
      headers = parser._headers;
      parser._headers = [];
    }

    if (!url) {
      url = parser._url;
      parser._url = '';
    }

    // parser.incoming = new IncomingMessage(parser.socket);
    // parser.incoming.httpVersionMajor = info.versionMajor;
    // parser.incoming.httpVersionMinor = info.versionMinor;
    // parser.incoming.httpVersion = info.versionMajor + '.' + info.versionMinor;
    // parser.incoming.url = url;

    for (var i = 0, n = headers.length; i < n; i += 2) {
      var k = headers[i];
      var v = headers[i + 1];
      // parser.incoming._addHeaderLine(k.toLowerCase(), v);
    }

    if (info.method) {
      // server only
      // parser.incoming.method = info.method;
    } else {
      // client only
      // parser.incoming.statusCode = info.statusCode;
      // CHECKME dead code? we're always a request parser
    }

    // parser.incoming.upgrade = info.upgrade;
    
    var isHeadResponse = false;

    if (!info.upgrade) {
      // For upgraded connections, we'll emit this after parser.execute
      // so that we can capture the first part of the new protocol
      // isHeadResponse = parser.onIncoming(parser.incoming, info.shouldKeepAlive);
    }

    return isHeadResponse;
  };

  parser.onBody = function(b, start, len) {
    // TODO body encoding?
    var slice = b.slice(start, start + len);
    // if (parser.incoming._decoder) {
    //   var string = parser.incoming._decoder.write(slice);
    //   if (string.length) parser.incoming.emit('data', string);
    // } else {
    //   parser.incoming.emit('data', slice);
    // }
  };

  parser.onMessageComplete = function() {
    // parser.incoming.complete = true;

    // Emit any trailing headers.
    var headers = parser._headers;
    if (headers) {
      for (var i = 0, n = headers.length; i < n; i += 2) {
        var k = headers[i];
        var v = headers[i + 1];
        // parser.incoming._addHeaderLine(k.toLowerCase(), v);
      }
      parser._headers = [];
      parser._url = '';
    }

    // if (!parser.incoming.upgrade) {
    //   // For upgraded connections, also emit this after parser.execute
    //   parser.incoming.readable = false;
    //   parser.incoming.emit('end');
    // }

    if (parser.socket.readable) {
      // force to read the next incoming message
      parser.socket.resume();
    }
  };

  return parser;
});

exports.createServer = function () {
  var args = Array.prototype.slice.call(arguments), 
      callback = typeof args[0] === 'function' && args.shift(),
      options = {}, port, host, server;
      
  server = net.createServer(function (socket) {
    var parser = parsers.alloc();
    
    parser.reinitialize(HTTPParser.REQUEST);
    parser.socket = socket;

    socket.addListener('error', function(e) {
      console.dir(e);
      console.dir(e.stack);
      //self.emit('clientError', e);
    });

    socket.ondata = function(d, start, end) {
      console.log(d.toString());
      var ret = parser.execute(d, start, end - start);
      console.dir(ret);
      console.dir(d.slice(0, ret).toString());
      console.dir(start);
      console.dir(end);
      if (ret instanceof Error) {
        debug('parse error');
        socket.destroy(ret);
        return;
      } 
      
      // else if (parser.incoming && parser.incoming.upgrade) {
      //   var bytesParsed = ret;
      //   socket.ondata = null;
      //   socket.onend = null;
      // 
      //   var req = parser.incoming;
      // 
      //   // This is start + byteParsed
      //   var upgradeHead = d.slice(start + bytesParsed, end);
      // 
      //   if (self.listeners('upgrade').length) {
      //     self.emit('upgrade', req, req.socket, upgradeHead);
      //   } else {
      //     // Got upgrade header, but have no handler.
      //     socket.destroy();
      //   }
      // }
    };

    socket.onend = function() {
      var ret = parser.finish();

      if (ret instanceof Error) {
        console.log('parse error');
        socket.destroy(ret);
        return;
      }

      socket.end();
    };

    socket.addListener('close', function() {
      // unref the parser for easy gc
      parsers.free(parser);
    });

    // The following callback is issued after the headers have been read on a
    // new message. In this callback we setup the response object and pass it
    // to the user.
    // parser.onIncoming = function(req, shouldKeepAlive) {
    //   incoming.push(req);
    // 
    //   var res = new ServerResponse(req);
    //   debug('server response shouldKeepAlive: ' + shouldKeepAlive);
    //   res.shouldKeepAlive = shouldKeepAlive;
    //   DTRACE_HTTP_SERVER_REQUEST(req, socket);
    // 
    //   if (socket._httpMessage) {
    //     // There are already pending outgoing res, append.
    //     outgoing.push(res);
    //   } else {
    //     res.assignSocket(socket);
    //   }
    // 
    //   // When we're finished writing the response, check if this is the last
    //   // respose, if so destroy the socket.
    //   res.on('finish', function() {
    //     // Usually the first incoming element should be our request.  it may
    //     // be that in the case abortIncoming() was called that the incoming
    //     // array will be empty.
    //     assert(incoming.length == 0 || incoming[0] === req);
    // 
    //     incoming.shift();
    // 
    //     res.detachSocket(socket);
    // 
    //     if (res._last) {
    //       socket.destroySoon();
    //     } else {
    //       // start sending the next message
    //       var m = outgoing.shift();
    //       if (m) {
    //         m.assignSocket(socket);
    //       }
    //     }
    //   });
    // 
    //   if ('expect' in req.headers &&
    //       (req.httpVersionMajor == 1 && req.httpVersionMinor == 1) &&
    //       continueExpression.test(req.headers['expect'])) {
    //     res._expect_continue = true;
    //     if (self.listeners('checkContinue').length) {
    //       self.emit('checkContinue', req, res);
    //     } else {
    //       res.writeContinue();
    //       self.emit('request', req, res);
    //     }
    //   } else {
    //     self.emit('request', req, res);
    //   }
    //   return false; // Not a HEAD response. (Not even a response!)
    // };
  });
  
  server.listen(8080);
  
  return server;
};