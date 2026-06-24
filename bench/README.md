# `bench/` — AI-code performance evals for node-http-proxy

A dependency-free (core-modules-only) benchmark + evals suite for grading
changes to `lib/` — in particular AI-generated optimizations. Designed by an
emulated panel of HTTP-performance luminaries (HAProxy / Varnish / undici /
llhttp / HTTP-2 / perf-methodology). The design notes below cite the principle
each piece encodes.

## The two-stage funnel

> The gates are the product, not the benchmark. A faster-but-wrong or
> faster-but-leaking proxy is the default failure mode of AI-generated systems
> code, so correctness and resource-safety **gate** performance — never average
> against it.

1. **Gates** (`evals/`, deterministic, cheap) — must pass first:
   - **wire oracle** — candidate vs frozen baseline, byte-identical responses or fail.
   - **lifecycle corpus** — client abort / origin RST / slowloris / half-open upgrade; proxy must survive + not leak.
   - **leak gate** — handles + RSS return to baseline after HTTP + WebSocket-churn bursts.
2. **Measurement** (`bench/`, lab tier, only if gates pass) — scenario matrix, A/B/A/B, CoV-gated.

## Layout

| File | Role |
|---|---|
| `freeze-baseline.js` | Materialise the immutable baseline snapshot from a git ref (default `9b96cd7`, the last published `1.18.1`). |
| `micro.js` | **Deterministic** network-free microbench of `setupOutgoing` — ns/op + bytes/op (run with `--expose-gc`). This is the CI-tier signal for allocation-level opts. |
| `origin-proc.js` | Null origin (pre-allocated buffer, raw WS upgrade) — its own process. |
| `proxy-proc.js` | Proxy-under-test — its own process; reports RSS peak, GC count, active handles. |
| `lib/loadgen.js` | Keep-alive load generator with full latency percentiles + slow-consumer mode. |
| `lib/harness.js` | Fork/ready/stats/teardown orchestration (3-process topology). |
| `lib/scenarios.js` | The scored matrix (each scenario, its own objective). |
| `run.js` | Network runner: A/A calibration → scenario matrix → scorecard. |
| `results/<label>/` | `scenarios.json` + `scorecard.md`. `BASELINE/` is committed. |

## Scenario matrix

| Scenario | Stresses | Scored on |
|---|---|---|
| `small-keepalive` | tiny keep-alive GET flood | **p99.9 tail latency** |
| `large-streaming` | large body + slow consumer | **bounded proxy RSS under backpressure** |
| `mixed-prod` | high-concurrency blended load | **p99 latency** |
| websocket-churn | upgrade/teardown churn | **leak-free teardown** (in `evals/leak.js`) |

## Honesty controls

- **A/A self-calibration first.** `run.js` runs baseline-vs-baseline before any
  A/B. If the null delta exceeds the noise floor (`BENCH_NOISE_FLOOR`, default
  5%) or CoV exceeds `BENCH_MAX_COV` (default 8%), the run declares itself
  *untrustworthy* and sub-threshold deltas are not certifiable. _The box is the
  experiment._
- **A/B/A/B interleaving** across `BENCH_TRIALS` (default 4) restarts cancels
  thermal/neighbour drift. Never compare against a number from a warmer box.
- **Median + CoV** per variant; significance requires CoV under threshold AND
  |Δ| over the noise floor.
- **Held-out corpus** (`evals/corpus.js`) is fixed/versioned so a candidate
  can't special-case the benchmark shape (Goodhart).

> Pinning (`taskset`/cpuset, disabled turbo/C-states) is unavailable on macOS;
> the CoV gate is the portable substitute — it refuses to certify when the box
> is too noisy rather than pretending otherwise.

## Run it

```bash
node bench/freeze-baseline.js          # materialise the baseline snapshot
node --expose-gc bench/micro.js        # deterministic alloc/ns microbench
node evals/run.js                      # all gates (must pass)
node bench/run.js BASELINE             # scenario matrix -> results/BASELINE
```
