var request = require('request'),
    proxy = require('./lib/balancing-proxy');

proxy.createServer();

request({
  uri: 'http://localhost:8080/post'
}, function () {
  
})