import url from "url";
import type { IncomingMessage, ServerResponse } from "http";
import { rewriteCookieProperty } from "../common";

var redirectRegex = /^201|30(1|2|7|8)$/;

/*!
 * Array of passes.
 *
 * A `pass` is just a function that is executed on `req, res, options`
 * so that you can easily add new checks while still keeping the base
 * flexible.
 */

export default {
  // <--

  /**
   * If is a HTTP 1.0 request, remove chunk headers
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {upstreamResponse} Res Response object from the proxy request
   *
   * @api private
   */
  removeChunked: function removeChunked(
    req: IncomingMessage,
    res: ServerResponse,
    upstreamRes: IncomingMessage
  ) {
    if (req.httpVersion === "1.0") {
      delete upstreamRes.headers["transfer-encoding"];
    }
  },

  /**
   * If is a HTTP 1.0 request, set the correct connection header
   * or if connection header not present, then use `keep-alive`
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {upstreamResponse} Res Response object from the proxy request
   *
   * @api private
   */
  setConnection: function setConnection(
    req: IncomingMessage,
    res: ServerResponse,
    upstreamRes: IncomingMessage
  ) {
    if (req.httpVersion === "1.0") {
      upstreamRes.headers.connection = req.headers.connection || "close";
    } else if (req.httpVersion !== "2.0" && !upstreamRes.headers.connection) {
      upstreamRes.headers.connection = req.headers.connection || "keep-alive";
    }
  },

  setRedirectHostRewrite: function setRedirectHostRewrite(
    req: IncomingMessage,
    res: ServerResponse,
    upstreamRes: IncomingMessage,
    options: any
  ) {
    if (
      (options.hostRewrite || options.autoRewrite || options.protocolRewrite) &&
      upstreamRes.headers["location"] &&
      redirectRegex.test(upstreamRes.statusCode as any)
    ) {
      const target = url.parse(options.target);
      const u = url.parse(upstreamRes.headers["location"]);

      // make sure the redirected host matches the target host before rewriting
      if (target.host != u.host) {
        return;
      }

      if (options.hostRewrite) {
        u.host = options.hostRewrite;
      } else if (options.autoRewrite) {
        u.host = req.headers["host"] as string;
      }
      if (options.protocolRewrite) {
        u.protocol = options.protocolRewrite;
      }
      // @ts-ignore
      upstreamRes.headers["location"] = u.format();
    }
  },
  /**
   * Copy headers from upstreamResponse to response
   * set each header in response object.
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {upstreamResponse} Res Response object from the proxy request
   * @param {Object} Options options.cookieDomainRewrite: Config to rewrite cookie domain
   *
   * @api private
   */
  writeHeaders: function writeHeaders(
    req: IncomingMessage,
    res: ServerResponse,
    upstreamRes: IncomingMessage,
    options: any
  ) {
    let rewriteCookieDomainConfig = options.cookieDomainRewrite;
    let rewriteCookiePathConfig = options.cookiePathRewrite;
    const preserveHeaderKeyCase = options.preserveHeaderKeyCase;
    let rawHeaderKeyMap: any;
    function setHeader(key: string, header: string | string[] | undefined) {
      if (header == undefined) return;
      if (rewriteCookieDomainConfig && key.toLowerCase() === "set-cookie") {
        header = rewriteCookieProperty(
          header,
          rewriteCookieDomainConfig,
          "domain"
        );
      }
      if (rewriteCookiePathConfig && key.toLowerCase() === "set-cookie") {
        header = rewriteCookieProperty(header, rewriteCookiePathConfig, "path");
      }
      res.setHeader(String(key).trim(), header);
    }

    if (typeof rewriteCookieDomainConfig === "string") {
      //also test for ''
      rewriteCookieDomainConfig = { "*": rewriteCookieDomainConfig };
    }

    if (typeof rewriteCookiePathConfig === "string") {
      //also test for ''
      rewriteCookiePathConfig = { "*": rewriteCookiePathConfig };
    }

    // message.rawHeaders is added in: v0.11.6
    // https://nodejs.org/api/http.html#http_message_rawheaders
    if (preserveHeaderKeyCase && upstreamRes.rawHeaders != undefined) {
      rawHeaderKeyMap = {};
      for (var i = 0; i < upstreamRes.rawHeaders.length; i += 2) {
        var key = upstreamRes.rawHeaders[i];
        rawHeaderKeyMap[key.toLowerCase()] = key;
      }
    }

    Object.keys(upstreamRes.headers).forEach(function (key) {
      var header = upstreamRes.headers[key];
      if (preserveHeaderKeyCase && rawHeaderKeyMap) {
        key = rawHeaderKeyMap[key] || key;
      }
      setHeader(key, header);
    });
  },

  /**
   * Set the statusCode from the upstreamResponse
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {upstreamResponse} Res Response object from the proxy request
   *
   * @api private
   */
  writeStatusCode: function writeStatusCode(
    req: IncomingMessage,
    res: ServerResponse,
    upstreamRes: IncomingMessage
  ) {
    // From Node.js docs: response.writeHead(statusCode[, statusMessage][, headers])
    res.statusCode = upstreamRes.statusCode as number;
    if (upstreamRes.statusMessage) {
      res.statusMessage = upstreamRes.statusMessage;
    }
  },
};
