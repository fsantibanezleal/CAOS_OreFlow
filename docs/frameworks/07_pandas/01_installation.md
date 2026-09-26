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

The sources are downloaded, never committed (`data/raw/` is ignored by git):

```powershell
./scripts/fetch-data.ps1
```

| File | Source | Verified by |
|---|---|---|
| `data/raw/SM1.Constructed_cases_data.xlsx` | HZDR RODARE record 336 (doi:10.14278/rodare.336), CC BY 4.0 | SHA-256 |
| `data/raw/geomet-flotation.csv`, `geomet-comminution.csv`, `geomet-drillholes.csv` | Zenodo record 7051975 (doi:10.5281/zenodo.7051975), CC BY 4.0 | MD5, as Zenodo publishes it |

`run_geomet.py` also downloads the flotation table itself when it is missing, and refuses it if its MD5
differs from the pinned value. Only the flotation table enters the GeoMet lane; the other two are
downloaded for research and are not joined to it.
