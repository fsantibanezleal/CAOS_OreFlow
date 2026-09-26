"""OreFlow's twelve authored cases and their single-factor variants.

Every case is an authored scenario: its ore, plant and operating values are chosen inside the ranges
recorded in the 2026-09-26 research dossier (transcribed into docs/methodologies/), each with a source note, and none is a
plant measurement or a calibrated plant model. Each variant changes exactly one declared input of the
operating point relative to the case nominal (requirement PE-32).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..engine.model import (Bank, Carrier, Crusher, Cyclone, DeslimePlant, Flotability, FlotationPlant, GradeSpec,
                            GravityPlant, MagneticPlant, Mill, MineralSpec, OperatingPoint, Ore, Payable, Plant)

SOURCES = {
    "breakage": "Moly-Cop Tools energy-specific selection (alpha0 0.0091 t/kWh, alpha1 0.651, alpha2 2.5, d_crit 6514 um) and its documented alternative breakage set (beta0 0.4, beta1 0.65, beta2 4.02); dossier section 1.4.",
    "crusher": "Whiten classification K1 0.5 to 0.95 CSS, K2 1.7 to 3.5 CSS, K3 about 2.3; dossier section 1.3.",
    "cyclone": "Plitt geometry ratios typical of mineral-processing cyclones; sharpness and underflow density authored; dossier section 2.",
    "flotation": "k from bubble surface area flux (Gorain et al. 1997), Savassi entrainment, perfect-mixer banks; floatability and widths authored within Trahar (1981) size behaviour; dossier section 3.",
    "collector": "Saturating collector response with gangue saturating at higher dose (chalcopyrite/pyrite critical review, PMC9572913); dossier section 3.5.",
    "gravity": "Gravity bleed of cyclone underflow and gold circulating load (Laplante and Staunton, AMIRA P420B); dossier section 4.",
    "magnetic": "LIMS magnetite recovery above 98% and grade rising with finer grind (Muthaphuli 2014); dossier section 5.",
    "phosphate": "Desliming below about 20 um and fatty-acid flotation to about 35% P2O5; dossier section 6 (secondary source).",
    "water": "Process-water capacity per tonne of ore (pumping and thickener capacity), authored 5% above each case's nominal requirement; it is the water constraint of the operating-point optimizer.",
    "kpi": "Nominal KPI ranges are typical practice ranges from the dossier section 3.7 and the cited sources; they are plausibility gates, not predictions.",
}


@dataclass(frozen=True)
class CaseDef:
    id: str
    category: str
    title: tuple[str, str]
    description: tuple[str, str]
    question: tuple[str, str]
    ore: Ore
    plant: Plant
    nominal: OperatingPoint
    variants: tuple[dict[str, Any], ...]
    kpi_ranges: dict[str, tuple[float, float]]
    sources: tuple[str, ...]
    provenance: str = "authored scenario; parameters inside cited ranges; not plant-calibrated"
    notes: tuple[str, ...] = field(default_factory=tuple)


def _mill(power_kw: float, wi_ref: float = 12.0) -> Mill:
    return Mill(installed_power_kw=power_kw, alpha0=0.0091, alpha1=0.651, alpha2=2.5, critical_size_um=6514.0,
                reference_work_index_kwh_t=wi_ref, beta0=0.4, beta1=0.65, beta2=4.02, discharge_solids=0.72)


def _crusher(feed_f80_um: float = 60000.0) -> Crusher:
    return Crusher(feed_f80_um=feed_f80_um, feed_slope=0.9, k1_css=0.8, k2_css=2.3, k3=2.3, beta0=0.4, beta1=0.7, beta2=3.5)


def _cyclone(diameter_cm: float, sharpness: float = 2.0, underflow_solids: float = 0.75) -> Cyclone:
    return Cyclone(sharpness=sharpness, underflow_solids=underflow_solids, diameter_cm=diameter_cm,
                   inlet_cm=0.256 * diameter_cm, vortex_cm=0.335 * diameter_cm, apex_cm=0.197 * diameter_cm,
                   free_vortex_height_cm=2.95 * diameter_cm)


def _flotation(rougher_m3: float, cleaner_m3: float, recleaner_m3: float | None, regrind_kwh_t: float,
               xi_um: float = 30.0, cleaner_wash: float = 0.3, recleaner_wash: float = 0.15, rougher_solids: float = 0.0,
               cleaner_solids: float = 0.22, recleaner_solids: float = 0.2) -> FlotationPlant:
    return FlotationPlant(
        rougher=Bank(cell_volume_m3=rougher_m3, gas_holdup=0.12, feed_solids=rougher_solids),
        cleaner=Bank(cell_volume_m3=cleaner_m3, gas_holdup=0.12, cells=6, jg_cm_s=1.0, feed_solids=cleaner_solids, wash_factor=cleaner_wash),
        recleaner=None if recleaner_m3 is None else Bank(cell_volume_m3=recleaner_m3, gas_holdup=0.12, cells=4, jg_cm_s=0.9,
                                                        feed_solids=recleaner_solids, wash_factor=recleaner_wash),
        regrind_energy_kwh_t=regrind_kwh_t, d32_base_mm=0.8, d32_slope_mm_per_cm_s=0.45, water_floatability=2.0e-6,
        entrainment_size_um=xi_um, drainage=1.0)


def _sulphide(p: float, optimum: float = 40.0, fine: float = 1.6, coarse: float = 0.8, half: float = 12.0, natural: float = 0.05) -> Flotability:
    return Flotability(floatability=p, optimum_size_um=optimum, fine_width=fine, coarse_width=coarse, half_dose_gpt=half,
                       unresponsive_fraction=natural)


QUARTZ = Flotability(floatability=1.0e-6, optimum_size_um=30.0, fine_width=1.2, coarse_width=0.8, half_dose_gpt=150.0)
PYRITE_DEPRESSED = Flotability(floatability=1.5e-5, optimum_size_um=40.0, fine_width=1.6, coarse_width=0.8, half_dose_gpt=40.0)


def _flotation_variants(collector_factor: float = 1.6) -> tuple[dict[str, Any], ...]:
    return (
        {"id": "nominal", "label": ("Nominal design", "Diseño nominal"), "change": {}},
        {"id": "harder_ore", "label": ("Harder ore (+25% work index)", "Mineral más duro (+25% índice de trabajo)"), "change": {"work_index_kwh_t": 1.25}},
        {"id": "coarser_grind", "label": ("Coarser grind target (+35% P80)", "Molienda más gruesa (+35% P80)"), "change": {"target_p80_um": 1.35}},
        {"id": "higher_throughput", "label": ("Higher throughput (+25%)", "Mayor tratamiento (+25%)"), "change": {"throughput_tph": 1.25}},
        {"id": "more_collector", "label": (f"More collector (+{round(100 * (collector_factor - 1))}%)", f"Más colector (+{round(100 * (collector_factor - 1))}%)"), "change": {"collector_gpt": collector_factor}},
        {"id": "more_air", "label": ("More air (+40% gas velocity)", "Más aire (+40% velocidad de gas)"), "change": {"jg_cm_s": 1.4}},
    )


def _gravity_variants() -> tuple[dict[str, Any], ...]:
    return (
        {"id": "nominal", "label": ("Nominal design", "Diseño nominal"), "change": {}},
        {"id": "harder_ore", "label": ("Harder ore (+25% work index)", "Mineral más duro (+25% índice de trabajo)"), "change": {"work_index_kwh_t": 1.25}},
        {"id": "coarser_grind", "label": ("Coarser grind target (+35% P80)", "Molienda más gruesa (+35% P80)"), "change": {"target_p80_um": 1.35}},
        {"id": "higher_throughput", "label": ("Higher throughput (+25%)", "Mayor tratamiento (+25%)"), "change": {"throughput_tph": 1.25}},
        {"id": "larger_bleed", "label": ("Larger gravity bleed (x2)", "Mayor purga gravimétrica (x2)"), "change": {"gravity_bleed": 2.0}},
        {"id": "more_collector", "label": ("More collector (+60%)", "Más colector (+60%)"), "change": {"collector_gpt": 1.6}},
    )


def _magnetic_variants() -> tuple[dict[str, Any], ...]:
    return (
        {"id": "nominal", "label": ("Nominal design", "Diseño nominal"), "change": {}},
        {"id": "harder_ore", "label": ("Harder ore (+25% work index)", "Mineral más duro (+25% índice de trabajo)"), "change": {"work_index_kwh_t": 1.25}},
        {"id": "coarser_grind", "label": ("Coarser grind target (+35% P80)", "Molienda más gruesa (+35% P80)"), "change": {"target_p80_um": 1.35}},
        {"id": "finer_grind", "label": ("Finer grind target (-25% P80)", "Molienda más fina (-25% P80)"), "change": {"target_p80_um": 0.75}},
        {"id": "higher_throughput", "label": ("Higher throughput (+25%)", "Mayor tratamiento (+25%)"), "change": {"throughput_tph": 1.25}},
        {"id": "finer_crusher", "label": ("Finer crusher setting (-20% CSS)", "Chancado más fino (-20% CSS)"), "change": {"crusher_css_mm": 0.8}},
    )


def _deslime_variants() -> tuple[dict[str, Any], ...]:
    return (
        {"id": "nominal", "label": ("Nominal design", "Diseño nominal"), "change": {}},
        {"id": "harder_ore", "label": ("Harder ore (+25% work index)", "Mineral más duro (+25% índice de trabajo)"), "change": {"work_index_kwh_t": 1.25}},
        {"id": "coarser_grind", "label": ("Coarser grind target (+35% P80)", "Molienda más gruesa (+35% P80)"), "change": {"target_p80_um": 1.35}},
        {"id": "higher_throughput", "label": ("Higher throughput (+25%)", "Mayor tratamiento (+25%)"), "change": {"throughput_tph": 1.25}},
        {"id": "coarser_deslime", "label": ("Coarser desliming cut (+50%)", "Corte de deslamado más grueso (+50%)"), "change": {"deslime_cut_um": 1.5}},
        {"id": "more_collector", "label": ("More collector (+40%)", "Más colector (+40%)"), "change": {"collector_gpt": 1.4}},
    )


def _copper(cid: str, category: str, title: tuple[str, str], description: tuple[str, str], question: tuple[str, str], *,
            grade: float, wi: float, tph: float, p80: float, power_kw: float, rougher_m3: float, cleaner_m3: float,
            recleaner_m3: float, cyclone_cm: float, liberation_um: float, composite: float, floatability: float,
            collector: float = 25.0, pyrite: float = 0.025, regrind: float = 6.0, extra_minerals: tuple[MineralSpec, ...] = (),
            extra_payables: tuple[Payable, ...] = (), xi_um: float = 30.0, kpi: dict[str, tuple[float, float]] | None = None,
            water: float = 2.1, quality: tuple[str, ...] = (), water_limit: float) -> CaseDef:
    ore = Ore(
        minerals=(MineralSpec(id="chalcopyrite", grindability=1.1, liberation_size_um=liberation_um, liberation_slope=1.5,
                              composite_content=composite, host="quartz", flotation=_sulphide(floatability)),
                  *extra_minerals,
                  MineralSpec(id="pyrite", fraction=pyrite, grindability=0.8, flotation=PYRITE_DEPRESSED),
                  MineralSpec(id="quartz", fraction=0.0, flotation=QUARTZ)),
        payables=(Payable("Cu", "%", (Carrier("chalcopyrite", 1.0),), grade), *extra_payables),
        work_index_kwh_t=wi, crushing_work_index_kwh_t=wi * 1.1, quality_species=quality)
    plant = Plant(family="rougher", crusher=_crusher(), mill=_mill(power_kw), cyclone=_cyclone(cyclone_cm),
                  flotation=_flotation(rougher_m3, cleaner_m3, recleaner_m3, regrind, xi_um=xi_um),
                  grade_spec=GradeSpec("Cu", 24.0), water_limit_m3_t=water_limit)
    nominal = OperatingPoint(throughput_tph=tph, target_p80_um=p80, circulating_load=2.5, water_m3_t=water, crusher_css_mm=8.0,
                             work_index_kwh_t=wi, head_grade=grade, collector_gpt=collector, jg_cm_s=1.4, rougher_cells=8)
    return CaseDef(cid, category, title, description, question, ore, plant, nominal, _flotation_variants(),
                   kpi or {"recovery_pct": (84.0, 94.0), "concentrate_grade": (24.0, 32.0)},
                   ("breakage", "crusher", "cyclone", "flotation", "collector", "water", "kpi"))


def _cases() -> tuple[CaseDef, ...]:
    cases: list[CaseDef] = []
    cases.append(_copper(
        "copper_porphyry_soft", "liberation", ("Soft copper porphyry", "Pórfido de cobre blando"),
        ("A soft porphyry with chalcopyrite disseminated in quartz-sericite gangue and lime-depressed pyrite; grinding energy buys liberation cheaply.",
         "Un pórfido blando con calcopirita diseminada en ganga de cuarzo y sericita, y pirita deprimida con cal; la energía de molienda compra liberación a bajo costo."),
        ("How far is it worth grinding when energy is cheap per micron?", "¿Hasta dónde conviene moler cuando cada micrón cuesta poca energía?"),
        grade=0.74, wi=11.0, tph=720.0, p80=150.0, power_kw=7300.0, rougher_m3=130.0, cleaner_m3=20.0, recleaner_m3=10.0,
        cyclone_cm=50.8, liberation_um=110.0, composite=0.35, floatability=2.8e-4, water_limit=2.29))
    cases.append(_copper(
        "copper_porphyry_hard", "liberation", ("Hard copper porphyry", "Pórfido de cobre duro"),
        ("A competent porphyry at a high work index; the installed ball-mill power binds and harder ore coarsens the grind.",
         "Un pórfido competente de alto índice de trabajo; la potencia instalada del molino limita y un mineral más duro engruesa la molienda."),
        ("What happens to recovery when the mill runs out of power?", "¿Qué le pasa a la recuperación cuando el molino se queda sin potencia?"),
        grade=0.52, wi=18.5, tph=510.0, p80=165.0, power_kw=7400.0, rougher_m3=100.0, cleaner_m3=14.0, recleaner_m3=8.0,
        cyclone_cm=50.8, liberation_um=100.0, composite=0.35, floatability=3.2e-4, water_limit=2.26,
        kpi={"recovery_pct": (82.0, 93.0), "concentrate_grade": (22.0, 32.0)}))
    cases.append(CaseDef(
        "gold_free_milling", "classification", ("Free-milling gold with gravity", "Oro de molienda libre con gravimetría"),
        ("Free gold liberated in the grinding circuit is dense and malleable, so cyclones return it to the mill; a gravity unit on an underflow bleed recovers it before flotation takes the gold held in pyrite.",
         "El oro libre liberado en la molienda es denso y maleable, por lo que los ciclones lo devuelven al molino; una unidad gravimétrica en una purga del underflow lo recupera antes de que la flotación tome el oro contenido en pirita."),
        ("How much gold does a gravity bleed capture from the circulating load?", "¿Cuánto oro captura una purga gravimétrica de la carga circulante?"),
        Ore(minerals=(MineralSpec(id="electrum", grindability=0.15, liberation_size_um=400.0, liberation_slope=1.5, composite_content=0.1,
                                  host="quartz", flotation=_sulphide(2.5e-4, optimum=60.0, coarse=0.6), gravity=True),
                      MineralSpec(id="pyrite", fraction=0.03, grindability=0.8, liberation_size_um=150.0, liberation_slope=1.5,
                                  composite_content=0.5, host="quartz", flotation=_sulphide(2.0e-4, half=15.0)),
                      MineralSpec(id="quartz", fraction=0.0, flotation=QUARTZ)),
            payables=(Payable("Au", "g/t", (Carrier("electrum", 0.45), Carrier("pyrite", 0.55, "trace")), 3.4),),
            work_index_kwh_t=15.5, crushing_work_index_kwh_t=17.0),
        Plant(family="gravity_rougher", crusher=_crusher(), mill=_mill(4600.0), cyclone=_cyclone(25.4),
              flotation=_flotation(45.0, 6.0, None, 0.0), grade_spec=GradeSpec("Au", 40.0), water_limit_m3_t=2.21,
              gravity=GravityPlant(max_recovery=0.8, size_scale_um=30.0, composite_recovery=0.03, gangue_yield=0.001)),
        OperatingPoint(throughput_tph=260.0, target_p80_um=106.0, circulating_load=2.5, water_m3_t=2.1, crusher_css_mm=8.0,
                       work_index_kwh_t=15.5, head_grade=3.4, collector_gpt=40.0, jg_cm_s=1.4, rougher_cells=7, gravity_bleed=0.3),
        _gravity_variants(), {"recovery_pct": (85.0, 97.0), "gravity_recovery_pct": (25.0, 70.0)},
        ("breakage", "crusher", "cyclone", "gravity", "flotation", "water", "kpi")))
    cases.append(CaseDef(
        "iron_magnetite_fine", "liberation", ("Fine magnetite concentration", "Concentración de magnetita fina"),
        ("A magnetite ore ground in closed circuit and upgraded by low-intensity magnetic drums; magnetite is recovered even in composites, so concentrate iron grade follows liberation and therefore the grind.",
         "Una magnetita molida en circuito cerrado y concentrada en tambores magnéticos de baja intensidad; la magnetita se recupera incluso en mixtos, por lo que la ley de hierro sigue a la liberación y por tanto a la molienda."),
        ("How fine must magnetite be ground to reach a pellet-feed grade?", "¿Qué tan fina debe molerse la magnetita para alcanzar ley de pellet feed?"),
        Ore(minerals=(MineralSpec(id="magnetite", grindability=0.9, liberation_size_um=130.0, liberation_slope=2.0, composite_content=0.5,
                                  host="silicate_fe", magnetic=True),
                      MineralSpec(id="silicate_fe", fraction=0.0)),
            payables=(Payable("Fe", "%", (Carrier("magnetite", 1.0),), 26.5),),
            work_index_kwh_t=13.5, crushing_work_index_kwh_t=15.0, quality_species=("SiO2",)),
        Plant(family="magnetic", crusher=_crusher(), mill=_mill(20300.0), cyclone=_cyclone(25.4),
              magnetic=MagneticPlant(max_capture=0.995, fine_scale_um=1.5, composite_threshold=0.1, entrapment_base=0.02,
                                     entrapment_fines=0.12, entrapment_scale_um=12.0, cleaner_factor=0.4, concentrate_solids=0.6),
              grade_spec=GradeSpec("Fe", 65.0), water_limit_m3_t=2.52),
        OperatingPoint(throughput_tph=920.0, target_p80_um=60.0, circulating_load=2.5, water_m3_t=2.4, crusher_css_mm=8.0,
                       work_index_kwh_t=13.5, head_grade=26.5),
        _magnetic_variants(), {"recovery_pct": (70.0, 92.0), "concentrate_grade": (63.0, 70.0), "magnetite_recovery_pct": (90.0, 99.5)},
        ("breakage", "crusher", "cyclone", "magnetic", "water", "kpi")))
    cases.append(CaseDef(
        "nickel_sulphide", "classification", ("Nickel sulphide with serpentine slimes", "Sulfuro de níquel con lamas de serpentina"),
        ("Pentlandite in a serpentinised ultramafic host; soft serpentine grinds to slimes that entrain into the froth and carry MgO, the penalty element for the smelter.",
         "Pentlandita en una roca ultramáfica serpentinizada; la serpentina blanda se muele a lamas que se arrastran a la espuma y aportan MgO, el elemento penalizado por la fundición."),
        ("How do slimes set the grade-recovery compromise?", "¿Cómo fijan las lamas el compromiso ley-recuperación?"),
        Ore(minerals=(MineralSpec(id="pentlandite", grindability=1.0, liberation_size_um=70.0, liberation_slope=1.5, composite_content=0.35,
                                  host="lizardite", flotation=_sulphide(1.9e-4, optimum=50.0, fine=1.1, half=15.0)),
                      MineralSpec(id="pyrrhotite", fraction=0.04, grindability=1.0,
                                  flotation=Flotability(floatability=6.0e-5, optimum_size_um=40.0, fine_width=1.6, coarse_width=0.8, half_dose_gpt=30.0)),
                      MineralSpec(id="lizardite", fraction=0.0, grindability=2.0, flotation=Flotability(floatability=2.0e-6, optimum_size_um=20.0, fine_width=1.2, coarse_width=0.8, half_dose_gpt=200.0))),
            payables=(Payable("Ni", "%", (Carrier("pentlandite", 1.0),), 1.2),),
            work_index_kwh_t=14.0, crushing_work_index_kwh_t=15.5, quality_species=("MgO",)),
        Plant(family="rougher", crusher=_crusher(), mill=_mill(3600.0), cyclone=_cyclone(38.1),
              flotation=_flotation(80.0, 12.0, 6.0, 4.0, xi_um=40.0), grade_spec=GradeSpec("Ni", 12.0), water_limit_m3_t=3.22),
        OperatingPoint(throughput_tph=430.0, target_p80_um=106.0, circulating_load=2.5, water_m3_t=2.6, crusher_css_mm=8.0,
                       work_index_kwh_t=14.0, head_grade=1.2, collector_gpt=45.0, jg_cm_s=1.3, rougher_cells=8),
        _flotation_variants(), {"recovery_pct": (65.0, 88.0), "concentrate_grade": (11.0, 22.0)},
        ("breakage", "crusher", "cyclone", "flotation", "collector", "water", "kpi")))
    cases.append(CaseDef(
        "phosphate_clay", "classification", ("Phosphate with clay slimes", "Fosfato con lamas arcillosas"),
        ("An igneous phosphate with clay: the grinding overflow is deslimed below about 20 um before fatty-acid flotation of apatite, so the desliming cut trades lost P2O5 against a cleaner flotation feed.",
         "Un fosfato ígneo con arcilla: el rebose de molienda se deslama bajo unos 20 um antes de flotar la apatita con ácidos grasos, por lo que el corte de deslamado cambia P2O5 perdido por una alimentación más limpia a flotación."),
        ("What does the desliming cut cost in phosphate?", "¿Cuánto fosfato cuesta el corte de deslamado?"),
        Ore(minerals=(MineralSpec(id="fluorapatite", grindability=1.4, liberation_size_um=280.0, liberation_slope=1.8, composite_content=0.5,
                                  host="quartz", flotation=Flotability(floatability=1.8e-4, optimum_size_um=70.0, fine_width=1.3, coarse_width=0.7, half_dose_gpt=250.0, unresponsive_fraction=0.02)),
                      MineralSpec(id="kaolinite", fraction=0.12, grindability=4.0, flotation=Flotability(floatability=2.0e-6, optimum_size_um=15.0, fine_width=1.2, coarse_width=0.8, half_dose_gpt=1500.0)),
                      MineralSpec(id="calcite", fraction=0.05, grindability=1.5, flotation=Flotability(floatability=6.0e-5, optimum_size_um=60.0, fine_width=1.2, coarse_width=0.8, half_dose_gpt=900.0)),
                      MineralSpec(id="quartz", fraction=0.0, flotation=QUARTZ)),
            payables=(Payable("P2O5", "%", (Carrier("fluorapatite", 1.0),), 11.4),),
            work_index_kwh_t=8.5, crushing_work_index_kwh_t=9.5),
        Plant(family="deslime_rougher", crusher=_crusher(), mill=_mill(3100.0), cyclone=_cyclone(91.4),
              flotation=_flotation(110.0, 30.0, 20.0, 0.0, xi_um=35.0, rougher_solids=0.33, cleaner_solids=0.3, recleaner_solids=0.3), deslime=DeslimePlant(sharpness=2.5, bypass=0.12),
              grade_spec=GradeSpec("P2O5", 32.0), water_limit_m3_t=4.98),
        OperatingPoint(throughput_tph=470.0, target_p80_um=150.0, circulating_load=2.2, water_m3_t=2.8, crusher_css_mm=8.0,
                       work_index_kwh_t=8.5, head_grade=11.4, collector_gpt=500.0, jg_cm_s=1.2, rougher_cells=7, deslime_cut_um=20.0),
        _deslime_variants(), {"recovery_pct": (50.0, 82.0), "concentrate_grade": (29.0, 37.0), "flotation_recovery_pct": (78.0, 95.0), "slimes_loss_pct": (5.0, 25.0)},
        ("breakage", "crusher", "cyclone", "phosphate", "flotation", "water", "kpi")))
    cases.append(_copper(
        "copper_molybdenum", "flotation", ("Copper-molybdenum bulk flotation", "Flotación colectiva cobre-molibdeno"),
        ("A porphyry floated as a bulk Cu-Mo concentrate; molybdenite is naturally hydrophobic but platy and fine, so it recovers a few points below copper.",
         "Un pórfido flotado como concentrado colectivo Cu-Mo; la molibdenita es hidrófoba natural pero laminar y fina, por lo que se recupera unos puntos bajo el cobre."),
        ("Why does molybdenite trail copper in the same froth?", "¿Por qué la molibdenita queda detrás del cobre en la misma espuma?"),
        grade=0.61, wi=16.2, tph=640.0, p80=150.0, power_kw=9500.0, rougher_m3=120.0, cleaner_m3=18.0, recleaner_m3=9.0,
        cyclone_cm=50.8, liberation_um=100.0, composite=0.35, floatability=2.7e-4, water_limit=2.27,
        extra_minerals=(MineralSpec(id="molybdenite", grindability=1.2, liberation_size_um=60.0, liberation_slope=1.5, composite_content=0.3,
                                    host="quartz", flotation=Flotability(floatability=2.6e-4, optimum_size_um=35.0, fine_width=1.5, coarse_width=0.7,
                                                                        half_dose_gpt=12.0, unresponsive_fraction=0.6)),),
        extra_payables=(Payable("Mo", "%", (Carrier("molybdenite", 1.0),), 0.022),),
        kpi={"recovery_pct": (84.0, 93.0), "concentrate_grade": (22.0, 31.0), "recovery_Mo_pct": (60.0, 90.0)}))
    cases.append(CaseDef(
        "copper_oxide", "flotation", ("Oxide copper by sulphidisation", "Óxido de cobre por sulfidización"),
        ("A malachite ore floated after sulphidisation, with part of the copper in chrysocolla that barely floats; recovery is capped by mineralogy, not by the circuit.",
         "Un mineral de malaquita flotado tras sulfidización, con parte del cobre en crisocola que casi no flota; la recuperación queda limitada por la mineralogía, no por el circuito."),
        ("What limits oxide-copper recovery when reagent is not the constraint?", "¿Qué limita la recuperación de óxidos de cobre cuando el reactivo no es la restricción?"),
        Ore(minerals=(MineralSpec(id="malachite", grindability=1.3, liberation_size_um=70.0, liberation_slope=1.5, composite_content=0.2,
                                  host="quartz", flotation=_sulphide(2.2e-4, half=60.0, natural=0.0)),
                      MineralSpec(id="kaolinite", fraction=0.2, grindability=4.0, flotation=Flotability(floatability=1.2e-5, optimum_size_um=15.0, fine_width=1.2, coarse_width=0.8, half_dose_gpt=300.0)),
                      MineralSpec(id="chrysocolla", grindability=1.5, flotation=Flotability(floatability=1.0e-5, optimum_size_um=40.0, fine_width=1.4, coarse_width=0.8, half_dose_gpt=200.0)),
                      MineralSpec(id="quartz", fraction=0.0, flotation=QUARTZ)),
            payables=(Payable("Cu", "%", (Carrier("malachite", 0.8), Carrier("chrysocolla", 0.2)), 1.05),),
            work_index_kwh_t=12.5, crushing_work_index_kwh_t=13.5),
        Plant(family="rougher", crusher=_crusher(), mill=_mill(6100.0), cyclone=_cyclone(50.8),
              flotation=_flotation(110.0, 16.0, 8.0, 4.0, xi_um=60.0, cleaner_wash=0.6, recleaner_wash=0.45), grade_spec=GradeSpec("Cu", 20.0), water_limit_m3_t=2.51),
        OperatingPoint(throughput_tph=580.0, target_p80_um=140.0, circulating_load=2.5, water_m3_t=2.2, crusher_css_mm=8.0,
                       work_index_kwh_t=12.5, head_grade=1.05, collector_gpt=150.0, jg_cm_s=1.4, rougher_cells=8),
        _flotation_variants(), {"recovery_pct": (60.0, 82.0), "concentrate_grade": (18.0, 32.0)},
        ("breakage", "crusher", "cyclone", "flotation", "collector", "water", "kpi")))
    cases.append(CaseDef(
        "zinc_sulfide", "flotation", ("Zinc sulphide", "Sulfuro de zinc"),
        ("An iron-bearing sphalerite activated with copper sulphate and floated away from lime-depressed pyrite; the high head grade makes the grade-recovery separation explicit.",
         "Una esfalerita con hierro activada con sulfato de cobre y flotada separándola de la pirita deprimida con cal; la alta ley de cabeza hace explícita la separación ley-recuperación."),
        ("How does pyrite control a zinc concentrate's grade?", "¿Cómo controla la pirita la ley de un concentrado de zinc?"),
        Ore(minerals=(MineralSpec(id="sphalerite", grindability=1.1, liberation_size_um=80.0, liberation_slope=1.5, composite_content=0.35,
                                  host="quartz", flotation=_sulphide(2.0e-4, half=25.0)),
                      MineralSpec(id="pyrite", fraction=0.06, grindability=0.8, flotation=PYRITE_DEPRESSED),
                      MineralSpec(id="quartz", fraction=0.0, flotation=QUARTZ)),
            payables=(Payable("Zn", "%", (Carrier("sphalerite", 1.0),), 4.8),),
            work_index_kwh_t=14.8, crushing_work_index_kwh_t=16.0),
        Plant(family="rougher", crusher=_crusher(), mill=_mill(13200.0), cyclone=_cyclone(38.1),
              flotation=_flotation(140.0, 30.0, 15.0, 4.0), grade_spec=GradeSpec("Zn", 50.0), water_limit_m3_t=2.97),
        OperatingPoint(throughput_tph=780.0, target_p80_um=106.0, circulating_load=2.5, water_m3_t=2.2, crusher_css_mm=8.0,
                       work_index_kwh_t=14.8, head_grade=4.8, collector_gpt=50.0, jg_cm_s=1.4, rougher_cells=8),
        _flotation_variants(), {"recovery_pct": (82.0, 93.0), "concentrate_grade": (46.0, 58.0)},
        ("breakage", "crusher", "cyclone", "flotation", "collector", "water", "kpi")))
    cases.append(_copper(
        "mixed_ore_high_clay", "integration", ("Copper ore with clay", "Mineral de cobre con arcilla"),
        ("A copper ore with a clay fraction that grinds to slimes; entrained clay dilutes the concentrate, so froth washing and air carry more weight than in a clean ore.",
         "Un mineral de cobre con una fracción arcillosa que se muele a lamas; la arcilla arrastrada diluye el concentrado, por lo que el lavado de espuma y el aire pesan más que en un mineral limpio."),
        ("How much grade does clay entrainment take?", "¿Cuánta ley se lleva el arrastre de arcilla?"),
        grade=0.48, wi=13.0, tph=520.0, p80=150.0, power_kw=5000.0, rougher_m3=110.0, cleaner_m3=16.0, recleaner_m3=8.0,
        cyclone_cm=66.0, liberation_um=100.0, composite=0.35, floatability=2.4e-4, xi_um=60.0, water=2.8, water_limit=2.98,
        extra_minerals=(MineralSpec(id="kaolinite", fraction=0.2, grindability=4.0,
                                    flotation=Flotability(floatability=2.0e-6, optimum_size_um=15.0, fine_width=1.2, coarse_width=0.8, half_dose_gpt=1500.0)),),
        kpi={"recovery_pct": (78.0, 92.0), "concentrate_grade": (18.0, 30.0)}))
    cases.append(_copper(
        "low_grade_copper", "integration", ("Low-grade copper at high throughput", "Cobre de baja ley a alto tratamiento"),
        ("A large, low-grade porphyry plant where throughput pays the bills; a harder ore or a higher feed rate is felt first as mill power and then as recovery.",
         "Una planta de pórfido grande y de baja ley donde el tratamiento paga las cuentas; un mineral más duro o más alimentación se nota primero en la potencia del molino y luego en la recuperación."),
        ("Is it better to push tonnes or to hold the grind?", "¿Conviene empujar toneladas o sostener la molienda?"),
        grade=0.29, wi=15.5, tph=1120.0, p80=180.0, power_kw=14200.0, rougher_m3=200.0, cleaner_m3=22.0, recleaner_m3=11.0,
        cyclone_cm=66.0, liberation_um=110.0, composite=0.35, floatability=3.2e-4, water_limit=2.23,
        kpi={"recovery_pct": (80.0, 92.0), "concentrate_grade": (22.0, 32.0)}))
    cases.append(CaseDef(
        "refractory_gold", "integration", ("Refractory gold in sulphides", "Oro refractario en sulfuros"),
        ("Gold locked in pyrite and arsenopyrite that no grind can free; flotation makes a sulphide concentrate for oxidation downstream, so sulphide recovery is gold recovery.",
         "Oro atrapado en pirita y arsenopirita que ninguna molienda libera; la flotación produce un concentrado de sulfuros para oxidación posterior, por lo que recuperar sulfuros es recuperar oro."),
        ("How do two gold carriers with different floatability share the recovery?", "¿Cómo se reparten la recuperación dos portadores de oro de distinta flotabilidad?"),
        Ore(minerals=(MineralSpec(id="pyrite", fraction=0.045, grindability=0.8, liberation_size_um=120.0, liberation_slope=1.5, composite_content=0.45,
                                  host="quartz", flotation=_sulphide(1.8e-4, half=20.0)),
                      MineralSpec(id="arsenopyrite", fraction=0.012, grindability=0.8, liberation_size_um=80.0, liberation_slope=1.5, composite_content=0.4,
                                  host="quartz", flotation=_sulphide(1.2e-4, half=25.0)),
                      MineralSpec(id="quartz", fraction=0.0, flotation=QUARTZ)),
            payables=(Payable("Au", "g/t", (Carrier("pyrite", 0.55, "trace"), Carrier("arsenopyrite", 0.45, "trace")), 2.2),),
            work_index_kwh_t=18.0, crushing_work_index_kwh_t=19.5, quality_species=("S", "As")),
        Plant(family="rougher", crusher=_crusher(), mill=_mill(6300.0), cyclone=_cyclone(30.5),
              flotation=_flotation(70.0, 10.0, None, 0.0), grade_spec=GradeSpec("Au", 15.0), water_limit_m3_t=2.37),
        OperatingPoint(throughput_tph=310.0, target_p80_um=106.0, circulating_load=2.5, water_m3_t=2.2, crusher_css_mm=8.0,
                       work_index_kwh_t=18.0, head_grade=2.2, collector_gpt=60.0, jg_cm_s=1.4, rougher_cells=8),
        _flotation_variants(), {"recovery_pct": (80.0, 95.0), "concentrate_grade": (12.0, 60.0)},
        ("breakage", "crusher", "cyclone", "flotation", "collector", "water", "kpi")))
    return tuple(cases)


CASES: tuple[CaseDef, ...] = _cases()
CASE_BY_ID = {c.id: c for c in CASES}


def variant_point(case: CaseDef, variant: dict[str, Any]) -> OperatingPoint:
    """Apply a variant's single multiplicative change to the case nominal."""
    changes = {}
    for name, factor in variant["change"].items():
        value = getattr(case.nominal, name) * factor
        changes[name] = int(round(value)) if isinstance(getattr(case.nominal, name), int) else value
    return case.nominal.with_values(**changes)
