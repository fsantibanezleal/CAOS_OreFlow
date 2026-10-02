/**
 * Benchmark (ADR-0016 section 9.C): the real numbers from the committed artifacts, grouped by the
 * question each answers: does the engine reproduce published examples, what do its method records
 * show, how far can the learned lane be trusted, and what do the two measured lanes say.
 */
import { useShellLang } from '@fasl-work/caos-app-shell';
import { ENGINE_BENCHMARK } from '../content/benchmark';
import { DocPage, TopicGroups } from '../content/doc';
import { INDUSTRIAL } from '../content/industrial';
import { MEASURED_LANES } from '../content/lanes';
import type { Lang } from '../lib/format';

const T = {
  title: { en: 'Benchmark', es: 'Benchmark' },
  lede: {
    en: 'The numbers behind OreFlow, read from the committed artifacts: the published examples the engine reproduces, what its method records found across the twelve cases, how the learned lane scores on plants it never saw, the two lanes that use measured data, kept apart from the engine, and the quality forecast of one plant.',
    es: 'Los números detrás de OreFlow, leídos desde los artefactos versionados: los ejemplos publicados que reproduce el motor, lo que encontraron sus registros de métodos en los doce casos, cómo puntúa la vía aprendida en plantas que nunca vio, las dos vías que usan datos medidos, separadas del motor, y el pronóstico de calidad de una planta.',
  },
  sections: { en: 'Benchmark sections', es: 'Secciones del benchmark' },
};

const GROUPS = [
  { id: 'oracles', label: { en: 'Published examples', es: 'Ejemplos publicados' }, topics: [ENGINE_BENCHMARK.ORACLES] },
  { id: 'methods', label: { en: 'Method records', es: 'Registros de métodos' }, topics: [ENGINE_BENCHMARK.KINETICS, ENGINE_BENCHMARK.OPTIMIZATION, ENGINE_BENCHMARK.UNCERTAINTY] },
  { id: 'learned', label: { en: 'Learned lane', es: 'Vía aprendida' }, topics: [ENGINE_BENCHMARK.LEARNED] },
  { id: 'measured', label: { en: 'Measured lanes', es: 'Vías medidas' }, topics: [MEASURED_LANES.GEOMET, MEASURED_LANES.SAMPLES, MEASURED_LANES.PARTICLES, MEASURED_LANES.INFERENCE] },
  // IS-05: the iron plant's forecast, a lane of its own, apart from the copper circuit and the optimizer
  { id: 'industrial', label: { en: 'Industrial quality', es: 'Calidad industrial' }, topics: [INDUSTRIAL.IRON_PLANT] },
];

export default function Benchmark() {
  const lang = useShellLang() as Lang;
  return (
    <DocPage title={T.title[lang]} lede={T.lede[lang]}>
      <TopicGroups lang={lang} label={T.sections} groups={GROUPS} />
    </DocPage>
  );
}
