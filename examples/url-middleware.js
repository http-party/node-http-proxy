/*
  url-middleware.js: Example of a simple url routing middleware for node-http-proxy

  Copyright (c) 2010 Charlie Robbins, Mikeal Rogers, Fedor Indutny, & Marak Squires.

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

var util = require('util'),
    colors = require('colors'),
    http = require('http'),
    httpProxy = require('http-proxy');
 
//
// This is an example of a url-routing middleware.
// This is not intended for production use, but rather as
// an example of how to write a middleware.
//

function matcher (url, dest) {
  //
  // First, turn the URL into a regex.  
  // NOTE: Turning user input directly into a Regular Expression is NOT SAFE.
  //
  var r = new RegExp(url.replace(/\//, '\\/'));
  
  //
  // This next block of code may look a little confusing. 
  // It returns a closure (anonymous function) for each URL to be matched,
  // storing them in an array - on each request, if the URL matches one that has
  // a function stored for it, the function will be called.
  //
  return function (url) {
    var m = r(url)
    if (!m) {
      return;
    }
    var path = url.slice(m[0].length);
    console.log('proxy:', url, '->', dest);
    return {
      url: path, 
      dest: dest
    };
  }
}

exports.urls = function (urls) {
  // This is the entry point for our middleware.
  // 'matchers' is the array of URL matchers, as mentioned above.
  var matchers = [];
  for (var url in urls) {
    // Call the 'matcher' function above, and store the resulting closure.
    matchers.push(matcher(url, urls[url]));
  }

  // This closure is returned as the request handler.
  return function (req, res, next) {
    //
    // in node-http-proxy middlewares, `proxy` is the prototype of `next`
    // (this means node-http-proxy middlewares support both the connect API (req, res, next)
    // and the node-http-proxy API (req, res, proxy)
    //
    var proxy = next;
    for (var k in matchers) {
      // for each URL matcher, try the request's URL.
      var m = matchers[k](req.url);
      // If it's a match:
      if (m) {
        // Replace the local URL with the destination URL.
        req.url = m.url;
        // If routing to a server on another domain, the hostname in the request must be changed.
        req.headers.host = m.host;
        // Once any changes are taken care of, this line makes the magic happen.
        proxy.proxyRequest(req, res, m.dest);
      }
    }
  }
}

//
// Now we set up our proxy.
//
httpProxy.createServer(
  //
  // This is where our middlewares go, with any options desired - in this case,
  // the list of routes/URLs and their destinations.
  //
  exports.urls({
    '/hello': { port: 9000, host: 'localhost' },
    '/charlie': { port: 80, host: 'charlieistheman.com' },
    '/google': { port: 80, host: 'google.com' } 
  });
).listen(8000);

//
// Target Http Server (to listen for requests on 'localhost')
//
http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9000);

// And finally, some colored startup output.
util.puts('http proxy server'.blue + ' started '.green.bold + 'on port '.blue + '8000'.yellow);
util.puts('http server '.blue + 'started '.green.bold + 'on port '.blue + '9000 '.yellow);