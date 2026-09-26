"""CONTRACT 1: the operating envelope shared by the API, the browser and the engine (PE-30).

This declaration is the only definition of the operating inputs: unit, bounds, slider step, integer
flag, the circuit families an input applies to, bilingual label and help, and the cross-field rules.
Scale-dependent inputs (throughput, head grade, work index, collector dose) are bounded by factors of
the case nominal; intensive inputs have absolute bounds. ``build_contract()`` resolves every bound
for every case into plain numbers, and ``validate()`` reads only that resolved document. The API
validates against the exported JSON and the browser ports ``validate`` over the same JSON, so both
accept and reject exactly the same states. Every accepted state is solvable by the engine; the
envelope test in ``tests/test_contract.py`` enforces that.
"""
from __future__ import annotations

import hashlib
import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np

from ..cases.catalog import CASES
from ..engine.constants import constant
from ..engine.grid import grid
from ..engine.model import OPERATING_FIELDS

SCHEMA = "oreflow.contract/v1"
FAMILIES = ("rougher", "gravity_rougher", "magnetic", "deslime_rougher")
FLOTATION_FAMILIES = ("rougher", "gravity_rougher", "deslime_rougher")
CONTRACT_PATH = Path(__file__).resolve().parents[3] / "data" / "derived" / "contract" / "operating_contract.json"
PROBES_PATH = CONTRACT_PATH.with_name("contract_probes.json")


@dataclass(frozen=True)
class InputSpec:
    name: str
    unit: str                      # "case" means the unit of the case's primary payable
    bounds: str                    # "relative" (factors of the case nominal) or "absolute"
    low: float
    high: float
    step: float                    # absolute step, or a factor of the nominal for relative bounds
    integer: bool
    families: tuple[str, ...]
    label: tuple[str, str]         # English, Spanish
    help: tuple[str, str]
    display_scale: float = 1.0     # the interface shows value * display_scale in display_unit
    display_unit: str = ""


INPUTS: tuple[InputSpec, ...] = (
    InputSpec("throughput_tph", "t/h", "relative", 0.5, 1.5, 0.01, False, FAMILIES,
              ("Ore throughput", "Tratamiento de mineral"),
              ("Dry ore fed to the grinding circuit. More tonnes shorten flotation residence and, once the mill runs at "
               "installed power, coarsen the grind.",
               "Mineral seco alimentado al circuito de molienda. Más toneladas acortan la residencia en flotación y, cuando "
               "el molino llega a su potencia instalada, engruesan la molienda.")),
    InputSpec("target_p80_um", "um", "relative", 0.5, 2.0, 0.01, False, FAMILIES,
              ("Grind target (P80)", "Objetivo de molienda (P80)"),
              ("Size that 80% of the cyclone overflow passes. The solver finds the mill energy that meets it; a finer "
               "target needs more energy and liberates more of the valuable mineral.",
               "Tamaño bajo el cual pasa el 80% del rebose del ciclón. El solver busca la energía de molienda que lo "
               "cumple; un objetivo más fino requiere más energía y libera más mineral valioso.")),
    InputSpec("circulating_load", "1", "absolute", 1.0, 4.0, 0.05, False, FAMILIES,
              ("Circulating load", "Carga circulante"),
              ("Cyclone underflow returned to the mill per tonne of new feed. The cyclone cut is solved to hold it; a "
               "higher load lowers the grinding energy for the same target, with diminishing returns.",
               "Descarga del ciclón que vuelve al molino por tonelada de alimentación fresca. El corte del ciclón se "
               "resuelve para sostenerla; una carga mayor reduce la energía de molienda para el mismo objetivo, con "
               "retornos decrecientes."),
              display_scale=100.0, display_unit="%"),
    InputSpec("water_m3_t", "m3/t", "absolute", 1.0, 4.0, 0.05, False, FAMILIES,
              ("Overflow water", "Agua en el rebose"),
              ("Water leaving with the cyclone overflow per tonne of ore. It sets the separation feed density and the "
               "pulp volume in the cells, so more water shortens residence time.",
               "Agua que sale con el rebose del ciclón por tonelada de mineral. Fija la densidad de la alimentación a "
               "separación y el volumen de pulpa en las celdas, por lo que más agua acorta la residencia.")),
    InputSpec("crusher_css_mm", "mm", "absolute", 4.0, 16.0, 0.5, False, FAMILIES,
              ("Crusher closed-side setting", "Abertura de descarga del chancador"),
              ("Closed-side setting of the crusher ahead of the mill. A tighter setting makes a finer mill feed and "
               "moves reduction work from the mill to the crusher.",
               "Abertura de descarga del chancador antes del molino. Una abertura menor produce una alimentación más "
               "fina al molino y traslada trabajo de reducción del molino al chancador.")),
    InputSpec("work_index_kwh_t", "kWh/t", "relative", 0.7, 1.5, 0.01, False, FAMILIES,
              ("Bond work index", "Índice de trabajo de Bond"),
              ("Ball-mill work index of the ore. Harder ore breaks more slowly per kWh, so it needs more energy for the "
               "same target, or coarsens the grind when the mill is at installed power.",
               "Índice de trabajo de molino de bolas del mineral. Un mineral más duro se fractura más lento por kWh, por "
               "lo que requiere más energía para el mismo objetivo, o engruesa la molienda con el molino a potencia "
               "instalada.")),
    InputSpec("head_grade", "case", "relative", 0.5, 1.5, 0.01, False, FAMILIES,
              ("Head grade", "Ley de cabeza"),
              ("Grade of the primary payable in the fresh ore. It sets the valuable-mineral content through the "
               "mineral's stoichiometry; the host gangue closes the mass balance.",
               "Ley del elemento pagable principal en el mineral fresco. Fija el contenido de mineral valioso a través "
               "de su estequiometría; la ganga huésped cierra el balance de masa.")),
    InputSpec("collector_gpt", "g/t", "relative", 0.0, 3.0, 0.01, False, FLOTATION_FAMILIES,
              ("Collector dose", "Dosis de colector"),
              ("Collector added per tonne of ore. Valuable minerals respond at a lower dose than gangue, so more "
               "collector raises recovery at first and then lowers the concentrate grade.",
               "Colector agregado por tonelada de mineral. Los minerales valiosos responden a menor dosis que la ganga, "
               "por lo que más colector sube primero la recuperación y luego baja la ley del concentrado.")),
    InputSpec("jg_cm_s", "cm/s", "absolute", 0.5, 2.5, 0.05, False, FLOTATION_FAMILIES,
              ("Gas velocity (rougher)", "Velocidad de gas (rougher)"),
              ("Superficial gas velocity in the rougher cells. It sets the bubble surface area flux and so the rate "
               "constants, and it raises water recovery and the entrainment of fine gangue.",
               "Velocidad superficial de gas en las celdas rougher. Fija el flujo de área superficial de burbujas y por "
               "tanto las constantes cinéticas, y aumenta la recuperación de agua y el arrastre de ganga fina.")),
    InputSpec("rougher_cells", "1", "absolute", 3, 12, 1, True, FLOTATION_FAMILIES,
              ("Rougher cells", "Celdas rougher"),
              ("Number of rougher cells in series. More cells add residence time and approach plug flow, so recovery "
               "rises with diminishing returns.",
               "Número de celdas rougher en serie. Más celdas agregan residencia y se acercan al flujo pistón, por lo que "
               "la recuperación sube con retornos decrecientes.")),
    InputSpec("gravity_bleed", "1", "absolute", 0.1, 0.6, 0.01, False, ("gravity_rougher",),
              ("Gravity bleed", "Purga gravimétrica"),
              ("Fraction of the cyclone underflow sent to the gravity concentrator. Free gold circulates many times, so "
               "a modest bleed recovers much of it, with diminishing returns.",
               "Fracción de la descarga del ciclón enviada al concentrador gravimétrico. El oro libre circula muchas "
               "veces, por lo que una purga moderada recupera gran parte, con retornos decrecientes."),
              display_scale=100.0, display_unit="%"),
    InputSpec("deslime_cut_um", "um", "absolute", 8.0, 45.0, 0.5, False, ("deslime_rougher",),
              ("Desliming cut", "Corte de deslamado"),
              ("Cut size of the desliming cyclone. Finer particles go to tailings as slimes: a coarser cut cleans the "
               "flotation feed and loses more of the fine valuable mineral.",
               "Tamaño de corte del ciclón de deslamado. Las partículas más finas van a relaves como lamas: un corte más "
               "grueso limpia la alimentación a flotación y pierde más mineral valioso fino.")),
)
INPUT_BY_NAME = {spec.name: spec for spec in INPUTS}

RULES: tuple[dict[str, Any], ...] = (
    {"id": "deslime_cut_above_half_target", "families": ["deslime_rougher"], "left": "deslime_cut_um", "relation": "<=",
     "factor": 0.5, "right": "target_p80_um",
     "message": {"en": "The desliming cut must be at most half the grind target; a coarser cut discards the product.",
                 "es": "El corte de deslamado debe ser a lo más la mitad del objetivo de molienda; un corte más grueso "
                       "descarta el producto."}},
)

MESSAGES = {
    "unknown_case": {"en": "Unknown case.", "es": "Caso desconocido."},
    "unknown_input": {"en": "Unknown input.", "es": "Entrada desconocida."},
    "not_applicable": {"en": "This input does not apply to this circuit.", "es": "Esta entrada no aplica a este circuito."},
    "not_a_number": {"en": "The value must be a number.", "es": "El valor debe ser un número."},
    "not_finite": {"en": "The value must be finite.", "es": "El valor debe ser finito."},
    "not_integer": {"en": "The value must be a whole number.", "es": "El valor debe ser un número entero."},
    "out_of_range": {"en": "The value is outside the operating envelope.", "es": "El valor está fuera de la envolvente de operación."},
}


def _case_entry(case: Any) -> dict[str, Any]:
    family = case.plant.family
    primary = case.ore.payables[0]
    nominal = asdict(case.nominal)
    inputs: dict[str, dict[str, Any]] = {}
    for spec in INPUTS:
        if family not in spec.families:
            continue
        base = float(nominal[spec.name])
        if spec.bounds == "relative":
            if base <= 0.0:
                raise ValueError(f"{case.id}: relative input {spec.name} needs a positive nominal")
            # 12 significant digits drop product noise (0.7 * 8.5 = 5.949999999999999); both
            # validators then compare against the same stored numbers.
            low, high, step = (float(f"{f * base:.12g}") for f in (spec.low, spec.high, spec.step))
        else:
            low, high, step = spec.low, spec.high, spec.step
        if not low <= base <= high:
            raise ValueError(f"{case.id}: nominal {spec.name}={base} is outside [{low}, {high}]")
        unit = primary.unit if spec.unit == "case" else spec.unit
        entry: dict[str, Any] = {"min": low, "max": high, "step": step, "unit": unit}
        if spec.integer:
            entry = {"min": int(low), "max": int(high), "step": int(step), "unit": unit}
        inputs[spec.name] = entry
    return {"family": family, "primary": {"species": primary.species, "unit": primary.unit},
            "nominal": nominal, "inputs": inputs}


def _digest(document: dict[str, Any]) -> str:
    body = json.dumps({k: v for k, v in document.items() if k != "digest"}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def build_contract() -> dict[str, Any]:
    """Resolved contract document: declarations, rules, messages, per-case bounds, grid and quadrature."""
    g = grid()
    nodes, weights = np.polynomial.laguerre.laggauss(int(constant("numerics.laguerre_nodes")))
    document: dict[str, Any] = {
        "schema": SCHEMA,
        "fields": list(OPERATING_FIELDS),
        "families": list(FAMILIES),
        "inputs": [
            {"name": s.name, "unit": s.unit, "bounds": s.bounds, "low": s.low, "high": s.high, "step": s.step,
             "integer": s.integer, "families": list(s.families), "label": {"en": s.label[0], "es": s.label[1]},
             "help": {"en": s.help[0], "es": s.help[1]}, "display_scale": s.display_scale, "display_unit": s.display_unit}
            for s in INPUTS
        ],
        "rules": [dict(rule) for rule in RULES],
        "messages": MESSAGES,
        "cases": {case.id: _case_entry(case) for case in CASES},
        "grid": {"upper_um": [float(v) for v in g.upper], "size_um": [float(v) for v in g.size]},
        "laguerre": {"nodes": [float(v) for v in nodes], "weights": [float(v) for v in weights]},
    }
    document["digest"] = _digest(document)
    return document


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def validate(contract: dict[str, Any], case_id: str, values: dict[str, Any]) -> dict[str, Any]:
    """Interpret the resolved contract for one state; missing inputs take the case nominal.

    Returns ``{"accepted", "point", "errors"}``; each error is ``{"code", "input", ...}`` with the value
    and the limit that failed. The browser validator is a line-by-line port of this function.
    """
    case = contract["cases"].get(case_id)
    if case is None:
        return {"accepted": False, "point": None, "errors": [{"code": "unknown_case", "input": None}]}
    declared = {spec["name"]: spec for spec in contract["inputs"]}
    point = dict(case["nominal"])
    errors: list[dict[str, Any]] = []
    for name, value in values.items():
        if name not in declared:
            errors.append({"code": "unknown_input", "input": name})
            continue
        if name not in case["inputs"]:
            if not (_is_number(value) and value == 0):
                errors.append({"code": "not_applicable", "input": name})
            continue
        if not _is_number(value):
            errors.append({"code": "not_a_number", "input": name})
            continue
        if not math.isfinite(value):
            errors.append({"code": "not_finite", "input": name})
            continue
        if declared[name]["integer"] and value != math.floor(value):
            errors.append({"code": "not_integer", "input": name, "value": value})
            continue
        bounds = case["inputs"][name]
        if value < bounds["min"] or value > bounds["max"]:
            errors.append({"code": "out_of_range", "input": name, "value": value, "min": bounds["min"], "max": bounds["max"]})
            continue
        point[name] = int(value) if declared[name]["integer"] else float(value)
    if not errors:
        for rule in contract["rules"]:
            if case["family"] not in rule["families"]:
                continue
            left, limit = point[rule["left"]], rule["factor"] * point[rule["right"]]
            if not left <= limit:
                errors.append({"code": rule["id"], "input": rule["left"], "value": left, "max": limit})
    if errors:
        return {"accepted": False, "point": None, "errors": errors}
    return {"accepted": True, "point": point, "errors": []}


def probe_states(contract: dict[str, Any]) -> list[dict[str, Any]]:
    """Deterministic states that exercise every branch of ``validate`` on every case."""
    probes: list[dict[str, Any]] = [{"case_id": "no_such_case", "values": {}}]
    for case_id, case in contract["cases"].items():
        probes.append({"case_id": case_id, "values": {}})
        probes.append({"case_id": case_id, "values": {"not_an_input": 1.0}})
        probes.append({"case_id": case_id, "values": {"throughput_tph": "720"}})
        probes.append({"case_id": case_id, "values": {"throughput_tph": True}})
        probes.append({"case_id": case_id, "values": {"throughput_tph": math.inf}})
        for name, bounds in case["inputs"].items():
            integer = isinstance(bounds["min"], int)
            outside = 1 if integer else 0.01 * (bounds["max"] - bounds["min"])
            probes.append({"case_id": case_id, "values": {name: bounds["min"]}})
            probes.append({"case_id": case_id, "values": {name: bounds["max"]}})
            probes.append({"case_id": case_id, "values": {name: bounds["min"] - outside}})
            probes.append({"case_id": case_id, "values": {name: bounds["max"] + outside}})
            probes.append({"case_id": case_id, "values": {name: math.nan}})
            if integer:
                probes.append({"case_id": case_id, "values": {name: bounds["min"] + 0.5}})
        for spec in contract["inputs"]:
            if spec["name"] not in case["inputs"]:
                probes.append({"case_id": case_id, "values": {spec["name"]: 1.0}})
                probes.append({"case_id": case_id, "values": {spec["name"]: 0}})
        for rule in contract["rules"]:
            if case["family"] in rule["families"]:
                right = case["inputs"][rule["right"]]["min"]
                left = case["inputs"][rule["left"]]
                probes.append({"case_id": case_id, "values": {rule["right"]: right, rule["left"]: left["max"]}})
                probes.append({"case_id": case_id, "values": {rule["right"]: right,
                                                              rule["left"]: min(left["max"], rule["factor"] * right)}})
    return probes


def encode_value(value: Any) -> Any:
    """Strict JSON has no NaN or infinity; probe files tag them so every harness can restore them."""
    if isinstance(value, float) and not math.isfinite(value):
        return {"non_finite": "nan" if math.isnan(value) else ("inf" if value > 0 else "-inf")}
    return value


def decode_value(value: Any) -> Any:
    if isinstance(value, dict) and set(value) == {"non_finite"}:
        return float(value["non_finite"])
    return value


def verdict(result: dict[str, Any]) -> dict[str, Any]:
    """Order-free summary of a validation result, compared across validators."""
    return {"accepted": result["accepted"], "errors": sorted([e["code"], e["input"] or ""] for e in result["errors"])}


def probe_document(contract: dict[str, Any]) -> dict[str, Any]:
    probes = [{"case_id": p["case_id"], "values": {k: encode_value(v) for k, v in p["values"].items()},
               "expected": verdict(validate(contract, p["case_id"], p["values"]))} for p in probe_states(contract)]
    return {"schema": "oreflow.contract-probes/v1", "digest": contract["digest"], "probes": probes}


def _write(path: Path, document: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, indent=1, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8", newline="\n")


def export_contract(path: Path = CONTRACT_PATH, probes_path: Path = PROBES_PATH) -> dict[str, Any]:
    """Write the resolved contract and its probe verdicts (the browser test replays the probes)."""
    document = build_contract()
    _write(path, document)
    _write(probes_path, probe_document(document))
    return document


def load_contract(path: Path = CONTRACT_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))
