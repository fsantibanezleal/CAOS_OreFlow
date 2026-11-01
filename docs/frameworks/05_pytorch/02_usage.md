# PyTorch: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## One training function for the surrogate and the guard (`methods/learning.py`)

`_train_network(x, y, hidden, s, seed, activation)` trains a fully connected network by full-batch
AdamW and stops on validation loss:

- the rows are shuffled with the seed, and 15% (`learning.validation_fraction`) are held back for
  validation; the rest are fitted;
- the network is `Linear` layers of the given widths with an activation between them, built on the
  chosen device;
- every epoch is one full-batch step, then one evaluation of the validation MSE;
- the weights of the best validation epoch are kept, and training stops when 150 epochs
  (`learning.patience`) pass without improvement, or at 3000 epochs (`learning.max_epochs`);
- the best weights are restored before the network is returned, with a record of the device, the
  epochs run, the best epoch, the best validation MSE, whether it stopped early, the row counts, a
  thinned validation history and the parameter count.

```python
opt = torch.optim.AdamW(model.parameters(), lr=0.003, weight_decay=0.0001)
for epoch in range(1, epochs + 1):
    model.train(); opt.zero_grad(set_to_none=True)
    loss = torch.mean((model(xt[fit_t]) - yt[fit_t]) ** 2)
    loss.backward(); opt.step()
    model.eval()
    with torch.no_grad():
        v = float(torch.mean((model(xt[val_t]) - yt[val_t]) ** 2))
    if v < best:
        best, best_epoch = v, epoch
        best_state = {k: t.detach().clone() for k, t in model.state_dict().items()}
    elif epoch - best_epoch >= patience:
        break
model.load_state_dict(best_state)
```

Full batch is a deliberate choice: the design has at most 3072 rows and the networks have a few
thousand parameters, so one step over all rows is cheap and makes the loss curve deterministic for a
given seed and device.

**The surrogate** is two hidden layers of 64 with SiLU, 22 standardized features in and three standardized targets out (5827 parameters). Interpolation recovery RMSE is 3.38 percentage points on the same interpolation test rows used by all models. At seed 20260927, the conditional mean case-held-out recovery RMSE is 6.86 points over 11/12 scored folds; magnetite has null metrics and `rejected-transfer`, affecting all 256 rows. The conditional transfer mean is 14.60 points over 6/7 scored groups. These conditional means do not cover magnetite. The chalcopyrite group scores recovery R² 0.795, and gold-in-pyrite -10.200.

Conditional means do not rank models with different surviving folds. The matched recovery comparison uses 11/12 case folds and 6/7 transfer groups, excluding magnetite for every algorithm. Null means rejected/unavailable, never zero.

| Recovery seed | Magnetite status | Magnetite RMSE (pp) | LOCO A/S/R | Conditional mean RMSE (pp) | Matched 11-fold mean RMSE (pp) |
|---|---|---|---|---|---|
| 20260927 | rejected-transfer | null | 12/11/1 | 6.86 | 6.86 |
| 20260938 | rejected-transfer | null | 12/11/1 | 7.37 | 7.37 |
| 20260949 | rejected-transfer | null | 12/11/1 | 7.63 | 7.63 |
| 20260960 | rejected-transfer | null | 12/11/1 | 7.44 | 7.44 |
| 20260971 | scored | 217.18 | 12/12/0 | 25.05 | 7.58 |

Four of five neural seeds reject magnetite recovery. Seed 20260971 remains scored with RMSE 217.18 percentage points: its predictions span -172.05 to -88.68%, overlapping the widened envelope at its upper end despite being negative. This is retained poor finite evidence, not a successful physical prediction. The first four conditional means cover eleven folds; the fifth covers twelve. The matched seed column uses the same eleven non-magnetite folds for every seed.

The full-design range check includes held-out target labels and runs only after inference. Passing it does not establish physical validity at every row or independent transfer performance.

Log upgrade and total energy retain all twelve case folds and all seven transfer groups. Their RMSE units are a dimensionless log10 upgrade ratio and kWh/t, respectively. GP uncertainty intervals belong to Gaussian process means, not to the MLP output.

The final surrogate uses the 3072-state design (2611 fitting and 461 validation rows); it reached its 3000-epoch cap with best validation loss at epoch 2992, on CUDA. Its exported ONNX maximum absolute difference is 0.00000155 in standardized outputs, below the 1e-05 export tolerance. Export parity checks execution, not field transfer.

**The guard** is an autoencoder with 16, 6 and 16 tanh hidden units and 22 outputs (956 parameters). Its threshold is fitted from validation reconstruction errors.

The reconstruction guard's held-out false-alarm rate is 1.47% and its false-accept rate is 15.5% over 11,016 shifted probes (612 in-envelope test rows). At +0.5 input ranges it accepts 15.5%; at -0.5, 19.9%. Acceptance varies by feature: crusher CSS 95.4%, water 68.8% and circulating load 41.8%. A reconstruction score is a diagnostic, not an operating constraint or physical-safety certificate.

The interpolation guard ran to the 3000-epoch cap (best epoch 3000); its threshold is 0.392, whereas the separately fitted exported guard uses 0.372. The contract remains authoritative; the learned guard does not certify a safe state.

## The particle network (`stages/particle_experiment.py`)

A separate, shared network for the four constructed HZDR cases: four standardized particle features
in, 32 and 32 ReLU units, four logits out (one per case). It is trained with minibatches of 4096,
`BCEWithLogitsLoss` on the A/B labels of the training sheet, AdamW (learning rate 0.002), for at most
60 epochs with a patience of 8 on the validation loss (15% of the training sheet, 10 202 particles).
The committed run kept epoch 52. Its output is logits; probabilities are their sigmoid, computed in
Python for the benchmark and in the browser for the inference panel.

## Seeds and devices

`torch.manual_seed(seed)` seeds the initialisation (and `torch.cuda.manual_seed_all` in the particle
lane). A seeded run is reproducible on one device, but not bit for bit across devices or CUDA
versions: GPU kernels may sum in a different order. OreFlow therefore does not ask anyone to retrain
to the last bit; it commits the trained networks as ONNX files and checks everything downstream
against those files ([06 ONNX](../06_onnx.md)).

## Tests

`tests/test_learning.py::test_protocols_and_model_identity` runs the whole lane on a small sandbox
design in a temporary folder, never the committed `models/`, and checks among other things that early
stopping kept a best epoch within the patience of the last one and restored it, that the guard's
false-accept rate stays below one minus its false-alarm rate, and that both ONNX exports reproduce
PyTorch within 1e-5 and ship their scalers.
`tests/test_particle_experiment.py::test_exported_onnx_matches_local_pytorch_checkpoint` compares the
committed particle network with the local PyTorch checkpoint on 32 seeded vectors (1e-6) when the
checkpoint exists; without it (as in a fresh clone) it checks only that the committed file is there.
