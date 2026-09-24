"""OreFlow's complete case x variant coverage matrix.

The values are authored engineering scenarios, not claimed plant measurements.
The HZDR particle-mineralogy dataset is processed alongside them as a licensed
external calibration reference; it is not silently treated as plant truth.
"""
from __future__ import annotations

from ..io.schema import Case, FeedParams


def _variants() -> tuple[dict, ...]:
    return (
        {"id": "nominal", "label": "Nominal design", "overrides": {}},
        {"id": "fine_feed", "label": "Finer feed", "overrides": {"feed_p80_um_factor": 0.88, "grind_p80_um_factor": 0.89, "classifier_cut_um_factor": 0.88}},
        {"id": "hard_ore", "label": "Harder ore", "overrides": {"hardness_kwh_t_factor": 1.28}},
        {"id": "high_throughput", "label": "High throughput", "overrides": {"feed_tph_factor": 1.28, "water_m3_t_factor": 1.08}},
        {"id": "selective_reagent", "label": "Selective reagent", "overrides": {"reagent_gpt_factor": 1.32, "flotation_time_min_factor": 1.16}},
        {"id": "coarse_grind", "label": "Coarser grind", "overrides": {"grind_p80_um_factor": 1.34, "classifier_cut_um_factor": 1.22, "flotation_time_min_factor": 0.92}},
    )


def _magnetic_variants() -> tuple[dict, ...]:
    return (
        {"id": "nominal", "label": "Nominal design", "overrides": {}},
        {"id": "fine_feed", "label": "Finer feed", "overrides": {"feed_p80_um_factor": 0.88, "grind_p80_um_factor": 0.89}},
        {"id": "hard_ore", "label": "Harder ore", "overrides": {"hardness_kwh_t_factor": 1.28}},
        {"id": "high_throughput", "label": "High throughput", "overrides": {"feed_tph_factor": 1.28, "water_m3_t_factor": 1.08}},
        {"id": "fine_grind", "label": "Finer liberation grind", "overrides": {"grind_p80_um_factor": 0.72}},
        {"id": "coarse_grind", "label": "Coarser grind", "overrides": {"grind_p80_um_factor": 1.34}},
    )


def _params(cid: str, **kwargs: float) -> FeedParams:
    defaults = dict(feed_tph=640.0, feed_grade_pct=0.82, feed_p80_um=14_000.0, hardness_kwh_t=13.2,
                    density_t_m3=2.65, grind_p80_um=180.0, classifier_cut_um=125.0,
                    flotation_time_min=18.0, air_rate_m3_min=2.4, reagent_gpt=145.0, water_m3_t=2.2)
    defaults.update(kwargs)
    family = "gravity_rougher" if cid == "gold_free_milling" else "magnetic" if cid == "iron_magnetite_fine" else "deslime_rougher" if cid == "phosphate_clay" else "rougher"
    return FeedParams(case_id=cid, seed=42, process_family=family, **defaults)


CASES = (
    Case("copper_porphyry_soft", "liberation", "Soft copper porphyry", "A competent but relatively soft sulphide feed where liberation is purchased with modest grinding energy.", _params("copper_porphyry_soft", feed_tph=720.0, feed_grade_pct=0.74, hardness_kwh_t=11.0, grind_p80_um=165.0), _variants(), "recovery gains flatten once liberated surface is available", "authored scenario; model calibration required"),
    Case("copper_porphyry_hard", "liberation", "Hard copper porphyry", "A high-work-index porphyry that makes the energy-liberation trade-off visible.", _params("copper_porphyry_hard", feed_tph=510.0, feed_grade_pct=0.52, hardness_kwh_t=20.5, grind_p80_um=190.0), _variants(), "Bond energy dominates cost and coarse grinding penalises recovery", "authored scenario; model calibration required"),
    Case("gold_free_milling", "liberation", "Free-milling gold", "A gravity plus flotation proxy with high density and a broad particle-size response.", _params("gold_free_milling", feed_tph=260.0, feed_grade_pct=0.034, density_t_m3=3.35, hardness_kwh_t=15.5, grind_p80_um=125.0, classifier_cut_um=95.0, reagent_gpt=88.0), _variants(), "grade-recovery is sensitive to very low head grade", "authored scenario; model calibration required"),
    Case("iron_magnetite_fine", "magnetic", "Fine magnetite concentration", "A ground magnetite feed passes through an authored low-intensity magnetic size-response proxy, without a cyclone or rougher.", _params("iron_magnetite_fine", feed_tph=920.0, feed_grade_pct=28.0, density_t_m3=3.9, feed_p80_um=9_000.0, grind_p80_um=95.0, classifier_cut_um=72.0, reagent_gpt=34.0), _magnetic_variants(), "grind and feed-size distribution determine the size-window magnetic capture", "authored scenario; no separator field or liberation calibration"),
    Case("nickel_laterite", "classification", "Nickel laterite proxy", "A clay-rich feed tested in the generic classification-plus-rougher proxy; this is not a representation of industrial laterite leaching.", _params("nickel_laterite", feed_tph=430.0, feed_grade_pct=1.42, density_t_m3=2.45, hardness_kwh_t=8.2, feed_p80_um=12_000.0, grind_p80_um=240.0, classifier_cut_um=165.0, water_m3_t=3.6, reagent_gpt=190.0), _variants(), "water and fines impose a throughput-quality compromise in the stated proxy only", "authored scenario; laterite hydrometallurgy is out of scope"),
    Case("phosphate_clay", "classification", "Phosphate with clay slimes", "Classifier overflow leaves as slimes; retained underflow enters a phosphate rougher proxy.", _params("phosphate_clay", feed_tph=470.0, feed_grade_pct=11.4, density_t_m3=2.2, hardness_kwh_t=6.4, feed_p80_um=10_500.0, grind_p80_um=310.0, classifier_cut_um=210.0, water_m3_t=4.5, reagent_gpt=120.0), _variants(), "desliming cut changes retained solids, valuable loss and rougher recovery", "authored scenario; mineral-by-size grade is not measured"),
    Case("copper_molybdenum", "flotation", "Copper-molybdenum rougher", "A sulphide rougher where kinetics and reagent selectivity can be inspected independently.", _params("copper_molybdenum", feed_grade_pct=0.61, hardness_kwh_t=16.2, grind_p80_um=150.0, classifier_cut_um=110.0, flotation_time_min=22.0, reagent_gpt=210.0), _variants(), "fast and slow floatable populations separate the recovery curve", "authored scenario; model calibration required"),
    Case("copper_oxide", "flotation", "Copper oxide response", "A slower flotation feed with a larger reagent-response uncertainty band.", _params("copper_oxide", feed_tph=580.0, feed_grade_pct=1.05, hardness_kwh_t=12.5, grind_p80_um=135.0, classifier_cut_um=105.0, flotation_time_min=27.0, air_rate_m3_min=2.8, reagent_gpt=320.0), _variants(), "reagent and residence time are coupled, not interchangeable", "authored scenario; model calibration required"),
    Case("zinc_sulfide", "flotation", "Zinc sulphide", "A high-grade sulphide case used to make concentrate grade and recovery separation explicit.", _params("zinc_sulfide", feed_tph=780.0, feed_grade_pct=4.8, hardness_kwh_t=14.8, grind_p80_um=175.0, classifier_cut_um=120.0, flotation_time_min=16.0, reagent_gpt=175.0), _variants(), "mass pull controls concentrate grade once recovery is high", "authored scenario; model calibration required"),
    Case("mixed_ore_high_clay", "integration", "Mixed ore with clay", "An integrated stress case coupling hardness, high water consumption and a low-selectivity froth.", _params("mixed_ore_high_clay", feed_tph=430.0, feed_grade_pct=0.38, hardness_kwh_t=18.2, density_t_m3=2.35, feed_p80_um=16_000.0, grind_p80_um=260.0, classifier_cut_um=185.0, flotation_time_min=24.0, water_m3_t=5.2, reagent_gpt=260.0), _variants(), "robust design is preferred when clay changes both classification and froth", "authored scenario; model calibration required"),
    Case("low_grade_copper", "integration", "Low-grade copper", "A throughput-oriented case where the optimizer must respect recovery and energy constraints.", _params("low_grade_copper", feed_tph=1120.0, feed_grade_pct=0.29, hardness_kwh_t=17.5, feed_p80_um=13_000.0, grind_p80_um=210.0, classifier_cut_um=150.0, flotation_time_min=20.0, reagent_gpt=190.0), _variants(), "small recovery changes can dominate the economic index", "authored scenario; model calibration required"),
    Case("refractory_gold", "integration", "Refractory gold proxy", "A hard, low-grade feed that demonstrates honest extrapolation warnings for learned surrogates.", _params("refractory_gold", feed_tph=310.0, feed_grade_pct=0.018, density_t_m3=3.0, hardness_kwh_t=25.0, feed_p80_um=15_500.0, grind_p80_um=105.0, classifier_cut_um=78.0, flotation_time_min=31.0, reagent_gpt=410.0), _variants(), "low grade and hard ore create a high-uncertainty decision surface", "authored scenario; model calibration required"),
)
