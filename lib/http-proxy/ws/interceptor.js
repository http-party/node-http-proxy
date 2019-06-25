'use strict';

const PerMessageDeflate = require('ws/lib/PerMessageDeflate');
const Extensions = require('ws/lib/Extensions');
const Receiver = require('ws/lib/Receiver');
const Sender = require('ws/lib/Sender');

const acceptExtensions = ({extenstions, isServer}) => {
    const {extensionName} = PerMessageDeflate;
    const extenstion = extenstions[extensionName];

    if (!extenstion) {
        return {};
    }

    const perMessageDeflate = new PerMessageDeflate({}, isServer);
    perMessageDeflate.accept(extenstion);

    return {[extensionName]: perMessageDeflate};
};

const getMsgHandler = ({interceptor, dataSender, binary}) => {
    return (data, flags) => {
        if (typeof interceptor !== 'function') {
            dataSender({data});
            return;
        }

        const modifiedData = interceptor(data, flags);

        // if interceptor does not return data then nothing will be sended to the server
        if (modifiedData) {
            dataSender({data: modifiedData, binary});
        }
    }
};

module.exports = class Interceptor {
    static create(opts = {}) {
        return new this(opts);
    }

    constructor({socket, options, proxyReq, proxyRes, proxySocket}) {
        this._socket = socket;
        this._options = options;
        this._proxyReq = proxyReq;
        this._proxyRes = proxyRes;
        this._proxySocket = proxySocket;

        this._configure();
    }

    _configure() {
        const secWsExtensions = this._proxyRes.headers['sec-websocket-extensions'];
        const extenstions = Extensions.parse(secWsExtensions);
        this._isCompressed = secWsExtensions && secWsExtensions.indexOf('permessage-deflate') != -1;

        // need both versions of extensions for each side of the proxy connection
        this._clientExtenstions = this._isCompressed ? acceptExtensions({extenstions, isServer: false}) : null;
        this._serverExtenstions = this._isCompressed ? acceptExtensions({extenstions, isServer: true}) : null;
    }

    _getDataSender({sender, event, options}) {
        return ({data, binary = false}) => {
            const opts = Object.assign({fin: true, compress: this._isCompressed, binary}, options);
            sender.send(data, opts);

            this._proxyReq.emit(event, {data, binary});
        };
    }

    _interceptClientMessages() {
        const receiver = new Receiver(this._clientExtenstions);
        const sender = new Sender(this._proxySocket, this._serverExtenstions);

        // frame must be masked when send from client to server - https://tools.ietf.org/html/rfc6455#section-5.3
        const options = {mask: true};
        const dataSender = this._getDataSender({sender, event: 'wsClientMsg', options});

        receiver.ontext = getMsgHandler({interceptor: this._options.wsInterceptClientMsg, dataSender, binary: false});
        receiver.onbinary = getMsgHandler({interceptor: this._options.wsInterceptClientMsg, dataSender, binary: true});
        receiver.onclose = (code, msg, {masked: mask}) => sender.close(code, msg, mask);

        this._socket.on('data', (data) => receiver.add(data));
    }

    _interceptServerMessages() {
        const receiver = new Receiver(this._serverExtenstions);
        const sender = new Sender(this._socket, this._clientExtenstions);

        const options = {mask: false};
        const dataSender = this._getDataSender({sender, event: 'wsServerMsg', options});

        receiver.ontext = getMsgHandler({interceptor: this._options.wsInterceptServerMsg, dataSender, binary: false});
        receiver.onbinary = getMsgHandler({interceptor: this._options.wsInterceptServerMsg, dataSender, binary: true});
        receiver.onclose = (code, msg, {masked: mask}) => sender.close(code, msg, mask);

        this._proxySocket.on('data', (data) => receiver.add(data));
    }

    startDataTransfer() {
        this._interceptClientMessages();
        this._interceptServerMessages();
    }
};
