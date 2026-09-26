# 03 SALib

SALib is the Sensitivity Analysis Library for Python. OreFlow uses it for one record: the
variance-based sensitivity of the nominal operating point of every case, which says how much of the
spread of recovery, grade, grinding energy and recovered metal each uncertain ore property explains,
alone (the first-order index `S1`) and with all its interactions (the total index `ST`). The design
and the estimators are Saltelli's (Saltelli et al. 2010, doi:10.1016/j.cpc.2009.09.018), as SALib
implements them (Herman and Usher 2017, doi:10.21105/joss.00097).

## At a glance

| | |
|---|---|
| Package | `SALib` |
| Version | 1.6.0 |
| Licence | MIT |
| Declared in | `requirements-precompute.txt` (the offline lane) |
| Lane | Offline bake only |
| Used by | `data-pipeline/pipeline/methods/uncertainty.py`, function `sensitivity` |
| Settings | `sensitivity.base_samples` (256), `sensitivity.resamples` (200), `sensitivity.confidence` (0.95), `uncertainty.seed`, `uncertainty.half_widths` |
| Cost | 256 x (4 + 2) = 1536 engine runs per nominal variant (1280 for the magnetite circuit, with three inputs) |

## Read in order

1. [Installation](03_salib/01_installation.md): the pin and its dependencies.
2. [Usage in OreFlow](03_salib/02_usage.md): the problem definition, the design, the estimators,
   what the record stores and how the pages show it.
3. [Applying it](03_salib/03_applying.md): sensitivity of your own case or model, and how to read
   and not to read the indices.
4. [`example.py`](03_salib/example.py): SALib's estimates against the Ishigami function's exact indices,
   then the soft porphyry record re-run and compared with the committed one.

Related: [02 SciPy](02_scipy.md) (the Latin hypercube of the uncertainty record),
[methodology 13](../methodologies/13_uncertainty-sensitivity.md).
