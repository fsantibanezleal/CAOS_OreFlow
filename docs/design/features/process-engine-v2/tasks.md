# Process engine v2 tasks

Each unit is finished with code, tests and its `docs/methodologies/` page (plus a `docs/frameworks/`
card for any library it introduces) in the same commit before the next one starts.

- [x] T01 Units registry, size grid, atomic weights, minerals, streams and balance auditor (PE-01, PE-02, PE-03, PE-33). Engine commit 8c62512; the shipped-artifact balance recheck of PE-02 lands with T16.
- [x] T02 Whiten matrix crusher and crushing energy (PE-04).
- [x] T03 Energy-specific PBM, mixers in series, Rosin-Rammler cyclone with bypass and density correction, water balance, target and power-limited solves (PE-05, PE-06, PE-07, PE-11, PE-22, PE-25).
- [x] T04 Plitt cyclone sizing (PE-12) and the Moly-Cop oracle (PE-08).
- [x] T05 Bond, operating work index, calibrated Rittinger and Kick, GMG oracle (PE-09, PE-10).
- [x] T06 Flotation banks, Sb kinetics, Savassi entrainment, water, cleaner recycle, stage recoveries, bank profile (PE-13 to PE-17, PE-21, PE-23, PE-24).
- [x] T07 Gravity gold in the grinding loop and the Laplante oracle (PE-18).
- [x] T08 LIMS magnetite and the Zandrivierspoort oracle (PE-19).
- [x] T09 Desliming (PE-20).
- [x] T10 Case catalog re-authored with sources; single-factor variants (PE-32, PE-34). Engine commit 8c62512.
- [x] T11 Contract 1 export, API validation, live API tests (PE-30, PE-30b). The browser validator and
  `frontend/src/test/contract.test.ts`, which replays `contract_probes.json`, land with T17 and T18.
- [x] T12 Kinetic fits and bank projection (PE-26): five lumped models, including the gamma form of the dossier.
- [x] T13 Constrained optimization (PE-27): grade, power and process-water constraints; water capacities authored per case.
- [x] T14 Uncertainty and Sobol (PE-28): scrambled Latin hypercube, authored spreads, SALib Saltelli indices.
- [ ] T15 Learned lane with interpolation and leave-one-case-out protocols, ONNX (PE-29).
- [ ] T16 Pipeline stages, artifacts, manifests, benchmark, non-vacuous validation, check_artifacts (PE-02).
- [ ] T17 TypeScript engine port, Web Worker sweeps, parity test on all variants (PE-31, PE-38).
- [ ] T18 Workbench, circuit, response, methods, compare and focus views on the new trace; locale formatter and document language (PE-35, PE-36, PE-37).
- [ ] T19 Methodology, Introduction, Implementation, Experiments, Benchmark content, citations and architecture modal from the dossier.
- [ ] T20 `docs/` wiki tree, README, STRUCTURE, CHANGELOG, manuscript rewrite.
- [ ] T21 Canonical bake with the GPU lane; full test suite; guards; build; visual QA in both themes and languages at three viewports.
- [ ] T22 Release 0.05.000, backfilled tags, PRs, CI, Pages, VPS deploy, live verification, CAOS_MANAGE records.
- [ ] T23 Convergence verdict against every requirement.
