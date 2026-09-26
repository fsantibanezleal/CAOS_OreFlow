/**
 * Interface strings in English and Spanish. Input labels and help come from the operating contract;
 * case texts from the case artifacts; everything the interface itself says is here, so no component
 * carries a literal string of its own.
 */
import type { Lang } from './format';

type T = { en: string; es: string };
export const t = (text: T, lang: Lang): string => text[lang];

const METRICS: Record<string, T> = {
  throughput_tph: { en: 'Throughput', es: 'Tratamiento' },
  head_grade: { en: 'Head grade', es: 'Ley de cabeza' },
  recovery_pct: { en: 'Recovery', es: 'Recuperación' },
  concentrate_grade: { en: 'Concentrate grade', es: 'Ley del concentrado' },
  tail_grade: { en: 'Tail grade', es: 'Ley del relave' },
  concentrate_tph: { en: 'Concentrate', es: 'Concentrado' },
  mass_pull_pct: { en: 'Mass pull', es: 'Rendimiento en masa' },
  recovered_primary_tph: { en: 'Recovered metal', es: 'Metal recuperado' },
  crusher_feed_f80_um: { en: 'Crusher feed F80', es: 'F80 alimentación chancador' },
  crusher_p80_um: { en: 'Mill feed F80', es: 'F80 alimentación molino' },
  target_p80_um: { en: 'Target P80', es: 'P80 objetivo' },
  p80_um: { en: 'Achieved P80', es: 'P80 logrado' },
  circulating_load_pct: { en: 'Circulating load', es: 'Carga circulante' },
  cyclone_cut_um: { en: 'Cyclone cut (host gangue)', es: 'Corte del ciclón (ganga)' },
  cyclone_bypass_pct: { en: 'Cyclone bypass', es: 'Cortocircuito del ciclón' },
  cyclones_required: { en: 'Cyclones in the cluster', es: 'Ciclones en la batería' },
  cyclone_pressure_kpa: { en: 'Cyclone pressure', es: 'Presión del ciclón' },
  plitt_cut_um: { en: 'Plitt cut', es: 'Corte de Plitt' },
  plitt_sharpness: { en: 'Plitt sharpness', es: 'Nitidez de Plitt' },
  cyclone_feed_solids_vol_pct: { en: 'Cyclone feed solids (volume)', es: 'Sólidos alimentación ciclón (volumen)' },
  mill_power_kw: { en: 'Mill power', es: 'Potencia del molino' },
  required_mill_power_kw: { en: 'Required mill power', es: 'Potencia requerida' },
  installed_mill_power_kw: { en: 'Installed mill power', es: 'Potencia instalada' },
  power_limited: { en: 'Power-limited', es: 'Limitado por potencia' },
  specific_energy_crushing_kwh_t: { en: 'Crushing energy', es: 'Energía de chancado' },
  specific_energy_grinding_kwh_t: { en: 'Grinding energy', es: 'Energía de molienda' },
  specific_energy_regrind_kwh_t: { en: 'Regrind energy', es: 'Energía de remolienda' },
  specific_energy_total_kwh_t: { en: 'Specific energy', es: 'Energía específica' },
  bond_energy_kwh_t: { en: 'Bond energy for the reduction', es: 'Energía de Bond de la reducción' },
  operating_work_index_kwh_t: { en: 'Operating work index', es: 'Índice de trabajo operacional' },
  bond_efficiency_ratio: { en: 'Bond efficiency ratio', es: 'Razón de eficiencia de Bond' },
  energy_rittinger_kwh_t: { en: 'Rittinger (comparison)', es: 'Rittinger (comparación)' },
  energy_kick_kwh_t: { en: 'Kick (comparison)', es: 'Kick (comparación)' },
  water_use_m3_h: { en: 'Process water', es: 'Agua de proceso' },
  water_intensity_m3_t: { en: 'Process water per tonne', es: 'Agua de proceso por tonelada' },
  gold_circulating_load_pct: { en: 'Gold circulating load', es: 'Carga circulante de oro' },
  gravity_recovery_pct: { en: 'Gravity recovery', es: 'Recuperación gravimétrica' },
  flotation_recovery_pct: { en: 'Flotation recovery', es: 'Recuperación de flotación' },
  regrind_power_kw: { en: 'Regrind power', es: 'Potencia de remolienda' },
  recleaner_recovery_pct: { en: 'Recleaner recovery', es: 'Recuperación de relimpieza' },
  rougher_recovery_pct: { en: 'Rougher recovery', es: 'Recuperación rougher' },
  cleaner_recovery_pct: { en: 'Cleaner recovery', es: 'Recuperación de limpieza' },
  rougher_concentrate_grade: { en: 'Rougher concentrate grade', es: 'Ley del concentrado rougher' },
  rougher_mass_pull_pct: { en: 'Rougher mass pull', es: 'Rendimiento en masa rougher' },
  rougher_residence_min: { en: 'Rougher residence', es: 'Residencia rougher' },
  cleaner_residence_min: { en: 'Cleaner residence', es: 'Residencia de limpieza' },
  rougher_water_recovery_pct: { en: 'Rougher water recovery', es: 'Recuperación de agua rougher' },
  cleaner_water_recovery_pct: { en: 'Cleaner water recovery', es: 'Recuperación de agua de limpieza' },
  bubble_surface_flux_s: { en: 'Bubble surface area flux', es: 'Flujo de área superficial de burbujas' },
  cleaner_recycle_tph: { en: 'Cleaner tails recycle', es: 'Recirculación de colas de limpieza' },
  recycle_iterations: { en: 'Recycle iterations', es: 'Iteraciones de recirculación' },
  entrained_gangue_share_pct: { en: 'Entrained share of gangue', es: 'Fracción arrastrada de la ganga' },
  magnetite_recovery_pct: { en: 'Magnetite recovery', es: 'Recuperación de magnetita' },
  slimes_mass_pct: { en: 'Slimes (mass)', es: 'Lamas (masa)' },
  slimes_loss_pct: { en: 'Payable lost to slimes', es: 'Pagable perdido en lamas' },
  balance_max_relative_error: { en: 'Balance closure error', es: 'Error de cierre del balance' },
  species_consistency_error: { en: 'Particle-class consistency', es: 'Consistencia de clases de partícula' },
};

const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';
/** A chemical formula as it is printed (P2O5 as P₂O₅): the digits after an element or a bracket are subscripts. */
export const formulaText = (formula: string): string =>
  formula.replace(/(?<=[A-Za-z)\]])\d+/g, digits => [...digits].map(d => SUBSCRIPT[Number(d)]).join(''));

export function metricLabel(key: string, lang: Lang): string {
  if (key in METRICS) return METRICS[key][lang];
  let m = /^concentrate_(.+)$/.exec(key);
  if (m) return lang === 'es' ? `${formulaText(m[1])} en concentrado` : `Concentrate ${formulaText(m[1])}`;
  m = /^head_(.+)$/.exec(key);
  if (m) return lang === 'es' ? `${formulaText(m[1])} en cabeza` : `Head ${formulaText(m[1])}`;
  m = /^recovery_(.+)_pct$/.exec(key);
  if (m) return lang === 'es' ? `Recuperación de ${formulaText(m[1])}` : `${formulaText(m[1])} recovery`;
  return key;
}

const FLAGS: Record<string, T> = {
  power_limited: { en: 'The mill runs at installed power; the product is coarser than the target.', es: 'El molino opera a potencia instalada; el producto es más grueso que el objetivo.' },
  target_unreachable: { en: 'The target P80 cannot be reached within the energy search range.', es: 'El P80 objetivo no se alcanza dentro del rango de energía.' },
  circulating_load_unreachable: { en: 'The design circulating load cannot be held at this energy.', es: 'La carga circulante de diseño no se sostiene con esta energía.' },
  cyclone_pressure: { en: 'The Plitt pressure lies outside the 35 to 200 kPa practical window.', es: 'La presión de Plitt está fuera de la ventana práctica de 35 a 200 kPa.' },
  mill_water_negative: { en: 'The declared densities leave no room for water at the mill.', es: 'Las densidades declaradas no dejan espacio para agua en el molino.' },
  sump_water_negative: { en: 'The declared densities leave no room for dilution at the sump.', es: 'Las densidades declaradas no dejan espacio para dilución en el cajón.' },
  recycle_not_converged: { en: 'The flotation recycle did not converge.', es: 'La recirculación de flotación no convergió.' },
  composite_scale_not_converged: { en: 'The host-limited composites did not converge.', es: 'Los mixtos limitados por la ganga no convergieron.' },
  negative_mass: { en: 'A class mass is negative beyond round-off.', es: 'Una masa de clase es negativa más allá del redondeo.' },
  non_finite_output: { en: 'A non-finite number was replaced by null.', es: 'Un número no finito se reemplazó por nulo.' },
};

export const flagText = (code: string, lang: Lang): string => FLAGS[code]?.[lang] ?? code;

/** A case record's provenance, a fixed phrase of the case catalog, in the interface language. */
const PROVENANCE: Record<string, T> = {
  'authored scenario; parameters inside cited ranges; not plant-calibrated': {
    en: 'authored scenario; parameters inside cited ranges; not plant-calibrated',
    es: 'escenario de autor; parámetros dentro de rangos citados; sin calibración de planta' },
};
export const provenanceText = (value: string, lang: Lang): string => PROVENANCE[value]?.[lang] ?? value;

/** A flag's short name, for tables and the HUD where the full sentence does not fit. */
const FLAG_SHORT: Record<string, T> = {
  power_limited: { en: 'Power-limited', es: 'Limitado por potencia' },
  target_unreachable: { en: 'Target unreachable', es: 'Objetivo inalcanzable' },
  circulating_load_unreachable: { en: 'Load unreachable', es: 'Carga inalcanzable' },
  cyclone_pressure: { en: 'Cyclone pressure', es: 'Presión del ciclón' },
  mill_water_negative: { en: 'No mill water', es: 'Sin agua en el molino' },
  sump_water_negative: { en: 'No sump water', es: 'Sin agua en el cajón' },
  recycle_not_converged: { en: 'Recycle not converged', es: 'Recirculación sin converger' },
  composite_scale_not_converged: { en: 'Composites not converged', es: 'Mixtos sin converger' },
  negative_mass: { en: 'Negative mass', es: 'Masa negativa' },
  non_finite_output: { en: 'Non-finite output', es: 'Salida no finita' },
};

export const flagShort = (code: string, lang: Lang): string => FLAG_SHORT[code]?.[lang] ?? code;

/** Stream names of the engine topology (every stream any case's circuit declares). */
const STREAMS: Record<string, T> = {
  crusher_feed: { en: 'Crusher feed', es: 'Alimentación del chancador' },
  new_feed: { en: 'New feed', es: 'Alimentación fresca' },
  mill_feed: { en: 'Mill feed', es: 'Alimentación del molino' },
  mill_discharge: { en: 'Mill discharge', es: 'Descarga del molino' },
  cyclone_feed: { en: 'Cyclone feed', es: 'Alimentación del ciclón' },
  cyclone_overflow: { en: 'Cyclone overflow', es: 'Rebose del ciclón' },
  cyclone_underflow: { en: 'Cyclone underflow', es: 'Descarga del ciclón' },
  recycle: { en: 'Underflow to the mill', es: 'Descarga de vuelta al molino' },
  gravity_feed: { en: 'Gravity bleed', es: 'Purga gravimétrica' },
  gravity_concentrate: { en: 'Gravity concentrate', es: 'Concentrado gravimétrico' },
  flotation_feed: { en: 'Flotation feed', es: 'Alimentación de flotación' },
  slimes: { en: 'Slimes', es: 'Lamas' },
  deslime_underflow: { en: 'Deslimed underflow', es: 'Descarga deslamada' },
  rougher_feed: { en: 'Rougher feed', es: 'Alimentación rougher' },
  rougher_concentrate: { en: 'Rougher concentrate', es: 'Concentrado rougher' },
  rougher_tail: { en: 'Rougher tail', es: 'Relave rougher' },
  regrind_product: { en: 'Regrind product', es: 'Producto de remolienda' },
  cleaner_feed: { en: 'Cleaner feed', es: 'Alimentación de limpieza' },
  cleaner_concentrate: { en: 'Cleaner concentrate', es: 'Concentrado de limpieza' },
  cleaner_tail: { en: 'Cleaner tail', es: 'Relave de limpieza' },
  recleaner_feed: { en: 'Recleaner feed', es: 'Alimentación de relimpieza' },
  recleaner_concentrate: { en: 'Recleaner concentrate', es: 'Concentrado de relimpieza' },
  recleaner_tail: { en: 'Recleaner tail', es: 'Relave de relimpieza' },
  lims_feed: { en: 'LIMS feed', es: 'Alimentación LIMS' },
  lims_rougher_concentrate: { en: 'LIMS rougher concentrate', es: 'Concentrado LIMS rougher' },
  lims_rougher_tail: { en: 'LIMS rougher tail', es: 'Relave LIMS rougher' },
  lims_cleaner_concentrate: { en: 'LIMS cleaner concentrate', es: 'Concentrado LIMS de limpieza' },
  lims_cleaner_tail: { en: 'LIMS cleaner tail', es: 'Relave LIMS de limpieza' },
  final_concentrate: { en: 'Final concentrate', es: 'Concentrado final' },
  final_tail: { en: 'Final tail', es: 'Relave final' },
};

export const streamName = (name: string, lang: Lang): string => STREAMS[name]?.[lang] ?? name.replace(/_/g, ' ');

/** Every mineral of the engine's mineral table. */
const MINERALS: Record<string, T> = {
  arsenopyrite: { en: 'Arsenopyrite', es: 'Arsenopirita' },
  calcite: { en: 'Calcite', es: 'Calcita' },
  chalcopyrite: { en: 'Chalcopyrite', es: 'Calcopirita' },
  chrysocolla: { en: 'Chrysocolla', es: 'Crisocola' },
  electrum: { en: 'Electrum', es: 'Electrum' },
  fluorapatite: { en: 'Fluorapatite', es: 'Fluorapatita' },
  kaolinite: { en: 'Kaolinite', es: 'Caolinita' },
  lizardite: { en: 'Lizardite', es: 'Lizardita' },
  magnetite: { en: 'Magnetite', es: 'Magnetita' },
  malachite: { en: 'Malachite', es: 'Malaquita' },
  molybdenite: { en: 'Molybdenite', es: 'Molibdenita' },
  pentlandite: { en: 'Pentlandite', es: 'Pentlandita' },
  pyrite: { en: 'Pyrite', es: 'Pirita' },
  pyrrhotite: { en: 'Pyrrhotite', es: 'Pirrotina' },
  quartz: { en: 'Quartz', es: 'Cuarzo' },
  silicate_fe: { en: 'Iron silicates', es: 'Silicatos de hierro' },
  sphalerite: { en: 'Sphalerite', es: 'Esfalerita' },
};
const CLASSES: Record<string, T> = {
  liberated: { en: 'liberated', es: 'libre' },
  composite: { en: 'in composites', es: 'en mixtos' },
  free: { en: 'free', es: 'libre' },
};

export const mineralName = (id: string, lang: Lang): string => MINERALS[id]?.[lang] ?? id.replace(/_/g, ' ');

/** The teaching category of a case, with the letter of its catalog code (L1, C2, F3, I1, ...). */
export const CATEGORY: Record<string, T & { code: string }> = {
  liberation: { code: 'L', en: 'Liberation', es: 'Liberación' },
  classification: { code: 'C', en: 'Classification', es: 'Clasificación' },
  flotation: { code: 'F', en: 'Flotation', es: 'Flotación' },
  integration: { code: 'I', en: 'Integration', es: 'Integración' },
};
export const categoryName = (id: string, lang: Lang): string => CATEGORY[id]?.[lang] ?? id;

/** The circuit family of a case: which units follow the grinding circuit. */
const FAMILIES: Record<string, T> = {
  rougher: { en: 'Flotation, rougher and cleaner', es: 'Flotación, rougher y cleaner' },
  gravity_rougher: { en: 'Gravity bleed and flotation', es: 'Purga gravimétrica y flotación' },
  magnetic: { en: 'Low-intensity magnetic separation', es: 'Separación magnética de baja intensidad' },
  deslime_rougher: { en: 'Desliming and flotation', es: 'Deslamado y flotación' },
};
export const familyName = (id: string, lang: Lang): string => FAMILIES[id]?.[lang] ?? id;

/** A particle class of the trace (`mineral:class`), as a mineral name and its class. */
export function speciesName(key: string, lang: Lang): string {
  const [mineral, particle] = key.split(':');
  return particle ? `${mineralName(mineral, lang)} (${CLASSES[particle]?.[lang] ?? particle})` : mineralName(mineral, lang);
}

export const UI = {
  views: {
    circuit: { en: 'Circuit', es: 'Circuito' },
    grinding: { en: 'Grinding', es: 'Molienda' },
    separation: { en: 'Separation', es: 'Separación' },
    response: { en: 'Response', es: 'Respuesta' },
    methods: { en: 'Methods', es: 'Métodos' },
    case: { en: 'Case', es: 'Caso' },
  },
  viewsLabel: { en: 'Views', es: 'Vistas' },
  sections: {
    feed: { en: 'Feed and grind', es: 'Alimentación y molienda' },
    classification: { en: 'Classification', es: 'Clasificación' },
    separation: { en: 'Separation', es: 'Separación' },
  },
  case: { en: 'Case', es: 'Caso' },
  variant: { en: 'Variant', es: 'Variante' },
  question: { en: 'Question', es: 'Pregunta' },
  modified: { en: 'Modified from the variant', es: 'Modificado respecto de la variante' },
  reset: { en: 'Reset to the variant', es: 'Volver a la variante' },
  openFocus: { en: 'Open the focus view', es: 'Abrir la vista de foco' },
  exitFocus: { en: 'Back to the workbench', es: 'Volver al laboratorio' },
  computing: { en: 'Computing', es: 'Calculando' },
  rejected: { en: 'Outside the operating envelope', es: 'Fuera de la envolvente de operación' },
  runSweep: { en: 'Compute', es: 'Calcular' },
  cancel: { en: 'Cancel', es: 'Cancelar' },
  resetZoom: { en: 'Reset zoom', es: 'Restablecer zoom' },
  legend: { en: 'Series: click to hide or show', es: 'Series: clic para ocultar o mostrar' },
  noFlags: { en: 'Within every engine check', es: 'Dentro de todas las verificaciones del motor' },
  loading: { en: 'Loading', es: 'Cargando' },
  basic: { en: 'Basic', es: 'Básico' },
  advanced: { en: 'Advanced', es: 'Avanzado' },
};
