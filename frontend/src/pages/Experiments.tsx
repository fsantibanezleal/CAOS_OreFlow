/**
 * Experiments (ADR-0016 section 9.C): the design and its coverage, the data, the splits, the metrics, what
 * the single-factor variants did in every case, the uncertainty record with its seed study, and the mechanism
 * ablations; every result is read from the committed benchmark and studies records.
 */
import { useShellLang } from '@fasl-work/caos-app-shell';
import { DocPage, TopicGroups } from '../content/doc';
import { EXPERIMENTS } from '../content/experiments';
import type { Lang } from '../lib/format';

const T = {
  title: { en: 'Experiments', es: 'Experimentos' },
  lede: {
    en: 'The numerical experiments behind OreFlow: a designed matrix of twelve cases with single-factor variants, the data and the leakage-safe splits every score uses, the metrics that judge each state, what every variant did in every case, how much of the uncertainty record is its own sampling error, and how much each mechanism of the engine carries.',
    es: 'Los experimentos numéricos detrás de OreFlow: una matriz diseñada de doce casos con variantes de un factor, los datos y las particiones sin fuga que usa cada puntaje, las métricas que juzgan cada estado, qué hizo cada variante en cada caso, cuánto del registro de incertidumbre es su propio error de muestreo, y cuánto aporta cada mecanismo del motor.',
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
