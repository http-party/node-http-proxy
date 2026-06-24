# `evals/` — correctness & resource-safety gates

The gates that **must pass before any performance number is trusted**. A
faster-but-wrong or faster-but-leaking proxy is the default failure mode of
AI-generated systems code, so these gate the benchmark rather than averaging
against it. All gates are **differential**: they compare the CANDIDATE working
tree against the frozen BASELINE snapshot (`bench/.baseline-snapshot`, produced
by `node bench/freeze-baseline.js`).

| Gate | File | Asserts |
|---|---|---|
| **Wire oracle** | `oracle.js` | Client-visible responses are byte-identical to baseline across a held-out request corpus, modulo an explicit `whitelist.js`. Any undeclared change to status/headers/body/framing fails. |
| **Lifecycle** | `lifecycle.js` | Under client-abort / origin-RST / slowloris / half-open-upgrade, the proxy survives and leaks **no more handles than baseline**. |
| **Leak** | `leak.js` | After an HTTP burst + WebSocket-churn burst, active handles and RSS grow **no more than baseline** (websocket-churn scored on leak-free teardown). |

```bash
node bench/freeze-baseline.js   # once, to materialise the baseline snapshot
node evals/run.js               # all three gates; non-zero exit if any fails
node evals/oracle.js            # or run a single gate
```

## Design notes

- **Differential, not absolute.** Thresholds drift across machines; "identical
  to / no worse than the frozen baseline" is portable. The baseline's *own*
  defects (e.g. the 1.18.1 WebSocket socket leak — ~600 handles after 300 churn
  cycles) become the reference an optimization is expected to **improve**.
- **Held-out corpus.** `corpus.js` is fixed and versioned so a candidate can't
  special-case the benchmark's request shape (Goodhart).
- **No golden bytes.** The oracle diffs candidate vs baseline live rather than
  asserting hand-written expected bytes, which rot (Indutny).
- **Stable `Host`.** The client sends a fixed Host so reflected request headers
  don't carry the proxy's random listen port.

## Known baseline finding

The gates document a real defect in `1.18.1`: WebSocket upgrades leak the
upstream socket when the client disconnects (half-open upgrade: +40 handles for
20 attempts; churn: +600 handles, ~70 MB RSS for 300 cycles). The teardown
optimization is expected to flip these from `ok` (no-worse) to `IMPROVED`.
