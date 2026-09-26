# PyTorch: applying it to a surrogate of your own simulator

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.
The runnable companion is [`example.py`](example.py).

## Train with the lane's function

`learning._train_network` is small and general: any `(rows, features)` input and `(rows, targets)`
output, standardized beforehand, with the lane's settings or your own.

```python
import numpy as np
from pipeline.methods import learning

s = learning.settings(max_epochs=1500, patience=100)          # the declared settings, two overridden
fx, fy = learning.Standardizer(x_train), learning.Standardizer(y_train)
model, info, validation_rows = learning._train_network(fx(x_train), fy(y_train), [64, 64], s, seed=7, activation="silu")
prediction = fy.inverse(learning._predict_network(model, fx(x_test)))
print(info["device"], info["epochs_run"], info["best_epoch"], info["stopped_early"])
```

Always return predictions to the target's units with the same scaler before scoring them; an RMSE of
standardized targets means nothing to a metallurgist.

## What the lane's choices protect against

- **Validation-based stopping with the best weights restored.** Training longer than the validation
  loss improves memorizes the design. The patience window lets a noisy loss recover before stopping,
  and restoring the best epoch means the returned network is the one the record describes.
- **Weight decay** (AdamW's `weight_decay`) keeps weights small, which matters most when the network
  is asked about a region it has not seen, the leave-one-case-out situation.
- **Standardizing on the training rows only.** The same rule as for scikit-learn: the held-out rows'
  statistics must not shape the model.
- **A guard next to the surrogate.** An autoencoder's reconstruction error says whether an input looks
  like the training data. It is cheap, and it is honest only with its false-accept rate by feature
  beside it: OreFlow's guard misses shifts of water, crusher setting and circulating load almost
  always, and the record says so.

## What a GPU changes

For networks of a few thousand parameters and a few thousand rows, the GPU shortens the wall time of
the thirteen trainings of each network (the interpolation split, the twelve held-out cases) and the
final fits; the whole learning stage, the scikit-learn models included, took 1688 s in an unloaded bake
(2106 s in the committed 0.05.001 bake, which shared the machine with browser checks). It does not change what the models can learn, and it makes bit-level reproduction depend on the
device. Record the device with every result, as the lane does, and never report a GPU run from a
machine that fell back to the CPU.

## Traps

- **`model.eval()` before predicting.** The networks here have no dropout or batch normalization, so it
  changes nothing today; it will the day a layer that behaves differently in training is added.
- **`torch.no_grad()` for evaluation**, or the validation loss builds a graph every epoch and memory
  grows with the epochs.
- **Keep the state on the device you trained on**, and move the network to the CPU before exporting
  (`export_onnx` does `model.to("cpu")`).
- **A surrogate's interpolation score is not its transfer score.** The MLP here interpolates best and
  transfers worst of five models; report both protocols or neither.
