# pytest and ruff: applying it

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.
The runnable companion is [`example.py`](example.py), a test file:

```powershell
.venv-gpu\Scripts\python.exe -m pytest docs\frameworks\09_pytest\example.py -q
```

## Turning a physical claim into a test

A sentence such as "a finer grind costs more grinding energy" is a test once three things are fixed:

1. **The states.** Which cases, which operating points, and what is held constant. For the grind claim,
   the mill's installed power must not bind, or the power limit decides the grind instead of the target:
   the suite's `run_point(..., unlimited_power=True)` removes it, and `example.py` does the same with
   `dataclasses.replace`.
2. **The inequality, with its round-off.** `finer > coarser` is right for a strict physical effect;
   `a <= b + 1e-9` is right where the claim is "does not decrease" and the two can be equal to the last
   bits.
3. **Every case it applies to.** `pytest.mark.parametrize` over the catalog, so a claim that holds for
   copper and fails for magnetite fails with the magnetite case's name. A claim that should not apply to
   a family says so in the test (`test_hardness_effects` skips the recovery assertion for the magnetite
   circuit, where a coarser grind does not lower recovery the same way).

## Properties over the envelope

A test on the nominal state checks one point. A property test draws many states the contract accepts and
requires the same invariant of all of them: every unit closes within 1e-9, no class mass is negative,
recovery lies strictly between 0 and 100%. `test_contract.py::test_engine_solves_the_envelope` does this
for each case, and `example.py` shows the pattern with seeded random states. Seed the draw, so a
failing state can be re-run, and print the state in the assertion message.

## Tests that write nothing they should not

- A test that runs a pipeline stage passes pytest's `tmp_path` as the output folder. A test that wrote
  `data/derived/` or `models/` would change the committed evidence while testing it.
- A test that needs a local file that is not committed (the HZDR checkpoint, the raw workbook) says what
  it checks without it; `test_exported_onnx_matches_local_pytorch_checkpoint` checks the committed file
  and returns when the checkpoint is absent, instead of failing a fresh clone.

## Pointing a requirement at its test

A new requirement row in `docs/design/features/<slug>/requirements.md` names its gate, for example
`` `tests/test_directions.py::test_collector_trades_grade_for_recovery` ``. `scripts/check_sdd.py` fails
if the file or the test function does not exist, so the pointer cannot rot silently.

## ruff before committing

```powershell
.venv-gpu\Scripts\python.exe -m ruff check data-pipeline tests docs\frameworks
```

ruff is fast enough to run on every save; CI runs it on `data-pipeline` and `tests`.
