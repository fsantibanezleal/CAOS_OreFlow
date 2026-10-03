# OreFlow scripts

Every script has a PowerShell and a bash form with the same behaviour. Each can be started from any directory
and first changes to the repository root, so a relative path argument (`predict-geomet -InputCsv`) is read from
the root, not from the caller's directory; pass absolute paths otherwise. Each uses the repository's own
environments, never a global interpreter.

| Script | What it does |
|---|---|
| `setup` | Creates the ignored `.venv` (the offline lane, `requirements-precompute.txt` with the dev tools) and `.venv-gpu` (the accelerator lane, `requirements-gpu.txt`, the CUDA 12.6 torch build), then probes CUDA; `-NoGpu` (`--no-gpu`) skips `.venv-gpu`, and the bash form skips it on macOS, which has no CUDA wheel |
| `fetch-data` | Downloads into `data/raw/` the HZDR particle workbook (RODARE record 336, SHA-256 verified) and the three GeoMet tables (Zenodo record 7051975, MD5 verified); the iron-plant archive (Kaggle 6294) is downloaded by `run_iron_plant.py` itself, SHA-256 verified |
| `precompute` | The three measured lanes (`run_particles.py`, `run_geomet.py --fit-checkpoint`, `run_iron_plant.py`), then the canonical bake (`data-pipeline/run.py`, arguments passed through), whose validation stage checks every record, the lanes' included; writes `data/derived/` and `models/` |
| `smoke` | The local release gate: every CI guard, ruff, the Python suite, every framework example, the frontend typecheck, tests and build; `-Bake` (`--bake`) adds a sandbox bake into `build/smoke` that never writes the committed artifacts |
| `predict-geomet` | Scores a CSV of assays with the GeoMet checkpoint (`-InputCsv`, `-OutputCsv`; `run_geomet.py --predict`) |
| `gpu_probe` | Reports the platform, the torch build, CUDA availability and version, and the device |
| `dev` | Starts the Vite dev server on 127.0.0.1:5914 |
| `render_use_cases.mjs` | Renders `docs/use-cases.md` and the twelve case pages from the committed records and `frontend/src/content/cases.ts`; `--check` fails when a page is stale (CI and `smoke` run it). Run with `node --experimental-strip-types` |

The guards are standard-library Python, so CI runs them before any install:

| Guard | What it rejects |
|---|---|
| `check_template_residue.py` | Leftovers of the product template's example (its SIR chart, cases and placeholders, its stage list and bake command) |
| `check_content_standards.py` | An em dash or an emoji in tracked content (ADR-0067), a banned arrow in the interface source, and a local disk path (a drive letter or a temp folder) in tracked text (ADR-0057 item 13) |
| `check_ci_budget.py` | A workflow that triggers off the trunks, trains, bakes, installs the training stack or runs the Python suite (ADR-0074) |
| `check_units.py` | An engine literal without a declared unit and source (PE-33) |
| `check_ui_formulas.py` | Engine arithmetic or solver imports in interface files, and sweeps started without a request (PE-36, PE-38) |
| `check_arch_i18n.py` | An architecture diagram text without its language pair, or a colour that is not a shell token with a system fallback (ADR-0058) |
| `check_sdd.py` | A missing design document, or a live requirement whose gate names a file or test that does not exist (ADR-0075) |
| `check_artifacts.py` | Any committed artifact that does not validate: the contract digest, every unit balance recomputed from the stored streams, byte counts and hashes, the method records, the learning record, the studies, the real samples and the three measured lanes |
