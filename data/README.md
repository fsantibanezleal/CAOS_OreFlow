# OreFlow data

`data/raw/` is ignored and contains downloaded source files only for local preprocessing. `data/derived/` contains compact, reviewable JSON artifacts shipped with the public app.

Contract 1 requires these operating-point fields and units:

| Field | Unit | Policy |
| --- | --- | --- |
| `feed_tph` | t/h | 1 to 50,000, review above 5,000 |
| `feed_grade_pct` | percent | 0.001 to 80 |
| `feed_p80_um` | micrometres | 100 to 500,000 |
| `hardness_kwh_t` | kWh/t | 0.1 to 80 |
| `density_t_m3` | t/m3 | 1.2 to 6 |
| `grind_p80_um`, `classifier_cut_um` | micrometres | positive, grind below feed |
| `flotation_time_min` | min | 0.1 to 120 |
| `air_rate_m3_min` | m3/min | 0.01 to 20 |
| `reagent_gpt` | g/t | 0 to 10,000, review above 1,500 |
| `water_m3_t` | m3/t | 0.01 to 20, review above 8 |

Rows with missing, non-numeric, non-finite or inconsistent values are rejected. Plausible low-grade or high-intensity rows are accepted with flags. The source summary at `data/derived/source/hzdr_summary.json` identifies the HZDR RODARE workbook, DOI `10.14278/rodare.336`, CC BY 4.0 license, sheet counts, quantiles and a non-plant-data boundary.

Contract 2 is the case artifact and manifest pair. The index in `data/derived/manifests/index.json` points to each case artifact. `scripts/check_artifacts.py` validates case count, variant count, method count, path existence, byte counts and matrix size.
