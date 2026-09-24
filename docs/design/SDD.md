# OreFlow software design document

## Problem and boundary

OreFlow lets a learner or researcher inspect how declared one-pass mineral-processing equations transform feed into size distributions, separation streams, recovery, grade, energy and water use. Its operating-envelope tool compares feasible settings within one authored case. It is **not** a calibrated plant simulator, an economic optimizer, or a substitute for metallurgical testwork. The HZDR particle experiment is independent of circuit recovery.

## Contracts and lanes

Contract 1 is the typed process input and rejection policy in `docs/data-contract.md`. Contract 2 is the checksummed case/variant trace and benchmark manifest. Offline Python generates canonical replay artifacts, trains simulator surrogates, evaluates disjoint perturbation rows and exports compact models. The browser runs a separately tested deterministic calculation for direct manipulation. Replay values and browser recalculations are explicitly distinguished. No web interaction rewrites canonical artifacts.

## Method and case acceptance

`docs/methods.md` owns the method ladder and the exact implemented limitations. The case matrix in `docs/cases.md` has four topology families, not twelve independent plant circuits. Every method displayed by a family must either execute with the applicable engine, show a precomputed value with its stale status, or be marked not applicable. A new operating-envelope result is accepted only when its inputs, candidate set, constraints, baseline, stress definition and selected point can be reproduced from the exported record.

## Oracles and deployment

Python/browser parity, stream closure, monotone cumulative size distributions, deterministic candidate ordering, constraint classification and non-dominated-set tests are the numerical oracles. These establish consistency with the declared simulator, not truth about a plant. The website ships committed artifacts to the existing ML VPS because API serving and artifact payloads already reside there. Build/deployment do not train or bake.

## Risks and kill criteria

Invalid grades, non-conserving streams, a method labelled live when stale, a case with the wrong topology, a decision view with no feasible/no-result explanation, or a chart that cannot report a point's units are release blockers. No plant-optimality or uncertainty-calibration claim is permitted without independent data and a new validation protocol.

## Operating-envelope sequence and provenance

The user selects a case, reviews a baseline, adjusts explicitly named limits, inspects the sampled feasible set and non-dominated points, then either applies one point to shared controls or exports the complete audit record. Applying a point makes the old replay artifact stale and recalculates with the browser engine. The case determines the second search axis: collector dose for rougher-bearing circuits, feed rate for magnetic separation. Grid resolution is deliberately finite (up to 49 settings), with a deterministic tie break. The stress result is the minimum recovery under declared parameter perturbations; it is a sensitivity screen, not a statistical interval. A zero-feasible result is an explanation, not a synthetic fallback.

The recorded point contains the complete process parameters and derived recovery, grade, energy, water, collector and recovered-valuable-mass metrics. The export captures all sampled points as well as the baseline, bounds and constraints. This permits another implementation to audit selection without relying on a screenshot. Source of truth for this lane is `frontend/src/live/operatingEnvelope.ts` and its numerical/interaction tests. The old angular decision surface remains a secondary geometric projection and explicitly does not rotate the underlying process state.

## Measured-data benchmark sequence and provenance

`data-pipeline/run_geomet.py` checks the pinned GeoMet v4 flotation CSV before any fit. The target is measured locked-cycle copper recovery in percent, not the HZDR constructed particle probability and not the circuit simulator's rougher recovery. One missing target is excluded with source-row provenance. The other 52 source rows are evaluated with complete-hole and complete-spatial-zone exclusion. Per-fold preprocessing is fitted on training rows only. A global mean baseline and three fixed model definitions produce one out-of-fold estimate for each eligible source row; the committed compact artifact carries those estimates and split metadata. The local batch-inference checkpoint is trained separately on all 52 rows after evaluation, is ignored by Git, and is tied to the exact source hash. Its predictions do not constitute held-out evidence.

The Benchmark route makes both observed/predicted error and sample location inspectable; the methodology and data contract retain the input units, exclusion and transfer limits. The gate in `scripts/check_artifacts.py` checks population, fixed source SHA, score finiteness and matrix completeness without refitting. The raw CSV and local checkpoint do not enter the public build. Scientific release would require new licensed campaigns with matching operating controls, external mine-family holdout and uncertainty calibration; this release does not claim that gate.
