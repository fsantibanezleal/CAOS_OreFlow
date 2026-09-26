# Industrial iron-flotation soft-sensor requirements

| ID | Requirement | Gate |
| --- | --- | --- |
| IS-01 | The pipeline SHALL pin the publisher's CC0 version-1 archive by SHA256, read the named CSV and record all source rows/hours. | Source hash and population tests. |
| IS-02 | The pipeline SHALL reject hours whose nominally hourly laboratory silica label varies within that hour; 20-second sensor rows SHALL NOT be treated as independent lab observations. | Interpolation and hourly aggregation tests. |
| IS-03 | The response SHALL be next-hour silica-concentrate grade. Training predictors SHALL exclude both concentrate lab columns, the future target and date-derived labels. | Feature-list and temporal-pair tests. |
| IS-04 | Evaluation SHALL use chronological, disjoint future windows with an explicit 24-hour train/test embargo; preprocessing SHALL fit within each training window. | Fold-boundary and model-matrix tests. |
| IS-05 | The product SHALL show observed/predicted traces, fold-level error, baseline comparison, exclusions and the non-causal, one-plant interpretation. | Artifact contract and rendered EN/ES/browser QA. |
| IS-06 | Industrial quality prediction SHALL remain separate from copper LCT recovery and authored circuit optimization; no online set-point recommendation is allowed from this lane. | Copy and route audit. |
