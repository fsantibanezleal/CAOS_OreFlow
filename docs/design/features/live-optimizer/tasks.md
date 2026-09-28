# Live optimizer tasks

- [x] T1 (OP-02, OP-03, OP-04; OP-01 with T3). The pattern search with the progressive barrier in
  `data-pipeline/pipeline/methods/pattern_search.py` and its port `frontend/src/engine/pattern_search.ts`, tested
  on analytic problems (a bowl, a disc from an infeasible corner, an impossible constraint, a search step) with
  the same evaluation digests in both languages. The declared constants move to `engine/data/constants.json` with
  T3.
- [ ] T2 (OP-05). Export the Gaussian process (`process_gp.json`) from the learning stage, with the export test
  against scikit-learn. Run the screen through `onnxruntime` in the bake.
- [ ] T3 (OP-06, OP-07). Records, schema and `scripts/check_artifacts.py` checks: the screen table, the saving,
  the weight path.
- [ ] T4 (OP-08). TypeScript port in `frontend/src/engine/optimize.ts` and `frontend/src/learning/gp.ts`, and the
  parity test over all variants and weights.
- [ ] T5 (OP-09, OP-10). The contract's weights control; the worker's `optimize` request; the Methods view
  control, trace and screen table; the browser-gate check.
- [ ] T6 (OP-11). Methodology (optimizer page), Benchmark (optimization tab) and Implementation texts, from the
  records, with claim tests; references Torczon 1997, Audet and Dennis 2006 and 2009, Booker et al. 1999.
- [ ] Convergence: every OP requirement with its gate's result.
