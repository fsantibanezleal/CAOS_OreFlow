/**
 * The experiment design as the case catalog declares it: every variant kind, the input it multiplies
 * and its factor. The Experiments page shows it; a test holds it equal to every case artifact's own
 * change record, so the page cannot state a factor the bake did not apply.
 */
import type { Bi } from './doc';

/** The design's variant kinds: the input each multiplies and its factor, as the case catalog declares them. */
export const VARIANT_KINDS: Array<{ id: string; label: Bi; input: string; factor: number; except?: Record<string, number> }> = [
  { id: 'harder_ore', label: { en: 'Harder ore', es: 'Mineral más duro' }, input: 'work_index_kwh_t', factor: 1.25 },
  { id: 'coarser_grind', label: { en: 'Coarser grind', es: 'Molienda más gruesa' }, input: 'target_p80_um', factor: 1.35 },
  { id: 'higher_throughput', label: { en: 'Higher throughput', es: 'Más tonelaje' }, input: 'throughput_tph', factor: 1.25 },
  { id: 'more_collector', label: { en: 'More collector', es: 'Más colector' }, input: 'collector_gpt', factor: 1.6, except: { phosphate_clay: 1.4 } },
  { id: 'more_air', label: { en: 'More air', es: 'Más aire' }, input: 'jg_cm_s', factor: 1.4 },
  { id: 'larger_bleed', label: { en: 'Larger bleed', es: 'Mayor purga' }, input: 'gravity_bleed', factor: 2.0 },
  { id: 'finer_grind', label: { en: 'Finer grind', es: 'Molienda más fina' }, input: 'target_p80_um', factor: 0.75 },
  { id: 'finer_crusher', label: { en: 'Finer crusher', es: 'Chancado más fino' }, input: 'crusher_css_mm', factor: 0.8 },
  { id: 'coarser_deslime', label: { en: 'Coarser deslime cut', es: 'Corte de deslamado mayor' }, input: 'deslime_cut_um', factor: 1.5 },
];
