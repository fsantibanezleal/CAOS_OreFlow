# 04 Add a case

A case is an authored ore, plant and operating point inside published ranges, with six variants that change
one input each. Adding one touches the catalog, the prose, a few pinned counts and the bake. The tests say
when each part is right.

## 1. Gather the values and their sources

Every parameter needs a value inside a range the literature records, and a source: the ore (minerals, their
liberation sizes, composite contents and floatabilities, the head grade of each payable, the Bond and
crushing work indices), the plant (installed mill power, cyclone size, bank volumes, the grade
specification) and the operating point. The existing cases cite their ranges through the keys of `SOURCES`
in `data-pipeline/pipeline/cases/catalog.py`; a new kind of evidence gets a new key there, stated the same
way.

A mineral the engine does not know yet goes into `data-pipeline/pipeline/engine/data/minerals.json` with its
English and Spanish names, its formula, its density and a source; its element contents follow from the
formula and the IUPAC atomic weights.

## 2. Declare the case (`pipeline/cases/catalog.py`)

A copper sulphide rougher case is one call of the `_copper(...)` builder (grade, work index, throughput, grind
target, mill power, bank volumes, cyclone diameter, liberation size, composite content, floatability, and the
KPI ranges and water capacity). Other circuits are written as a `CaseDef(...)` in `_cases()`, as the
existing gold, magnetite, nickel and phosphate cases are. Each family has its variant set:
`_flotation_variants`, `_gravity_variants`, `_magnetic_variants` or `_deslime_variants`, each the nominal
plus five single-factor changes.

Two values are derived, not chosen:

- **the water capacity** (`water_limit_m3_t`) is 5% above the water the nominal state needs: run the nominal
  state once, read `water_intensity_m3_t`, multiply by 1.05;
- **the contract bounds** come from the case's nominal values (`pipeline/io/contract.py` resolves the
  relative inputs as factors of the nominal), so the contract needs no edit.

## 3. Write its prose (`frontend/src/content/cases.ts`)

Add an entry to `CASE_CONTEXT` with the problem, the scope and assumptions, how to read the workbench for it,
and its reference keys, each paragraph in English and Spanish; add any new reference to
`frontend/src/content/citations.ts`. The Case view and the case's documentation page both read it.

## 4. Update the counts that are pinned on purpose

The catalog's size is stated in checks and prose, so a thirteenth case fails them until they are updated:

| Where | What |
|---|---|
| `scripts/check_artifacts.py` | `N_CASES, N_VARIANTS = 12, 72` |
| `tests/test_cases.py::test_catalog_shape` | twelve cases, twelve ids |
| `frontend/src/test/*-claims.test.ts` | the counts and the per-case findings the pages state |
| the content pages, the architecture modal (`content/architecture.ts`, `public/svg/tech/`) and `docs/` | "twelve", "12", "72" in the prose and the diagrams |

`grep -rn "twelve\|72 variants\|12 cases" frontend/src docs` finds the prose.

## 5. Bake, render, check

```powershell
.venv-gpu\Scripts\python.exe -m pytest tests\test_cases.py -q       # shape, single factor, sources, KPI ranges, water
./scripts/precompute.ps1                                             # guide 02
node --experimental-strip-types scripts/render_use_cases.mjs         # its page and the landing table
./scripts/smoke.ps1                                                  # everything else
```

What the tests hold the new case to:

- `test_variants_are_single_factor`: each variant changes exactly the one input it declares (PE-32);
- `test_parameters_carry_units_and_sources`: every mineral is in the table with a source, every source key
  exists, the titles exist in both languages, the provenance says "not plant-calibrated" (PE-34);
- `test_nominal_kpis_within_literature_ranges`: the nominal state lands inside the KPI ranges you declared;
- `test_water_capacity_is_five_percent_above_nominal`;
- `test_engine_balances.py`: every unit of every variant closes within 1e-9 (PE-02);
- `test_contract.py::test_engine_solves_the_envelope`: states across the case's whole envelope solve;
- `test_directions.py`: the physical directions hold for it;
- `frontend/src/test/parity.test.ts`: the browser port reproduces its six variants within 1e-6 (PE-31).

The workbench picks the case up from the index (its selector code, its focus route and the Pages route file
are generated), and the browser gate measures it like any other once it is baked.
