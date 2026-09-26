"""Typed inputs of the process engine: ore, plant and operating point.

Case definitions in ``pipeline/cases/catalog.py`` build these objects; case artifacts embed them as
plain dictionaries so that the browser engine recomputes from exactly the same inputs.
Every field name carries its unit where it is not dimensionless.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field, fields, replace
from typing import Any


@dataclass(frozen=True)
class Flotability:
    """First-order flotation response of liberated grains of one mineral."""

    floatability: float            # P: rate constant per unit bubble surface area flux (1)
    optimum_size_um: float         # size of fastest flotation
    fine_width: float              # log-normal width below the optimum (ln units)
    coarse_width: float            # log-normal width above the optimum (ln units)
    half_dose_gpt: float           # collector dose at half response (g/t)
    unresponsive_fraction: float = 0.0  # response that needs no collector (natural floatability)


@dataclass(frozen=True)
class Carrier:
    """A mineral carrying a share of a payable species."""

    mineral: str
    share: float                   # fraction of the species' head grade carried by this mineral
    mode: str = "stoichiometric"   # "stoichiometric": fraction derived; "trace": content derived


@dataclass(frozen=True)
class Payable:
    species: str                   # element or oxide, for example Cu, Au, P2O5
    unit: str                      # "%" or "g/t"
    carriers: tuple[Carrier, ...]
    head_grade: float              # nominal head grade in ``unit``; the primary one is a control


@dataclass(frozen=True)
class MineralSpec:
    id: str                        # key into engine/data/minerals.json
    fraction: float = 0.0          # declared ore mass fraction (gangue proportion or trace carrier)
    grindability: float = 1.0      # multiplier on the energy-specific selection function (1)
    liberation_size_um: float = 0.0    # size at 50% liberation (valuable minerals)
    liberation_slope: float = 1.0      # exponent of the liberation curve (1)
    composite_content: float = 0.0     # mass fraction of this mineral in its binary composites
    host: str = ""                 # gangue mineral id forming the composites
    flotation: Flotability | None = None
    magnetic: bool = False
    gravity: bool = False


@dataclass(frozen=True)
class Ore:
    minerals: tuple[MineralSpec, ...]
    payables: tuple[Payable, ...]  # primary first
    work_index_kwh_t: float        # Bond ball-mill work index
    crushing_work_index_kwh_t: float
    quality_species: tuple[str, ...] = ()   # impurity assays reported in products, e.g. MgO, SiO2


@dataclass(frozen=True)
class Crusher:
    feed_f80_um: float
    feed_slope: float              # Rosin-Rammler slope of the crusher feed (1)
    k1_css: float                  # K1 as a multiple of the closed-side setting
    k2_css: float                  # K2 as a multiple of the closed-side setting
    k3: float
    beta0: float
    beta1: float
    beta2: float


@dataclass(frozen=True)
class Mill:
    installed_power_kw: float
    alpha0: float                  # t/kWh with sizes in um
    alpha1: float
    alpha2: float
    critical_size_um: float
    reference_work_index_kwh_t: float
    beta0: float
    beta1: float
    beta2: float
    discharge_solids: float        # mass fraction of solids at the mill discharge


@dataclass(frozen=True)
class Cyclone:
    sharpness: float               # Rosin-Rammler partition exponent m (1)
    underflow_solids: float        # mass fraction of solids in the underflow
    diameter_cm: float
    inlet_cm: float
    vortex_cm: float
    apex_cm: float
    free_vortex_height_cm: float


@dataclass(frozen=True)
class Bank:
    cell_volume_m3: float
    gas_holdup: float              # volume fraction of gas in the pulp
    cells: int = 0                 # fixed count (cleaner); the rougher count is a control
    jg_cm_s: float = 0.0           # fixed gas velocity (cleaner); the rougher one is a control
    feed_solids: float = 0.0       # target solids fraction after dilution (cleaner)
    wash_factor: float = 1.0       # multiplier on the degree of entrainment (froth washing)


@dataclass(frozen=True)
class FlotationPlant:
    rougher: Bank
    cleaner: Bank
    d32_base_mm: float             # Sauter bubble size at zero gas velocity (extrapolated)
    d32_slope_mm_per_cm_s: float   # increase of D32 with Jg
    water_floatability: float      # water carriage per unit bubble surface area flux (1)
    entrainment_size_um: float     # Savassi xi
    drainage: float                # Savassi delta
    recleaner: Bank | None = None  # second cleaning stage; its tails return to the cleaner feed
    regrind_energy_kwh_t: float = 0.0   # open-circuit regrind of rougher concentrate, per t of regrind feed


@dataclass(frozen=True)
class GravityPlant:
    max_recovery: float            # per-pass recovery of coarse liberated gold (fraction)
    size_scale_um: float           # size at which recovery reaches 63% of the maximum
    composite_recovery: float      # per-pass recovery of gold locked in composites (fraction)
    gangue_yield: float            # mass yield of gangue to the gravity concentrate (fraction)


@dataclass(frozen=True)
class MagneticPlant:
    max_capture: float             # capture of liberated magnetite (fraction)
    fine_scale_um: float           # size scale of the ultrafine capture loss
    composite_threshold: float     # magnetite content at 63% composite capture
    entrapment_base: float         # gangue entrapment at coarse sizes (fraction)
    entrapment_fines: float        # additional gangue entrapment for ultrafines (fraction)
    entrapment_scale_um: float
    cleaner_factor: float          # entrapment multiplier in the cleaner drum
    concentrate_solids: float          # mass fraction of solids in the magnetic concentrate


@dataclass(frozen=True)
class DeslimePlant:
    sharpness: float
    bypass: float                  # fraction of feed water (and fines) to the underflow


@dataclass(frozen=True)
class GradeSpec:
    species: str
    minimum: float                 # in the species unit


@dataclass(frozen=True)
class Plant:
    family: str                    # rougher | gravity_rougher | magnetic | deslime_rougher
    crusher: Crusher
    mill: Mill
    cyclone: Cyclone
    flotation: FlotationPlant | None = None
    gravity: GravityPlant | None = None
    magnetic: MagneticPlant | None = None
    deslime: DeslimePlant | None = None
    grade_spec: GradeSpec | None = None
    water_limit_m3_t: float = 0.0


@dataclass(frozen=True)
class OperatingPoint:
    throughput_tph: float
    target_p80_um: float
    circulating_load: float        # underflow solids over new-feed solids (fraction, 2.5 = 250%)
    water_m3_t: float              # circuit water leaving with the cyclone overflow, per t of ore
    crusher_css_mm: float
    work_index_kwh_t: float
    head_grade: float              # primary payable, in its unit
    collector_gpt: float = 0.0
    jg_cm_s: float = 0.0
    rougher_cells: int = 0
    gravity_bleed: float = 0.0     # fraction of cyclone underflow sent to the gravity unit
    deslime_cut_um: float = 0.0

    def with_values(self, **changes: Any) -> "OperatingPoint":
        return replace(self, **changes)


OPERATING_FIELDS = tuple(f.name for f in fields(OperatingPoint))


def to_dict(obj: Any) -> dict[str, Any]:
    return asdict(obj)


def _build(cls: type, data: dict[str, Any] | None) -> Any:
    if data is None:
        return None
    return cls(**data)


def ore_from_dict(data: dict[str, Any]) -> Ore:
    minerals = tuple(
        MineralSpec(**{**m, "flotation": _build(Flotability, m.get("flotation"))}) for m in data["minerals"]
    )
    payables = tuple(
        Payable(p["species"], p["unit"], tuple(Carrier(**c) for c in p["carriers"]), p["head_grade"])
        for p in data["payables"]
    )
    return Ore(minerals, payables, data["work_index_kwh_t"], data["crushing_work_index_kwh_t"],
               tuple(data.get("quality_species", ())))


def plant_from_dict(data: dict[str, Any]) -> Plant:
    flotation = data.get("flotation")
    return Plant(
        family=data["family"],
        crusher=Crusher(**data["crusher"]),
        mill=Mill(**data["mill"]),
        cyclone=Cyclone(**data["cyclone"]),
        flotation=None if flotation is None else FlotationPlant(
            rougher=Bank(**flotation["rougher"]), cleaner=Bank(**flotation["cleaner"]),
            recleaner=_build(Bank, flotation.get("recleaner")),
            **{k: v for k, v in flotation.items() if k not in {"rougher", "cleaner", "recleaner"}}),
        gravity=_build(GravityPlant, data.get("gravity")),
        magnetic=_build(MagneticPlant, data.get("magnetic")),
        deslime=_build(DeslimePlant, data.get("deslime")),
        grade_spec=_build(GradeSpec, data.get("grade_spec")),
        water_limit_m3_t=data.get("water_limit_m3_t", 0.0),
    )


def operating_from_dict(data: dict[str, Any]) -> OperatingPoint:
    return OperatingPoint(**{k: data[k] for k in OPERATING_FIELDS if k in data})


@dataclass
class Flags:
    items: list[dict[str, str]] = field(default_factory=list)

    def add(self, code: str, message: str) -> None:
        if all(item["code"] != code for item in self.items):
            self.items.append({"code": code, "message": message})
