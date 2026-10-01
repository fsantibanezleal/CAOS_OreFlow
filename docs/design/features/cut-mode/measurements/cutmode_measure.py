"""Cut-mode task T1 measurement: is the mill power e (1 + C(e, d50c)) F monotone in the energy per pass at a
fixed cut, and does the water bypass converge with the achieved circulating load?

For every case's nominal state: solve the target mode (e*, cut*), then for cuts cut* x {0.6, 0.8, 1, 1.25, 1.6}
and energies e* x 2^[-2, 2] (17 points), solve the bypass fixed point (the underflow water follows the achieved
circulating load, not the design one) and record C, the power and the iterations.
"""
import json
import sys


sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parents[5] / 'data-pipeline'))
from pipeline.cases.catalog import CASES  # noqa: E402
from pipeline.engine.circuit import crush, resolve  # noqa: E402
from pipeline.engine.constants import constant  # noqa: E402
from pipeline.engine.grid import grid  # noqa: E402
from pipeline.engine.grinding import GrindingCircuit  # noqa: E402
from pipeline.engine.model import Flags  # noqa: E402
from pipeline.engine.streams import Stream  # noqa: E402


def circuit_for(case):
    op, plant = case.nominal, case.plant
    r = resolve(case.ore, op)
    g = grid()
    shape = g.rosin_rammler(plant.crusher.feed_f80_um, plant.crusher.feed_slope)
    feed = Stream({m: op.throughput_tph * r.fraction[m] * shape for m in r.ids}, 0.0)
    css = op.crusher_css_mm * float(constant('units.um_per_mm'))
    new_feed = {m: crush(feed.solids[m], css, plant.crusher) for m in r.ids}
    return GrindingCircuit(r, plant, op, new_feed, Flags())


def consistent(c, e, cut, tol=1e-12, cap=200):
    """C at (e, cut) with the underflow water from the achieved load; returns (C, iterations)."""
    su = c.plant.cyclone.underflow_solids
    load = c.op.circulating_load
    for k in range(1, cap + 1):
        c.water_under = load * c.new_feed_tph * (1.0 - su) / su
        c.bypass = c.water_under / (c.water_under + c.water_over)
        new = c.run(e, cut).circulating_load
        if abs(new - load) <= tol * max(1.0, load):
            return new, k
        load = new
    return load, -1


out = []
for case in CASES:
    c = circuit_for(case)
    res = c.solve()
    e_star, cut_star, installed = res.energy_per_pass_kwh_t, res.cut_um, case.plant.mill.installed_power_kw
    rows = []
    for fc in (0.6, 0.8, 1.0, 1.25, 1.6):
        cut = cut_star * fc
        series = []
        for j in range(17):
            e = e_star * 2.0 ** (-2 + j / 4)
            C, iters = consistent(c, e, cut)
            series.append({'e': e, 'C': C, 'power': e * (1 + C) * c.new_feed_tph, 'iterations': iters})
        powers = [s['power'] for s in series]
        monotone = all(b > a for a, b in zip(powers, powers[1:]))
        rows.append({'cut_factor': fc, 'cut_um': cut, 'monotone': monotone, 'C_range': [min(s['C'] for s in series), max(s['C'] for s in series)],
                     'max_iterations': max(s['iterations'] for s in series), 'unconverged': sum(s['iterations'] < 0 for s in series),
                     'power_range_kw': [powers[0], powers[-1]], 'installed_kw': installed})
    out.append({'case': case.id, 'e_star': e_star, 'cut_star': cut_star, 'design_C': case.nominal.circulating_load, 'rows': rows})
    print(case.id, 'monotone', [r['monotone'] for r in rows], 'C', [f"{r['C_range'][0]:.2f}-{r['C_range'][1]:.2f}" for r in rows],
          'iters', [r['max_iterations'] for r in rows], 'unconv', sum(r['unconverged'] for r in rows), flush=True)
json.dump(out, open(__import__('pathlib').Path(__file__).with_suffix('.json'), 'w'), indent=1)
