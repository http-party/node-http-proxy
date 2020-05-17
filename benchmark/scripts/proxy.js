const { createProxyServer } = require('../../');
const http = require('http');

const proxy = createProxyServer({});
const agent = new http.Agent({ keepAlive: true})

const server = http.createServer(function(req, res) {
    // You can define here your custom logic to handle the request
    // and then proxy the request.
    proxy.web(req, res, {
        target: 'http://localhost:9000',
        agent: agent
    });
});

console.log('listening on port 8000');
server.listen(8000);