# 04 scikit-learn

scikit-learn supplies every classical learner in OreFlow and the protocols around them. It is used in
three places that never mix: the learned lane, which scores surrogates of the process engine; the
particle lane, which fits a sparse logistic model to the HZDR particles; and the GeoMet lane, which
predicts measured locked-cycle recovery from assays. joblib, which scikit-learn uses to persist models,
stores the GeoMet checkpoint that `scripts/predict-geomet` scores new assays with.

## At a glance

| | |
|---|---|
| Packages | `scikit-learn`, `joblib` |
| Versions | 1.5.2, 1.4.2 |
| Licence | BSD-3-Clause (both) |
| Declared in | `requirements-precompute.txt` |
| Lane | Offline bake and the local GeoMet prediction script |
| Learned lane (`methods/learning.py`) | `Ridge`, `RandomForestRegressor`, `HistGradientBoostingRegressor`, `GaussianProcessRegressor` with an ARD kernel, `permutation_importance` |
| Particle lane (`stages/particle_experiment.py`) | `LogisticRegression` (L1, saga), `StandardScaler`, `train_test_split` |
| GeoMet lane (`run_geomet.py`) | `Pipeline`, `SimpleImputer`, `StandardScaler`, `Ridge`, `RandomForestRegressor`, `GaussianProcessRegressor`, `GroupKFold`, metrics, `clone`; `joblib.dump` and `joblib.load` |
| Settings | `learning.*` in the constants file; the GeoMet and particle settings in their modules |

## Read in order

1. [Installation](04_scikit-learn/01_installation.md): the pins and the threading note.
2. [Usage in OreFlow](04_scikit-learn/02_usage.md): the four surrogates and their two protocols, the
   Gaussian process's intervals and switched-off features, the particle and GeoMet models.
3. [Applying it](04_scikit-learn/03_applying.md): scoring a surrogate of your own simulator honestly,
   and running the GeoMet model on your own assays.
4. [`example.py`](04_scikit-learn/example.py): re-derives the committed summary from its folds, then
   runs the interpolation and leave-one-case-out protocols on a fresh small design and shows the gap.

Related: [05 PyTorch](05_pytorch.md) (the fifth surrogate and the guard),
[methodology 14](../methodologies/14_learned-lane.md), [data contract 04](../data-contract/04_particle-lane.md)
and [05](../data-contract/05_geomet-lane.md).
