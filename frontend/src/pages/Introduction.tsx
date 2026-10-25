/**
 * Introduction (ADR-0016 section 9.C): what OreFlow is and who it is for, the approach, the twelve
 * cases, the scope and evidence, and how to use the workbench, each with its figure and references.
 */
import { ExecutiveView, SurfacePage, useShellLang } from '@fasl-work/caos-app-shell';
import { TopicGroups } from '../content/doc';
import { INTRODUCTION } from '../content/introduction';
import type { Lang } from '../lib/format';
import executive from '../../../content/executive.json';

const T = {
  title: { en: 'Introduction', es: 'Introducción' },
  lede: {
    en: 'Ore processing decisions couple comminution, classification and separation through circulating loads, particle size and mineral liberation. OreFlow lets researchers, process engineers and students inspect these dependencies in a reproducible steady-state model, compare classical and learned methods, and judge every result against its assumptions, data provenance and validation limits.',
    es: 'Las decisiones de procesamiento mineral acoplan conminución, clasificación y separación mediante cargas circulantes, tamaño de partícula y liberación mineral. OreFlow permite a investigadores, ingenieros de procesos y estudiantes inspeccionar estas dependencias en un modelo reproducible de estado estacionario, comparar métodos clásicos y aprendidos, y evaluar cada resultado según sus supuestos, procedencia de datos y límites de validación.',
  },
  views: { en: 'Introduction views', es: 'Vistas de la introducción' },
  executive: { en: 'Executive', es: 'Ejecutiva' },
  technical: { en: 'Technical', es: 'Técnica' },
};

export default function Introduction() {
  const lang = useShellLang() as Lang;
  return (
    <div className="page-body wide of-introduction-page" data-doc-page>
    <SurfacePage title={T.title[lang]} lede={<span className="of-intro-lede">{T.lede[lang]}</span>} ariaLabel={T.views[lang]} instrument focus tabs={[
        { id: 'executive', label: T.executive[lang], content: <ExecutiveView data={executive} base={import.meta.env.BASE_URL} />, focus: true },
        { id: 'technical', label: T.technical[lang], content: <TopicGroups lang={lang} label={T.views} groups={INTRODUCTION} /> },
      ]} />
    </div>
  );
}
