# 11 Kinetic fits and bank projection

A laboratory batch flotation test gives one recovery-time curve; a plant rougher is a bank of
continuously fed cells. Lumped kinetic models connect the two: fit a few parameters to the batch
curve, then predict the bank. OreFlow uses its own engine as the laboratory, so it can measure how
much each lumped model loses when the real feed is a distribution of rates.

## Theory

**The batch curve.** In a batch cell every particle class $j$ (a mineral, a liberation state and a
size) floats by first-order true flotation with rate constant $k_j$, so the recovery of a species with
content $c_j$ in a feed $x_j$ is

$$R_{batch}(t) = \frac{\sum_j c_j x_j \left(1 - e^{-k_j t}\right)}{\sum_j c_j x_j}.$$

The feed is a distribution of rates (fast liberated grains near the optimum size, slow composites
and ultrafines), so $R_{batch}$ is a mixture of exponentials, not one exponential.

**Lumped models.** Five classical forms summarize such a curve (dossier section 3.6):

| Model | $R(t)$ | Parameters |
|---|---|---|
| First order | $A\,(1 - e^{-kt})$ | ultimate recovery $A$, rate $k$ |
| Kelsall, modified by Jowett (1974) | $A\,[(1-\phi)(1 - e^{-k_f t}) + \phi\,(1 - e^{-k_s t})]$ | slow fraction $\phi$, fast and slow rates $k_f > k_s$ |
| Klimpel | $A\left[1 - \dfrac{1 - e^{-kt}}{kt}\right]$ | rates uniform on $[0, k]$ |
| Gamma (Imaizumi and Inoue 1963) | $A\,[1 - (1 + a t)^{-p}]$ | a gamma distribution of rates with shape $p$ and scale $a$ |
| Compressed or stretched exponential | $A\,(1 - e^{-(kt)^\beta})$ | $\beta > 1$: delayed onset; $\beta < 1$: a spread of rates |

Kelsall (1961, Trans. IMM 70:191-204) introduced the fast and slow split; Klimpel (1980, SME-AIME
preprint 80-34) the rectangular distribution; Polat and Chander (2000, doi:10.1016/S0301-7516(99)00069-1)
review first-order models with rate distributions; Bu et al. (2017, doi:10.5277/ppmp170128) compare
orders and distributions; Vinnett and Waters (2025, doi:10.1016/j.mineng.2025.109246) treat the
compressed exponential.

**Projection to a bank.** A bank of $N$ equal perfectly mixed cells, each of mean residence $\tau_c$,
has an Erlang residence distribution $E(t) = t^{N-1} e^{-t/\tau_c} / (\tau_c^N (N-1)!)$. Every first-order
class obeys segregated flow exactly: its bank recovery is $\int_0^\infty (1 - e^{-k t}) E(t)\,dt =
1 - (1 + k\tau_c)^{-N}$. A mixture of first-order classes therefore projects as
$R_{bank} = \int_0^\infty R_{batch}(t)\, E(t)\, dt$, and so does any lumped model of it. Closed forms:

$$R^{FO}_{bank} = A\,[1 - (1 + k\tau_c)^{-N}],$$
$$R^{K}_{bank} = A\,\big[(1-\phi)(1 - (1 + k_f\tau_c)^{-N}) + \phi\,(1 - (1 + k_s\tau_c)^{-N})\big],$$
$$R^{Kl}_{bank} = A\left[1 - \frac{1 - (1 + k\tau_c)^{1-N}}{(N-1)\,k\tau_c}\right] \quad (N \ge 2), \qquad
A\left[1 - \frac{\ln(1 + k\tau_c)}{k\tau_c}\right] \quad (N = 1).$$

The gamma and compressed forms have no closed bank form in general; with $t = \tau_c v$,
$\int f(t) E(t)\,dt = \int_0^\infty f(\tau_c v)\, \frac{v^{N-1}}{(N-1)!}\, e^{-v}\, dv$, evaluated with the
64-node Gauss-Laguerre rule exported with Contract 1, so both engines integrate with the same table.

**The exact answer.** Because the engine knows every class rate, it also computes the unlumped bank
recovery $\sum_j c_j x_j [1 - (1 + k_j \tau_c)^{-N}] / \sum_j c_j x_j$. The **lumping error** of a model is
its projection minus this exact value. The **ultimate gap** is the fitted $A$ minus the fitted
recovery at the last batch time: the part of the projection that rests on extrapolation, because a
bank residence (often above 20 min) is longer than the 16 min test.

## Implementation

`pipeline/engine/kinetics.py`:

- The virtual batch test floats the rougher feed (fresh flotation feed plus the cleaner recycle) with
  the rougher's rate constants: the same bubble surface area flux and collector dose, and no
  entrainment. Samples are taken at 0.5, 1, 2, 3, 4, 6, 8, 12 and 16 min.
- Bounds are imposed by reparameterization, so the least-squares problem is unconstrained:
  $A$ and $\phi$ through a logistic, rates and $p$ through an exponential, $k_f = k_s + e^{\theta}$ so the
  fast rate stays above the slow one, and $\beta$ in $[0.2, 5]$ through a scaled logistic.
- Levenberg-Marquardt (Marquardt 1963, J. SIAM 11(2):431-441, doi:10.1137/0111030) with Marquardt's
  diagonal scaling, analytic Jacobians through the chain rule of the reparameterization, a Gaussian
  elimination with partial pivoting for the small normal systems, damping from 1e-3 by factors of 10,
  and a stop when the relative decrease of the residual or the step falls below 1e-14 (at most 400
  iterations). Every sum runs in a fixed order, so the browser port follows the same path.
- Starting values come from the curve: $A_0$ halfway between the last batch recovery and 1, and
  $k_0 = \ln 2 / t_{1/2}$ from the interpolated half-recovery time.
- The record in the trace (`methods.kinetics`) holds the batch curve, each model's parameters, fit
  RMSE, iterations and convergence, the fitted values at the batch times and on a 65-point curve,
  the bank projection, the lumping error and the ultimate gap, plus the exact distributed bank
  recovery and the engine's rougher recovery (which adds entrainment).

On the twelve nominal cases the first-order model underestimates the exact bank by 3 to 7 points,
because it caps the ultimate recovery at the plateau of a 16 min test. The Kelsall and gamma forms
fit the batch curve to within 0.2 points RMSE and project within about 1.6 points. The stretched
exponential settles at $\beta$ between 0.84 and 0.94: a spread of rates, as the class structure
implies. These ranges are pinned by `test_documented_findings_on_nominal_cases`. All 330 fits on
the baked variants converge, which the browser parity depends on. In the seeded envelope sample of
the contract gate (measured on 2026-09-26), 12 of 1670 fits, gamma and Kelsall at states whose batch
curve reaches only 6 to 35% by 16 min, stop at the iteration cap: there the curve has no plateau, so
the ultimate recovery and the slow rate trade off along a flat valley and are not separately
identifiable. They are reported with `converged: false`, never as a converged fit.

## Verification

- `tests/test_kinetics.py::test_fits_and_bank_projection` (PE-26): on every flotation case the batch
  curve rises monotonically, every model converges and reports its parameters, RMSE (recomputed from
  the record), bank projection, lumping error and ultimate gap; the two-rate and gamma forms fit
  better than first order and within 0.5 points.
- `test_exact_curves_are_recovered`: each model recovers its own parameters to 1e-6 from an exact
  curve and a perturbed start, including a compressed ($\beta = 1.6$) and a stretched ($\beta = 0.7$)
  exponential.
- `test_quadrature_matches_closed_forms`: for 1, 3, 8 and 12 cells and $k\tau_c$ of 0.1, 1 and 5, the
  Laguerre rule reproduces $(1 + k\tau_c)^{-N}$ to 1e-10 and the Klimpel closed form to 1e-9.
- `test_single_rate_feed_has_no_lumping_error`: when the feed really is one rate plus an inert
  fraction, the first-order fit recovers it and its projection equals the exact bank.
- `test_every_baked_variant_fit_converges`: all five fits converge on every baked flotation variant.
- `test_documented_findings_on_nominal_cases`: the ranges stated on this page hold on the nominal
  cases.

## What it is not

The batch test is virtual: it has the rougher's hydrodynamics and no froth-recovery or entrainment
effects, which a laboratory test would include. The lumped parameters describe this engine's rate
distribution; they are not fitted to plant or laboratory data, and the lumping errors say how much a
lumped model would lose on a feed like this one, not on any particular ore.
