var colors = require('colors'),
    httpProxy = require('../../lib/http-proxy')
    dns = require('dns');


httpProxy.createServer({
    target: 'http://example.com:80',
    changeOrigin: true,

    // Define custom dns lookup function
    lookup: function (host, options, callback) {
        console.log('Looking up', host);

        dns.lookup(host, options, function (err, address, family) {
            console.log('Result: err:', err, ', address:', address, 'family:', family);
            
            callback(err, address, family);
        });
    },        
}).listen(8003);


console.log('http proxy server'.blue + ' started '.green.bold + 'on port '.blue + '8003'.yellow);