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
