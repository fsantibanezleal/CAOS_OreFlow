# pandas and openpyxl: applying it to OreFlow's records and to your own assays

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.
The runnable companion is [`example.py`](example.py).

## OreFlow's records as tables

Every committed record is JSON, and most of them are lists of rows that pandas takes directly. The
case index and the manifests give a one-line-per-case summary:

```python
import json
import pandas as pd

index = json.loads(open("data/derived/manifests/index.json", encoding="utf-8").read())
rows = []
for entry in index["cases"]:
    manifest = json.loads(open(f"data/derived/{entry['manifest_path']}", encoding="utf-8").read())
    rows.append({"case": entry["case_id"], "family": entry["family"], **manifest["nominal"]})
cases = pd.DataFrame(rows).set_index("case")
print(cases.sort_values("specific_energy_total_kwh_t"))
```

The GeoMet artifact stores every out-of-fold prediction, so a table of observations against
predictions is one `json_normalize` away, and any score can be recomputed with a `groupby`
(`example.py` does both). The learning record's folds, the uncertainty record's sampled values and
the benchmark's per-case KPIs read the same way.

## Your own assays for the GeoMet model

The prediction script expects a CSV with exactly these column names, in ppm:

| Column | Unit | Rule |
|---|---|---|
| `Cu ppm`, `Fe ppm`, `S ppm`, `Si ppm`, `Al ppm` | ppm (mg/kg) | numeric, 0 to 1 000 000; an empty cell is a missing assay |
| any other column | | kept in the output as it is (a sample identifier, for example) |

Prepare it with pandas from whatever your laboratory exports, converting units explicitly:

```python
assays = pd.read_excel("lab_export.xlsx")                      # needs openpyxl for .xlsx
prepared = pd.DataFrame({
    "sample_id": assays["Sample"],
    "Cu ppm": assays["Cu %"] * 10_000,                          # 1% = 10 000 ppm
    "Fe ppm": assays["Fe %"] * 10_000,
    "S ppm": assays["S %"] * 10_000,
    # oxide to element with the engine's IUPAC atomic weights (engine/data/atomic_weights.json):
    # Si 28.085, Al 26.982, O 15.999
    "Si ppm": assays["SiO2 %"] * 10_000 * 28.085 / (28.085 + 2 * 15.999),
    "Al ppm": assays["Al2O3 %"] * 10_000 * 2 * 26.982 / (2 * 26.982 + 3 * 15.999),
})
prepared.to_csv("my_assays.csv", index=False)
```

A laboratory that reports silica and alumina as oxides needs the element conversion above, or the
model reads the wrong quantity with no error. Then run `scripts/predict-geomet` as
[04 scikit-learn](../04_scikit-learn/03_applying.md) describes.

## Traps

- **`errors="coerce"` hides bad cells.** It turns "<0.01" or "n/a" into NaN without saying so. OreFlow
  uses it only after checking that no present value failed to parse (`validate_assays` compares the
  non-null cells before and after); do the same, or detection-limit strings become missing data
  silently.
- **Excel types.** A column of numbers with one text cell arrives as `object`; check `dtypes` before
  converting.
- **Row numbers.** A DataFrame index is not a line of the file. Keep the source line (`index + 2` for a
  CSV with a header) when you exclude rows, so every exclusion can be traced, as the GeoMet artifact
  does.
- **Do not join the other GeoMet tables by position.** The comminution and drill-hole tables are not
  row-aligned with the flotation table; any join needs a key and a reason, which the lane deliberately
  does not make.
