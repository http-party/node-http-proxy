# Bench scorecard — CANDIDATE

- Node: `v24.16.0`  trials: 4  noise floor: 5%  max CoV: 8%
- **A/A calibration:** delta 137.01% — ⚠️ noisy

| Scenario | Metric | Baseline | Candidate | Δ% | Verdict |
|---|---|---:|---:|---:|---|
| small-keepalive | latencyMs.p99_9 | 140.009 | 131.757 | -5.89 | no-change |
| large-streaming | proxy.rssPeakMB | 128.781 | 129.328 | 0.42 | no-change |
| mixed-prod | latencyMs.p99 | 56.149 | 71.514 | 27.36 | no-change |

_Δ% is normalised so negative = improvement. `no-change` = within noise floor._
