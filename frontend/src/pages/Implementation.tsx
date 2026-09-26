/**
 * Implementation (ADR-0016 section 9.C): the system, the engine and its browser port, the bake, the
 * contracts and artifacts, what runs where, and the gates and release, with the committed bake's own
 * timings, artifacts and exported networks.
 */
import { useShellLang } from '@fasl-work/caos-app-shell';
import { DocPage, TopicGroups } from '../content/doc';
import { IMPLEMENTATION } from '../content/implementation';
import type { Lang } from '../lib/format';

const T = {
  title: { en: 'Implementation', es: 'Implementación' },
  lede: {
    en: 'How OreFlow is built: one Python engine, an offline bake that writes versioned artifacts, a line-by-line TypeScript port that recomputes every state in the browser, and the contracts and gates that hold them together. The numbers on this page are read from the committed artifacts.',
    es: 'Cómo está construido OreFlow: un motor en Python, un horneado fuera de línea que escribe artefactos versionados, una traducción línea a línea a TypeScript que recalcula cada estado en el navegador, y los contratos y controles que los mantienen unidos. Los números de esta página se leen desde los artefactos versionados.',
  },
  sections: { en: 'Implementation sections', es: 'Secciones de la implementación' },
};

export default function Implementation() {
  const lang = useShellLang() as Lang;
  return (
    <DocPage title={T.title[lang]} lede={T.lede[lang]}>
      <TopicGroups lang={lang} label={T.sections} groups={IMPLEMENTATION} />
    </DocPage>
  );
}
