# Benchmarking `node-http-proxy`

The long-term goal of these scripts and documentation is to provide a consistent and well understood benchmarking process for `node-http-proxy` so that performance does not degrade over time. They were initially created to compare the performance of `v0.10.3` and `v1.0.0` (which was a significant rewrite).

## Pre-requisites

All benchmarking shall be done with [wrk](https://github.com/wg/wrk) which _is the same tool used for performance testing by the node.js core team._ **Make sure you have `wrk` installed before continuing**.

```
$ wrk
Usage: wrk <options> <url>                            
  Options:                                            
    -c, --connections <N>  Connections to keep open   
    -d, --duration    <T>  Duration of test           
    -t, --threads     <N>  Number of threads to use   
                                                      
    -s, --script      <S>  Load Lua script file       
    -H, --header      <H>  Add header to request      
        --latency          Print latency statistics   
        --timeout     <T>  Socket/request timeout     
    -v, --version          Print version details      
                                                      
  Numeric arguments may include a SI unit (1k, 1M, 1G)
  Time arguments may include a time unit (2s, 2m, 2h)
```

## Benchmarks

1. [Simple HTTP benchmark](#simple-http)

### Simple HTTP

_This benchmark requires three terminals running:_

1. **A proxy server:** `node benchmark/scripts/proxy.js`
2. **A target server:** `node benchmark/scripts/hello.js`
3. **A wrk process:** `wrk -c 20 -d5m -t 2 http://127.0.0.1:8000`
