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
    en: 'How OreFlow is built: one Python engine, an offline precompute that writes versioned artifacts, a line-by-line TypeScript port that recomputes every state in the browser, and the contracts and gates that hold them together. The numbers on this page are read from the committed artifacts.',
    es: 'Cómo está construido OreFlow: un motor en Python, un precálculo fuera de línea que escribe artefactos versionados, una versión línea a línea en TypeScript que recalcula cada estado en el navegador, y los contratos y controles que los mantienen unidos. Los números de esta página se leen desde los artefactos versionados.',
  },
  sections: { en: 'Implementation sections', es: 'Secciones de la implementación' },
};

const byId = new Map(IMPLEMENTATION.map(group => [group.id, group]));
export const IMPLEMENTATION_GROUPS = [
  { id: 'system', label: { en: 'System', es: 'Sistema' }, topics: byId.get('system')!.topics },
  { id: 'engine', label: { en: 'Engine and browser model', es: 'Motor y modelo en navegador' }, topics: byId.get('engine')!.topics },
  { id: 'bake', label: { en: 'Offline pipeline', es: 'Pipeline fuera de línea' }, topics: byId.get('bake')!.topics },
  { id: 'data', label: { en: 'Data and execution', es: 'Datos y ejecución' }, topics: [...byId.get('contracts')!.topics, ...byId.get('lanes')!.topics] },
  { id: 'models', label: { en: 'Models and GPU', es: 'Modelos y GPU' }, topics: [...byId.get('models')!.topics, ...byId.get('gpu')!.topics] },
  { id: 'release', label: { en: 'Release and deployment', es: 'Publicación y despliegue' }, topics: [...byId.get('release')!.topics, ...byId.get('deploy')!.topics] },
];

export default function Implementation() {
  const lang = useShellLang() as Lang;
  return (
    <DocPage title={T.title[lang]} lede={T.lede[lang]}>
      <TopicGroups lang={lang} label={T.sections} groups={IMPLEMENTATION_GROUPS} />
    </DocPage>
  );
}
