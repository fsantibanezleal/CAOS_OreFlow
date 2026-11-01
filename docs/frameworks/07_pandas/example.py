"""pandas in OreFlow: the committed records read as tables, the GeoMet scores recomputed with a groupby from
the out-of-fold predictions the artifact stores, and the raw GeoMet table re-validated when it has been
fetched into the configured external cache (scripts/fetch-data). Without a configured
root or cached table that part is skipped and says so; the example never downloads.

Run from the repository root with the repository's environment:
    .venv-gpu\\Scripts\\python.exe docs\\frameworks\\07_pandas\\example.py
Every printed claim is also asserted.
Optional arguments: --data-root ROOT or --source EXISTING.csv (read-only).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
DERIVED = ROOT / "data" / "derived"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source", type=Path, help="existing read-only GeoMet flotation CSV")
parser.add_argument("--data-root", type=Path, help="external data root (or CAOS_DATA_ROOT)")
args = parser.parse_args()

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
sys.path.insert(0, str(ROOT / "data-pipeline"))
from pipeline.io.storage import source_path  # noqa: E402

raw = None
if args.source is not None or args.data_root is not None or os.environ.get("CAOS_DATA_ROOT", "").strip():
    raw = source_path("geomet-flotation.csv", args.source, data_root=args.data_root)
if raw is not None and raw.is_file():
    data = raw.read_bytes()
    if hashlib.md5(data).hexdigest() != geomet["source"]["md5"] or hashlib.sha256(data).hexdigest() != geomet["source"]["sha256"]:
        raise ValueError("GeoMet source checksum drift")
    source = pd.read_csv(raw)
    usable = source[source["LCT"].between(0, 1) & source[["HOLEID", "X", "Y", "Z"]].notna().all(axis=1)]
    excluded = [int(i) + 2 for i in source.index.difference(usable.index)]
    print(f"\nraw table: {len(source)} rows, {len(usable)} usable from {usable['HOLEID'].nunique()} holes, excluded source lines {excluded}")
    assert (len(source), len(usable), usable["HOLEID"].nunique()) == (geomet["source"]["raw_rows"], geomet["source"]["usable_rows"], geomet["source"]["holes"])
    assert excluded == [e["source_row"] for e in geomet["source"]["exclusions"]]
else:
    print("\nraw validation skipped: set CAOS_DATA_ROOT or pass --data-root and fetch the pinned table, "
          "or pass --source EXISTING.csv for a read-only input")
print("every check passed")
