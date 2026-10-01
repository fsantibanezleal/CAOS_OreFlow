"""PE-28: the uncertainty record is seeded and reports P05, P50, P95 and constraint probabilities; the
sensitivity record carries first-order and total Sobol indices."""
from __future__ import annotations

import json
from functools import lru_cache

import numpy as np

from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.constants import constant
from pipeline.methods.uncertainty import OUTPUTS, inputs_for, sensitivity, uncertainty


@lru_cache(maxsize=None)
def _mc(case_id: str, seed: int | None = None) -> str:
    case = CASE_BY_ID[case_id]
    return json.dumps(uncertainty(case, case.nominal, seed=seed), allow_nan=False)


def test_seeded_quantiles_and_sobol():
    record = json.loads(_mc("copper_porphyry_soft"))
    assert record["samples"] == int(constant("uncertainty.samples")) and record["seed"] == int(constant("uncertainty.seed"))
    assert _mc("copper_porphyry_soft") == json.dumps(uncertainty(CASE_BY_ID["copper_porphyry_soft"],
                                                                 CASE_BY_ID["copper_porphyry_soft"].nominal), allow_nan=False)
    widths = constant("uncertainty.half_widths")
    names = list(record["inputs"])
    factors = np.array(record["factors"])
    for j, name in enumerate(names):
        assert np.all(factors[:, j] >= 1.0 - widths[name]) and np.all(factors[:, j] <= 1.0 + widths[name])
    for key in OUTPUTS:
        out = record["outputs"][key]
        assert out["p05"] <= out["p50"] <= out["p95"]
        values = np.array(out["values"])
        assert len(values) == record["samples"]
        assert np.allclose(np.quantile(values, [0.05, 0.5, 0.95]), [out["p05"], out["p50"], out["p95"]], rtol=0, atol=0)
    probabilities = record["probabilities"]
    assert all(0.0 <= v <= 1.0 for v in probabilities.values())
    assert probabilities["all_constraints"] <= min(v for k, v in probabilities.items() if k != "all_constraints")
    assert record["max_balance_error"] <= 1e-9
    other = json.loads(_mc("copper_porphyry_soft", seed=7))
    assert other["factors"] != record["factors"]

    case = CASE_BY_ID["copper_porphyry_soft"]
    s = sensitivity(case, case.nominal, base_samples=32)
    assert s["evaluations"] == 32 * (len(names) + 2)
    energy = s["indices"]["specific_energy_grinding_kwh_t"]
    # grinding does not depend on floatability, so its indices are exactly zero, not merely small
    assert energy["ST"]["floatability"] == 0.0 and energy["S1"]["floatability"] == 0.0
    assert max(energy["ST"], key=energy["ST"].get) == "work_index"
    for key in OUTPUTS:
        idx = s["indices"][key]
        for name in names:
            assert idx["ST"][name] >= idx["S1"][name] - idx["S1_conf"][name] - idx["ST_conf"][name]
            assert idx["ST"][name] >= -idx["ST_conf"][name]


def test_magnetite_has_no_floatability_input_and_sobol_is_seeded():
    case = CASE_BY_ID["iron_magnetite_fine"]
    assert "floatability" not in inputs_for(case)
    first = sensitivity(case, case.nominal, base_samples=32)
    again = sensitivity(case, case.nominal, base_samples=32)
    assert json.dumps(first) == json.dumps(again)
    assert set(first["inputs"]) == {"work_index", "head_grade", "liberation_size"}


def test_grade_margin_shows_in_the_probability():
    # the magnetite grade (65.7% Fe) sits close to its 65% specification, the soft porphyry (26.2% Cu)
    # well above its 24%: the probabilities of meeting the specification must reflect that order
    magnetite = json.loads(_mc("iron_magnetite_fine"))["probabilities"]["grade_meets_spec"]
    copper = json.loads(_mc("copper_porphyry_soft"))["probabilities"]["grade_meets_spec"]
    assert magnetite < copper


def test_an_output_constant_up_to_round_off_is_recorded_as_constant():
    # at a 110 um target the hard porphyry's mill runs at installed power at every sample, so its grinding
    # energy is installed power over throughput to the last bits; before the tolerance its indices ranked
    # that floating-point spread (a total index of 1.1 for the head grade, 0 for the work index)
    case = CASE_BY_ID["copper_porphyry_hard"]
    s = sensitivity(case, case.nominal.with_values(target_p80_um=110.0), base_samples=32)
    assert s["indices"]["specific_energy_grinding_kwh_t"] == {"constant": True}
    assert s["indices"]["recovery_pct"]["ST"]["work_index"] > 0.5


# UQ-01 to UQ-03: one generator and one Latin hypercube, identical in the browser

SPLITMIX64_1234567 = [6457827717110365317, 3203168211198807973, 9817491932198370423, 4593380528125082431, 16408922859458223821]
# SHA-256 of the first 10,000 uniforms from the bake's seed, packed as little-endian doubles; the TypeScript test
# (frontend/src/test/splitmix64.test.ts) holds the same digest, so the two languages agree bit for bit
UNIFORMS_20260926_SHA256 = "60cde9c3edb0352c693c2b976f75903c708bf4d2f0343053507d688eeff516a0"
# the same digest of the bake's default design (128 samples, 4 inputs, row by row); frontend/src/test/lhs.test.ts
LHS_128_4_20260926_SHA256 = "fc43b40e144ebde250e1be65b12888654983d177955802b8231ae631a88a39d5"


def test_splitmix64_vector():
    from pipeline.methods.sampling import SplitMix64

    rng = SplitMix64(1234567)
    assert [rng.next_int() for _ in range(5)] == SPLITMIX64_1234567  # Vigna's splitmix64.c; Rosetta Code's task


def test_uniform_bits():
    import hashlib
    import struct

    from pipeline.methods.sampling import SplitMix64

    assert int(constant("uncertainty.seed")) == 20260926
    rng, digest = SplitMix64(20260926), hashlib.sha256()
    draws = [rng.next_float() for _ in range(10_000)]
    for u in draws:
        digest.update(struct.pack("<d", u))
    assert digest.hexdigest() == UNIFORMS_20260926_SHA256
    assert all(0.0 <= u < 1.0 for u in draws)
    assert all((u * 2.0**53).is_integer() for u in draws)  # every draw is k / 2^53


def test_lhs_strata():
    from pipeline.methods.sampling import latin_hypercube

    for n, d, seed in ((1, 1, 0), (7, 3, 1), (128, 4, 20260926), (512, 4, 2**53 - 1)):
        design = latin_hypercube(n, d, seed)
        assert len(design) == n and all(len(row) == d for row in design)
        for k in range(d):
            strata = sorted(int(row[k] * n) for row in design)
            assert strata == list(range(n)), (n, d, seed, k)  # one sample in every stratum of every input
    import hashlib
    import struct

    digest = hashlib.sha256()
    for row in latin_hypercube(128, 4, 20260926):
        for u in row:
            digest.update(struct.pack("<d", u))
    assert digest.hexdigest() == LHS_128_4_20260926_SHA256
    assert latin_hypercube(128, 4, 20260926) == latin_hypercube(128, 4, 20260926)
    assert latin_hypercube(128, 4, 20260926) != latin_hypercube(128, 4, 20260927)
