# Licence inventory

The repository's [MIT licence](LICENSE) applies to OreFlow's original software and authored simulator content.
The following files and adaptations carry separate terms. Credits and transformations are recorded in
[ATTRIBUTION.md](ATTRIBUTION.md); source URLs, versions and hashes are retained with the data records.

| Files or models | Source and terms | Distribution scope |
|---|---|---|
| `data/derived/source/hzdr_summary.json`, `data/derived/source/hzdr_particle_benchmark.json` | Pereira et al., [RODARE 336](https://doi.org/10.14278/rodare.336), CC BY 4.0 | Derived summaries and evaluation from the source workbook. Preserve attribution, source link, licence and the fact that OreFlow adapted it. |
| `models/particle_mlp.onnx` | Trained from RODARE 336, CC BY 4.0 | The trained particle-label weights retain the dataset's distribution terms. The inference implementation is original MIT code. |
| `data/derived/source/geomet_lct_benchmark.json`, `data/derived/real_samples.json` | Hoffimann et al., [GeoMet v4](https://doi.org/10.5281/zenodo.7051975), CC BY 4.0 | Contains adapted measured records and derived comparisons. Preserve the distinction between measured recoveries and authored simulator outputs. |
| The local `geomet_lct.joblib` checkpoint produced by `data-pipeline/run_geomet.py` | Trained from GeoMet v4, CC BY 4.0 | Uncommitted local model. These terms apply if it is redistributed separately. |
| `data/derived/source/iron_plant_soft_sensor.json` | Oliveira, [Kaggle 6294 v1](https://www.kaggle.com/datasets/edumagalhaes/quality-prediction-in-a-mining-process), CC0 1.0 | Hourly measurements and forecast evaluation derived from the public-domain source. Provenance is retained. |
| Measured-data figures embedded in `notebooks/` and manuscript figures based on these sources | The corresponding dataset terms above | Notebook prose and code are MIT; embedded dataset adaptations retain their source terms. |
| `manuscripts/technical-report/` and `manuscripts/surrogate-screening/` article text and PDFs | Felipe Santibáñez-Leal, CC BY 4.0 | Report and article text; cited third-party material retains its own rights. |
| `models/process_surrogate.onnx`, `models/process_guard.onnx`, `models/process_screen.json`, `models/process_gp_cholesky.bin`, `models/process_surrogate.json` | OreFlow's authored simulator training data, MIT | These models learn authored process scenarios; they are separate from the HZDR and GeoMet models. The exact committed model paths are declared in the contract catalog. |

Raw source files are downloaded separately to the configured external data root and are not part of the
repository distribution. Their original terms remain in force. Exporting a model or compact summary does
not change its dataset's licence. Third-party software dependencies retain the licences recorded in their
package distributions and the [framework guide](docs/frameworks.md).

Full texts: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.en),
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en).
