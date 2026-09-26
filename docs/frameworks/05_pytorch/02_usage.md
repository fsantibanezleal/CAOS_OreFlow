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

**The surrogate** is two hidden layers of 64 with SiLU, 22 standardized features in and three
standardized targets out (5827 parameters). It is scored under the same two protocols as the
scikit-learn models ([04](../04_scikit-learn.md)): it interpolates best of all five (recovery RMSE 3.07
points) and transfers worst (42.1 points on average over the held-out cases). The average hides where
it fails: held out, each of the five copper sulphide cases, which have neighbours in the training set,
costs it 2.1 to 4.7 points, while the magnetite circuit costs 259 (recoveries predicted far outside 0
to 100%), free-milling gold 92 and phosphate 78. The final surrogate is trained on all
3072 states; the committed run stopped at epoch 1954 with its best validation loss at epoch 1804, on
CUDA.

**The guard** is an autoencoder: hidden layers of 16, 6 and 16 with tanh, trained to reproduce its
own standardized input (956 parameters). Its reconstruction error is small for states like the
training design and grows for states unlike it. The threshold is the 99th percentile
(`learning.guard_quantile`) of the reconstruction errors on the validation rows, which only selected
the best epoch and were never fitted. On the interpolation protocol it flags 1.3% of the held-out
in-envelope states (false alarms) and accepts 17.0% of 11 016 probes pushed half a training range
past the maximum of one continuous feature at a time (false accepts). The accepts concentrate in
three features: shifted water (97%), crusher setting (97%) and circulating load (91%) pass almost
always, because a single input that moves without its correlates is exactly what an autoencoder of
correlated features cannot see. The record keeps the rate per feature, and the Benchmark page prints
it.

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
