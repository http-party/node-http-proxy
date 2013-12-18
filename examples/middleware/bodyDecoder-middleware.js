/*
  bodyDecoder-middleware.js: Basic example of `connect.bodyParser()` middleware in node-http-proxy

  Copyright (c) Nodejitsu 2013

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

var http = require('http'),
    connect = require('connect'),
    request = require('request'),
    colors = require('colors'),
    util = require('util'),
    Store = require('../helpers/store'),
    httpProxy = require('../../lib/http-proxy'),
    proxy = httpProxy.createProxyServer({});

http.createServer(new Store().handler()).listen(7531, function () {
  util.puts('http '.blue + 'greetings '.green + 'server'.blue + ' started '.green.bold + 'on port '.blue + '7531'.yellow);
//try these commands:
// get index:
// curl localhost:7531
// []
//
// get a doc:
// curl localhost:7531/foo
// {"error":"not_found"}
//
// post an doc:
// curl -X POST localhost:7531/foo -d '{"content": "hello", "type": "greeting"}'
// {"ok":true}
//
// get index (now, not empty)
// curl localhost:7531
// ["/foo"]
//
// get doc 
// curl localhost:7531/foo
// {"content": "hello", "type": "greeting"}

//
// now, suppose we wanted to direct all objects where type == "greeting" to a different store 
// than where type == "insult"
//
// we can use connect connect-bodyDecoder and some custom logic to send insults to another Store.

//insult server:

  http.createServer(new Store().handler()).listen(2600, function () {
    util.puts('http '.blue + 'insults '.red + 'server'.blue + ' started '.green.bold + 'on port '.blue + '2600'.yellow);

  //greetings -> 7531, insults-> 2600 

  // now, start a proxy server.

    //don't worry about incoming contont type
    //bodyParser.parse[''] = JSON.parse

    connect.createServer(
      //refactor the body parser and re-streamer into a separate package
      connect.bodyParser(),
      //body parser absorbs the data and end events before passing control to the next
      // middleware. if we want to proxy it, we'll need to re-emit these events after 
      //passing control to the middleware.
      require('connect-restreamer')(),
      function (req, res) {
        //if your posting an obect which contains type: "insult"
        //it will get redirected to port 2600.
        //normal get requests will go to 7531 nad will not return insults.
        var port = (req.body && req.body.type === 'insult' ? 2600 : 7531)
        proxy.web(req, res, { target: { host: 'localhost', port: port }});
      }
    ).listen(1337, function () {
      util.puts('http proxy server'.blue + ' started '.green.bold + 'on port '.blue + '1337'.yellow);
      //bodyParser needs content-type set to application/json
      //if we use request, it will set automatically if we use the 'json:' field.
      function post (greeting, type) {
        request.post({
          url: 'http://localhost:1337/' + greeting,
          json: {content: greeting, type: type || "greeting"}
        })
      }
      post("hello")
      post("g'day")
      post("kiora")
      post("houdy")
      post("java", "insult")

      //now, the insult should have been proxied to 2600
      
      //curl localhost:2600
      //["/java"]

      //but the greetings will be sent to 7531

      //curl localhost:7531
      //["/hello","/g%27day","/kiora","/houdy"]

    })
  })
});