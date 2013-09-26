# Benchmarking `node-http-proxy`

The long-term goal of these scripts and documentation is to provide a consistent and well understood benchmarking process for `node-http-proxy` so that performance does not degrade over time. They were initially created to compare the performance of `v0.10.3` and `v1.0.0` (which was a significant rewrite).

## Pre-requisites

All benchmarking shall be done with [wrk](https://github.com/wg/wrk) which _is the same tool used for performance testing by the node.js core team._ **Make sure you have `wrk` installed before continuing**.

```
$ wrk
Usage: wrk <options> <url>                            
  Options:                                            
    -c, --connections <n>  Connections to keep open   
    -r, --requests    <n>  Total requests to make     
    -t, --threads     <n>  Number of threads to use   
                                                      
    -H, --header      <h>  Add header to request      
    -v, --version          Print version details      
                                                      
  Numeric arguments may include a SI unit (2k, 2M, 2G)
```

## Benchmarks

1. [Simple HTTP benchmark](#simple-http)

### Simple HTTP

_This benchmark requires three terminals running:_

1. **A proxy server:** `node benchmark/scripts/proxy.js`
2. **A target server:** `node benchmark/scripts/hello.js`
3. **A wrk process:** `wrk -c 20 -r 10000 -t 2 http://127.0.0.1:8000`