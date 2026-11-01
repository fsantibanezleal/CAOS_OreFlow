# pandas and openpyxl: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../07_pandas.md](../07_pandas.md).

## The pins

```text
pandas==2.2.3
openpyxl==3.1.5
```

Both are in `requirements-precompute.txt`. pandas reads `.xlsx` files through an engine it does not
bundle; openpyxl is that engine, and without it `pd.read_excel` fails on the HZDR workbook with an
import error.

## Installing

```powershell
./scripts/setup.ps1
```

On their own:

```bash
python -m pip install "pandas==2.2.3" "openpyxl==3.1.5"
```

## The raw data

The sources are cached outside the checkout under `<CAOS_DATA_ROOT>/oreflow/raw/`, never committed.
Export `CAOS_DATA_ROOT` to the device's external data root before fetching, or pass the root explicitly:

```powershell
./scripts/fetch-data.ps1
./scripts/fetch-data.ps1 -DataRoot $env:CAOS_DATA_ROOT -Dataset geomet
```

| File | Source | Verified by |
|---|---|---|
| `<CAOS_DATA_ROOT>/oreflow/raw/SM1.Constructed_cases_data.xlsx` | HZDR RODARE record 336 (doi:10.14278/rodare.336), CC BY 4.0 | SHA-256 |
| `<CAOS_DATA_ROOT>/oreflow/raw/geomet-flotation.csv`, `geomet-comminution.csv`, `geomet-drillholes.csv` | Zenodo record 7051975 (doi:10.5281/zenodo.7051975), CC BY 4.0 | MD5, as Zenodo publishes it |
| `<CAOS_DATA_ROOT>/oreflow/raw/iron-flotation-kaggle-v1.zip` | Kaggle dataset 6294 version 1, CC0 | SHA-256 |

`run_geomet.py` also downloads a missing default-cache flotation table during an explicit offline run,
and refuses it if its MD5 differs from the pinned value. Only flotation enters that measured lane;
the process bake's real-samples stage also uses comminution, checking both tables by MD5 and SHA-256.
Drillholes is fetched but not joined to either lane. `.env` is not automatically loaded, and missing
required roots explain the needed variable or argument. Local checkpoint workflows also need
`CAOS_MODELS_ROOT` (or an explicit external destination).

Existing ignored `data/raw/` files stay in place and can be supplied read-only with the runners' or
example's `--source` argument. The example also accepts `--data-root` and never fetches data itself.
