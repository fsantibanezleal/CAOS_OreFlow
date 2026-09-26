/**
 * Experiments (ADR-0016 section 9.C): the design and its coverage, the metrics, what the single-factor
 * variants did in every case, and the protocols of the method records and of the learned lane; every
 * result is read from the committed benchmark.
 */
import { useShellLang } from '@fasl-work/caos-app-shell';
import { DocPage, TopicGroups } from '../content/doc';
import { EXPERIMENTS } from '../content/experiments';
import type { Lang } from '../lib/format';

const T = {
  title: { en: 'Experiments', es: 'Experimentos' },
  lede: {
    en: 'The numerical experiments behind OreFlow: a designed matrix of twelve cases with single-factor variants, the metrics that judge each state, what every variant did in every case, and the protocols of the method records, including the leakage-safe one that scores the learned lane on plants it never saw.',
    es: 'Los experimentos numéricos detrás de OreFlow: una matriz diseñada de doce casos con variantes de un factor, las métricas que juzgan cada estado, qué hizo cada variante en cada caso, y los protocolos de los registros de métodos, incluido el protocolo sin fuga que evalúa la vía aprendida en plantas que nunca vio.',
  },
  sections: { en: 'Experiment sections', es: 'Secciones de los experimentos' },
};

export default function Experiments() {
  const lang = useShellLang() as Lang;
  return (
    <DocPage title={T.title[lang]} lede={T.lede[lang]}>
      <TopicGroups lang={lang} label={T.sections} groups={EXPERIMENTS} />
    </DocPage>
  );
}
