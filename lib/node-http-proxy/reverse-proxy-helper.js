/*
 reverse-proxy-helper.js: http reverse proxy helper methods.

 Copyright (c) 2012 Jo Voordeckers - @jovoordeckers - jo.voordeckers@gmail.com

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

//
// #### function ReverseProxyHelper(target)
// #### @target {Object} Proxy options, target (proxied) server
// Helper functions for reverse proxy mode.
var ReverseProxyHelper = exports.ReverseProxyHelper = function(target) {
  var self = this;
  self.target = target;
}

//
// #### function httpRedirect(repsonse)
// #### @response {ServerResponse} Response from the target server
// Check if the response is a server-side HTTP 30x Redirect.
ReverseProxyHelper.prototype.isHttpRedirect = function(response) {
  switch (response.statusCode) {
    case 301:
    case 302:
    case 303:
    case 307:
      return !!response.headers && !!response.headers.location;
  }
  return false;
}

//
// #### function decomposeUrl(url)
// #### @url {String} absolute URL String
// Return an absolute URL in decomposed form { proto, host, port, path }.
ReverseProxyHelper.prototype.decomposeUrl = function (url) {

  if (url) {

    var urlMatch = url.match(/(https?)\:\/\/([a-zA-Z0-9\-\.]+)(?:\:(\d{1,5}))?((?:\/|\?).+)?/);

    if (urlMatch) {

      var decomp = {
        proto: urlMatch[1],
        host: urlMatch[2],
        port: urlMatch[3] ? Number(urlMatch[3]) : (urlMatch[1] === "http" ? 80 : 443),
        path: urlMatch[4]
      };

      return decomp;

    }
  }

  return null;
}

//
// #### function rewriteLocationHeader(request, response, originalHost)
// #### @request {ServerRequest} Incoming HTTP Request intercepted by the proxy
// #### @response {ServerResponse} Outgoing HTTP Request to write proxied data to
// #### @originalHost {String} Original Host header of the incoming request, before manipulation
// If needed rewrite the Location header to be consistent with the source and target configuration.
// This will only rewrite if a Host header is present in the original request and
// the X-Forwarded-Proto in the proxy request header.
ReverseProxyHelper.prototype.rewriteLocationHeader = function (request, response, originalHost) {

  var self = this,
      decompConn;


  function isRedirectToTarget(decomp) { // Check if the redirect URL assumes a redirect to the target server

    var sourceProto = request.headers["x-forwarded-proto"];

    decompConn = self.decomposeUrl(sourceProto+"://"+originalHost);

    if (!decompConn) return false;

    var targetProto = (self.target.https ? "https" : "http")
    var sameProto = targetProto == decomp.proto;
    var samePort = Number(self.target.port) === decomp.port;
    var isLocalHost = "127.0.0.1" === decomp.host || "localhost" === decomp.host;

    return sameProto && samePort && ( decompConn.host === decomp.host || self.target.host == decomp.host || isLocalHost);
  }

  if (self.isHttpRedirect(response)) {

    var decomp = this.decomposeUrl(response.headers.location);

    if (decomp && isRedirectToTarget(decomp)) {

      var defaultPort = (decompConn.port === 80 || decompConn.port === 443);

      var proto = decompConn.proto + "://",
          host = decompConn.host,
          port = defaultPort ? "" : ":" + decompConn.port,
          path = decomp.path;

      response.headers['x-reverse-proxy-location-rewritten-from'] = response.headers.location;

      response.headers.location = proto + host + port + path;

      response.headers['x-reverse-proxy-location-rewritten-to'] = response.headers.location;

    }
  }
}
