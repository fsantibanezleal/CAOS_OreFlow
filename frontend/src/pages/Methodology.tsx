/**
 * Methodology (ADR-0016 section 9.C): every model and method of the engine, grouped by the question it
 * answers, each topic with its prose, governing equations, parameters, limits, a figure and its own
 * references, transcribed from the methodology and the research dossier.
 */
import { useShellLang } from '@fasl-work/caos-app-shell';
import { DocPage, TopicGroups } from '../content/doc';
import { COMMINUTION } from '../content/methodology/comminution';
import { METHODS } from '../content/methodology/methods';
import { SEPARATION } from '../content/methodology/separation';
import { STREAMS } from '../content/methodology/streams';
import type { Lang } from '../lib/format';

const T = {
  title: { en: 'Methodology', es: 'Metodología' },
  lede: {
    en: 'How the engine turns an ore and a plant into streams, grades and energies: the particle and stream model, comminution, classification and separation, and the method records built on top of them. Every equation is the form the engine solves; every parameter is authored inside a range the research records, and every model states what it leaves out.',
    es: 'Cómo el motor convierte un mineral y una planta en corrientes, leyes y energías: el modelo de partículas y corrientes, la conminución, la clasificación y la separación, y los registros de métodos construidos sobre ellos. Cada ecuación es la forma que resuelve el motor; cada parámetro es de autor dentro de un rango que registra la investigación, y cada modelo dice lo que deja fuera.',
  },
  groups: { en: 'Model groups', es: 'Grupos de modelos' },
  streams: { en: 'Streams and conservation', es: 'Corrientes y conservación' },
  comminution: { en: 'Comminution', es: 'Conminución' },
  separation: { en: 'Classification and separation', es: 'Clasificación y separación' },
  methods: { en: 'Method records', es: 'Registros de métodos' },
};

export default function Methodology() {
  const lang = useShellLang() as Lang;
  return (
    <DocPage title={T.title[lang]} lede={T.lede[lang]}>
      <TopicGroups lang={lang} label={T.groups} groups={[
        { id: 'streams', label: T.streams, topics: STREAMS },
        { id: 'comminution', label: T.comminution, topics: COMMINUTION },
        { id: 'separation', label: T.separation, topics: SEPARATION },
        { id: 'methods', label: T.methods, topics: METHODS },
      ]} />
    </DocPage>
  );
}
