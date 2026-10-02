"""Real ore samples in an engine circuit (RS-01 to RS-05; docs/design/features/real-samples).

Source: the GeoMet dataset, Zenodo 7051975 (CC BY 4.0; Hoffimann et al. 2022, doi:10.1007/s11004-022-10013-1).
Two of its tables, pinned by MD5 (Zenodo's own checksum) and SHA-256:

- ``comminution.csv``: 60 samples with the Bond ball-mill test values. The column meanings are inferred from the
  Bond test, because the paper is paywalled: ``A`` the closing screen (um), ``M`` the net undersize per
  revolution (g/rev), ``F80`` and ``P80`` in um. The work index is Bond's metric form (RS-02).
- ``flotation.csv``: 53 locked-cycle tests with head assays and the measured copper recovery ``LCT``; the one
  without a recovery is excluded, as the GeoMet lane excludes it.

The samples' sulphur cannot cover chalcopyrite (dossier of 2026-09-28): the copper is allocated across
chalcopyrite, bornite and chalcocite by a sulphur-limited normative mineralogy in moles (RS-03), an assumption
labelled on every surface. The iron left after the sulphides goes to magnetite (an assumption: the assays do not
identify it), and quartz closes the mass. Each locked-cycle sample takes the work index of the nearest comminution
sample in its hole, or else the deposit median (RS-04). The engine then runs the soft porphyry's circuit on the
sample's ore at the case's nominal operating point (RS-05); the liberation, breakage and flotation parameters stay
the case's, and the two new copper minerals float at declared ratios to chalcopyrite (dossier of 2026-09-30).
"""
from __future__ import annotations

import hashlib
import math
from dataclasses import replace
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from ..engine.chemistry import formula_weight, parse_formula
from ..engine.constants import atomic_weights, constant, mineral_table
from ..engine.model import Carrier, MineralSpec, OperatingPoint, Ore, Payable
from .catalog import CASE_BY_ID, QUARTZ

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data" / "raw"
CASE_ID = "copper_porphyry_soft"
RECORD = "https://zenodo.org/records/7051975"
SOURCES = {
    "comminution": {"file": "geomet-comminution.csv", "url": "https://zenodo.org/api/records/7051975/files/comminution.csv/content",
                    "md5": "1a33df8ba77f5d49c281ba3fff16b20b",
                    "sha256": "972ebf9ebb2e3309280abb72ca142062bc0115281a0340eb1e8a5ceb97237527"},
    "flotation": {"file": "geomet-flotation.csv", "url": "https://zenodo.org/api/records/7051975/files/flotation.csv/content",
                  "md5": "f2e90da6bfa81de1261177ee85a91570",
                  "sha256": "e7968c250c1ccc17b63da6d9624473dd92b32a7ba8d8772e70070a0115e42eda"},
}
COPPER_MINERALS = ("chalcopyrite", "bornite", "chalcocite")


def source_bytes(name: str, raw: Path = RAW) -> bytes:
    """A pinned table, read from data/raw or downloaded there; any other bytes are refused (RS-01)."""
    pin = SOURCES[name]
    path = raw / pin["file"]
    if path.is_file():
        data = path.read_bytes()
    else:
        with urlopen(pin["url"], timeout=60) as response:
            data = response.read()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    if hashlib.md5(data).hexdigest() != pin["md5"] or hashlib.sha256(data).hexdigest() != pin["sha256"]:
        raise ValueError(f"GeoMet {name} table does not match its pinned checksums")
    return data


def _rows(name: str) -> list[dict[str, str]]:
    import csv
    import io

    text = source_bytes(name).decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def _number(value: str | None) -> float | None:
    if value is None or value.strip() == "":
        return None
    x = float(value)
    return x if math.isfinite(x) else None


def bond_work_index(screen_um: float, grindability_g_rev: float, p80_um: float, f80_um: float) -> float:
    """Bond's ball-mill work index in kWh per tonne from the laboratory test (RS-02)."""
    lab = float(constant("bond.lab_constant"))
    a, b = float(constant("bond.lab_screen_exponent")), float(constant("bond.lab_grindability_exponent"))
    coefficient = float(constant("bond.coefficient"))
    reduction = coefficient / math.sqrt(p80_um) - coefficient / math.sqrt(f80_um)
    return float(constant("units.short_ton_per_tonne")) * lab / (screen_um ** a * grindability_g_rev ** b * reduction)


def comminution_samples() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    samples, excluded = [], []
    for k, row in enumerate(_rows("comminution")):
        values = {key: _number(row.get(key)) for key in ("X", "Y", "Z", "A", "M", "F80", "P80")}
        source_row = k + 2
        if any(v is None for v in values.values()) or not values["F80"] > values["P80"] > 0.0 or values["M"] <= 0.0:
            excluded.append({"table": "comminution", "source_row": source_row, "reason": "incomplete Bond test values"})
            continue
        samples.append({"source_row": source_row, "hole": row["HOLEID"], "xyz": [values["X"], values["Y"], values["Z"]],
                        "screen_um": values["A"], "grindability_g_rev": values["M"], "f80_um": values["F80"],
                        "p80_um": values["P80"],
                        "work_index_kwh_t": bond_work_index(values["A"], values["M"], values["P80"], values["F80"])})
    return samples, excluded


def _atoms(mineral: str) -> dict[str, float]:
    return parse_formula(mineral_table()[mineral]["formula"])


def allocate(cu_ppm: float, s_ppm: float, fe_ppm: float) -> dict[str, Any] | None:
    """Sulphur-limited normative mineralogy in moles (RS-03): the copper minerals the sample's sulphur can make, in
    order of falling S/Cu (chalcopyrite, bornite, chalcocite), pyrite from sulphur left over chalcopyrite, and
    magnetite from the iron left over the sulphides. The S/Cu of each mineral comes from its formula. Returns None
    when the sulphur cannot cover even chalcocite."""
    w = atomic_weights()
    c, s = cu_ppm / w["Cu"], s_ppm / w["S"]          # mol per 1e6 g of ore
    ratio = {m: _atoms(m)["S"] / _atoms(m)["Cu"] for m in COPPER_MINERALS}
    moles = {m: 0.0 for m in (*COPPER_MINERALS, "pyrite", "magnetite")}
    if s >= ratio["chalcopyrite"] * c:
        moles["chalcopyrite"] = c / _atoms("chalcopyrite")["Cu"]
        moles["pyrite"] = (s - ratio["chalcopyrite"] * c) / _atoms("pyrite")["S"]
        band = "chalcopyrite_pyrite"
    else:
        pair = ("chalcopyrite", "bornite") if s >= ratio["bornite"] * c else ("bornite", "chalcocite")
        if s < ratio["chalcocite"] * c:
            return None
        # two minerals share the copper and the sulphur: solve the 2x2 balance in formula units
        (a1, b1), (a2, b2) = ((_atoms(m)["Cu"], _atoms(m)["S"]) for m in pair)
        det = a1 * b2 - a2 * b1
        moles[pair[0]], moles[pair[1]] = (c * b2 - s * a2) / det, (a1 * s - b1 * c) / det
        band = "_".join(pair)
    fe_sulphides = sum(moles[m] * _atoms(m).get("Fe", 0.0) for m in (*COPPER_MINERALS, "pyrite"))
    fe_left = max(0.0, fe_ppm / w["Fe"] - fe_sulphides)
    moles["magnetite"] = fe_left / _atoms("magnetite")["Fe"]
    mass = {m: n * formula_weight(mineral_table()[m]["formula"]) / 1e6 for m, n in moles.items()}
    cu_mass = {m: moles[m] * _atoms(m)["Cu"] * w["Cu"] for m in COPPER_MINERALS}
    total_cu = sum(cu_mass.values())
    return {"band": band, "fractions": mass, "copper_shares": {m: cu_mass[m] / total_cu for m in COPPER_MINERALS},
            "s_to_cu_molar": s / c}


def _distance(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def assign_work_index(hole: str, xyz: list[float], comminution: list[dict[str, Any]]) -> dict[str, Any]:
    """The nearest comminution sample in the same hole, else the deposit median (RS-04)."""
    same = [c for c in comminution if c["hole"] == hole]
    if same:
        nearest = min(same, key=lambda c: (_distance(c["xyz"], xyz), c["source_row"]))
        return {"value": nearest["work_index_kwh_t"], "how": "nearest_in_hole", "from_source_row": nearest["source_row"],
                "distance_m": _distance(nearest["xyz"], xyz)}
    values = sorted(c["work_index_kwh_t"] for c in comminution)
    n = len(values)
    median = values[n // 2] if n % 2 else 0.5 * (values[n // 2 - 1] + values[n // 2])
    return {"value": median, "how": "deposit_median", "from_source_row": None, "distance_m": None}


def allocate_alternative(cu_ppm: float, s_ppm: float, fe_ppm: float) -> dict[str, Any] | None:
    """S-06: the other end of the sulphur-deficient family, chalcopyrite with chalcocite, closing the same copper and
    sulphur; the chalcopyrite-pyrite band has no freedom and keeps its allocation."""
    base = allocate(cu_ppm, s_ppm, fe_ppm)
    if base is None or base["band"] == "chalcopyrite_pyrite":
        return base
    w = atomic_weights()
    c, s = cu_ppm / w["Cu"], s_ppm / w["S"]
    (a1, b1), (a2, b2) = ((_atoms(m)["Cu"], _atoms(m)["S"]) for m in ("chalcopyrite", "chalcocite"))
    det = a1 * b2 - a2 * b1
    moles = {m: 0.0 for m in (*COPPER_MINERALS, "pyrite", "magnetite")}
    moles["chalcopyrite"], moles["chalcocite"] = (c * b2 - s * a2) / det, (a1 * s - b1 * c) / det
    fe_sulphides = sum(moles[m] * _atoms(m).get("Fe", 0.0) for m in COPPER_MINERALS)
    moles["magnetite"] = max(0.0, fe_ppm / w["Fe"] - fe_sulphides) / _atoms("magnetite")["Fe"]
    mass = {m: n * formula_weight(mineral_table()[m]["formula"]) / 1e6 for m, n in moles.items()}
    cu_mass = {m: moles[m] * _atoms(m)["Cu"] * w["Cu"] for m in COPPER_MINERALS}
    total_cu = sum(cu_mass.values())
    return {"band": base["band"] + ":chalcopyrite_chalcocite", "fractions": mass,
            "copper_shares": {m: cu_mass[m] / total_cu for m in COPPER_MINERALS}, "s_to_cu_molar": s / c}


def sample_ore(allocation: dict[str, Any], head_cu_pct: float, work_index: float, bornite_ratio: float | None = None,
               chalcocite_to_bornite: float | None = None, drop_magnetite: bool = False) -> Ore:
    """The soft porphyry's ore with the sample's minerals: the copper minerals take chalcopyrite's liberation and
    flotation parameters, at their declared floatability ratios; pyrite keeps the case's depressed flotability;
    magnetite is gangue that floats as quartz does; quartz closes the mass."""
    case = CASE_BY_ID[CASE_ID]
    spec = {m.id: m for m in case.ore.minerals}
    cp = spec["chalcopyrite"]
    bn = float(constant("minerals.bornite_floatability_ratio")) if bornite_ratio is None else bornite_ratio
    cc = float(constant("minerals.chalcocite_to_bornite_floatability_ratio")) if chalcocite_to_bornite is None else chalcocite_to_bornite
    ratios = {"chalcopyrite": 1.0, "bornite": bn, "chalcocite": bn * cc}
    shares = allocation["copper_shares"]
    carriers = [m for m in COPPER_MINERALS if shares[m] > 0.0]
    minerals = [replace(cp, id=m, flotation=replace(cp.flotation, floatability=cp.flotation.floatability * ratios[m])) for m in carriers]
    # a gangue mineral with no declared fraction is the ore's balance, and quartz is the only one: pyrite and
    # magnetite join only when the allocation gives them mass
    if allocation["fractions"]["pyrite"] > 0.0:
        minerals.append(replace(spec["pyrite"], fraction=allocation["fractions"]["pyrite"]))
    if allocation["fractions"]["magnetite"] > 0.0 and not drop_magnetite:
        minerals.append(MineralSpec(id="magnetite", fraction=allocation["fractions"]["magnetite"], flotation=QUARTZ))
    minerals.append(spec["quartz"])
    payable = Payable("Cu", "%", tuple(Carrier(m, shares[m]) for m in carriers), head_cu_pct)
    ratio = case.ore.crushing_work_index_kwh_t / case.ore.work_index_kwh_t
    return replace(case.ore, minerals=tuple(minerals), payables=(payable,), work_index_kwh_t=work_index,
                   crushing_work_index_kwh_t=work_index * ratio)


def sample_point(head_cu_pct: float, work_index: float) -> OperatingPoint:
    return CASE_BY_ID[CASE_ID].nominal.with_values(head_grade=head_cu_pct, work_index_kwh_t=work_index)


def locked_cycle_samples(comminution: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    samples, excluded = [], []
    for k, row in enumerate(_rows("flotation")):
        source_row = k + 2
        lct = _number(row.get("LCT"))
        cu, s, fe = (_number(row.get(f"{e} ppm")) for e in ("Cu", "S", "Fe"))
        xyz = [_number(row.get(a)) for a in ("X", "Y", "Z")]
        if lct is None or not 0.0 <= lct <= 1.0:
            excluded.append({"table": "flotation", "source_row": source_row, "reason": "missing locked-cycle recovery"})
            continue
        if cu is None or s is None or fe is None or any(v is None for v in xyz):
            excluded.append({"table": "flotation", "source_row": source_row, "reason": "missing Cu, S, Fe or location"})
            continue
        allocation = allocate(cu, s, fe)
        if allocation is None:
            excluded.append({"table": "flotation", "source_row": source_row,
                             "reason": "the sulphur cannot cover the copper even as chalcocite"})
            continue
        samples.append({"id": f"lct-{source_row}", "source_row": source_row, "hole": row["HOLEID"], "xyz": xyz,
                        "assays_pct": {"Cu": cu / 1e4, "S": s / 1e4, "Fe": fe / 1e4},
                        "measured_recovery_pct": 100.0 * lct, "allocation": allocation,
                        "work_index": assign_work_index(row["HOLEID"], xyz, comminution)})
    return samples, excluded
