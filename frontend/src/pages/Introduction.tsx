/**
 * Introduction (ADR-0016 section 9.C): what OreFlow is and who it is for, the approach, the twelve
 * cases, the scope and evidence, and how to use the workbench, each with its figure and references.
 */
import { useShellLang } from '@fasl-work/caos-app-shell';
import { DocPage, TopicGroups } from '../content/doc';
import { INTRODUCTION } from '../content/introduction';
import type { Lang } from '../lib/format';

const T = {
  title: { en: 'OreFlow', es: 'OreFlow' },
  lede: {
    en: 'OreFlow computes how a grinding and separation circuit trades recovery, concentrate grade, energy and water, from a stated ore, plant and operating point. This page says what it is for, how it works, what the twelve cases cover, what its results can and cannot support, and how to read the workbench.',
    es: 'OreFlow calcula cómo un circuito de molienda y separación intercambia recuperación, ley de concentrado, energía y agua, desde un mineral, una planta y un punto de operación declarados. Esta página dice para qué sirve, cómo funciona, qué cubren los doce casos, qué pueden sostener sus resultados y qué no, y cómo leer el laboratorio.',
  },
  sections: { en: 'Introduction sections', es: 'Secciones de la introducción' },
};

export default function Introduction() {
  const lang = useShellLang() as Lang;
  return (
    <DocPage title={T.title[lang]} lede={T.lede[lang]}>
      <TopicGroups lang={lang} label={T.sections} groups={INTRODUCTION} />
    </DocPage>
  );
}
