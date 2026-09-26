# 04 Classification

## Theory

A hydrocyclone sends particles to the underflow with a probability that rises with size and density,
and it carries a share of the fines to the underflow with the water (the bypass). Plitt's model
(1976) expresses the partition as a Rosin-Rammler curve on the corrected cut size $d_{50c}$ with a
water bypass $R_f$:

$$y'(d) = 1 - \exp\!\left(-\ln 2\,(d/d_{50c})^{m}\right),\qquad y(d) = R_f + (1 - R_f)\,y'(d).$$

Plitt's cut-size equation depends on the solids density as $(\rho_s - \rho_l)^{-0.5}$, so a denser
particle classifies as if it were larger. The engine applies that dependence per particle class,

$$d_{50c,k} = d_{50c}\sqrt{\frac{\rho_{host} - 1}{\rho_k - 1}},$$

which sends liberated sulphides, magnetite and gold to the underflow at finer sizes than the gangue.
In a closed circuit this returns dense minerals to the mill until they are fine, the known
overgrinding of dense minerals; plant audits of gold circuits show the same shift of the partition
curve (Laplante and Staunton, AMIRA P420B).

**Plitt cluster sizing.** With lengths in cm, $Q$ in L/min per cyclone and $C_v$ in percent solids by
volume (Plitt 1976, CIM Bulletin 69(776):114-123; equations as documented in SysCAD *Hydrocyclone*):

$$d_{50c} = \frac{50.5\,D_c^{0.46} D_i^{0.6} D_o^{1.21} e^{0.063 C_v}}{D_u^{0.71} h^{0.38} Q^{0.45} (\rho_s - \rho_l)^{0.5}}\ \mu\mathrm{m}$$

$$\Delta P = \frac{1.88\,Q^{1.78} e^{0.0055 C_v}}{D_c^{0.37} D_i^{0.94} h^{0.28} (D_u^2 + D_o^2)^{0.87}}\ \mathrm{kPa}$$

$$S = \frac{1.9\,(D_u/D_o)^{3.31} h^{0.54} (D_u^2 + D_o^2)^{0.36} e^{0.0054 C_v}}{H^{0.24} D_c^{1.11}},\quad R_v = \frac{S}{1+S},\quad m = 1.94\,e^{-1.58 R_v}\left(\frac{D_c^2 h}{Q}\right)^{0.15}$$

with $H$ the pressure head in metres of slurry.

## Implementation

The circuit solver of page 03 finds the cut the circuit needs. `cyclone.size_cluster` then answers
the equipment question: at the solved cyclone feed (solids and water flows, volume concentration,
mean density), how much flow per cyclone gives that cut by Plitt's equation, how many cyclones that
means (nearest integer), and the Plitt cut, pressure, volume split and sharpness at that count. A
pressure outside 35 to 200 kPa is flagged, not rejected.

## Parameters

| Parameter | Value | Unit | Source |
|---|---|---|---|
| sharpness $m$ | 2.0 | 1 | authored; Moly-Cop example 1.66 |
| underflow solids | 75 | % w/w | authored |
| geometry ratios $D_i, D_o, D_u, h$ | 0.256, 0.335, 0.197, 2.95 times $D_c$ | 1 | typical proportions |
| $D_c$ | 25 to 91 cm by case | cm | chosen so nominal Plitt pressure lies in the window |
| Plitt coefficients | as above | see equations | Plitt (1976) |

## Verification

- `tests/test_classification.py::test_partition_bypass_and_density_correction` (PE-11): the bypass
  equals the water split; the fine end of the partition approaches the bypass; dense classes report to
  the underflow at least as much as the host gangue.
- `tests/test_classification.py::test_plitt_sizing_consistency` (PE-12): the Plitt cut at the chosen
  cyclone count is within 10% of the cut the circuit needs, on every nominal case.

## What it is not

Plitt's equations are uncalibrated here (a plant applies correction factors fitted to a survey), so
the cyclone count and pressure are a design check, not a selection. The published Moly-Cop base case,
which uses a different (CIMM) cut model, runs six 26-inch cyclones at 53 kPa where uncalibrated Plitt
suggests fewer at higher pressure. No roping, no fish-hook.
