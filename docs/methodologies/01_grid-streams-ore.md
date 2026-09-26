# 01 Size grid, streams and ore

## Size grid

All streams share one grid of 63 classes on a fourth-root-of-two progression. The upper bound of
class $i$ (0-based) is

$$x_i = 150\,000 \cdot 2^{-i/4}\ \mu\mathrm{m}, \qquad i = 0, \dots, 62,$$

so class $i$ spans $[x_{i+1}, x_i)$ and the last class is the pan below $x_{62} = 3.24\ \mu$m.
The representative size is the geometric mean $d_i = \sqrt{x_i x_{i+1}}$ (for the pan,
$x_{62} \cdot 2^{-1/8}$). Cumulative passing at $x_i$ is the mass in classes $i$ and finer, and
percentiles (P80 and others) interpolate linearly in $(\ln x, \text{passing})$.

The top bound sits above the coarsest crusher feed in the catalog, and the fine end resolves the
slimes that desliming and entrainment act on. A fixed grid makes every case comparable and gives the
learned models a common feature space.

## Streams

A stream holds, for every mineral $m$, a vector $M_{m,i}$ in t/h, and a scalar water flow in t/h.
Element and oxide assays are computed from mineral masses and element contents; nothing stores a
grade directly, so a grade can only change when mineral masses change.

## Element contents

Mineral compositions are computed from formulas and the IUPAC abridged standard atomic weights
(`engine/data/atomic_weights.json`). For example chalcopyrite $\mathrm{CuFeS_2}$ gives 34.63% Cu,
fluorapatite $\mathrm{Ca_5(PO_4)_3F}$ gives 42.2% $\mathrm{P_2O_5}$ and magnetite
$\mathrm{Fe_3O_4}$ gives 72.36% Fe. Oxide assays use the oxide's own formula weight
($\mathrm{P_2O_5}/\mathrm{P} = 2.2914$). Non-stoichiometric phases (electrum at 73% Au, chrysocolla,
iron-bearing silicate gangue) declare their composition with a source in
`engine/data/minerals.json`, as do all densities (mindat.org typical values).

## Ore at an operating point

A case declares the payable species and the minerals that carry them. A **stoichiometric** carrier
takes the ore fraction its share of the head grade implies,
$w_m = g \cdot s / c_m$ (grade $g$, share $s$, content $c_m$); a **trace** carrier (gold in pyrite)
keeps a declared fraction and receives the content its share implies. Gangue minerals with a declared
fraction are absolute; exactly one gangue mineral takes the balance and hosts the composites.

## Liberation and particle classes

Liberation follows King's (1979) idea that liberation is governed by particle size relative to a
characteristic liberation size, decoupled from breakage (Int. J. Miner. Process. 6:207-220,
doi:10.1016/0301-7516(79)90037-1). The fraction of a valuable mineral's mass that sits in liberated
grains in class $i$ is

$$L_i = \frac{1}{1 + (d_i/x_L)^{n_L}},$$

with $x_L$ the size at 50% liberation and $n_L$ the slope, both authored per case. The rest is held in
binary composites with the host gangue at a declared valuable content $c$; a composite's density is
$\rho_c = 1/(c/\rho_V + (1-c)/\rho_{host})$.

The split into particle classes (liberated, composite, free gangue) is applied only to a product of
breakage: the mill product and the regrind product. Separations then carry the classes forward
unchanged, because a cyclone or a flotation bank treats liberated grains and composites differently
and the liberated share of a concentrate is not the feed's $L_i$. After a regrind, composites are
limited by the host gangue actually present in each class,

$$C_i = \min\!\left(\frac{(1-L_i) V_i}{c},\ \frac{H_i}{1-c}\right),$$

which conserves every mineral exactly and liberates the balance of the valuable mineral.

## Verification

- `tests/test_engine_core.py::test_grid_and_stream_shapes` (PE-01)
- `tests/test_engine_core.py::test_stoichiometry_from_atomic_weights` (PE-03)
- the grinding result records `species_consistency_error`, the difference between the mineral
  overflow of the solve and the particle-class overflow rebuilt into minerals (below 1e-10).

## What it is not

The liberation curve is a one-parameter-family description by size. It does not model the
distribution of composite grades (King's beta distribution), textures, or preferential breakage along
grain boundaries.
