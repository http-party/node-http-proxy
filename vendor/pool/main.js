var sys = require('sys')
  , eyes = require('eyes')
  , http = require('http')
  , events = require('events')
  ;

function Pool (port, host, https, credentials) {
  this.port = port;
  this.host = host;
  this.https = https;
  this.credentials = credentials;
  this.clients = [];
  this.pending = [];
  this.minClients = 0;
  this.maxClients = 8;
};

sys.inherits(Pool, events.EventEmitter);

Pool.prototype.getClient = function (cb) {
  for (var i=0;i<this.clients.length;i+=1) {
    if (!this.clients[i].busy) {
      if (this.clients.length > this.maxClients) {
        this.clients[i].end();
        this.clients.splice(i, 1);
        i-=1;
      } else {
        return cb(this.clients[i]);
      }
    }
  }
  if (this.clients.length >= this.maxClients) {
    this.pending.push(cb);
  } else {
    var client = http.createClient(this.port, this.host, this.https, this.credentials);
    this.clients.push(client);
    cb(client);
  }
};

Pool.prototype.request = function () {
  // Argument parsing. This gets a little dicey with the 
  // differences in defaults
  var method, url, headers, callback, args;
  var self = this;
  args = Array.prototype.slice.call(arguments);
  
  if (typeof args[args.length - 1] === 'function') {
    callback = args.pop();
  }
  if (args[0]) method = args[0];
  if (args[1]) url = args[1];
  if (args[2]) headers = args[2];
  
  if (!headers) headers = {};
  if (!headers.Connection) headers.Connection = 'keep-alive';
  
  self.getClient(function (client) {
    var errorListener = function (error) {
      client.removeListener("error", errorListener);
      
      // Remove the client from the available clients since it has errored
      self.clients.splice(self.clients.indexOf(client), 1);
      
      self.emit("error", error);
      request.emit("error", error);
    };
    
    var request = client.request(method, url, headers);
    client.on("error", errorListener);
    request.on("response", function (response) {
      response.on("end", function () {
        client.removeListener("error", errorListener);
        client.busy = false;
        self.onFree(client);
      })
    })
    client.busy = true;
    callback(request);
  });
};

Pool.prototype.onFree = function (client) {
  if (this.pending.length > 0) this.pending.shift()(client);
};

Pool.prototype.setMinClients = function (num) {
  this.minClients = num;
  if (this.clients.length < num) {
    for (var i=this.clients.length;i<num;i+=1) {
      var client = http.createClient(this.port, this.host, this.https, this.credentials);
      this.clients.push(client);
      this.emit('free', client);
    }
  }
};

Pool.prototype.setMaxClients = function (num) {
  this.maxClients = num;
};
Pool.prototype.end = function () {
  this.clients.forEach(function (c) {c.end()});
};

function PoolManager () {
  this.pools = {};
  this.pending = [];
  this.minClients = 0;
  this.maxClients = 8;
};

PoolManager.prototype.setMaxClients = function (num) {
  this.maxClients = num;
  for (i in this.pools) {
    this.pools[i].setMaxClients(num);
  }
};

PoolManager.prototype.setMinClients = function (num) {
  this.minClients = num;
  for (i in this.pools) {
    this.pools[i].setMinClients(num);
  }
};

PoolManager.prototype.getPool = function (port, host, https, credentials) {
  var k = (port+host+https+credentials);
  if (!this.pools[k]) { 
    this.pools[k] = exports.createPool(port, host, https, credentials); 
    this.pools[k].setMinClients(this.minClients);
    this.pools[k].setMaxClients(this.maxClients);
  }
  return this.pools[k];
};

exports.createPool = function (port, host, https, credentials) {
  return new Pool(port, host, https, credentials);
};

exports.createPoolManager = function () {
  return new PoolManager();
};
