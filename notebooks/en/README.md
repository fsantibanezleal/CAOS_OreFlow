# OreFlow notebooks

Bilingual practical lessons grounded in OreFlow's committed process cases and implemented pipeline methods.


## 01 01-comminution

- [Follow a copper ore through crushing and grinding](01-comminution/01-the-record.ipynb), level 1: Starting from one declared OreFlow ore and its nominal operating point, follow feed size through the comminution circuit. You will distinguish a simulated flowsheet record from plant measurement and identify the quantities the engine actually computes.

- [Reconstruct the energy and recycle calculation](01-comminution/02-the-method.ipynb), level 2: Reproduce a nominal circuit run from OreFlow's declared case, inspect the classifier and energy stages, and test how the implemented Bond law responds to a controlled P80 change. Every computed quantity comes from the pipeline methods.

- [Compare Bond, Rittinger and Kick on one reduction](01-comminution/03-research-comparison.ipynb), level 3: Compare three comminution hypotheses over the same feed-size and product-size range, identify the calibration point at which they agree, and state what the comparison can and cannot establish.



## 02 02-flotation

- [Read a flotation bank as a kinetic response](02-flotation/01-the-record.ipynb), level 1: Run the Cu-Mo rougher and distinguish its virtual batch curve from the continuously fed bank response. Understand why recovery versus time is a process response, not a decorative animation.

- [Fit five kinetic models and compare bank projection](02-flotation/02-the-method.ipynb), level 2: Run OreFlow's bounded nonlinear fits, inspect parameter bounds and residuals, and compare each fitted bank prediction with the engine's exact rate-distributed reference.

- [Compare classical flotation kinetics on one evidence set](02-flotation/03-research-comparison.ipynb), level 3: Compare five cited kinetic forms on identical batch evidence, then evaluate bank projection separately against the engine's exact rate-distributed reference.



## 03 03-learning

- [Build one ore-processing learning example](03-learning/01-the-record.ipynb), level 1: Use OreFlow's own feature and target functions on one authored circuit. Identify what the surrogate learns and why engine-generated rows are not plant observations.

- [Trace the design and leakage-safe validation splits](03-learning/02-the-method.ipynb), level 2: Generate a small deterministic design through OreFlow's pipeline, inspect its within-case interpolation and whole-case holdout indices, and relate these protocols to the committed full-size validation.

- [Compare surrogates and transfer to unseen ores](03-learning/03-research-comparison.ipynb), level 3: Compare model families on identical targets and interpolation rows, inspect whole-case transfer and Gaussian-process coverage, and assess what the evidence says about generalization limits.



## 04 04-optimization

- [Read an operating-point optimization record](04-optimization/01-the-record.ipynb), level 1: Separate the operating decisions, objective, feasibility constraints and measured search effort in the committed optimizer result. Explain why an optimum is conditional on the authored case and its contract.

- [Run and inspect the pattern search](04-optimization/02-the-method.ipynb), level 2: Run OreFlow's production optimizer on the soft porphyry case, inspect its actual evaluation trace and test whether the final point satisfies each declared physical constraint.

- [Evaluate surrogate-screened search](04-optimization/03-research-comparison.ipynb), level 3: Compare the screened and unscreened search evidence in the same committed benchmark row, then interpret how the objective weight changes recovery-energy trade-offs.



## 05 05-uncertainty

- [Distinguish process variation from uncertainty](05-uncertainty/01-the-record.ipynb), level 1: Read the committed uncertainty record, identify its uncertain ore inputs and output quantiles, and explain why an interval around one simulated state is not a plant confidence interval.

- [Propagate a seeded uncertainty design](05-uncertainty/02-the-method.ipynb), level 2: Run OreFlow's uncertainty function on a teaching-sized seeded design, inspect the simulated recovery distribution and compare the nominal point with its sampled range.

- [Estimate variance-based input sensitivity](05-uncertainty/03-research-comparison.ipynb), level 3: Run the production Saltelli-Sobol sensitivity method on a bounded teaching design, rank first-order and total effects, and explain why small-design indices are exploratory estimates.
