/*
 reverse-proxy-helper-test.js: test for http reverse proxy helper methods.

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

var assert = require('assert'),
    vows = require('vows'),
    ReverseProxyHelper = require('../../lib/node-http-proxy/reverse-proxy-helper').ReverseProxyHelper,
    req = { headers: {} },
    reqHttps = { headers: {} };

req.headers["x-forwarded-proto"] = "http";
reqHttps.headers["x-forwarded-proto"] = "https";

vows.describe("Reverse Proxy Helper").addBatch({

  "when decomposing URL ":{

    "http://server-host.com/myRequest":{
      topic:function () {
        return new ReverseProxyHelper().decomposeUrl("http://server-host.com/myRequest");
      },
      "the proto is http":function (deco) {
        assert.equal(deco.proto, "http");
      },
      "the port is 80":function (topic) {
        assert.equal(topic.port, 80);
      },
      "the host is server-host.com":function (topic) {
        assert.equal(topic.host, "server-host.com");
      },
      "the path is /myRequest":function (topic) {
        assert.equal(topic.path, "/myRequest");
      }
    },

    "https://server-host.com/myRequest":{
      topic:function () {
        return new ReverseProxyHelper().decomposeUrl("https://server-host.com/myRequest");
      },
      "the proto is https":function (deco) {
        assert.equal(deco.proto, "https");
      },
      "the port is 443":function (topic) {
        assert.equal(topic.port, 443);
      },
      "the host is server-host.com":function (topic) {
        assert.equal(topic.host, "server-host.com");
      },
      "the path is /myRequest":function (topic) {
        assert.equal(topic.path, "/myRequest");
      }
    },

    "http://server-host.com:8181/myRequest":{

      topic:function () {
        return new ReverseProxyHelper().decomposeUrl("http://server-host.com:8181/myRequest");
      },
      "the proto is http":function (deco) {
        assert.equal(deco.proto, "http");
      },
      "the port is 8181":function (topic) {
        assert.equal(topic.port, 8181);
      },
      "the host is server-host.com":function (topic) {
        assert.equal(topic.host, "server-host.com");
      },
      "the path is /myRequest":function (topic) {
        assert.equal(topic.path, "/myRequest");
      }
    },

    "https://server-host.com:8181/myRequest":{

      topic:function () {
        return new ReverseProxyHelper().decomposeUrl("https://server-host.com:8181/myRequest");
      },
      "the proto is https":function (deco) {
        assert.equal(deco.proto, "https");
      },
      "the port is 8181":function (topic) {
        assert.equal(topic.port, 8181);
      },
      "the host is server-host.com":function (topic) {
        assert.equal(topic.host, "server-host.com");
      },
      "the path is /myRequest":function (topic) {
        assert.equal(topic.path, "/myRequest");
      }
    },

    "http://server-host.com:8080":{

      topic:function () {
        return new ReverseProxyHelper().decomposeUrl("http://server-host.com:8080");
      },
      "the proto is http":function (deco) {
        assert.equal(deco.proto, "http");
      },
      "the port is 8080":function (topic) {
        assert.equal(topic.port, 8080);
      },
      "the host is server-host.com":function (topic) {
        assert.equal(topic.host, "server-host.com");
      },
      "the path is undefined":function (topic) {
        assert.equal(topic.path, undefined);
      }
    },

    "http://server-host.com:8080/?user=foo":{

      topic:function () {
        return new ReverseProxyHelper().decomposeUrl("http://server-host.com:8080?user=foo");
      },
      "the proto is http":function (deco) {
        assert.equal(deco.proto, "http");
      },
      "the port is 8080":function (topic) {
        assert.equal(topic.port, 8080);
      },
      "the host is server-host.com":function (topic) {
        assert.equal(topic.host, "server-host.com");
      },
      "the path is ?user=foo":function (topic) {
        assert.equal(topic.path, "?user=foo");
      }
    },

    "http://server-host.com:8080/myRequest?user=foo":{

      topic:function () {
        return new ReverseProxyHelper().decomposeUrl("http://server-host.com:8080/myRequest?user=foo");
      },
      "the proto is http":function (deco) {
        assert.equal(deco.proto, "http");
      },
      "the port is 8080":function (topic) {
        assert.equal(topic.port, 8080);
      },
      "the host is server-host.com":function (topic) {
        assert.equal(topic.host, "server-host.com");
      },
      "the path is /myRequest?user=foo":function (topic) {
        assert.equal(topic.path, "/myRequest?user=foo");
      }
    },

    "http://127.0.0.1:8080/myRequest?user=foo":{

      topic:function () {
        return new ReverseProxyHelper().decomposeUrl("http://127.0.0.1:8080/myRequest?user=foo");
      },
      "the proto is http":function (deco) {
        assert.equal(deco.proto, "http");
      },
      "the port is 8080":function (topic) {
        assert.equal(topic.port, 8080);
      },
      "the host is 127.0.0.1":function (topic) {
        assert.equal(topic.host, "127.0.0.1");
      },
      "the path is /myRequest?user=foo":function (topic) {
        assert.equal(topic.path, "/myRequest?user=foo");
      }
    },

    "https://127.0.0.1:8080/myRequest?user=foo":{

      topic:function () {
        return new ReverseProxyHelper().decomposeUrl("https://127.0.0.1:8080/myRequest?user=foo");
      },
      "the proto is http":function (deco) {
        assert.equal(deco.proto, "https");
      },
      "the port is 8080":function (topic) {
        assert.equal(topic.port, 8080);
      },
      "the host is 127.0.0.1":function (topic) {
        assert.equal(topic.host, "127.0.0.1");
      },
      "the path is /myRequest?user=foo":function (topic) {
        assert.equal(topic.path, "/myRequest?user=foo");
      }
    },

    "/someApp/foo?bar=baz":{

      topic:function () {
        return new ReverseProxyHelper().decomposeUrl("/someApp/foo?bar=baz");
      },
      "decomposes to undefined, not an absolute URL":function (deco) {
        assert.equal(deco, undefined);
      }
    }

  },

  "when response with statusCode":{
    "200":{
      topic:function () {
        return new ReverseProxyHelper().isHttpRedirect({ statusCode:200 });
      },
      "no redirect":function (topic) {
        assert.equal(topic, false);
      }
    },
    "301 and no headers":{
      topic:function () {
        return new ReverseProxyHelper().isHttpRedirect({ statusCode:301 });
      },
      "no redirect - headers missing":function (topic) {
        assert.equal(topic, false);
      }
    },
    "302 and no headers":{
      topic:function () {
        return new ReverseProxyHelper().isHttpRedirect({ statusCode:302 });
      },
      "no redirect - headers missing":function (topic) {
        assert.equal(topic, false);
      }
    },
    "301 and location headers":{
      topic:function () {
        return new ReverseProxyHelper().isHttpRedirect({ statusCode:301, headers:{ location:'http://some/url' }});
      },
      "redirect - with location header":function (topic) {
        assert.equal(topic, true);
      }
    },
    "302 and location headers":{
      topic:function () {
        return new ReverseProxyHelper().isHttpRedirect({ statusCode:302, headers:{ location:'http://some/url' }});
      },
      "redirect - with location header":function (topic) {
        assert.equal(topic, true);
      }
    }
  },

  "when location header":{
    "/someApp/foo?bar=baz":{
      topic:function () {
        var origHost = "source.com";
        var target = { host:"target.com", port:8080 };
        var resp = { headers : { location: "/someApp/foo?bar=baz" }};
        new ReverseProxyHelper(target).rewriteLocationHeader(req, resp, origHost)
        return resp;
      },
      "don't rewrite (relative URL)":function (topic) {
        assert.equal(topic.headers.location, "/someApp/foo?bar=baz");
      }
    },
    "http://target.com:8080/someApp/foo?bar=baz":{
      topic:function () {
        var origHost = "source.com";
        var target = { host:"target.com", port:8080 };
        var resp = { statusCode: 301, headers : { location: "http://target.com:8080/someApp/foo?bar=baz" }};
        new ReverseProxyHelper(target).rewriteLocationHeader(req, resp, origHost)
        return resp;
      },
      "rewrite to http://source.com/someApp/foo?bar=baz":function (topic) {
        assert.equal(topic.headers.location, "http://source.com/someApp/foo?bar=baz");
      }
    },
    "http://source.com:8080/someApp/foo?bar=baz and https source":{
      topic:function () {
        var origHost = "source.com";
        var target = { host:"target.com", port:8080, https: false };
        var resp = { statusCode: 301, headers : { location: "http://source.com:8080/someApp/foo?bar=baz" }};
        new ReverseProxyHelper(target).rewriteLocationHeader(reqHttps, resp, origHost)
        return resp;
      },
      "rewrite to https://source.com/someApp/foo?bar=baz":function (topic) {
        assert.equal(topic.headers.location, "https://source.com/someApp/foo?bar=baz");
      }
    },
    "http://source.com/someApp/foo?bar=baz and https source same port source and target":{
      topic:function () {
        var origHost = "source.com:80";
        var target = { host:"target.com", port:80, https: false };
        var resp = { statusCode: 301, headers : { location: "http://source.com/someApp/foo?bar=baz" }};
        new ReverseProxyHelper(target).rewriteLocationHeader(reqHttps, resp, origHost)
        return resp;
      },
      "rewrite to https://source.com/someApp/foo?bar=baz":function (topic) {
        assert.equal(topic.headers.location, "https://source.com/someApp/foo?bar=baz");
      }
    },
    "http://localhost:8080/someApp/foo?bar=baz":{
      topic:function () {
        var origHost = "localhost:8181";
        var target = { host:"localhost", port:8080, https: false };
        var resp = { statusCode: 301, headers : { location: "http://localhost:8080/someApp/foo?bar=baz" }};
        new ReverseProxyHelper(target).rewriteLocationHeader(req, resp, origHost);
        return resp;
      },
      "rewrite to http://localhost:8181/someApp/foo?bar=baz":function (topic) {
        assert.equal(topic.headers.location, "http://localhost:8181/someApp/foo?bar=baz");
      }
    },
    "https://localhost:8080/someApp/foo?bar=baz and https target server":{
      topic:function () {
        var origHost = "localhost:8181";
        var target = { host:"localhost", port:8080, https: true };
        var resp = { statusCode: 301, headers : { location: "https://localhost:8080/someApp/foo?bar=baz" }};
        new ReverseProxyHelper(target).rewriteLocationHeader(req, resp, origHost);
        return resp;
      },
      "rewrite to http://localhost:8181/someApp/foo?bar=baz":function (topic) {
        assert.equal(topic.headers.location, "http://localhost:8181/someApp/foo?bar=baz");
      }
    },
  }

}).export(module);
