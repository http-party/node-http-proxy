'use strict';

//
// The scenario matrix. Each scenario scores a *different* objective (Snell:
// the suite is a matrix, not a number). `primary` names the metric the
// scorecard compares; `betterWhen` says which direction is an improvement.
//

module.exports = [
  {
    name: 'small-keepalive',
    description: 'Flood of tiny keep-alive GETs. Scored on tail latency.',
    origin: { bodySize: 64 },
    load: { path: '/', method: 'GET', connections: 50, durationMs: 2500 },
    primary: 'latencyMs.p99_9',
    betterWhen: 'lower'
  },
  {
    name: 'large-streaming',
    description: 'Large body + slow consumer. Scored on bounded proxy memory under backpressure.',
    origin: { bodySize: 5 * 1024 * 1024 },
    load: { path: '/', method: 'GET', connections: 8, durationMs: 3000, slowReadBytesPerTick: 16 * 1024 },
    primary: 'proxy.rssPeakMB',
    betterWhen: 'lower'
  },
  {
    name: 'mixed-prod',
    description: 'Blended small-body load at high concurrency. Scored on p99 latency.',
    origin: { bodySize: 1024 },
    load: { path: '/', method: 'GET', connections: 100, durationMs: 2500 },
    primary: 'latencyMs.p99',
    betterWhen: 'lower'
  }
];
