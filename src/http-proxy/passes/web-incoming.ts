import httpNative, { IncomingMessage, ServerResponse } from "http";
import httpsNative from "https";
import webOutgoing from "./web-outgoing";
import { UrlWithStringQuery } from "url";
import { getPort, hasEncryptedConnection, setupOutgoing } from "../common";
import followRedirects from "follow-redirects";
import { proxyOptions } from "../../index";

const webOutgoingPasses = Object.values(webOutgoing);

const nativeAgents = { http: httpNative, https: httpsNative };

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
    req: IncomingMessage,
    res: ServerResponse,
    options: proxyOptions,
    _,
    server,
    clb
  ) {
    // And we begin!
    server.emit("start", req, res, options.target || options.forward);

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
      ).request(setupOutgoing(requestOptions, options, req, "forward"));

      // error handler (e.g. ECONNRESET, ECONNREFUSED)
      // Handle errors on incoming request as well as it makes sense to
      var forwardError = createErrorHandler(forwardReq, options.forward);
      req.on("error", forwardError);
      forwardReq.on("error", forwardError);

      (options.buffer || req).pipe(forwardReq);
      if (!options.target) {
        return res.end();
      }
    }

    // Request initalization
    var proxyReq = (
      (options.target as UrlWithStringQuery).protocol === "https:"
        ? https
        : http
    ).request(setupOutgoing(requestOptions, options, req));

    // Enable developers to modify the proxyReq before headers are sent
    proxyReq.on("socket", function (socket) {
      if (server && !proxyReq.getHeader("expect")) {
        server.emit("proxyReq", proxyReq, req, res, options);
      }
    });

    // allow outgoing socket to timeout so that we could
    // show an error page at the initial request
    if (options.proxyTimeout) {
      proxyReq.setTimeout(options.proxyTimeout, function () {
        proxyReq.destroy();
      });
    }

    // ensure we destroy proxy if request is aborted
    res.on("close", function () {
      var aborted = !res.writableFinished;
      if (aborted) {
        proxyReq.destroy();
      }
    });

    // handle errors in proxy and incoming request, just like for forward proxy
    var proxyError = createErrorHandler(proxyReq, options.target);
    req.on("error", proxyError);
    proxyReq.on("error", proxyError);

    function createErrorHandler(proxyReq: httpNative.ClientRequest, url) {
      return function proxyError(err) {
        if (req.socket.destroyed && err.code === "ECONNRESET") {
          server.emit("econnreset", err, req, res, url);
          return proxyReq.destroy();
        }

        if (clb) {
          clb(err, req, res, url);
        } else {
          server.emit("error", err, req, res, url);
        }
      };
    }

    (options.buffer || req).pipe(proxyReq);

    proxyReq.on("response", function forwardResponse(proxyRes) {
      if (server) {
        server.emit("proxyRes", proxyRes, req, res);
      }

      if (!res.headersSent && !options.selfHandleResponse) {
        for (var i = 0; i < webOutgoingPasses.length; i++) {
          // @ts-ignore - can return boolean
          if (webOutgoingPasses[i](req, res, proxyRes, options)) {
            break;
          }
        }
      }

      if (!res.writableEnded) {
        // Allow us to listen when the proxy has completed
        proxyRes.on("end", function () {
          if (server) server.emit("end", req, res, proxyRes);
        });
        // We pipe to the response unless its expected to be handled by the user
        if (!options.selfHandleResponse) proxyRes.pipe(res);
      } else {
        if (server) server.emit("end", req, res, proxyRes);
      }
    });
  },
};
