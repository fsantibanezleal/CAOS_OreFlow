# Released-model notebook design

The existing learning comparison retains two distinct experiments: a four-estimator reference comparison and
an explicitly separate challenge of the final released artifacts. The latter uses `Screen.judge` and `Screen.gp`
from the production pipeline, with NumPy/SciPy only. Its fresh simulator states use a separately declared Sobol
seed and the case operating contract. The final models already saw every authored case family; this challenge
does not reproduce LOCO training or establish transfer to an operating plant.

The provenance table identifies the release learning record, contract and model/scaler files with hashes.
Feature and target order/scaling are explained from the exported scalers. All three neural target errors remain
separate because recovery, log-upgrade and energy have different units.

Synthetic guard probes modify direct continuous features beyond the global authored operating bounds. They are
feature diagnostics, not coherent plant operating states, and are never submitted to the physical simulator as
valid interventions. Reconstruction errors are compared with the unchanged released threshold. Missed shifts
and baseline flags remain evidence.

The recovery GP supplies its own mean and standard deviation. Nominal Gaussian intervals at 50, 80 and 95 percent
are compared with exact simulator targets over every challenge row and by case. The neural prediction is never
used as the interval centre. A guard-accepted subset, if displayed, follows the unfiltered results and states its
denominator; an empty subset has no coverage estimate. Small per-case counts limit resolution, and this empirical
challenge is neither a plant calibration nor a reproduction of fold-specific GP coverage.

Each language companion carries actual tables, readable figures, localised explanatory surfaces and computed
Results bindings. The existing production bake and deployed weights remain unchanged.
