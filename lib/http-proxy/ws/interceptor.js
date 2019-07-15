'use strict';

const PerMessageDeflate = require('ws/lib/PerMessageDeflate');
const Extensions = require('ws/lib/Extensions');
const Receiver = require('ws/lib/Receiver');
const Sender = require('ws/lib/Sender');

const acceptExtensions = ({extensions, isServer}) => {
    const {extensionName} = PerMessageDeflate;
    const extension = extensions[extensionName];

    if (!extension) {
        return {};
    }

    const perMessageDeflate = new PerMessageDeflate({}, isServer);
    perMessageDeflate.accept(extension);

    return {[extensionName]: perMessageDeflate};
};

module.exports = class Interceptor {
    static create(opts = {}) {
        return new this(opts);
    }

    constructor({socket, options, req, proxyReq, proxyRes, proxySocket}) {
        this._socket = socket;
        this._options = options;
        this._req = req;
        this._proxyReq = proxyReq;
        this._proxyRes = proxyRes;
        this._proxySocket = proxySocket;
        this._isSocketOpened = true;

        this._configure();
    }

    _configure() {
        this._proxySocket.on('close', () => {
            this._isSocketOpened = false;
        });

        const secWsExtensions = this._proxyRes.headers['sec-websocket-extensions'];
        const extensions = Extensions.parse(secWsExtensions);
        this._isCompressed = secWsExtensions && secWsExtensions.includes('permessage-deflate');

        // need both versions of extensions for each side of the proxy connection
        this._clientExtensions = this._isCompressed ? acceptExtensions({extensions, isServer: false}) : null;
        this._serverExtensions = this._isCompressed ? acceptExtensions({extensions, isServer: true}) : null;
    }

    _getDataSender({sender, event, options}) {
        return ({data, binary = false}) => {
            const opts = Object.assign({fin: true, compress: this._isCompressed, binary}, options);
            sender.send(data, opts);

            this._proxyReq.emit(event, {data, binary});
        };
    }

    _getMsgHandler({interceptor, dataSender, binary}) {
        return (data, flags) => {
            if (typeof interceptor !== 'function') {
                dataSender({data});
                return;
            }

            const modifiedData = interceptor(data, {req: this._req, flags});

            // if interceptor does not return data then nothing will be sended to the server
            if (modifiedData) {
                dataSender({data: modifiedData, binary});
            }
        }
    }

    _interceptClientMessages() {
        const receiver = new Receiver(this._clientExtensions);
        const sender = new Sender(this._proxySocket, this._serverExtensions);
        this._proxyReq.emit('clientSenderInited', sender);

        // frame must be masked when send from client to server - https://tools.ietf.org/html/rfc6455#section-5.3
        const options = {mask: true};
        const dataSender = this._getDataSender({sender, event: 'wsClientMsg', options});

        receiver.ontext = this._getMsgHandler({interceptor: this._options.wsInterceptClientMsg, dataSender, binary: false});
        receiver.onbinary = this._getMsgHandler({interceptor: this._options.wsInterceptClientMsg, dataSender, binary: true});
        receiver.onclose = (code, msg, {masked: mask}) => this._isSocketOpened && sender.close(code, msg, mask);

        this._socket.on('data', (data) => receiver.add(data));
    }

    _interceptServerMessages() {
        const receiver = new Receiver(this._serverExtensions);
        const sender = new Sender(this._socket, this._clientExtensions);
        this._proxyReq.emit('serverSenderInited', sender);

        const options = {mask: false};
        const dataSender = this._getDataSender({sender, event: 'wsServerMsg', options});

        receiver.ontext = this._getMsgHandler({interceptor: this._options.wsInterceptServerMsg, dataSender, binary: false});
        receiver.onbinary = this._getMsgHandler({interceptor: this._options.wsInterceptServerMsg, dataSender, binary: true});
        receiver.onclose = (code, msg, {masked: mask}) => this._isSocketOpened && sender.close(code, msg, mask);

        this._proxySocket.on('data', (data) => receiver.add(data));
    }

    startDataTransfer() {
        this._interceptClientMessages();
        this._interceptServerMessages();
    }
};
