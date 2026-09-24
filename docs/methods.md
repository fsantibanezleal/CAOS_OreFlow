# Methods and theory

## Comminution

Rittinger is implemented as a surface-area proxy, Kick as a logarithmic reduction-ratio proxy and Bond as a work-index relation. A Whiten-style crusher response converts feed P80 and CSS into a product P80. Grinding uses a cumulative size-distribution shape proxy whose slope changes with hardness and reduction ratio. It does not solve a population-balance equation or a calibrated breakage kernel.

## Classification

The classifier applies a logistic fine-recovery probability to *size-bin masses*, sums them for the one-pass overflow solids fraction and normalizes their cumulative sum for the overflow size curve. A Plitt-style approximation makes cut size respond to water, density and feed load. The calculation assumes uniform valuable grade across size classes; overall valuable recovery is overflow fraction times conditional rougher recovery. It omits detailed cyclone geometry, pressure drop, rheology and circulating load.

## Flotation and balance

First-order, Kelsall fast/slow and compressed-exponential kinetics generate alternative conditional time-response curves. Recovery is converted to concentrate grade using a declared mass-pull proxy, with an exact one-stage valuable-metal balance. The balance is exact for the model and is not a measurement-quality claim.

## Optimisation and uncertainty

The bounded search evaluates 25 grind/reagent candidates with a declared objective. Monte Carlo uses seeded lognormal multipliers for hardness, grade and cut size. Quantiles are conditional on the authored state and not calibrated safety intervals.

## Machine learning

Ridge, random forest, gradient boosting and Gaussian process models are fit with scikit-learn. A PyTorch MLP and autoencoder are fit in the accelerator environment when available and exported to ONNX when the exporter is installed. The target is overall simulator recovery, not a hidden plant label. Held-out evaluation is a disjoint perturbation set from the *same authored case families*, with RMSE in percentage points and R². The autoencoder is assessed by feature reconstruction MSE separately; Gaussian-process predictive intervals are not calibrated or reported.

## Operating-envelope investigation

The interactive study is an auditable finite 7×7 sample around the selected operating point. It varies grind P80 and collector dose, or grind P80 and feed rate for magnetite, with the other controls held fixed. A point is feasible only when recovery and concentrate grade meet minima and specific energy, water and applicable collector dose meet maxima. Exact non-dominance compares recovered valuable mineral (t/h; maximize), total power (MW; minimize) and collector mass (kg/h; minimize) or water demand for magnetite. The recommended *sampled* point maximizes recovered valuable mineral among feasible non-dominated points. A stress minimum is the minimum recovery under +10% hardness and ±10% classifier cut where applicable. It is not a confidence interval, continuous optimum or plant set-point. [Constraint-handling reference](https://www.pymoo.org/constraints/index.html).

## Measured locked-cycle response

An independent GeoMet lane evaluates copper locked-cycle test recovery on 52 usable rows from 29 holes in one deposit; one of 53 rows lacks LCT. Five assay features (Cu, Fe, S, Si, Al in ppm) are log1p-transformed. Hole ID and coordinates define split groups and plots only; `fr` and `xr` are excluded because their semantics and possible relation to LCT are not established. A training-mean baseline, fixed-alpha ridge, 160-tree random forest and train-conditioned fixed-kernel Gaussian process use five hole-grouped folds and a separate three-X-zone holdout. Preprocessing is fitted in each training fold. Scores are percentage-point errors against measured *test* recovery, not simulator outputs. The source does not contain grind, collector or residence settings and cannot calibrate the interactive circuit. Sources: [GeoMet v4](https://doi.org/10.5281/zenodo.7051975), [Hoffimann et al. (2022)](https://doi.org/10.1007/s11004-022-10013-1).
