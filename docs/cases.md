# Case coverage

OreFlow covers four process questions with three cases each: liberation (`copper_porphyry_soft`, `copper_porphyry_hard`, `gold_free_milling`), classification (`iron_magnetite_fine`, `nickel_laterite`, `phosphate_clay`), flotation (`copper_molybdenum`, `copper_oxide`, `zinc_sulfide`) and integration (`mixed_ore_high_clay`, `low_grade_copper`, `refractory_gold`).

Every case has six variants: nominal design, finer feed, harder ore, high throughput, selective reagent and coarser grind. Every variant runs the same 19-method registry. The cases are authored scenarios and must be calibrated before operational use. Their role is to make response shape, method disagreement, uncertainty and learned-model scope inspectable.
