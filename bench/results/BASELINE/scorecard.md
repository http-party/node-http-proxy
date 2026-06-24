# Bench scorecard — BASELINE

- Node: `v24.16.0`  trials: 4  noise floor: 5%  max CoV: 8%
- **A/A calibration:** delta -13.84% — ⚠️ noisy

| Scenario | Metric | Baseline | Candidate | Δ% | Verdict |
|---|---|---:|---:|---:|---|
| small-keepalive | latencyMs.p99_9 | 116.260 | 180.496 | 55.25 | no-change |
| large-streaming | proxy.rssPeakMB | 133.516 | 126.656 | -5.14 | IMPROVED |
| mixed-prod | latencyMs.p99 | 85.026 | 63.703 | -25.08 | no-change |

_Δ% is normalised so negative = improvement. `no-change` = within noise floor._
