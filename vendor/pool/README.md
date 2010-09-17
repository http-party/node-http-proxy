# Pool -- Simple HTTP client pooling

## Install

<pre>
  npm install pool
</pre>

## Super simple to use

Pool has two core usage scenarios: creating a pool and creating a set of pools. Creating a pool is easy:

<pre>
  var pool = require('pool'),
      sys = require('sys'),
      local = pool.createPool('80', 'localhost');

  client = local.request('GET', '/', function (request) {
    // You can work with the request here just as you would as if it 
    // was returned from http.createClient
    request.on('end', function () {
      sys.puts('Request ended');
    });
  });
</pre>

Creating a set of pools can be accomplished using a PoolManager:

<pre>
  var pool = require('pool'),
      manager = pool.createPoolManager(),
      local = manager.getPool('80', 'localhost');

  client = local.request('GET', '/', function (request) {
    // You can work with the request here just as you would as if it 
    // was returned from http.createClient
    request.on('end', function () {
      sys.puts('Request ended');
    });        
  });
</pre>