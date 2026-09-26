# pytest and ruff: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../09_pytest.md](../09_pytest.md).

## The pins

`requirements-dev.txt`:

```text
pytest==9.1.1
ruff==0.15.18
httpx==0.28.1
-r requirements-api.txt
```

`scripts/setup.ps1` installs it into both `.venv` and `.venv-gpu`. The learned-lane tests import PyTorch
and ONNX Runtime, so the full suite needs the environment that has them; both of this machine's
environments do, and `.venv-gpu` is the one the local gate uses first.

## Commands

```powershell
.venv-gpu\Scripts\python.exe -m pytest                        # the whole suite (tests/, quiet)
.venv-gpu\Scripts\python.exe -m pytest tests\test_contract.py  # one file
.venv-gpu\Scripts\python.exe -m pytest -k balances             # by name
.venv-gpu\Scripts\python.exe -m ruff check data-pipeline tests # the lint CI runs
./scripts/smoke.ps1                                            # the whole local release gate
```

`conftest.py` puts `data-pipeline/` on the import path, so the tests import `pipeline` without an
installation (the product declares no package of its own).

## Configuration (`pyproject.toml`)

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-q"
filterwarnings = ["ignore:Could not find the number of physical cores:UserWarning"]

[tool.ruff]
line-length = 130
target-version = "py311"

[tool.ruff.lint]
ignore = ["E501"]
```

The one filtered warning is joblib's fallback to the logical core count on Windows, which is correct;
every other warning stays visible. `testpaths` keeps pytest out of `docs/`, so the framework examples
run only when named.
