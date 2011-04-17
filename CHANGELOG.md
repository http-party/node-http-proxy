## ChangeLog for: node-http-proxy

## Version 0.5.0 - 4/15/2011
- Remove winston in favor of custom events                 (indexzero)
- Add x-forwarded-for Header                               (indexzero)
- Fix WebSocket support                                    (indexzero)
- Add tests / examples for WebSocket support               (indexzero)
- Update .proxyRequest() and .proxyWebSocketRequest() APIs (indexzero)
- Add HTTPS support                                        (indexzero)
- Add tests / examples for HTTPS support                   (indexzero)

## Version 0.4.1 - 3/20/2011
- Include missing dependency in package.json                                  (indexzero)

## Version 0.4.0 - 3/20/2011
- Update for node.js 0.4.0                                                    (indexzero)
- Remove pool dependency in favor of http.Agent                               (indexzero)
- Store buffered data using `.buffer()` instead of on the HttpProxy instance  (indexzero)
- Change the ProxyTable to be a lookup table instead of actively proxying     (indexzero)
- Allow for pure host-only matching in ProxyTable                             (indexzero)
- Use winston for logging                                                     (indexzero)
- Improve tests with async setup and more coverage                            (indexzero)
- Improve code documentation                                                  (indexzero)

### Version 0.3.1 - 11/22/2010
- Added node-http-proxy binary script                      (indexzero)
- Added experimental WebSocket support                     (indutny)
- Added forward proxy functionality                        (indexzero)
- Added proxy table for multiple target lookup             (indexzero)
- Simplified tests using helpers.js                        (indexzero)
- Fixed uncaughtException bug with invalid proxy target    (indutny)
- Added configurable logging for HttpProxy and ProxyTable  (indexzero) 