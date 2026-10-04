# pytest and ruff: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## The suite, by what it verifies

Every test file opens with the requirement it verifies (the `PE-nn` rows of
`docs/design/features/process-engine-v2/requirements.md`), and `scripts/check_sdd.py` requires each
requirement's gate to name a test that exists. The counts are those of 0.08.001 (541 in all); each release's are in
`docs/release-verification.md`.

| File | Tests in 0.08.001 | What it verifies |
|---|---|---|
| `test_engine_core.py` | 3 | PE-01 streams on one grid; PE-03 stoichiometry from atomic weights; E-02 the head grade is the total assay |
| `test_engine_balances.py` | 120 | PE-02: every unit and the circuit close within 1e-9 on each of the 96 variants, from the named streams, not from the solver; CM-05 again on the 24 cut-mode variants |
| `test_crusher.py` | 1 | PE-04: the Whiten form, mass conservation, the response to the closed-side setting |
| `test_grinding.py` | 82 | PE-05 to PE-07: target P80 and circulating load, steady-state delivery, the power-limited mode; CM-02 to CM-04 and CM-09: the cut mode at installed power, its flags, the two modes' agreement and the states it refuses |
| `test_energy.py` | 3 | PE-09 the GMG worked example of the operating work index; PE-10 the comparison laws; E-18 the oversize-feed factor left out |
| `test_classification.py` | 13 | PE-11 the cyclone partition with bypass and density correction; PE-12 Plitt sizing |
| `test_flotation.py` | 26 | PE-13 to PE-17: banks, the rate from bubble surface flux, entrainment, recycle, stage recoveries |
| `test_separation.py` | 3 | PE-18 gravity in the grinding loop; PE-19 magnetite grade against grind; PE-20 the desliming trade-off |
| `test_gravity_grg.py` | 7 | E-11: the gravity-recoverable gold on the published model's structure: its own sizes, Banisi's breakage rate, the fitted classification exponent, the unit on the mill discharge, the case inside its sourced range |
| `test_directions.py` | 50 | PE-21 to PE-25: every direction the product claims (more collector trades grade for recovery; a harder ore coarsens the grind at installed power; the head grade's direction per case) |
| `test_kinetics.py` | 33 | PE-26: the five lumped fits, their errors and their bank projections |
| `test_optimization.py` | 15 | PE-27, OP-01 to OP-06: the pattern search with its barrier, the objective, the screen inside its envelope, the optimum as an engine result, the record |
| `test_uncertainty.py` | 7 | PE-28: the uncertainty and Sobol records; UQ-01 to UQ-03: SplitMix64, its uniforms and the Latin hypercube, with the digests the browser holds |
| `test_learning.py` | 6 | PE-29: the learned lane's protocols, the records the pages quote, and a reused learning record that cannot ship |
| `test_learning_findings.py` | 5 | every number methodology page 14 quotes |
| `test_contract.py` | 19 | PE-30 one contract, identical verdicts; PE-30b every accepted state solves with closed balances; OP-10, UQ-07 and CM-01: the weight, the uncertainty controls and the classifier cut declared |
| `test_live_api.py` | 17 | PE-30 through the API: probe verdicts, the live trace equals the engine's |
| `test_cases.py` | 51 | PE-32 single-factor variants; PE-34 units and sources; the nominal KPI plausibility gate |
| `test_case_rules.py` | 3 | the authoring rules every case keeps (#58): each plausibility range has a source note, the nominal state sits inside its ranges and meets its own grade, and the water capacity is 5% above the nominal need |
| `test_case_premises.py` | 2 | E-03, E-04: the phosphate and clay cases' stated premises are what the engine computes |
| `test_oracles.py` | 6 | the published examples: Moly-Cop (every published input, net against net, and the Plitt sizing as a stated failure), GMG, Laplante like for like, Zandrivierspoort |
| `test_geomet.py` | 8 | GM-01 to GM-07: the GeoMet lane's pinned source, folds, models, assay contract and the uncertainty of its ranking |
| `test_particle_experiment.py` | 2 | the HZDR particle lane's record and the exported network against its checkpoint |
| `test_iron_plant.py` | 7 | IS-01 to IS-04, IS-06: the soft-sensor lane on its committed artifact and on small synthetic frames, the held laboratory labels and the fitted last assay; never refits the lane or reads the 184 MB CSV |
| `test_real_samples.py` | 8 | RS-01 to RS-05: the pinned GeoMet tables, the Bond work index, the sulphur-limited allocation, the engine runs of the samples in the soft porphyry's circuit and the comparison's dependences |
| `test_ablations.py` | 14 | AB-01 to AB-03: every mechanism switch is on by default and changes nothing when on, every ablated state closes its balances, and a case without the mechanism is not applicable |
| `test_spa_routes.py` | 5 | the service's version; its document-route fallback with and without a `404.html` (0.08.000 answered 404 without one); the runtime module served as JavaScript whatever the host's type table; a build with no Pages `404.html` |
| `test_manuscript_claims.py` | 9 | every result number and count the manuscript quotes, against the committed records |
| `test_docs_claims.py` | 9 | every number methodology pages 04, 06, 09, 12, 13 and 15 to 18, guide 03 and data contracts 03 to 06 quote |
| `test_docs_counts.py` | 7 | the SDD coverage matrix, guide 03's snippets, methodology pages 02, 03 and 11, the bake times, retired phrases, every relative link, and the changelog's entries |

## Cached engine runs (`tests/engine_helpers.py`)

The engine is deterministic, so a variant is simulated once per test session and shared:

```python
@lru_cache(maxsize=None)
def run_variant(case_id: str, variant_id: str) -> CircuitResult:
    ...
    return simulate(case.ore, case.plant, variant_point(case, variant))
```

`run_point` runs an arbitrary point, optionally with unlimited mill power, which is how a test separates
the physics of grinding from the power limit. `all_variants()` and `flotation_cases()` feed
`pytest.mark.parametrize`, so a test written once runs on every variant or every flotation circuit, and a
failure names the case.

## The kinds of test the suite relies on

- **Conservation, recomputed.** `test_engine_balances.py` sums the named streams around every unit
  itself; a solver that reported its own residual would pass a test that trusted it.
- **Directions over the catalog.** `test_directions.py` states each physical claim as an inequality and
  runs it on every case it applies to, with explicit tolerances for round-off (`<= r + 1e-9`).
- **The whole envelope.** `test_contract.py::test_engine_solves_the_envelope` samples states across each
  case's contract envelope, requires every accepted one to solve with closed balances and no
  non-finite output, and every rejected one to fail only on the declared cross-field rule.
- **Records quoted by the docs.** `test_learning_findings.py` parses the tables of methodology page 14
  and compares each value with the learning record, so the prose cannot drift from the numbers.
- **Published examples as oracles**, labelled as examples and never as plant data.
- **Sandboxes.** A test that runs a pipeline stage writes into pytest's `tmp_path`, never into
  `data/derived/` or `models/`.

## ruff

`ruff check data-pipeline tests` is the only Python check CI runs with the dev requirements installed;
the configuration in `pyproject.toml` sets a 130-character line (long numeric tables read better on one
line) and targets Python 3.11 syntax. The framework examples are linted with the same command
locally (`ruff check docs/frameworks`).
