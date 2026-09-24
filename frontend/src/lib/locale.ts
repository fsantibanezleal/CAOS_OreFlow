export const caseSpanish: Record<string, string> = {
  copper_porphyry_soft: 'Pórfido de cobre blando', copper_porphyry_hard: 'Pórfido de cobre duro',
  gold_free_milling: 'Oro de molienda libre', iron_magnetite_fine: 'Magnetita fina',
  nickel_laterite: 'Laterita de níquel', phosphate_clay: 'Fosfato con arcillas',
  copper_molybdenum: 'Rougher cobre-molibdeno', copper_oxide: 'Respuesta de óxido de cobre',
  zinc_sulfide: 'Sulfuro de zinc', mixed_ore_high_clay: 'Mineral mixto arcilloso',
  low_grade_copper: 'Cobre de baja ley', refractory_gold: 'Proxy de oro refractario',
};
export const variantSpanish: Record<string, string> = {
  nominal: 'Diseño nominal', fine_feed: 'Alimentación más fina', finer_feed: 'Alimentación más fina',
  hard_ore: 'Mineral más duro', harder_ore: 'Mineral más duro', high_throughput: 'Mayor caudal',
  selective_reagent: 'Colector selectivo', coarse_grind: 'Molienda más gruesa', coarser_grind: 'Molienda más gruesa',
};
export const localizedCase = (id: string, fallback: string, es: boolean) => es ? caseSpanish[id] ?? fallback : fallback;
export const localizedVariant = (id: string, fallback: string, es: boolean) => es ? variantSpanish[id] ?? fallback : fallback;
