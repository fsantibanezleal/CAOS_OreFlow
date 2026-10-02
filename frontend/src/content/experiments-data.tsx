/**
 * Experiments, the data and splits tabs that 0.07.000 adds (PG-01). The data tab lists every dataset the
 * product uses with its licence, the hash that pins it and what it feeds, read from the records; the splits
 * tab states how each lane keeps its test data out of its training, with the leakage-safe diagram. The
 * learned lane's split sizes are the learning record's, and the measured lanes' are their own records'.
 */
import { loadGeometBenchmark, loadIndex, loadIronPlant, loadLearning, loadParticleBenchmark } from '../lib/artifacts';
import type { Lang } from '../lib/format';
import { Loaded, useArtifact } from './data';
import type { Topic } from './doc';
import { Arrow, Box, pick } from './figures';

const r = String.raw;
const n = (value: number, lang: Lang) => value.toLocaleString(lang === 'es' ? 'es-CL' : 'en-US');

function LineageFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-lineage-arrow)';
  const lane = (y: number, source: string, pin: string, stage: string, record: string, kind?: 'accent' | 'good') => (
    <g key={source}>
      <Box x={10} y={y} w={170} h={44} title={source} lines={[]} kind={kind} />
      <line className="dg-edge" x1={180} y1={y + 22} x2={206} y2={y + 22} markerEnd={arrow} />
      <Box x={210} y={y} w={150} h={44} title={pin} lines={[]} />
      <line className="dg-edge" x1={360} y1={y + 22} x2={386} y2={y + 22} markerEnd={arrow} />
      <Box x={390} y={y} w={150} h={44} title={stage} lines={[]} />
      <line className="dg-edge" x1={540} y1={y + 22} x2={566} y2={y + 22} markerEnd={arrow} />
      <Box x={570} y={y} w={180} h={44} title={record} lines={[]} />
    </g>
  );
  return (
    <svg className="fig-svg" viewBox="0 0 760 290" role="img" aria-label={p('Where each dataset comes from, what pins it, which stage reads it and which record it feeds', 'De dónde viene cada conjunto de datos, qué lo fija, qué etapa lo lee y qué registro alimenta')}>
      <Arrow id="of-lineage-arrow" />
      <text className="dg-box-title accent" x={10} y={16}>{p('Source', 'Fuente')}</text>
      <text className="dg-box-title accent" x={210} y={16}>{p('Pinned by', 'Fijado por')}</text>
      <text className="dg-box-title accent" x={390} y={16}>{p('Read by', 'Lo lee')}</text>
      <text className="dg-box-title accent" x={570} y={16}>{p('Feeds', 'Alimenta')}</text>
      {lane(26, p('Case catalog (authored)', 'Catálogo de casos (autor)'), p('the contract digest', 'la huella del contrato'), p('case stage', 'etapa de casos'), p('12 case records', '12 registros de caso'), 'accent')}
      {lane(84, p('Engine states', 'Estados del motor'), p('the design seed', 'la semilla del diseño'), p('learning stage', 'etapa de aprendizaje'), p('learning record', 'registro de aprendizaje'), 'accent')}
      {lane(142, 'HZDR RODARE 336', 'SHA-256', p('particle lane', 'vía de partículas'), p('particle benchmark', 'benchmark de partículas'), 'good')}
      {lane(200, 'Kaggle 6294 (CC0)', 'SHA-256', p('iron-plant lane', 'vía de la planta'), p('forecast record', 'registro del pronóstico'), 'good')}
      <text className="dg-box-sub" x={10} y={264}>{p('GeoMet (Zenodo 7051975) follows the particle lane: SHA-256 and MD5, the GeoMet lane, the locked-cycle benchmark;', 'GeoMet (Zenodo 7051975) sigue a la vía de partículas: SHA-256 y MD5, la vía GeoMet, el benchmark de ciclo cerrado;')}</text>
      <text className="dg-box-sub" x={10} y={280}>{p('its 52 samples also pass through the engine, in the precompute\'s real-samples stage.', 'sus 52 muestras además pasan por el motor, en la etapa de muestras reales del precálculo.')}</text>
    </svg>
  );
}

function DatasetTable({ lang }: { lang: Lang }) {
  const index = useArtifact(loadIndex);
  const learning = useArtifact(loadLearning);
  const particles = useArtifact(loadParticleBenchmark);
  const geomet = useArtifact(loadGeometBenchmark);
  const iron = useArtifact(loadIronPlant);
  const p = (en: string, es: string) => pick(lang, en, es);
  return (
    <Loaded lang={lang} errors={[index.error, learning.error, particles.error, geomet.error, iron.error]} ready={Boolean(index.value && learning.value && particles.value && geomet.value && iron.value)}>
      {() => {
        const ix = index.value!, L = learning.value!, P = particles.value!, G = geomet.value!, I = iron.value!;
        const rows: Array<[string, string, string, string, string]> = [
          [p('The twelve authored cases', 'Los doce casos de autor'), p('authored in the repository (MIT); parameters from cited ranges or labelled authored', 'de autor en el repositorio (MIT); parámetros de rangos citados o marcados de autor'),
            p(`contract digest ${ix.contract_digest.slice(0, 16)}`, `huella del contrato ${ix.contract_digest.slice(0, 16)}`),
            p(`${ix.n_cases} cases, ${ix.n_variants} variants`, `${ix.n_cases} casos, ${ix.n_variants} variantes`), p('every workbench view, the method records, the benchmark', 'cada vista del simulador, los registros de métodos, el benchmark')],
          [p('The learning design', 'El diseño de aprendizaje'), p('engine states, generated by the precompute', 'estados del motor, generados por el precálculo'),
            p(`seed ${L.design.seed}`, `semilla ${L.design.seed}`), p(`${n(L.design.rows, lang)} states, ${L.design.per_case} per case`, `${n(L.design.rows, lang)} estados, ${L.design.per_case} por caso`), p('the learned lane and its exported networks', 'la vía aprendida y sus redes exportadas')],
          [p('HZDR constructed-case particles', 'Partículas de casos construidos HZDR'), `${P.source.license}, doi:${P.source.doi}`, `SHA-256 ${P.source.sha256.slice(0, 16)}`,
            p(`${n(P.protocol.train_rows, lang)} training, ${n(P.protocol.test_rows, lang)} test particles`, `${n(P.protocol.train_rows, lang)} partículas de entrenamiento, ${n(P.protocol.test_rows, lang)} de prueba`), p('the particle lane and its network', 'la vía de partículas y su red')],
          [p('GeoMet locked-cycle tests', 'Ensayos de ciclo cerrado GeoMet'), `${G.source.license}, doi:${G.source.doi}`, `SHA-256 ${G.source.sha256.slice(0, 16)}`,
            p(`${G.source.usable_rows} of ${G.source.raw_rows} tests, ${G.source.holes} drill holes`, `${G.source.usable_rows} de ${G.source.raw_rows} ensayos, ${G.source.holes} sondajes`), p('the GeoMet lane and its checkpoint; the real-samples source', 'la vía GeoMet y su modelo guardado; la fuente de muestras reales')],
          [p('Iron-plant hourly records', 'Registros horarios de la planta de hierro'), `${I.source.license}, Kaggle ${I.source.dataset_id} v${I.source.version}`, `SHA-256 ${I.source.csv_sha256.slice(0, 16)}`,
            p(`${n(I.quality.source_rows, lang)} rows, ${n(I.protocol.pair_rows, lang)} hour pairs, ${I.source.date_first.slice(0, 10)} to ${I.source.date_last.slice(0, 10)}`, `${n(I.quality.source_rows, lang)} filas, ${n(I.protocol.pair_rows, lang)} pares horarios, ${I.source.date_first.slice(0, 10)} a ${I.source.date_last.slice(0, 10)}`),
            p('the industrial-quality lane and the plant-hour source', 'la vía de calidad industrial y la fuente de hora de planta')],
        ];
        return (
          <div>
            <table className="of-doc-table of-doc-table-data">
              <thead><tr>{[p('Dataset', 'Conjunto de datos'), p('Licence and source', 'Licencia y fuente'), p('Pinned by', 'Fijado por'), p('Size', 'Tamaño'), p('Feeds', 'Alimenta')].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>{rows.map(row => <tr key={row[0]}><th scope="row" className="of-doc-soft">{row[0]}</th>
                <td className="of-doc-wrap">{row[1]}</td><td className="of-doc-soft"><code>{row[2]}</code></td><td className="of-doc-wrap">{row[3]}</td><td className="of-doc-wrap">{row[4]}</td></tr>)}</tbody>
            </table>
            <p className="of-footnote">{p('The first 16 hexadecimal digits of each hash, read from the records (for the iron plant, its CSV\'s). The raw files are fetched by the setup scripts and checked against these hashes; none is committed.', 'Los primeros 16 dígitos hexadecimales de cada huella, leídos de los registros (para la planta de hierro, la de su CSV). Los archivos crudos se descargan con los scripts de preparación y se verifican contra estas huellas; ninguno se versiona.')}</p>
          </div>
        );
      }}
    </Loaded>
  );
}

export const DATA: Topic = {
  id: 'data',
  title: { en: 'The data', es: 'Los datos' },
  paragraphs: [
    { en: 'Five datasets feed OreFlow, and three of them are measured. The twelve cases are authored plants: every parameter carries its unit and either a source or the label authored, and the contract digest pins the whole catalog, so any change to a case changes the digest every record carries. The learning design is generated by the precompute from the cases\' envelopes with a declared seed, so the learned lane never sees a measurement.',
      es: 'Cinco conjuntos de datos alimentan a OreFlow, y tres de ellos son medidos. Los doce casos son plantas de autor: cada parámetro lleva su unidad y una fuente o la marca de autor, y la huella del contrato fija el catálogo completo, así que cualquier cambio en un caso cambia la huella que lleva cada registro. El diseño de aprendizaje lo genera el precálculo desde las envolventes de los casos con una semilla declarada, así que la vía aprendida nunca ve una medición.' },
    { en: 'The three measured datasets never calibrate the engine. The HZDR workbook gives particle measurements of four constructed separation cases with the source authors\' own predictions; the GeoMet record gives locked-cycle copper recoveries and assays from one deposit; the iron-plant record (Kaggle 6294, CC0) gives six months of one plant\'s hourly sensors and laboratory assays, used for a next-hour silica forecast. Each raw file is fetched by its lane\'s script, checked against the hash its record pins (the published one where the source publishes it) and never committed; the records keep the hash, the licence, the row counts and every excluded row with its reason.',
      es: 'Los tres conjuntos medidos nunca calibran el motor. El libro de trabajo HZDR da mediciones de partículas de cuatro casos de separación construidos con las propias predicciones de los autores de la fuente; el registro GeoMet da recuperaciones de cobre de ciclo cerrado y ensayes de un yacimiento; el registro de la planta de hierro (Kaggle 6294, CC0) da seis meses de sensores horarios y ensayes de laboratorio de una planta, usados para pronosticar la sílice de la hora siguiente. Cada archivo crudo lo descarga el script de su vía, se verifica contra la huella que fija su registro (la publicada donde la fuente la publica) y nunca se versiona; los registros guardan la huella, la licencia, los conteos de filas y cada fila excluida con su razón.' },
    { en: 'The GeoMet samples also pass through the engine as inputs (their copper, sulphur and iron assays and a work index from the pinned comminution table), so that the engine\'s recovery can be set beside each measured test; nothing in the engine is fitted to them. The GeoMet tests have no grind, reagent or residence, so they cannot set the engine\'s controls, and the HZDR probabilities are constructed, not observed recoveries. The measured lanes test the learned methods on real data, which the authored cases cannot do.',
      es: 'Las muestras GeoMet además pasan por el motor (con sus ensayes de cobre, azufre y hierro y un índice de trabajo tomado de la tabla de conminución fijada), para poner la recuperación del motor junto a cada ensayo medido; nada del motor se ajusta a ellas. Los ensayos GeoMet no tienen molienda, reactivos ni residencia, así que no pueden fijar los controles del motor, y las probabilidades HZDR son construidas, no recuperaciones observadas. Las vías medidas prueban los métodos aprendidos sobre datos reales, lo que los casos de autor no pueden hacer.' },
  ],
  equations: [
    { tex: { en: r`h = \mathrm{SHA\text{-}256}(\text{file}),\qquad h \ne h_{\text{pinned}} \;\Rightarrow\; \text{stop}`, es: r`h = \mathrm{SHA\text{-}256}(\text{archivo}),\qquad h \ne h_{\text{fijada}} \;\Rightarrow\; \text{detener}` }, caption: { en: 'A measured source is read only when its hash is the one its record pins.', es: 'Una fuente medida se lee solo cuando su huella es la que fija su registro.' } },
  ],
  limits: [
    { en: 'The measured lanes are one deposit, one constructed workbook and six months of one plant\'s records; they say how the learned methods behave on real rows, not how a plant runs.', es: 'Las vías medidas son un yacimiento, un libro de trabajo construido y seis meses de registros de una planta; dicen cómo se comportan los métodos aprendidos sobre filas reales, no cómo opera una planta.' },
  ],
  figure: { caption: { en: 'Where each dataset comes from, what pins it, which stage reads it and which record it feeds.', es: 'De dónde viene cada conjunto de datos, qué lo fija, qué etapa lo lee y qué registro alimenta.' }, render: lang => <LineageFigure lang={lang} />, wide: true },
  data: lang => <DatasetTable lang={lang} />,
  refs: ['hzdr', 'particle-paper', 'geomet', 'kaggle6294'],
};

function SplitsFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const cell = (x: number, y: number, kind: 'train' | 'test' | 'none', key: string) => (
    <rect key={key} x={x} y={y} width={16} height={12} rx={2} className={kind === 'test' ? 'dg-fill-warn' : kind === 'train' ? 'dg-fill-accent' : 'dg-box'} />
  );
  const cases = 12;
  return (
    <svg className="fig-svg" viewBox="0 0 440 350" role="img" aria-label={p('Interpolation holds out states inside every case; leave one case out holds out whole cases; the measured lanes hold out whole drill holes, keep their published sheets, or test forward in time', 'La interpolación reserva estados dentro de cada caso; dejar un caso fuera reserva casos completos; las vías medidas reservan sondajes completos, conservan sus hojas publicadas o prueban hacia adelante en el tiempo')}>
      <text className="dg-box-title accent" x={10} y={16}>{p('Interpolation: 20% of every case', 'Interpolación: 20% de cada caso')}</text>
      {Array.from({ length: cases }, (_, c) => [0, 1, 2, 3, 4].map(s => cell(10 + c * 20, 26 + s * 14, s === 4 ? 'test' : 'train', `i${c}${s}`)))}
      <text className="dg-box-title accent" x={10} y={116}>{p('Leave one case out: twelve folds', 'Dejar un caso fuera: doce particiones')}</text>
      {[0, 1, 2].map(f => Array.from({ length: cases }, (_, c) => cell(10 + c * 20, 126 + f * 14, c === f ? 'test' : 'train', `l${f}${c}`)))}
      <text className="dg-box-sub" x={250} y={150}>{p('... and nine more', '... y nueve más')}</text>
      <text className="dg-box-title accent" x={10} y={196}>{p('GeoMet: whole drill holes, then spatial zones', 'GeoMet: sondajes completos, luego zonas espaciales')}</text>
      {Array.from({ length: 10 }, (_, h) => cell(10 + h * 20, 206, h % 5 === 0 ? 'test' : 'train', `g${h}`))}
      <text className="dg-box-title accent" x={10} y={246}>{p('HZDR: the published training and test sheets', 'HZDR: las hojas publicadas de entrenamiento y prueba')}</text>
      {cell(10, 256, 'train', 'h1')}<text className="dg-box-sub" x={32} y={266}>{p('training', 'entrenamiento')}</text>
      {cell(130, 256, 'test', 'h2')}<text className="dg-box-sub" x={152} y={266}>{p('test', 'prueba')}</text>
      <text className="dg-box-title accent" x={10} y={296}>{p('Iron plant: forward windows, at least 24 h apart', 'Planta de hierro: ventanas futuras, separadas 24 h o más')}</text>
      {Array.from({ length: 12 }, (_, h) => cell(10 + h * 20, 306, h < 8 ? 'train' : h === 8 ? 'none' : 'test', `t${h}`))}
      <text className="dg-box-sub" x={10} y={340}>{p('Preprocessing is fitted on training rows only.', 'El preprocesamiento usa solo filas de entrenamiento.')}</text>
    </svg>
  );
}

function SplitTable({ lang }: { lang: Lang }) {
  const learning = useArtifact(loadLearning);
  const particles = useArtifact(loadParticleBenchmark);
  const geomet = useArtifact(loadGeometBenchmark);
  const iron = useArtifact(loadIronPlant);
  const p = (en: string, es: string) => pick(lang, en, es);
  return (
    <Loaded lang={lang} errors={[learning.error, particles.error, geomet.error, iron.error]} ready={Boolean(learning.value && particles.value && geomet.value && iron.value)}>
      {() => {
        const L = learning.value!, P = particles.value!.protocol, G = geomet.value!.protocols, I = iron.value!;
        const embargo = Math.min(...I.folds.map(f => f.embargo_hours_min));
        const loco = L.leave_one_case_out[0];
        const rows: Array<[string, string, string, string]> = [
          [p('Learned lane, interpolation', 'Vía aprendida, interpolación'), p('a fifth of every case\'s states, seeded', 'un quinto de los estados de cada caso, sembrado'), n(L.interpolation.train_rows, lang), n(L.interpolation.test_rows, lang)],
          [p('Learned lane, leave one case out', 'Vía aprendida, dejar un caso fuera'), p(`one whole case per fold, ${L.leave_one_case_out.length} folds`, `un caso completo por partición, ${L.leave_one_case_out.length} particiones`), n(loco.train_rows, lang), n(loco.test_rows, lang)],
          [p('Guard, false accepts', 'Guardia, falsas aceptaciones'), p('held-out states pushed past one feature\'s range', 'estados reservados empujados más allá del rango de una variable'), '', n(L.guard.probe_rows, lang)],
          [p('HZDR particles', 'Partículas HZDR'), p('the published sheets; 15% of the training sheet stops the network early', 'las hojas publicadas; 15% de la hoja de entrenamiento detiene la red antes'), n(P.fit_rows, lang), n(P.test_rows, lang)],
          [p('GeoMet, whole holes', 'GeoMet, sondajes completos'), p(`${G.hole.folds.length} folds; no hole in both training and test`, `${G.hole.folds.length} particiones; ningún sondaje en entrenamiento y prueba`), n(G.hole.folds[0].train_rows, lang), n(G.hole.folds[0].test_rows, lang)],
          [p('GeoMet, spatial zones', 'GeoMet, zonas espaciales'), p(`${G.zone.folds.length} folds of holes sorted by position`, `${G.zone.folds.length} particiones de sondajes ordenados por posición`), n(G.zone.folds[0].train_rows, lang), n(G.zone.folds[0].test_rows, lang)],
          [p('Iron plant, forward windows', 'Planta de hierro, ventanas futuras'), p(`${I.folds.length} windows; the expanding history before each, ${embargo} h or more of embargo`, `${I.folds.length} ventanas; la historia creciente anterior a cada una, ${embargo} h o más de embargo`), n(I.folds[0].train_rows, lang), n(I.folds[0].test_rows, lang)],
        ];
        return (
          <div>
            <table className="of-doc-table of-doc-table-data">
              <thead><tr>{[p('Split', 'Partición'), p('What is held out', 'Qué se reserva'), p('Training rows', 'Filas de entrenamiento'), p('Test rows', 'Filas de prueba')].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>{rows.map(row => <tr key={row[0]}><th scope="row" className="of-doc-soft">{row[0]}</th><td className="of-doc-wrap">{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td></tr>)}</tbody>
            </table>
            <p className="of-footnote">{p('The first fold of each protocol that has folds; the rows vary slightly between the GeoMet folds, because whole holes are kept together.', 'La primera partición de cada protocolo que tiene particiones; las filas varían un poco entre las particiones GeoMet, porque los sondajes completos se mantienen juntos.')}</p>
          </div>
        );
      }}
    </Loaded>
  );
}

export const SPLITS: Topic = {
  id: 'splits',
  title: { en: 'Splits', es: 'Particiones' },
  paragraphs: [
    { en: 'Every score in OreFlow is measured on rows the model never trained on, and every split says what it keeps apart. The learned lane has two protocols on its 3072 engine states. Interpolation holds out a fifth of every case\'s states, so it measures how well a model fills in between states of plants it knows. Leave one case out holds out a whole case in each of twelve folds, so no state of the tested plant is seen in training: it measures transfer to a plant the model has not met, and the features are physical properties and controls, never the case\'s identity.',
      es: 'Cada puntaje en OreFlow se mide sobre filas con las que el modelo nunca entrenó, y cada partición dice qué mantiene aparte. La vía aprendida tiene dos protocolos sobre sus 3072 estados del motor. La interpolación reserva un quinto de los estados de cada caso, así que mide qué tan bien un modelo completa entre estados de plantas que conoce. Dejar un caso fuera reserva un caso completo en cada una de doce particiones, así que ningún estado de la planta probada se ve al entrenar: mide la transferencia a una planta que el modelo no ha visto, y las variables son propiedades físicas y controles, nunca la identidad del caso.' },
    { en: 'The guard is tested on both sides of its threshold: its false alarms on the held-out states of the envelope, and its false accepts on probes, each held-out state pushed half its training range past the maximum of one continuous feature at a time. The measured lanes follow the same rule with their own units: the GeoMet tests are split by whole drill hole and by spatial zone, because tests from one hole are not independent, and the HZDR particles keep the source\'s own training and test sheets. The iron-plant forecast keeps time order: three forward windows, each trained on the expanding history before it and tested after at least 24 hours of embargo.',
      es: 'El guardia se prueba a ambos lados de su umbral: sus falsas alarmas sobre los estados reservados de la envolvente, y sus falsas aceptaciones sobre sondas, cada estado reservado empujado la mitad de su rango de entrenamiento más allá del máximo de una variable continua a la vez. Las vías medidas siguen la misma regla con sus propias unidades: los ensayos GeoMet se dividen por sondaje completo y por zona espacial, porque los ensayos de un sondaje no son independientes, y las partículas HZDR conservan las propias hojas de entrenamiento y prueba de la fuente. El pronóstico de la planta de hierro respeta el orden temporal: tres ventanas futuras, cada una entrenada con la historia creciente anterior y probada tras al menos 24 horas de embargo.' },
    { en: 'In every split the preprocessing is fitted on the training rows alone: the scalers of the learned lane, the imputation and scaling of the GeoMet and iron-plant models, and the early-stopping rows of the networks, which come out of the training side. A split that let a test row shape the scaler would leak it into the score.',
      es: 'En cada partición el preprocesamiento se ajusta solo con las filas de entrenamiento: los escaladores de la vía aprendida, la imputación y el escalamiento de los modelos GeoMet y de la planta de hierro, y las filas de parada temprana de las redes, que salen del lado de entrenamiento. Una partición que dejara a una fila de prueba dar forma al escalador la filtraría en el puntaje.' },
  ],
  equations: [
    { tex: { en: r`\mathcal{D}_{\text{train}}^{(c)} = \mathcal{D} \setminus \mathcal{D}_c,\qquad \mathcal{D}_{\text{test}}^{(c)} = \mathcal{D}_c`, es: r`\mathcal{D}_{\text{entrenamiento}}^{(c)} = \mathcal{D} \setminus \mathcal{D}_c,\qquad \mathcal{D}_{\text{prueba}}^{(c)} = \mathcal{D}_c` }, caption: { en: 'Leave one case out: fold c trains on every state outside case c and tests on case c.', es: 'Dejar un caso fuera: la partición c entrena con cada estado fuera del caso c y prueba en el caso c.' } },
    { tex: r`\alpha = \Pr\left[e(z) > q_{0.99}\mid z \in U\right],\qquad \beta = \Pr\left[e(z) \le q_{0.99}\mid z \notin U\right]`, caption: { en: 'The guard\'s false-alarm rate α on in-envelope states U, and its false-accept rate β on out-of-envelope probes.', es: 'La tasa de falsas alarmas α del guardia sobre estados de la envolvente U, y su tasa de falsas aceptaciones β sobre sondas fuera de ella.' } },
  ],
  limits: [
    { en: 'Leave one case out measures transfer to a thirteenth authored plant, not to a real one; the twelve cases are the whole population the models ever see.', es: 'Dejar un caso fuera mide la transferencia a una decimotercera planta de autor, no a una real; los doce casos son toda la población que los modelos llegan a ver.' },
    { en: 'The guard\'s probes step out along one feature at a time; a state that is unusual only in a combination of features is not probed.', es: 'Las sondas del guardia salen a lo largo de una variable a la vez; un estado que solo es inusual en una combinación de variables no se sondea.' },
  ],
  figure: { caption: { en: 'What each split holds out: states inside every case, whole cases, whole drill holes, or the published sheets.', es: 'Qué reserva cada partición: estados dentro de cada caso, casos completos, sondajes completos, o las hojas publicadas.' }, render: lang => <SplitsFigure lang={lang} /> },
  data: lang => <SplitTable lang={lang} />,
  refs: ['sklearn2011', 'geomet', 'hzdr'],
};
