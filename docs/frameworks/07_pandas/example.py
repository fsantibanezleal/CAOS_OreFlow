"""pandas in OreFlow: the committed records read as tables, the GeoMet scores recomputed with a groupby from
the out-of-fold predictions the artifact stores, and the raw GeoMet table re-validated when it has been
fetched (scripts/fetch-data); without it that part is skipped and says so.

Run from the repository root with the repository's environment:
    .venv-gpu\\Scripts\\python.exe docs\\frameworks\\07_pandas\\example.py
Every printed claim is also asserted.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
DERIVED = ROOT / "data" / "derived"

# 1. the twelve cases at their nominal states, from the index and the manifests
index = json.loads((DERIVED / "manifests" / "index.json").read_text(encoding="utf-8"))
rows = []
for entry in index["cases"]:
    manifest = json.loads((DERIVED / entry["manifest_path"]).read_text(encoding="utf-8"))
    kpis_within = sum(k["within"] for k in manifest["kpis"].values())
    rows.append({"case": entry["case_id"], "family": entry["family"], **manifest["nominal"],
                 "kpis_within": f"{kpis_within}/{len(manifest['kpis'])}"})
cases = pd.DataFrame(rows).set_index("case")
print(cases[["family", "recovery_pct", "concentrate_grade", "specific_energy_total_kwh_t", "kpis_within"]].round(2).to_string())
assert len(cases) == 12 and set(cases["family"]) == {"rougher", "gravity_rougher", "magnetic", "deslime_rougher"}

# 2. the GeoMet lane: one row per test, protocol and model, from the stored out-of-fold predictions
geomet = json.loads((DERIVED / "source" / "geomet_lct_benchmark.json").read_text(encoding="utf-8"))
long = []
for protocol, record in geomet["protocols"].items():
    for row in record["rows"]:
        for model, predicted in row["predictions_pct"].items():
            long.append({"protocol": protocol, "hole": row["hole_id"], "fold": row["fold"], "model": model,
                         "observed": row["observed_lct_pct"], "predicted": predicted})
frame = pd.DataFrame(long)
frame["error"] = frame["predicted"] - frame["observed"]
scores = frame.groupby(["protocol", "model"]).agg(mae_pp=("error", lambda e: float(np.mean(np.abs(e)))),
                                                  rmse_pp=("error", lambda e: float(np.sqrt(np.mean(e ** 2)))),
                                                  bias_pp=("error", "mean"))
print("\nGeoMet locked-cycle recovery, recomputed from the stored predictions (percentage points):")
print(scores.round(3).to_string())
for (protocol, model), row in scores.iterrows():
    stored = geomet["protocols"][protocol]["scores"][model]
    for key in ("mae_pp", "rmse_pp", "bias_pp"):
        assert abs(row[key] - stored[key]) <= 5e-4, (protocol, model, key)
holes_per_fold = frame[frame["protocol"] == "hole"].groupby("hole")["fold"].nunique()
assert int(holes_per_fold.max()) == 1            # a hole never appears in two folds
print(f"{frame['hole'].nunique()} holes, each in exactly one fold of the hole protocol; the stored scores are reproduced")

# 3. the raw table, when it has been fetched: the same validation the lane applies
raw = ROOT / "data" / "raw" / "geomet-flotation.csv"
if raw.is_file():
    source = pd.read_csv(raw)
    usable = source[source["LCT"].between(0, 1) & source[["HOLEID", "X", "Y", "Z"]].notna().all(axis=1)]
    excluded = [int(i) + 2 for i in source.index.difference(usable.index)]
    print(f"\nraw table: {len(source)} rows, {len(usable)} usable from {usable['HOLEID'].nunique()} holes, excluded source lines {excluded}")
    assert (len(source), len(usable), usable["HOLEID"].nunique()) == (geomet["source"]["raw_rows"], geomet["source"]["usable_rows"], geomet["source"]["holes"])
    assert excluded == [e["source_row"] for e in geomet["source"]["exclusions"]]
else:
    print("\nraw table not fetched (run scripts/fetch-data to re-validate it); skipped")
print("every check passed")
