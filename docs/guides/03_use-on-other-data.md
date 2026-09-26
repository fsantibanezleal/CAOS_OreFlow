# 03 Use it on other data

Four ways to put your own numbers through OreFlow, from the lightest to the heaviest. None of them
calibrates the engine: the cases are authored plants inside published ranges, and a result for your plant
is the engine's answer for the ore and plant you describe, nothing more.

## 1. Move the controls of a case (no installation)

Open a case in the workbench, change any of its twelve inputs within the contract's bounds, and read the
views. A state is a link: the URL carries the case, the variant, the view and every changed input
(`?case=copper_porphyry_soft&variant=nominal&set=target_p80_um:120,collector_gpt:30`), so a state can be
sent to someone else and opens as you left it.

## 2. Call the live API (any language)

```bash
curl -s https://oreflow.ml.fasl-work.com/api/simulate \
  -H "content-type: application/json" \
  -d '{"case_id": "copper_porphyry_soft", "point": {"target_p80_um": 120, "collector_gpt": 30}}'
```

The answer is the full trace of that state (`oreflow.live/v2`), or `oreflow.rejection/v1` with a code for
every input the contract refuses. The inputs you leave out take the case's nominal values.
[Frameworks 08](../frameworks/08_fastapi/03_applying.md) shows a client in Python and what to rely on.

## 3. Run the engine yourself (Python, `.venv`)

The engine is plain Python with NumPy; nothing else is needed to run it. Validate the point through the
contract first, because the engine solves whatever it is given:

```python
import json, sys
sys.path.insert(0, "data-pipeline")
from dataclasses import replace
from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.circuit import simulate
from pipeline.engine.model import operating_from_dict
from pipeline.io.contract import validate

contract = json.loads(open("data/derived/contract/operating_contract.json", encoding="utf-8").read())
case = CASE_BY_ID["copper_porphyry_soft"]
verdict = validate(contract, case.id, {"target_p80_um": 120, "collector_gpt": 30})
if not verdict["accepted"]:
    raise SystemExit(verdict["errors"])
point = operating_from_dict(verdict["point"])
result = simulate(case.ore, case.plant, point)
print(result.metrics["recovery_pct"], [f["code"] for f in result.flags])     # 96.08 ['power_limited', 'cyclone_pressure']
```

To describe a different ore or plant, change the case's own definitions with `dataclasses.replace`;
every field has its unit in `pipeline/engine/model.py`:

```python
minerals = tuple(replace(m, liberation_size_um=140.0) if m.id == "chalcopyrite" else m for m in case.ore.minerals)
ore = replace(case.ore, minerals=minerals)
plant = replace(case.plant, mill=replace(case.plant.mill, installed_power_kw=case.plant.mill.installed_power_kw * 1.1))
result = simulate(ore, plant, point)                     # 96.82% recovery; every balance still closes
```

The contract validates operating points against a case's declared envelope; it does not know about an
ore or plant you changed, so check the flags and the balance of every result yourself
(`result.flags`, `result.metrics["balance_max_relative_error"]`, which the engine keeps below 1e-9).
The methods take a changed case too: `optimize`, `uncertainty` and `sensitivity` in
`pipeline/methods/` ([frameworks 02](../frameworks/02_scipy/03_applying.md) and
[03](../frameworks/03_salib/03_applying.md)).

For a measured size distribution rather than a Rosin-Rammler feed, put it on the engine's grid first
([frameworks 01](../frameworks/01_numpy/03_applying.md)).

## 4. Score your own assays with the GeoMet model

The GeoMet lane predicts a locked-cycle copper recovery from five assays, learned from 52 measured tests of
one deposit:

```powershell
./scripts/fetch-data.ps1                                        # once: the pinned source table
./scripts/predict-geomet.ps1 -InputCsv data/examples/geomet-assays.csv -OutputCsv E:\_Temp\geomet-predictions.csv
```

`data/examples/geomet-assays.csv` is a committed, illustrative one-row input; replace it with yours. The CSV
needs the columns `Cu ppm`, `Fe ppm`, `S ppm`, `Si ppm` and `Al ppm`; any other column (a sample id) is kept.
The output adds the three fitted models' predictions (`ridge_lct_pct`, `random_forest_lct_pct`,
`gaussian_process_lct_pct`; about 86% for the example), the number of missing assays, a flag when an assay
lies outside the range of the training tests, and the evidence boundary. On its own data the models
barely separate (under whole-hole folds only ridge beats the training mean with an interval that excludes zero (0.42 points of RMSE, 95% interval 0.02 to 0.82), and under spatial-zone folds no model does), so read a prediction as what those 52 tests suggest
([frameworks 04](../frameworks/04_scikit-learn/03_applying.md), [data contract 05](../data-contract/05_geomet-lane.md)).

## Reading the records instead

Every committed record is JSON and reads as a table: the twelve cases' nominal results from the manifests,
every out-of-fold GeoMet prediction, the learning record's folds, the uncertainty record's sampled values
([frameworks 07](../frameworks/07_pandas/03_applying.md)). The case pages under
[use cases](../use-cases.md) are rendered from the same records.
