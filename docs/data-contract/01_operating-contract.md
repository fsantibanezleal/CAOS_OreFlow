# 01 Operating contract (Contract 1)

Contract 1 is the operating envelope: the set of states for which OreFlow runs its process engine
and stands behind the result. It is declared once, in `data-pipeline/pipeline/io/contract.py`, and
exported to `data/derived/contract/operating_contract.json`. The live API validates every request
against that exported file, and the browser ports the same validator over the same file, so both
accept and reject exactly the same states (requirement PE-30). Every state the contract accepts is
solved by the engine with closed balances (PE-30b).

What it is not: it is not a statement that a real plant can operate at every accepted state. It
bounds the region where this engine, with each case's authored plant (mill power, cell volumes,
cyclone cluster), is numerically sound and physically consistent. A state inside the envelope can
still carry engine flags, for example `power_limited` or a cyclone pressure outside the practical
window; those are results, not rejections.

## The state

A state is a case (which fixes the ore, the plant and the circuit family) plus the operating point
of `pipeline.engine.model.OperatingPoint`. The four circuit families are `rougher` (grinding, then
rougher, cleaner and optional recleaner flotation), `gravity_rougher` (a gravity bleed inside the
grinding loop, then flotation), `magnetic` (grinding, then low-intensity magnetic separation) and
`deslime_rougher` (grinding, a desliming cyclone, then flotation).

| Input | Unit | Bounds | Slider step | Applies to | What it does |
|---|---|---|---|---|---|
| `throughput_tph` | t/h | 0.5 to 1.5 of nominal | 1% of nominal | all | Dry ore to the grinding circuit. More tonnes shorten flotation residence and, at installed mill power, coarsen the grind. |
| `target_p80_um` | um | 0.5 to 2.0 of nominal | 1% of nominal | all | Size passed by 80% of the cyclone overflow. The solver finds the mill energy that meets it. |
| `circulating_load` | fraction (shown in %) | 1.0 to 4.0 | 0.05 | all | Underflow returned to the mill per tonne of new feed; the cyclone cut is solved to hold it. |
| `water_m3_t` | m3/t | 1.0 to 4.0 | 0.05 | all | Water leaving with the cyclone overflow per tonne of ore (50% to 20% solids). |
| `crusher_css_mm` | mm | 4 to 16 | 0.5 | all | Closed-side setting of the crusher ahead of the mill. |
| `work_index_kwh_t` | kWh/t | 0.7 to 1.5 of nominal | 1% of nominal | all | Bond ball-mill work index of the ore. |
| `head_grade` | unit of the primary payable (% or g/t) | 0.5 to 1.5 of nominal | 1% of nominal | all | Grade of the primary payable; the host gangue closes the mass balance. |
| `collector_gpt` | g/t | 0 to 3 of nominal | 1% of nominal | flotation families | Collector dose; the valuable mineral saturates at a lower dose than gangue. |
| `jg_cm_s` | cm/s | 0.5 to 2.5 | 0.05 | flotation families | Superficial gas velocity in the rougher. |
| `rougher_cells` | whole number | 3 to 12 | 1 | flotation families | Rougher cells in series. |
| `gravity_bleed` | fraction (shown in %) | 0.10 to 0.60 | 0.01 | `gravity_rougher` | Fraction of the cyclone underflow sent to the gravity concentrator. |
| `deslime_cut_um` | um | 8 to 45 | 0.5 | `deslime_rougher` | Cut size of the desliming cyclone. |

Why two kinds of bound. Throughput, grade, hardness and reagent dose are properties of a scenario:
the envelope around them is the region the case plant is sized for, so they are bounded by factors
of the case nominal. Circulating load, water, crusher setting, gas velocity, cell count, bleed and
desliming cut have plant-independent physical ranges, so they have absolute bounds. Sources for the
absolute ranges, from the research dossier of 2026-09-26:

- Gas velocity 0.5 to 2.5 cm/s is the range of the gas-dispersion literature (Gorain et al. 1997,
  doi:10.1016/S0892-6875(97)00014-9; Nesset et al. 2006, Minerals Engineering 19:807-815), recorded
  there as a plant range and not as a single published figure.
- Banks of three to nine mechanical cells are well described as perfect mixers in series (MDPI
  review, Minerals 2(4):258); the bound of 12 extends the same model by three cells.
- The gravity bleed range is the range of the Laplante simulator example (10 to 60% of the underflow,
  AMIRA P420B), which is also the product's gravity oracle.
- Circulating load brackets the Moly-Cop BallSim base case (277%) and the Laplante example (250%);
  the water, crusher-setting and desliming ranges are authored around the case nominals (desliming
  near 20 um is common phosphate practice, dossier section 6).

Worked example, soft copper porphyry (nominal in brackets): throughput 360 to 1080 t/h (720), target
P80 75 to 300 um (150), work index 7.7 to 16.5 kWh/t (11.0), head grade 0.37 to 1.11% Cu (0.74),
collector 0 to 75 g/t (25). The resolved numbers for every case are in the exported JSON under
`cases.<id>.inputs`; the page does not repeat them, so it cannot go stale.

## Cross-field rules

| Rule | Families | Condition | Why |
|---|---|---|---|
| `deslime_cut_above_half_target` | `deslime_rougher` | `deslime_cut_um <= 0.5 target_p80_um` | A desliming cut close to the product size discards the product itself. |

A rule is data: `left relation factor * right`, evaluated after every single input has passed, so
both validators compute the same product of the same stored numbers.

## Validation

`validate(contract, case_id, values)` takes a possibly partial set of inputs.

1. An unknown case is rejected (`unknown_case`).
2. Every input starts at the case nominal; a missing input keeps it. This is how the API accepts a
   partial request, and how the browser starts: the state it edits is the nominal.
3. Each supplied input is checked in order: a name the contract does not declare is `unknown_input`;
   an input the case's family does not use must be absent or exactly 0, otherwise `not_applicable`;
   a value that is not a JSON number (a string, a boolean, null) is `not_a_number`; NaN or an
   infinity is `not_finite`; a fractional value for a whole-number input is `not_integer`; a value
   outside the resolved bounds is `out_of_range`, reported with both limits.
4. Only if every input passed, the cross-field rules run.
5. The result is `{accepted, point, errors}`. An accepted state returns the full operating point;
   a rejected state returns every error found, never a partially applied point.

Nothing is coerced. The string `"720"` is not a throughput and `true` is not a cell count, in either
language. The slider step is an interface hint: the validator does not require values on the step
grid, because the engine is continuous in every input but the cell count.

Messages. Each code has an English and a Spanish message in the contract (`messages`, and `message`
on each rule). The API returns the English message with each error; the browser shows the message in
the interface language and formats the numbers with the active locale. The codes, inputs and limits
are identical in both.

## The envelope guarantee (PE-30b)

A contract that accepts states the engine cannot solve would move failures from the validator to
the solver. `tests/test_contract.py::test_engine_solves_the_envelope` therefore solves, for every
case: both corners (every input at its minimum, every input at its maximum), every input at each of
its bounds with the others at nominal, and eight seeded uniform states that pass the rules. Each
state must solve without an exception, serialize as strict JSON, raise neither `negative_mass` nor
`non_finite_output`, close every unit balance within 1e-9 and keep the particle-class split
consistent within 1e-9.

This gate found two engine defects when it was introduced, both now fixed and covered by their own
tests: the flotation recycle stopped on an absolute residual that left a trace mineral (gold at
1e-4 t/h) 1.8e-9 out of balance, and the grinding circuit locked more host gangue into composites
than a valuable-rich size class carried (a 55% magnetite feed). See the methodology pages 05 and 03.

## The exported document

`operating_contract.json` (schema `oreflow.contract/v1`):

| Key | Content |
|---|---|
| `fields` | the operating-point field names, in engine order |
| `families` | the four circuit families |
| `inputs` | each declaration: unit, bound kind, factors or limits, step, integer flag, families, bilingual label and help, display scale and unit |
| `rules` | the cross-field rules |
| `messages` | bilingual message per error code |
| `cases` | per case: family, primary payable and unit, full nominal point, resolved `min`, `max`, `step`, `unit` of every applicable input |
| `grid` | the 63 size-class upper bounds and representative sizes (um) shared by both engines |
| `laguerre` | the 64-node Gauss-Laguerre nodes and weights used by the kinetic bank projection, so both engines integrate with the same table |
| `digest` | SHA-256 of the document without the digest; every API response carries it |

`contract_probes.json` holds deterministic probe states with their verdicts: for every case the
nominal, every input at each bound and just outside it, NaN, infinity, a string, a boolean, an
unknown name, every inapplicable input set and unset, and the rule at and beyond its limit. Strict
JSON has no NaN, so non-finite probe values are written as `{"non_finite": "nan"}` and decoded by each
harness. `tests/test_contract.py::test_export_matches_validator` checks that both files equal a fresh
export and that every probe verdict holds; `tests/test_live_api.py::test_api_and_contract_agree`
replays every probe through the HTTP API; the browser test replays the same file.

## Regenerating

```powershell
.venv\Scripts\python.exe -c "import sys; sys.path.insert(0, 'data-pipeline'); from pipeline.io.contract import export_contract; export_contract()"
```

The export is deterministic. Changing a declaration, a rule or a case nominal changes the digest,
and the export test fails until the files are regenerated and committed.
