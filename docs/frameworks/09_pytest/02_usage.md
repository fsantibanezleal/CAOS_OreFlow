# pytest and ruff: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## The suite, by what it verifies

Every test file opens with the requirement it verifies (the `PE-nn` rows of
`docs/design/features/process-engine-v2/requirements.md`), and `scripts/check_sdd.py` requires each
requirement's gate to name a test that exists.

| File | Tests | What it verifies |
|---|---|---|
| `test_engine_core.py` | 2 | PE-01 streams on one grid; PE-03 stoichiometry from atomic weights |
| `test_engine_balances.py` | 72 | PE-02: every unit and the circuit close within 1e-9 on each of the 72 variants, from the named streams, not from the solver |
| `test_crusher.py` | 1 | PE-04: the Whiten form, mass conservation, the response to the closed-side setting |
| `test_grinding.py` | 26 | PE-05 to PE-07: target P80 and circulating load, steady-state delivery, the power-limited mode |
| `test_energy.py` | 2 | PE-09 the GMG worked example of the operating work index; PE-10 the comparison laws |
| `test_classification.py` | 13 | PE-11 the cyclone partition with bypass and density correction; PE-12 Plitt sizing |
| `test_flotation.py` | 26 | PE-13 to PE-17: banks, the rate from bubble surface flux, entrainment, recycle, stage recoveries |
| `test_separation.py` | 3 | PE-18 gravity in the grinding loop; PE-19 magnetite grade against grind; PE-20 the desliming trade-off |
| `test_directions.py` | 46 | PE-21 to PE-25: every direction the product claims (more collector trades grade for recovery; a harder ore coarsens the grind at installed power) |
| `test_kinetics.py` | 33 | PE-26: the five lumped fits, their errors and their bank projections |
| `test_optimization.py` | 7 | PE-27: the constrained optimizer |
| `test_uncertainty.py` | 4 | PE-28: the uncertainty and Sobol records |
| `test_learning.py`, `test_learning_findings.py` | 4, 5 | PE-29: the learned lane's protocols, and every number methodology page 14 quotes |
| `test_contract.py` | 16 | PE-30 one contract, identical verdicts; PE-30b every accepted state solves with closed balances |
| `test_live_api.py` | 16 | PE-30 through the API: probe verdicts, the live trace equals the engine's |
| `test_cases.py` | 49 | PE-32 single-factor variants; PE-34 units and sources; the nominal KPI plausibility gate |
| `test_oracles.py` | 4 | the published examples: Moly-Cop, GMG, Laplante, Zandrivierspoort |
| `test_geomet.py`, `test_particle_experiment.py` | 8, 2 | the measured lanes' committed records |
| `test_spa_routes.py` | 2 | the service's version and its document-route fallback |

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
