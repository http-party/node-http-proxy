var http   = require('http'),
    https  = require('https'),
    common = require('../common'),
    passes = exports;

/*!
 * Array of passes.
 *
 * A `pass` is just a function that is executed on `req, socket, options`
 * so that you can easily add new checks while still keeping the base
 * flexible.
 */

/*
 * Websockets Passes
 *
 */

var passes = exports;

[
  /**
   * WebSocket requests must have the `GET` method and
   * the `upgrade:websocket` header
   *
   * @param {ClientRequest} Req Request object
   * @param {Socket} Websocket
   *
   * @api private
   */

  function checkMethodAndHeader (req, socket) {
    if (req.method !== 'GET' || !req.headers.upgrade) {
      socket.destroy();
      return true;
    }

    if (req.headers.upgrade.toLowerCase() !== 'websocket') {
      socket.destroy();
      return true;
    }
  },

  /**
   * Sets `x-forwarded-*` headers if specified in config.
   *
   * @param {ClientRequest} Req Request object
   * @param {Socket} Websocket
   * @param {Object} Options Config object passed to the proxy
   *
   * @api private
   */

  function XHeaders(req, socket, options) {
    if(!options.xfwd) return;

    var values = {
      for  : req.connection.remoteAddress || req.socket.remoteAddress,
      port : common.getPort(req),
      proto: common.hasEncryptedConnection(req) ? 'wss' : 'ws'
    };

    ['for', 'port', 'proto'].forEach(function(header) {
      req.headers['x-forwarded-' + header] =
        (req.headers['x-forwarded-' + header] || '') +
        (req.headers['x-forwarded-' + header] ? ',' : '') +
        values[header];
    });
  },

  /**
   * Does the actual proxying. Make the request and upgrade it
   * send the Switching Protocols request and pipe the sockets.
   *
   * @param {ClientRequest} Req Request object
   * @param {Socket} Websocket
   * @param {Object} Options Config object passed to the proxy
   *
   * @api private
   */
  function stream(req, socket, options, head, server, clb) {
    common.setupSocket(socket);

    if (head && head.length) socket.unshift(head);


    var proxyReq = (common.isSSL.test(options.target.protocol) ? https : http).request(
      common.setupOutgoing(options.ssl || {}, options, req)
    );

    // Enable developers to modify the proxyReq before headers are sent
    if (server) { server.emit('proxyReqWs', proxyReq, req, socket, options, head); }

    // Error Handler
    proxyReq.on('error', onOutgoingError);
    proxyReq.on('response', function (res) {
      // if upgrade event isn't going to happen, close the socket
      if (!res.upgrade) socket.end();
    });

    proxyReq.on('upgrade', function(proxyRes, proxySocket, proxyHead) {
      proxySocket.on('error', onOutgoingError);

      // Allow us to listen when the websocket has completed
      proxySocket.on('end', function () {
        server.emit('close', proxyRes, proxySocket, proxyHead);
      });

      // The pipe below will end proxySocket if socket closes cleanly, but not
      // if it errors (eg, vanishes from the net and starts returning
      // EHOSTUNREACH). We need to do that explicitly.
      socket.on('error', function () {
        proxySocket.end();
      });

      common.setupSocket(proxySocket);

      if (proxyHead && proxyHead.length) proxySocket.unshift(proxyHead);

      //
      // Remark: Handle writing the headers to the socket when switching protocols
      // Also handles when a header is an array
      //
      socket.write(
        Object.keys(proxyRes.headers).reduce(function (head, key) {
          var value = proxyRes.headers[key];

          if (!Array.isArray(value)) {
            head.push(key + ': ' + value);
            return head;
          }

          for (var i = 0; i < value.length; i++) {
            head.push(key + ': ' + value[i]);
          }
          return head;
        }, ['HTTP/1.1 101 Switching Protocols'])
        .join('\r\n') + '\r\n\r\n'
      );

      function setupInterceptingWebSocket() {
        var PerMessageDeflate = require('ws/lib/PerMessageDeflate'),
            Extensions        = require('ws/lib/Extensions'),
            Receiver          = require('ws/lib/Receiver'),
            Sender            = require('ws/lib/Sender');

        // Needed to catch the pipe closing, and notifying the consumer
        proxyReq.on('close', function(data) {
          server.emit('close', proxyRes, proxySocket, proxyHead);
        });

        function acceptExtensions(offer, isServer) {
          var extensions = {};
          if (offer[PerMessageDeflate.extensionName]) {
            var perMessageDeflate = new PerMessageDeflate({}, isServer);
            perMessageDeflate.accept(offer[PerMessageDeflate.extensionName]);
            extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
          }
          return extensions;
        }

        ////////////////////////////////////////////////////////////////////////
        // [Client] -> [ProxyServer] <-> [ProxyClient] -> [Server]
        // socket is the [Client] / proxySocket is the [Server]

        // This section is handling: [ProxyClient] -> [Server]
        // Parse the extensions, typically set to something like: permessage-deflate; client_max_window_bits=15
        var isCompressed = ('sec-websocket-extensions' in proxyRes.headers) && (proxyRes.headers['sec-websocket-extensions'].indexOf('permessage-deflate') != -1);
        var offer = Extensions.parse(proxyRes.headers['sec-websocket-extensions']);
        // We need both client/server versions of the extensions for each side of the proxy connection
        var extensionsAsServer = isCompressed ? acceptExtensions(offer, false) : null;
        var extensionsAsClient = isCompressed ? acceptExtensions(offer, true) : null;
        // Receiver takes socket stream data and reconstructs and emits web socket messages
        var toServerReceiver = new Receiver(extensionsAsServer);
        // Sender takes raw data and composes packaged messages to send through the websocket
        var toServerSender = new Sender(proxySocket, extensionsAsClient);
        // Wrapped so we can expose this with the correct options
        var toServerSenderFunction = function(data, binary) {
          // Server needs masking enabled see WebSocket RFC: Client-to-Server Masking
          // If this is not set, the websocket will fail to connect
          var sendOptions = { fin: true, mask: true, compress: isCompressed, binary: !!binary };
          proxyReq.emit('message_toserver', data, binary);
          toServerSender.send(data, sendOptions);
        }

        // Callback when a websocket text message is received
        toServerReceiver.ontext = function(data, flags) {
          if (typeof (options.wsOnMessageToServer) === 'function') {
            data = options.wsOnMessageToServer(data, flags);
            // TODO: might be legit to send an empty message, and we are using it as a sentinal value to indicate we consumed the message
            if (data) {
              toServerSenderFunction(data);
            }
          }
          else {
            toServerSenderFunction(data);
          }
        };

        // Callback when a websocket binary message is received
        toServerReceiver.onbinary = function(data, flags) {
          if (typeof (options.wsOnMessageToServer) === 'function') {
            data = options.wsOnMessageToServer(data, flags);
            // TODO: might be legit to send an empty message, and we are using it as a sentinal value to indicate we consumed the message
            if (data) {
              toServerSenderFunction(data, true);
            }
          }
          else {
            toServerSenderFunction(data, true);
          }
        };

        // Accept stream data from the socket and add it into the websocket receiver in order to retreive messages
        socket.on('data', function(data) {
          toServerReceiver.add(data);
        });

        ////////////////////////////////////////////////////////////////////////
        // This section is handling: [Client] -> [ProxyServer]
        var toClientReceiver = new Receiver(extensionsAsClient);
        var toClientSender = new Sender(socket, extensionsAsServer);
        // Wrapped so we can expose this with the correct options
        var toClientSenderFunction = function(data, binary) {
          var sendOptions = { fin: true, mask: false, compress: isCompressed, binary: false };
          proxyReq.emit('message_toclient', data, binary);
          toClientSender.send(data, sendOptions);
        }
        toClientReceiver.ontext = function(data, flags) {
          if (typeof (options.wsOnMessageToClient) === 'function') {
            data = options.wsOnMessageToClient(data, flags);
            // TODO: might be legit to send an empty message, and we are using it as a sentinal value to indicate we consumed the message
            if (data) {
              toClientSenderFunction(data);
            }
          }
          else {
            toClientSenderFunction(data);
          }
        };

        toClientReceiver.onbinary = function(data, flags) {
          if (typeof (options.wsOnMessageToClient) === 'function') {
            data = options.wsOnMessageToClient(data, flags);
            // TODO: might be legit to send an empty message, and we are using it as a sentinal value to indicate we consumed the message
            if (data) {
              toClientSenderFunction(data, true);
            }
          }
          else {
            toClientSenderFunction(data, true);
          }
        };

        proxySocket.on('data', function(data) {
          toClientReceiver.add(data);
        });

        if (server) { server.emit('websocket_connected', toServerSenderFunction, toClientSenderFunction); }
      }

      if (options.wsInterceptMessages) {
        setupInterceptingWebSocket();
      }
      else {
        proxySocket.pipe(socket).pipe(proxySocket);
      }

      server.emit('open', proxySocket);
      server.emit('proxySocket', proxySocket);  //DEPRECATED.
    });

    return proxyReq.end(); // XXX: CHECK IF THIS IS THIS CORRECT

    function onOutgoingError(err) {
      if (clb) {
        clb(err, req, socket);
      } else {
        server.emit('error', err, req, socket);
      }
      socket.end();
    }
  }

] // <--
  .forEach(function(func) {
    passes[func.name] = func;
  });
