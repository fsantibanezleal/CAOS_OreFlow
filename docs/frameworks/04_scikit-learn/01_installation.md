# scikit-learn: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../04_scikit-learn.md](../04_scikit-learn.md).

## The pins

```text
scikit-learn==1.5.2
joblib==1.4.2
```

Both are in `requirements-precompute.txt`. scikit-learn also needs NumPy, SciPy and threadpoolctl,
which resolve in the same environment.

## Installing

```powershell
./scripts/setup.ps1
```

On their own:

```bash
python -m pip install "scikit-learn==1.5.2" "joblib==1.4.2"
```

Check:

```powershell
.venv\Scripts\python.exe -c "import sklearn, joblib; print(sklearn.__version__, joblib.__version__)"
```

## Notes that matter here

- **The model identities are recorded.** The learning record stores each estimator's full class path
  (for example `sklearn.ensemble._forest.RandomForestRegressor`), so a reader knows exactly which
  implementation produced a score. A scikit-learn upgrade can change forests and boosting at the
  last digits; it is followed by a bake.
- **Physical cores on Windows.** joblib probes the physical core count with a Windows tool that is
  absent on some machines and falls back to the logical count, with a warning. The fallback is
  correct, so `pyproject.toml` (for the tests) and `pipeline.py` (for the bake) silence exactly that
  message and nothing else.
- **Threads inside worker processes.** The random forest is fitted with `n_jobs=-1`. The learning stage
  runs in the main bake process after the parallel case stage has finished, so it does not compete
  with the case workers.
- **The GeoMet checkpoint is a joblib pickle.** It loads only with compatible scikit-learn and joblib
  versions, and a pickle runs code when it is loaded: load checkpoints you produced, never ones from
  an untrusted source. The checkpoint is local and ignored by git; `run_geomet.py --fit-checkpoint`
  rebuilds it from the pinned source data.
