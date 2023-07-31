import httpNative, { IncomingMessage, ServerResponse } from "http";
import httpsNative from "https";
import webOutgoing from "./web-outgoing";
import { UrlWithStringQuery } from "url";
import { getPort, hasEncryptedConnection, setupOutgoing } from "../common";
import followRedirects from "follow-redirects";
import { proxyOptions } from "../../index";

const webOutgoingPasses = Object.values(webOutgoing);

const nativeAgents = { http: httpNative, https: httpsNative };

// https://nodejs.org/dist/latest-v18.x/docs/api/http.html#:~:text=In%20a%20successful%20request%2C%20the%20following%20events%20will%20be%20emitted%20in%20the%20following%20order%3A

/*!
 * Array of passes.
 *
 * A `pass` is just a function that is executed on `req, res, options`
 * so that you can easily add new checks while still keeping the base
 * flexible.
 */

export default {
  /**
   * Sets `content-length` to '0' if request is of DELETE type.
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {Object} Options Config object passed to the proxy
   *
   * @api private
   */

  deleteLength: function deleteLength(
    req: IncomingMessage,
    res: ServerResponse,
    options: any
  ) {
    if (
      (req.method === "DELETE" || req.method === "OPTIONS") &&
      !req.headers["content-length"]
    ) {
      req.headers["content-length"] = "0";
      delete req.headers["transfer-encoding"];
    }
  },

  /**
   * Sets timeout in request socket if it was specified in options.
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {Object} Options Config object passed to the proxy
   *
   * @api private
   */

  timeout: function timeout(
    req: IncomingMessage,
    res: ServerResponse,
    options: proxyOptions
  ) {
    if (options.timeout) {
      req.socket.setTimeout(options.timeout);
    }
  },

  /**
   * Sets `x-forwarded-*` headers if specified in config.
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {Object} Options Config object passed to the proxy
   *
   * @api private
   */

  XHeaders: function XHeaders(
    req: IncomingMessage,
    res: ServerResponse,
    options: any
  ) {
    if (!options.xfwd) return;
    // @ts-ignore
    const encrypted = req.isSpdy || hasEncryptedConnection(req);
    const values: Record<string, any> = {
      for: req.socket.remoteAddress || req.socket.remoteAddress,
      port: getPort(req),
      proto: encrypted ? "https" : "http",
    };

    Object.keys(values).forEach((header) => {
      req.headers["x-forwarded-" + header] =
        (req.headers["x-forwarded-" + header] || "") +
        (req.headers["x-forwarded-" + header] ? "," : "") +
        values[header];
    });

    req.headers["x-forwarded-host"] =
      req.headers["x-forwarded-host"] || req.headers["host"] || "";
  },

  /**
   * Does the actual proxying. If `forward` is enabled fires up
   * a ForwardStream, same happens for ProxyStream. The request
   * just dies otherwise.
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {Object} Options Config object passed to the proxy
   *
   * @api private
   */

  stream: function stream(
    downstreamReq: IncomingMessage,
    downstreamRes: ServerResponse,
    options: proxyOptions,
    _,
    server,
    clb
  ) {
    // And we begin!
    server.emit("start", downstreamReq, downstreamRes, options.target || options.forward);

    // @ts-ignore
    const agents: {
      http: typeof httpNative;
      https: typeof httpsNative;
    } = options.followRedirects ? followRedirects : nativeAgents;

    const http = agents.http;
    const https = agents.https;
    const requestOptions = {
      ...(options.ssl || {}),
      ...options.requestOptions,
    };
    if (options.forward) {
      // If forward enable, so just pipe the request
      var forwardReq = (
        options.forward.protocol === "https:" ? https : http
      ).request(setupOutgoing(requestOptions, options, downstreamReq, "forward"));

      // error handler (e.g. ECONNRESET, ECONNREFUSED)
      // Handle errors on incoming request as well as it makes sense to
      downstreamReq.on("error", proxyError);
      forwardReq.on("error", proxyError);

      (options.buffer || downstreamReq).pipe(forwardReq);
      if (!options.target) {
        return downstreamRes.end();
      }
    }

    // Request initalization
    var upstreamReq = (
      (options.target as UrlWithStringQuery).protocol === "https:"
        ? https
        : http
    ).request(setupOutgoing(requestOptions, options, downstreamReq));

    // Enable developers to modify the upstreamReq before headers are sent
    upstreamReq.on("socket", function (socket) {
      if (server && !upstreamReq.getHeader("expect")) {
        server.emit("upstreamReq", upstreamReq, downstreamReq, downstreamRes, options);
      }
    });

    // allow outgoing socket to timeout so that we could
    // show an error page at the initial request
    if (options.proxyTimeout) {
      upstreamReq.setTimeout(options.proxyTimeout, function () {
        upstreamReq.destroy();
      });
    }

    // ensure we destroy proxy if request is aborted
    downstreamRes.on("close", function () {
      var aborted = !downstreamRes.writableFinished;
      if (aborted) {
        upstreamReq.destroy();
      }
    });

    // handle errors in proxy and incoming request, just like for forward proxy
    downstreamReq.on("error", proxyError);
    upstreamReq.on("error", proxyError);

    function proxyError(err) {      
      const url = options.target || options.forward;
      // incoming request was already destroyed.
      if (downstreamReq.socket.destroyed && err.code === "ECONNRESET") {
        server.emit("econnreset", err, downstreamReq, downstreamRes, url);
        return upstreamReq.destroy();
      }

      if (clb) {
        clb(err, downstreamReq, downstreamRes, url);
      } else {
        server.emit("error", err, downstreamReq, downstreamRes, url);
      }
    }

    (options.buffer || downstreamReq).pipe(upstreamReq);

    upstreamReq.on("response", function forwardResponse(upstreamRes) {
      if (server) {
        server.emit("upstreamRes", upstreamRes, downstreamReq, downstreamRes);
      }

      if (!downstreamRes.headersSent && !options.selfHandleResponse) {
        for (var i = 0; i < webOutgoingPasses.length; i++) {
          // @ts-ignore - can return boolean
          if (webOutgoingPasses[i](downstreamReq, downstreamRes, upstreamRes, options)) {
            break;
          }
        }
      }

      if (!downstreamRes.writableEnded) {
        // Allow us to listen when the proxy has completed
        upstreamRes.on("end", function () {
          if (server) server.emit("end", downstreamReq, downstreamRes, upstreamRes);
        });
        // We pipe to the response unless its expected to be handled by the user
        // https://nodejs.org/api/stream.html#readablepipedestination-options
        if (!options.selfHandleResponse) upstreamRes.pipe(downstreamRes);
      } else {
        upstreamRes.resume();
        if (server) server.emit("end", downstreamReq, downstreamRes, upstreamRes);
      }
    });
  },
};
