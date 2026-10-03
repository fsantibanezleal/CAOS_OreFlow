# 17 The HZDR particle lane

The particle lane asks a question about data, not about the engine: how well do four descriptors of a particle
(its shape, its size and how much of its surface is one mineral) predict which side of a separation it reports to?
It answers on a public particle-mineralogy dataset, scored against probabilities its authors constructed, and it
never feeds the engine (`data-pipeline/run_particles.py`, `pipeline/stages/particle_experiment.py`). The fields and
the exclusions are in [data contract 04](../data-contract/04_particle-lane.md).

## Source

The HZDR RODARE record 336 (doi:10.14278/rodare.336, CC BY 4.0), the supplementary workbook of a study of particle
separation from automated mineralogy. Its training sheet holds 68,008 particles, each with a class A or B in four
**constructed** separation cases: the authors assigned the classes from separation probabilities they built, so no
case is a measured separation. Its test sheet holds 29,147 particles with the constructed probability of class B in
each case and the authors' own model predictions, and no observed class.

## Protocol

- **Features.** Exactly four: `Aspect Ratio`, `Solidity`, `ECD` and `Mineral 1 surface`, standardized with a scaler
  fitted on the training rows that fit the models only. Every probability, prediction and class column, the other
  mineral fields and the duplicated descriptors are excluded.
- **Split.** The published sheets as they are: the training sheet for fitting, with 15% of it (10,202 rows, stratified
  by the first case's class, seed 42) held back to stop the network early; the test sheet for scoring.
- **Models.** Two families, fitted independently:
  - an L1-penalized logistic regression per case (scikit-learn, `saga`, $C = 1$);
  - one network for the four cases at once (PyTorch, 4 inputs, two hidden layers of 32 with ReLU, 4 outputs,
    binary cross-entropy on the logits, AdamW at a learning rate of 0.002 and a weight decay of 0.0001, batches of
    4,096), trained on CUDA when present for at most 60 epochs and stopped when the held-back loss has not improved
    by 1e-5 for 8 epochs; the weights of the best epoch are kept (epoch 52 in the record), exported to ONNX (opset
    17) and run in the browser on request.
- **Reference.** The authors' published predictions are scored with the same rules, as a reference; OreFlow does not
  refit them.
- **Scores.** The test sheet has probabilities, not classes, so each model's predicted probability is compared with
  the constructed one: root-mean-square error, mean absolute error and bias. A 20-bin calibration table and a
  101-point threshold curve (the share selected and the expected class-B capture at each threshold) are recorded per
  case and model.

$$\mathrm{RMSE}_c = \sqrt{\frac{1}{n_c}\sum_{i=1}^{n_c}\left(\hat p_{ic} - p_{ic}\right)^2},\qquad \min_{w,b}\ \sum_i \ell\left(y_{ic},\ \sigma(w^\top x_i + b)\right) + \lVert w\rVert_1$$

The first is the score of case $c$ over its $n_c$ test particles, $p_{ic}$ the constructed probability; the second
is the L1 logistic fit, $\ell$ the log loss and $\sigma$ the logistic function.

**Missing values.** Case 4 has missing constructed and reference probabilities: every model is scored on the same
28,484 finite test rows of that case (663 excluded), and the record states the count. The other cases use all
29,147 rows. A case with fewer than 1,000 comparable rows stops the run instead of being scored.

## What the record shows

Root-mean-square error against the constructed probability, per case (`data/derived/source/hzdr_particle_benchmark.json`):

| Case | Published reference | L1 logistic | Network |
|---|---|---|---|
| 1 | 0.0257 | 0.0131 | 0.0138 |
| 2 | 0.0175 | 0.0157 | 0.0181 |
| 3 | 0.0207 | 0.0171 | 0.0143 |
| 4 (28,484 rows) | 0.0371 | 0.1919 | 0.0226 |

The linear model is the better of OreFlow's two in cases 1 and 2 and fails only in case 4, where the network does
not. The linear model is closer to the constructed probabilities than the published reference in cases 1 to 3; the
network is closer in cases 1, 3 and 4 and slightly further in case 2 (0.0181 against 0.0175). The lane scores how
closely a model reproduces a constructed rule, which is a statement about the features and the models, not about
any plant.

## Verification

- `tests/test_particle_experiment.py`: the population, the features and the scope of the record; the exported ONNX
  network against the local PyTorch checkpoint.
- `scripts/check_artifacts.py`: the pin, the population and the record's fields, without refitting.
- `tests/test_docs_claims.py` holds the numbers of this page to the record.

## What it is not

The test classes are not observed, so nothing here is a classification accuracy, a metallurgical recovery or a plant
benchmark. The four cases are the dataset authors' constructions, and the lane says how a model reproduces them.
