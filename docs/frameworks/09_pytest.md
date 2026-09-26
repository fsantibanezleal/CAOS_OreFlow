# 09 pytest and ruff

pytest runs OreFlow's Python suite: 341 tests over the engine, the contract, the methods, the learned
and measured lanes and the service, each named after the requirement it verifies. ruff lints the Python
code. httpx is there for FastAPI's `TestClient`. By the CI budget rule (ADR-0074) the suite runs on the
workstation before a pull request, through `scripts/smoke`, and CI runs only ruff and the
standard-library guards.

## At a glance

| | |
|---|---|
| Packages | `pytest`, `ruff`, `httpx` |
| Versions | 9.1.1, 0.15.18, 0.28.1 |
| Licences | MIT, MIT, BSD-3-Clause |
| Declared in | `requirements-dev.txt` (which includes the API lane) |
| Configuration | `pyproject.toml`: `testpaths = ["tests"]`, `addopts = "-q"`, one filtered warning; ruff with `line-length = 130`, `target-version = "py311"`, `E501` ignored |
| Where it runs | locally (`scripts/smoke.ps1`, or `python -m pytest`); CI runs `ruff check data-pipeline tests` only |
| Time | 76 s for the whole suite on the development machine (measured 2026-09-26) |

## Read in order

1. [Installation](09_pytest/01_installation.md): the pins, the environments and the commands.
2. [Usage in OreFlow](09_pytest/02_usage.md): the map of the suite by requirement, the shared cached
   engine runs, and the kinds of test it relies on.
3. [Applying it](09_pytest/03_applying.md): writing a test that verifies a physical claim, and keeping a
   test from writing committed artifacts.
4. [`example.py`](09_pytest/example.py): a runnable test file (`python -m pytest docs/frameworks/09_pytest/example.py`)
   with a conservation property over contract states, a direction test and a contract-rejection test.

Related: [architecture 05](../architecture/05_release-and-deployment.md) (the local gate and CI),
[`docs/design/SDD.md`](../design/SDD.md) and the requirement tables whose gates name these tests.
