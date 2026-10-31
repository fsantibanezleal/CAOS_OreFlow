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
    en: 'Ore processing decisions couple comminution, classification and separation through circulating loads, particle size and mineral liberation. OreFlow lets researchers, process engineers and students inspect these dependencies in a reproducible steady-state model, compare mechanistic and learned methods, and judge every result against its assumptions, data provenance and validation limits.',
    es: 'Las decisiones de procesamiento mineral acoplan conminución, clasificación y separación mediante cargas circulantes, tamaño de partícula y liberación mineral. OreFlow permite a investigadores, ingenieros de procesos y estudiantes inspeccionar estas dependencias en un modelo reproducible de estado estacionario, comparar modelos mecanicistas y aprendidos, y evaluar cada resultado según sus supuestos, procedencia de datos y límites de validación.',
  },
  views: { en: 'Introduction views', es: 'Vistas de la introducción' },
  executive: { en: 'Executive', es: 'Ejecutiva' },
  technical: { en: 'Technical', es: 'Técnica' },
  reportTitle: { en: 'Technical report', es: 'Informe técnico' },
  reportText: {
    en: 'Read the versioned research report describing the process engine, model assumptions, validation protocol, results and limitations.',
    es: 'Consulta el informe de investigación versionado sobre el motor de proceso, los supuestos, el protocolo de validación, los resultados y sus límites.',
  },
  reportLink: { en: 'Open the report on Zenodo (CC BY 4.0)', es: 'Abrir el informe en Zenodo (CC BY 4,0)' },
};

export default function Introduction() {
  const lang = useShellLang() as Lang;
  return (
    <div className="page-body wide of-introduction-page" data-doc-page>
    <SurfacePage title={T.title[lang]} lede={<span className="lede of-intro-lede">{T.lede[lang]}</span>} ariaLabel={T.views[lang]} instrument focus tabs={[
        { id: 'executive', label: T.executive[lang], content: <ExecutiveView data={executive} base={import.meta.env.BASE_URL} />, focus: true },
        { id: 'technical', label: T.technical[lang], content: <>
          <section className="prose of-topic" data-doc-section="">
            <h2>{T.reportTitle[lang]}</h2>
            <p>{T.reportText[lang]} <a href="https://doi.org/10.5281/zenodo.23783845" target="_blank" rel="noreferrer">{T.reportLink[lang]}</a>.</p>
          </section>
          <TopicGroups lang={lang} label={T.views} groups={INTRODUCTION} />
        </> },
      ]} />
    </div>
  );
}
