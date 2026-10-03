/**
 * Implementation (ADR-0016 section 9.C): the system, the engine and its browser port, the bake, the
 * contracts and artifacts, what runs where, and the gates and release. Transcribed from the bake and
 * browser-engine architecture pages, the data contracts, the process-engine design and the deployment
 * record; the stage timings, artifact bytes and hashes and the exported networks are read from the
 * committed validation record, manifests and learning record.
 */
import { loadIndex, loadLearning, loadManifest, loadValidation } from '../lib/artifacts';
import type { CaseManifest } from '../lib/artifacts.types';
import { formatFixed, formatSignificant, type Lang } from '../lib/format';
import { Loaded, useArtifact } from './data';
import type { Bi, Topic } from './doc';
import { Arrow, Box, pick } from './figures';
import { DEPLOY, GPU, MODELS } from './implementation-models';

const r = String.raw;

function ArchitectureFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-impl-arrow)';
  const column = (x: number, title: string, boxes: Array<{ y: number; h: number; title: string; lines: string[]; kind?: 'accent' | 'good' | 'optional' }>) => (
    <g>
      <rect className="of-dg-frame" x={x} y="14" width="250" height="456" rx="10" />
      <text className="dg-box-title accent" x={x + 12} y="34">{title}</text>
      {boxes.map(b => <Box key={b.title} x={x + 12} y={b.y} w={226} h={b.h} title={b.title} lines={b.lines} kind={b.kind} />)}
    </g>
  );
  return (
    <svg className="fig-svg" viewBox="0 0 900 560" role="img" aria-label={p('The offline precompute in its stage order, the committed artifacts, the browser and the service', 'El precálculo fuera de línea en el orden de sus etapas, los artefactos versionados, el navegador y el servicio')}>
      <Arrow id="of-impl-arrow" />
      {column(12, p('Precompute (workstation)', 'Precálculo (estación de trabajo)'), [
        { y: 48, h: 42, title: p('Python engine', 'Motor en Python'), kind: 'accent', lines: [p('grid, units, solvers, trace', 'malla, unidades, cálculo, traza')] },
        { y: 95, h: 42, title: p('1 Contract', '1 Contrato'), lines: [p('bounds, rules, digest', 'límites, reglas, huella')] },
        { y: 142, h: 42, title: p('2 Learning, CUDA', '2 Aprendizaje, CUDA'), lines: [p('networks, guard, screen', 'redes, guardia, filtro')] },
        { y: 189, h: 42, title: p('3 Cases, 12 workers', '3 Casos, 12 procesos'), lines: [p('traces, optimizer, Sobol', 'trazas, optimizador, Sobol')] },
        { y: 236, h: 42, title: p('4 Benchmark', '4 Benchmark'), lines: [p('oracles, cross-case summary', 'oráculos, resumen entre casos')] },
        { y: 283, h: 42, title: p('5 Studies, 12 workers', '5 Estudios, 12 procesos'), lines: [p('ablations, seed study', 'ablaciones, semillas')] },
        { y: 330, h: 42, title: p('6 Real samples', '6 Muestras reales'), lines: [p('52 GeoMet tests in the engine', '52 ensayos GeoMet en el motor')] },
        { y: 377, h: 42, title: p('7 Manifests', '7 Manifiestos'), lines: [p('bytes, SHA-256, the index', 'bytes, SHA-256, el índice')] },
        { y: 424, h: 42, title: p('8 Validation', '8 Validación'), lines: [p('every record checked', 'cada registro verificado')] },
      ])}
      {column(325, p('Committed artifacts', 'Artefactos versionados'), [
        { y: 48, h: 44, title: p('Operating contract', 'Contrato de operación'), lines: [p('13 inputs, 4 families', '13 entradas, 4 familias')] },
        { y: 102, h: 58, title: p('12 case artifacts', '12 artefactos de caso'), lines: [p('96 variants with traces', '96 variantes con trazas'), p('and method records', 'y registros de métodos')] },
        { y: 170, h: 58, title: p('Learning and models', 'Aprendizaje y modelos'), lines: [p('surrogate and guard ONNX', 'ONNX de sustituto y guardia'), p('screen: float64 weights, GP', 'filtro: pesos float64, GP')] },
        { y: 238, h: 58, title: p('Benchmark, studies,', 'Benchmark, estudios,'), lines: [p('real samples, validation', 'muestras reales, validación'), p('oracles, checks, timings', 'oráculos, controles, tiempos')] },
        { y: 306, h: 44, title: p('Manifests and index', 'Manifiestos e índice'), lines: [p('bytes, SHA-256, digest', 'bytes, SHA-256, huella')] },
        { y: 360, h: 58, title: p('Measured lanes (source)', 'Vías medidas (source)'), kind: 'optional', lines: [p('HZDR, GeoMet, iron plant:', 'HZDR, GeoMet, planta de hierro:'), p('run_*.py, before the precompute', 'run_*.py, antes del precálculo')] },
      ])}
      {column(638, p('Browser (the site)', 'Navegador (el sitio)'), [
        { y: 48, h: 44, title: p('Contract validator', 'Validador del contrato'), lines: [p('same codes as the service', 'mismos códigos del servicio')] },
        { y: 102, h: 58, title: p('TypeScript engine port', 'Motor en TypeScript'), kind: 'good', lines: [p('a trace per control change', 'una traza por cada cambio'), p('within 1e-6 of Python', 'a 1e-6 del de Python')] },
        { y: 170, h: 58, title: p('Web Workers, on request', 'Web Workers, a pedido'), lines: [p('sweeps, optimizer,', 'barridos, optimizador,'), p('uncertainty; cancellable', 'incertidumbre; cancelables')] },
        { y: 238, h: 58, title: p('Learned models', 'Modelos aprendidos'), lines: [p('surrogate, guard: ONNX, wasm', 'sustituto, guardia: ONNX, wasm'), p('screen: float64, optimizer', 'filtro: float64, optimizador')] },
        { y: 306, h: 44, title: p('Views draw the trace', 'Las vistas dibujan la traza'), lines: [p('no engine formula in the views', 'sin fórmulas del motor en las vistas')] },
      ])}
      <line className="dg-edge" x1="262" y1="180" x2="323" y2="180" markerEnd={arrow} />
      <line className="dg-edge" x1="575" y1="180" x2="636" y2="180" markerEnd={arrow} />
      <text className="dg-edge-label" x="293" y="488" textAnchor="middle">{p('the precompute writes, then validates', 'el precálculo escribe y luego valida')}</text>
      <text className="dg-edge-label" x="606" y="488" textAnchor="middle">{p('the build copies them into the site', 'la compilación los copia al sitio')}</text>
      <line className="dg-edge" x1="450" y1="470" x2="450" y2="504" markerEnd={arrow} />
      <Box x={12} y={506} w={876} h={46} title={p('Service: the Python engine behind the same contract', 'Servicio: el motor en Python tras el mismo contrato')}
        lines={[p('validated simulation, catalog and benchmark; serves the built site; never trains or rewrites an artifact', 'simulación validada, catálogo y benchmark; sirve el sitio compilado; nunca entrena ni reescribe un artefacto')]} />
    </svg>
  );
}

function ParityFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-impl-arrow-2)';
  return (
    <svg className="fig-svg" viewBox="0 0 440 250" role="img" aria-label={p('Both engines re-simulate every precomputed variant and every number is compared', 'Ambos motores vuelven a simular cada variante precalculada y se compara cada número')}>
      <Arrow id="of-impl-arrow-2" />
      <Box x={8} y={96} w={128} h={58} title={p('case artifact', 'artefacto de caso')} lines={[p('definition', 'definición'), p('and point', 'y punto')]} />
      <Box x={160} y={30} w={146} h={50} title={p('Python engine', 'motor en Python')} kind="accent" lines={[p('precomputed trace', 'traza precalculada')]} />
      <Box x={160} y={170} w={146} h={50} title={p('TypeScript port', 'versión en TypeScript')} kind="good" lines={[p('recomputed trace', 'traza recalculada')]} />
      <Box x={326} y={96} w={106} h={58} title={p('compare', 'comparar')} lines={[p('1e-6 relative', '1e-6 relativo'), p('every number', 'cada número')]} />
      {/* the engine boxes are 146 px: the Spanish 'versión en TypeScript' ran past 128 (0.08 gate) */}
      <path className="dg-edge" d="M 136 116 L 147 116 L 147 55 L 158 55" markerEnd={arrow} />
      <path className="dg-edge" d="M 136 134 L 147 134 L 147 195 L 158 195" markerEnd={arrow} />
      <path className="dg-edge" d="M 306 55 L 315 55 L 315 116 L 324 116" markerEnd={arrow} />
      <path className="dg-edge" d="M 306 195 L 315 195 L 315 134 L 324 134" markerEnd={arrow} />
      <text className="dg-note" x="220" y="244" textAnchor="middle">{p('96 variants: every metric, stream, curve and kinetic record', '96 variantes: cada métrica, corriente, curva y registro cinético')}</text>
    </svg>
  );
}

function BakeFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-impl-arrow-3)';
  const stages: Array<[string, string]> = [
    [p('contract', 'contrato'), p('operating contract, probes', 'contrato de operación, sondas')],
    [p('learning, CUDA', 'aprendizaje, CUDA'), p('learning record, ONNX, the screen', 'el registro, ONNX y el filtro')],
    [p('cases, 12 workers', 'casos, 12 procesos'), p('12 case artifacts, 96 variants', '12 artefactos de caso, 96 variantes')],
    [p('benchmark', 'benchmark'), p('the cross-case summary', 'el resumen entre casos')],
    [p('studies, 12 workers', 'estudios, 12 procesos'), p('ablations and the seed study', 'ablaciones y el estudio de semillas')],
    [p('real samples', 'muestras reales'), p('52 GeoMet samples in the engine', '52 muestras GeoMet en el motor')],
    [p('manifests', 'manifiestos'), p('manifests and the index', 'manifiestos y el índice')],
    [p('validation', 'validación'), p('the validation record', 'el registro de validación')],
  ];
  return (
    <svg className="fig-svg" viewBox="0 0 440 374" role="img" aria-label={p('The eight stages of the precompute and what each writes', 'Las ocho etapas del precálculo y lo que escribe cada una')}>
      <Arrow id="of-impl-arrow-3" />
      {stages.map(([stage, output], k) => (
        <g key={stage}>
          <rect className={k === 1 || k === 2 ? 'dg-box accent' : 'dg-box'} x="14" y={12 + 42 * k} width="170" height="32" rx="6" />
          <text className="dg-box-title" x="26" y={33 + 42 * k}>{stage}</text>
          {k < stages.length - 1 && <line className="dg-edge" x1="99" y1={44 + 42 * k} x2="99" y2={52 + 42 * k} markerEnd={arrow} />}
          <line className="dg-edge" x1="184" y1={28 + 42 * k} x2="204" y2={28 + 42 * k} markerEnd={arrow} />
          <text className="dg-box-sub" x="210" y={32 + 42 * k}>{output}</text>
        </g>
      ))}
      <text className="dg-note" x="220" y="364" textAnchor="middle">{p('a failing check fails the precompute; nothing partial is indexed', 'una verificación fallida hace fallar el precálculo; nada parcial se indexa')}</text>
    </svg>
  );
}

function ContractFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-impl-arrow-4)';
  const top: Array<[string, string]> = [[p('state', 'estado'), p('case + point', 'caso + punto')], [p('validate', 'validar'), p('same file', 'mismo archivo')], [p('engine', 'motor'), p('solves', 'resuelve')], [p('trace', 'traza'), p('v2, strict', 'v2, estricta')]];
  const bottom: Array<[string, string, number, number]> = [[p('case artifact', 'artefacto'), p('8 variants', '8 variantes'), 10, 120], [p('manifest', 'manifiesto'), 'bytes, SHA-256', 160, 120], [p('index', 'índice'), p('this run only', 'solo esta corrida'), 310, 120]];
  return (
    <svg className="fig-svg" viewBox="0 0 440 262" role="img" aria-label={p('From a state through validation and the engine to the trace, the case artifact, its manifest and the index', 'De un estado por la validación y el motor a la traza, el artefacto de caso, su manifiesto y el índice')}>
      <Arrow id="of-impl-arrow-4" />
      {top.map(([title, sub], k) => (
        <g key={title}>
          <Box x={10 + 110 * k} y={24} w={90} h={48} title={title} lines={[sub]} kind={k === 1 ? 'accent' : undefined} />
          {k < top.length - 1 && <line className="dg-edge" x1={100 + 110 * k} y1="48" x2={118 + 110 * k} y2="48" markerEnd={arrow} />}
        </g>
      ))}
      <line className="dg-edge" x1="165" y1="72" x2="165" y2="96" markerEnd={arrow} />
      <Box x={100} y={98} w={134} h={44} title={p('rejected', 'rechazado')} lines={[p('code and limits', 'código y límites')]} />
      <path className="dg-edge" d="M 385 72 L 385 158 L 70 158 L 70 174" markerEnd={arrow} />
      <text className="dg-edge-label" x="380" y="152" textAnchor="end">{p('precomputed per variant', 'precalculada por variante')}</text>
      {bottom.map(([title, sub, x, w], k) => (
        <g key={title}>
          <Box x={x} y={176} w={w} h={48} title={title} lines={[sub]} />
          {k < bottom.length - 1 && <line className="dg-edge" x1={x + w} y1="200" x2={bottom[k + 1][2] - 2} y2="200" markerEnd={arrow} />}
        </g>
      ))}
      <text className="dg-note" x="220" y="250" textAnchor="middle">{p('every engine record carries the engine version and the contract digest', 'cada registro del motor lleva la versión del motor y la huella del contrato')}</text>
    </svg>
  );
}

function LanesFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const lanes: Array<{ title: string; kind: 'accent' | 'good' | undefined; items: string[] }> = [
    { title: p('Live (browser)', 'Vivo (navegador)'), kind: 'good', items: [p('validator', 'validador'), p('engine port', 'motor en TypeScript'), p('worker sweeps', 'barridos en worker'), p('optimizer', 'optimizador'), p('uncertainty', 'incertidumbre'), p('ONNX surrogate', 'sustituto ONNX'), p('ONNX guard', 'guardia ONNX'), p('float64 screen', 'filtro float64')] },
    { title: p('Precomputed (read)', 'Precálculo (leído)'), kind: 'accent', items: [p('kinetic fits', 'ajustes cinéticos'), p('optimization', 'optimización'), p('uncertainty', 'incertidumbre'), p('Sobol indices', 'índices de Sobol'), p('learning results', 'resultados ML'), p('studies, samples', 'estudios, muestras')] },
    { title: p('Service', 'Servicio'), kind: undefined, items: [p('same contract', 'mismo contrato'), p('validated simulate', 'simulación validada'), p('catalog, benchmark', 'catálogo, benchmark'), p('serves the site', 'sirve el sitio'), p('never trains', 'nunca entrena')] },
  ];
  return (
    <svg className="fig-svg" viewBox="0 0 440 252" role="img" aria-label={p('What runs live in the browser, what is precomputed and read, and what the service does', 'Qué corre en vivo en el navegador, qué se precalcula y se lee, y qué hace el servicio')}>
      {lanes.map((lane, k) => <Box key={lane.title} x={5 + 145 * k} y={10} w={140} h={194} title={lane.title} lines={lane.items} step={20} kind={lane.kind} />)}
      <text className="dg-note" x="220" y="226" textAnchor="middle">{p('a moved control re-solves the circuit live; the optimizer', 'un control movido resuelve el circuito en vivo; el optimizador')}</text>
      <text className="dg-note" x="220" y="240" textAnchor="middle">{p('and the uncertainty design re-run only when asked', 'y el diseño de incertidumbre se recalculan solo a pedido')}</text>
    </svg>
  );
}

function ReleaseFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-impl-arrow-5)';
  return (
    <svg className="fig-svg" viewBox="0 0 440 260" role="img" aria-label={p('Local gates, then the task branch, develop and main, then Pages and the service', 'Controles locales, luego la rama de tarea, develop y main, luego Pages y el servicio')}>
      <Arrow id="of-impl-arrow-5" />
      <Box x={10} y={14} w={420} h={46} title={p('Local, before a release', 'Local, antes de publicar')} kind="accent" lines={[p('Python tests · precompute · browser gate · screenshots read', 'pruebas Python · precalculado · control en navegador · capturas leídas')]} />
      <line className="dg-edge" x1="70" y1="60" x2="70" y2="78" markerEnd={arrow} />
      <Box x={10} y={80} w={120} h={46} title={p('task branch', 'rama de tarea')} lines={[p('no CI', 'sin CI')]} />
      <Box x={160} y={80} w={120} h={46} title="develop" lines={[p('CI checks', 'controles CI')]} />
      <Box x={310} y={80} w={120} h={46} title="main" lines={[p('CI and Pages', 'CI y Pages')]} />
      <line className="dg-edge" x1="130" y1="103" x2="158" y2="103" markerEnd={arrow} />
      <line className="dg-edge" x1="280" y1="103" x2="308" y2="103" markerEnd={arrow} />
      <path className="dg-edge" d="M 350 126 L 350 146 L 110 146 L 110 166" markerEnd={arrow} />
      <path className="of-dg-optional-edge" d="M 390 126 L 390 166" markerEnd={arrow} />
      <text className="dg-edge-label" x="150" y="140">{p('on push, by the workflow', 'al publicar, por el flujo')}</text>
      <text className="dg-edge-label" x="384" y="160" textAnchor="end">{p('by hand', 'a mano')}</text>
      <Box x={10} y={168} w={200} h={46} title="GitHub Pages" kind="good" lines={[p('project path, route files', 'ruta del proyecto, rutas')]} />
      <Box x={230} y={168} w={200} h={46} title={p('Service (VPS)', 'Servicio (VPS)')} kind="good" lines={[p('pulled from main over SSH', 'desde main por SSH')]} />
      <text className="dg-note" x="220" y="240" textAnchor="middle">{p('checked from outside: health, routes, catalog, a simulation', 'verificado desde fuera: salud, rutas, catálogo, una simulación')}</text>
    </svg>
  );
}

/** Every stage of the precompute in words; a test fails on a stage the validation record lists without one (T-07). */
export const STAGE_TEXT: Record<string, { name: Bi; what: Bi; output: Bi }> = {
  contract: { name: { en: 'contract', es: 'contrato' }, what: { en: 'Resolves the operating contract for every case and records the probe verdicts', es: 'Resuelve el contrato de operación de cada caso y registra los veredictos de las sondas' }, output: { en: 'the operating contract and its probes', es: 'el contrato de operación y sus sondas' } },
  cases: { name: { en: 'cases', es: 'casos' }, what: { en: "Per case, in parallel: every variant's trace, optimization and uncertainty records, and the nominal variant's Sobol record", es: 'Por caso, en paralelo: la traza de cada variante, sus registros de optimización e incertidumbre, y el registro de Sobol de la variante nominal' }, output: { en: 'twelve case artifacts', es: 'doce artefactos de caso' } },
  learning: { name: { en: 'learning', es: 'aprendizaje' }, what: { en: 'The learned lane on a 3072-state design: two protocols, five models, the guard and the ONNX export', es: 'La vía aprendida sobre un diseño de 3072 estados: dos protocolos, cinco modelos, el guardia y la exportación ONNX' }, output: { en: 'the learning record, two networks and the optimizer\'s screen', es: 'el registro de aprendizaje, dos redes y el filtro del optimizador' } },
  benchmark: { name: { en: 'benchmark', es: 'benchmark' }, what: { en: "The cross-case summary from this run's records and the recomputed oracles", es: 'El resumen entre casos desde los registros de esta corrida y los oráculos recalculados' }, output: { en: 'the benchmark', es: 'el benchmark' } },
  studies: { name: { en: 'studies', es: 'estudios' }, what: { en: 'The mechanism ablations at every nominal state and the uncertainty record at eight more seeds', es: 'Las ablaciones de mecanismos en cada estado nominal y el registro de incertidumbre con ocho semillas más' }, output: { en: 'the studies record', es: 'el registro de estudios' } },
  real_samples: { name: { en: 'real samples', es: 'muestras reales' }, what: { en: "The 52 GeoMet samples through the soft porphyry's circuit, beside their measured tests", es: 'Las 52 muestras GeoMet en el circuito del pórfido blando, junto a sus ensayos medidos' }, output: { en: 'the real-samples record', es: 'el registro de muestras reales' } },
  manifests: { name: { en: 'manifests', es: 'manifiestos' }, what: { en: 'Removes files the catalog no longer has; byte counts, SHA-256, headline metrics and checks per case; the index', es: 'Elimina archivos que el catálogo ya no tiene; bytes, SHA-256, métricas principales y verificaciones por caso; el índice' }, output: { en: 'twelve manifests and the index', es: 'doce manifiestos y el índice' } },
  validation: { name: { en: 'validation', es: 'validación' }, what: { en: 'The artifact checks, in process; a failure fails the precompute', es: 'Las verificaciones de artefactos, en proceso; una falla hace fallar el precálculo' }, output: { en: 'the validation record', es: 'el registro de validación' } },
};

const TEXT = {
  stage: { en: 'Stage', es: 'Etapa' },
  what: { en: 'What it does', es: 'Qué hace' },
  output: { en: 'Output', es: 'Salida' },
  seconds: { en: 'Seconds', es: 'Segundos' },
  stagesCaption: {
    en: 'The committed precompute, read from its validation record: engine version {v}, {w} case workers, checks {p}; {t} minutes in all on the development machine.',
    es: 'El precálculo versionado, leído desde su registro de validación: versión del motor {v}, {w} procesos de casos, verificaciones {p}; {t} minutos en total en la máquina de desarrollo.',
  },
  passed: { en: 'passed', es: 'aprobadas' },
  failed: { en: 'failed', es: 'fallidas' },
  case: { en: 'Case artifact', es: 'Artefacto de caso' },
  bytes: { en: 'Bytes', es: 'Bytes' },
  sha: { en: 'SHA-256 (first 16)', es: 'SHA-256 (primeros 16)' },
  schema: { en: 'Schema', es: 'Esquema' },
  variants: { en: 'Variants', es: 'Variantes' },
  artifactsCaption: {
    en: 'The committed case artifacts as their manifests record them; the contract digest of every one begins {d}.',
    es: 'Los artefactos de caso versionados según sus manifiestos; la huella del contrato de todos comienza con {d}.',
  },
  network: { en: 'Exported network', es: 'Red exportada' },
  opset: { en: 'ONNX opset', es: 'Opset ONNX' },
  diff: { en: 'Largest difference from PyTorch', es: 'Mayor diferencia con PyTorch' },
  surrogate: { en: 'Surrogate (22 features to 3 targets)', es: 'Sustituto (22 variables a 3 objetivos)' },
  guard: { en: 'Guard (autoencoder)', es: 'Guardia (autoencoder)' },
  networksCaption: {
    en: 'The networks the browser runs, from the learning record: the final MLP trained on {rows} states on {device}, stopped at epoch {best} of {epochs}.',
    es: 'Las redes que ejecuta el navegador, desde el registro de aprendizaje: el MLP final entrenado con {rows} estados en {device}, detenido en la época {best} de {epochs}.',
  },
};

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? key);

function StageTable({ lang }: { lang: Lang }) {
  const validation = useArtifact(loadValidation);
  return (
    <Loaded lang={lang} errors={[validation.error]} ready={Boolean(validation.value)}>
      {() => {
        const v = validation.value!;
        return (
          <table className="of-doc-table of-doc-table-data">
            <caption>{fill(TEXT.stagesCaption[lang], { v: v.engine_version, w: String(v.workers), p: v.passed ? TEXT.passed[lang] : TEXT.failed[lang],
              t: formatFixed(Object.values(v.seconds).reduce((a, b) => a + b, 0) / 60, lang, 0) })}</caption>
            <thead><tr>{[TEXT.stage, TEXT.what, TEXT.output, TEXT.seconds].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
            <tbody>{v.stages.map(stage => (
              <tr key={stage}>
                <th scope="row">{STAGE_TEXT[stage]?.name[lang] ?? stage}</th>
                <td className="of-doc-wrap">{STAGE_TEXT[stage]?.what[lang] ?? ''}</td>
                <td className="of-doc-wrap">{STAGE_TEXT[stage]?.output[lang] ?? ''}</td>
                <td>{formatSignificant(v.seconds[stage], lang, 3)}</td>
              </tr>
            ))}</tbody>
          </table>
        );
      }}
    </Loaded>
  );
}

function ArtifactTable({ lang }: { lang: Lang }) {
  const index = useArtifact(loadIndex);
  const learning = useArtifact(loadLearning);
  const manifests = useArtifact(() => loadIndex().then(ix => Promise.all(ix.cases.map(c => loadManifest(c.case_id)))));
  return (
    <Loaded lang={lang} errors={[index.error, learning.error, manifests.error]} ready={Boolean(index.value && learning.value && manifests.value)}>
      {() => {
        const list = manifests.value as CaseManifest[];
        const l = learning.value!;
        const training = l.final.mlp_training as { device: string; best_epoch: number; epochs_run: number };
        return (
          <>
            <table className="of-doc-table of-doc-table-data">
              <caption>{fill(TEXT.artifactsCaption[lang], { d: index.value!.contract_digest.slice(0, 16) })}</caption>
              <thead><tr>{[TEXT.case, TEXT.variants, TEXT.bytes, TEXT.sha, TEXT.schema].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
              <tbody>{list.map(m => (
                <tr key={m.case_id}>
                  <th scope="row">{m.title[lang]}</th>
                  <td>{m.variants.length}</td>
                  <td>{formatFixed(m.artifact.bytes, lang, 0)}</td>
                  <td><code>{m.artifact.sha256.slice(0, 16)}</code></td>
                  <td><code>{m.artifact.schema}</code></td>
                </tr>
              ))}</tbody>
            </table>
            <table className="of-doc-table of-doc-table-data">
              <caption>{fill(TEXT.networksCaption[lang], { rows: formatFixed(l.design.rows, lang, 0), device: training.device.toUpperCase(), best: formatFixed(training.best_epoch, lang, 0), epochs: formatFixed(training.epochs_run, lang, 0) })}</caption>
              <thead><tr>{[TEXT.network, TEXT.bytes, TEXT.opset, TEXT.diff].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
              <tbody>{(['surrogate', 'guard'] as const).map(key => (
                <tr key={key}>
                  <th scope="row">{TEXT[key][lang]}</th>
                  <td>{formatFixed(l.final.exports[key].bytes, lang, 0)}</td>
                  <td>{l.final.exports[key].opset}</td>
                  <td>{formatSignificant(l.final.exports[key].max_abs_difference, lang, 2)}</td>
                </tr>
              ))}</tbody>
            </table>
          </>
        );
      }}
    </Loaded>
  );
}

const GATES: Array<[Bi, Bi, Bi]> = [
  [{ en: 'Conservation at every unit within 1e-9', es: 'Conservación en cada unidad dentro de 1e-9' }, { en: 'the engine\'s audit, and an independent recheck of the committed artifacts from their stored streams', es: 'la auditoría del motor, y una verificación independiente de los artefactos versionados desde sus corrientes guardadas' }, { en: 'local tests; CI', es: 'pruebas locales; CI' }],
  [{ en: 'One contract, the same verdicts', es: 'Un contrato, los mismos veredictos' }, { en: 'the probe file replayed by the validator, the service and the browser', es: 'el archivo de sondas repetido por el validador, el servicio y el navegador' }, { en: 'local tests; CI', es: 'pruebas locales; CI' }],
  [{ en: 'The accepted states tested solve', es: 'Los estados aceptados probados se resuelven' }, { en: 'both corners, every single bound and eight seeded interior states of every case', es: 'ambas esquinas, cada límite individual y ocho estados interiores sembrados de cada caso' }, { en: 'local tests', es: 'pruebas locales' }],
  [{ en: 'Browser engine parity', es: 'Paridad del motor en el navegador' }, { en: 'all 96 precomputed variants re-simulated within 1e-6 relative', es: 'las 96 variantes precalculadas vueltas a simular dentro de 1e-6 relativo' }, { en: 'CI', es: 'CI' }],
  [{ en: 'The surrogate in the browser', es: 'El sustituto en el navegador' }, { en: 'features within 1e-12, predictions at float32 precision, the guard verdict exactly', es: 'variables dentro de 1e-12, predicciones con precisión float32, el veredicto del guardia exacto' }, { en: 'CI', es: 'CI' }],
  [{ en: 'Charts plot trace numbers', es: 'Los gráficos dibujan números de la traza' }, { en: 'every value the grinding and separation charts plot, on every precomputed variant', es: 'cada valor de los gráficos de molienda y separación, en cada variante precalculada' }, { en: 'CI', es: 'CI' }],
  [{ en: 'No engine arithmetic in the interface', es: 'Sin aritmética del motor en la interfaz' }, { en: 'a static scan of every interface file', es: 'una revisión estática de cada archivo de interfaz' }, { en: 'CI', es: 'CI' }],
  [{ en: 'Every constant declared with its unit', es: 'Cada constante declarada con su unidad' }, { en: 'a static scan of both engines', es: 'una revisión estática de ambos motores' }, { en: 'CI', es: 'CI' }],
  [{ en: 'The case contexts hold', es: 'Los contextos de los casos se sostienen' }, { en: 'every qualitative claim of every case context checked on the precomputed results', es: 'cada afirmación cualitativa de cada contexto verificada sobre los resultados precalculados' }, { en: 'CI', es: 'CI' }],
  [{ en: 'Layout, language and figures', es: 'Diseño, idioma y figuras' }, { en: 'the browser gate at four desktop sizes, both themes and both languages, and at a phone and a tablet size', es: 'el control en navegador en cuatro tamaños de escritorio, ambos temas y ambos idiomas, y en un tamaño de teléfono y uno de tableta' }, { en: 'local, before a release', es: 'local, antes de publicar' }],
];

const SYSTEM: Topic = {
  id: 'system',
  title: { en: 'The system', es: 'El sistema' },
  paragraphs: [
    { en: 'OreFlow has one engine and three places where it runs. The engine, written in Python, is the reference: it holds the size grid, the ore and plant models, every unit, the closed-circuit solvers, the audit and the trace. An offline precompute runs it over the twelve cases and their variants and writes the method records, the learned lane and the benchmark as versioned artifacts. The browser runs a line-by-line TypeScript port of the same engine, so the workbench recomputes a state instead of looking it up, and a small service runs the Python engine behind the same contract for anyone who wants a trace over HTTP.',
      es: 'OreFlow tiene un motor y tres lugares donde corre. El motor, escrito en Python, es la referencia: contiene la malla de tamaños, los modelos de mineral y planta, cada unidad, los solucionadores de circuito cerrado, la auditoría y la traza. Un precálculo fuera de línea lo ejecuta sobre los doce casos y sus variantes y escribe los registros de métodos, la vía aprendida y el benchmark como artefactos versionados. El navegador ejecuta una versión línea a línea en TypeScript del mismo motor, así que el simulador recalcula un estado en vez de buscarlo, y un servicio pequeño ejecuta el motor en Python tras el mismo contrato para quien quiera una traza por HTTP.' },
    { en: 'Every hand-off is a declared document. The operating contract says which states exist; the trace says what one evaluation produced; the case artifact embeds the ore and plant definitions with eight variants and their method records; manifests and an index bind each artifact to its bytes, its hash, the engine version and the contract digest; the learning record and the exported networks carry their own scalers and a reference that the browser must reproduce.',
      es: 'Cada traspaso es un documento declarado. El contrato de operación dice qué estados existen; la traza dice qué produjo una evaluación; el artefacto de caso incluye las definiciones de mineral y planta con ocho variantes y sus registros de métodos; los manifiestos y un índice ligan cada artefacto a sus bytes, su hash, la versión del motor y la huella del contrato; el registro de aprendizaje y las redes exportadas llevan sus propios escaladores y una referencia que el navegador debe reproducir.' },
    { en: 'Nothing is computed twice in different ways. The constants the port uses are the Python engine\'s own data files, imported at build time; the kinetic quadrature is the node table exported with the contract; the browser\'s validator interprets the same exported contract as the service. Where two computations must agree, a test holds them to a stated tolerance on every precomputed variant.',
      es: 'Nada se calcula dos veces de maneras distintas. Las constantes de la versión en TypeScript son los propios archivos de datos del motor en Python, importados al compilar; la cuadratura cinética es la tabla de nodos exportada con el contrato; el validador del navegador interpreta el mismo contrato exportado que el servicio. Donde dos cálculos deben coincidir, una prueba los sostiene a una tolerancia declarada en cada variante precalculada.' },
    { en: 'The views only draw. Every view reads the trace or a precomputed record and formats numbers in the interface language; a static check rejects engine arithmetic in interface files, and a test checks that every value a chart plots is a number of the trace.',
      es: 'Las vistas solo dibujan. Cada vista lee la traza o un registro precalculado y formatea los números en el idioma de la interfaz; una verificación estática rechaza aritmética del motor en archivos de interfaz, y una prueba verifica que cada valor que dibuja un gráfico sea un número de la traza.' },
  ],
  equations: [
    { tex: r`\mathcal{T} = E(c, u),\qquad u \in U_c`, caption: { en: 'One evaluation: the engine E maps a case c and an operating point u of its contract envelope $U_c$ to a trace.', es: 'Una evaluación: el motor E lleva un caso c y un punto de operación u de su envolvente $U_c$ a una traza.' } },
    { tex: r`\delta = H\left(C \setminus \delta\right)`, caption: { en: 'The contract digest: the SHA-256 hash H of the contract document C without its digest field; every artifact and every service response carries it.', es: 'La huella del contrato: el hash SHA-256 H del documento del contrato C sin su campo de huella; cada artefacto y cada respuesta del servicio la lleva.' } },
  ],
  limits: [
    { en: 'The service and the site share the engine and the contract, not the machine: the service answers on the VPS, the site computes on the reader\'s device.', es: 'El servicio y el sitio comparten el motor y el contrato, no la máquina: el servicio responde en el VPS, el sitio calcula en el equipo del lector.' },
  ],
  figure: { wide: true, caption: { en: 'The precompute writes and validates the artifacts, the build copies them into the site, the browser recomputes with the port, and the service runs the Python engine behind the same contract.', es: 'El precálculo escribe y valida los artefactos, la compilación los copia al sitio, el navegador recalcula con la versión en TypeScript, y el servicio ejecuta el motor en Python tras el mismo contrato.' }, render: lang => <ArchitectureFigure lang={lang} /> },
  refs: ['scipy2020', 'onnx-web'],
};

const ENGINE: Topic = {
  id: 'engine',
  title: { en: 'Engine and port', es: 'Motor y su versión en TypeScript' },
  paragraphs: [
    { en: 'The Python engine is canonical. The TypeScript port mirrors it module by module: the size grid, the Whiten crusher, the three-mixer population balance, the Plitt cyclone, the Illinois root finders, the host-limited composite fixed point, the flotation banks and recycles, magnetic separation, desliming, the energy report, the audit and the trace. Sums run in the same order and additions are grouped the same way, so the iterates of the root finders and fixed points follow the same path, and Python\'s round-half-to-even is reproduced where the cyclone count is rounded.',
      es: 'El motor en Python es el canónico. La versión en TypeScript lo refleja módulo por módulo: la malla de tamaños, el chancador de Whiten, el balance poblacional de tres mezcladores, el ciclón de Plitt, los buscadores de raíces de Illinois, el punto fijo de mixtos limitado por la ganga huésped, los bancos y recirculaciones de flotación, la separación magnética, el deslamado, el informe de energía, la auditoría y la traza. Las sumas corren en el mismo orden y las adiciones se agrupan igual, así que las iteraciones de los buscadores de raíces y de los puntos fijos siguen el mismo camino, y el redondeo al par de Python se reproduce donde se redondea el número de ciclones.' },
    { en: 'The port solves the 63-class systems by LU decomposition with partial pivoting instead of LAPACK. It is not bit-identical and does not need to be: the two agree to about 1e-14 relative. The constants come from the Python engine\'s data files at build time, so a number cannot drift between the two engines, and a static check rejects any undeclared numeric literal in either engine.',
      es: 'La versión en TypeScript resuelve los sistemas de 63 clases por descomposición LU con pivoteo parcial en vez de LAPACK. No es idéntica bit a bit y no necesita serlo: ambas coinciden a cerca de 1e-14 relativo. Las constantes vienen de los archivos de datos del motor en Python al compilar, así que un número no puede divergir entre los dos motores, y una verificación estática rechaza cualquier literal numérico no declarado en cualquiera de los dos motores.' },
    { en: 'The parity test re-simulates every one of the 96 precomputed variants in the port, from the artifact\'s own definition and point, and compares every metric, stream record, curve and kinetic record within 1e-6 relative, with the same flag codes. Audit residuals, which are round-off, are held below 1e-9 instead, and iteration counters may differ by two. The kinetic fits\' step counts are not compared: on a flat valley a last-bit difference changes when the stopping test is met, while the fitted parameters and projections still agree. On the nominal cases the largest difference in a physical metric is about 1e-14.',
      es: 'La prueba de paridad vuelve a simular en la versión en TypeScript cada una de las 96 variantes precalculadas, desde la definición y el punto del propio artefacto, y compara cada métrica, registro de corriente, curva y registro cinético dentro de 1e-6 relativo, con los mismos códigos de aviso. Los residuos de la auditoría, que son redondeo, se acotan en cambio bajo 1e-9, y los contadores de iteraciones pueden diferir en dos. Los pasos de los ajustes cinéticos no se comparan: en un valle plano una diferencia en el último bit cambia cuándo se cumple el criterio de parada, mientras los parámetros ajustados y las proyecciones siguen coincidiendo. En los casos nominales la mayor diferencia en una métrica física es cerca de 1e-14.' },
    { en: 'The first full precompute showed one real disagreement: the payable\'s recovery by size in classes holding 1e-17 to 1e-10 of the rougher-feed payable differed by up to 2.5% between the two engines, because the composition of those classes is round-off of the cyclone split. Both engines now report such classes as empty below a declared share of 1e-8, and the parity test compares the empty classes exactly.',
      es: 'El primer precálculo completo mostró un desacuerdo real: la recuperación por tamaño del pagable en clases con 1e-17 a 1e-10 del pagable de la alimentación rougher difería hasta 2,5% entre los dos motores, porque la composición de esas clases es redondeo de la división del ciclón. Ambos motores informan ahora esas clases como vacías bajo una fracción declarada de 1e-8, y la prueba de paridad compara exactamente las clases vacías.' },
  ],
  equations: [
    { tex: r`|a_{TS} - a_{Py}| \le \max\!\left(10^{-6}\,\max(|a_{TS}|, |a_{Py}|),\ 10^{-12}\right)`, caption: { en: 'The parity criterion, applied to every number of every precomputed variant\'s trace.', es: 'El criterio de paridad, aplicado a cada número de la traza de cada variante precalculada.' } },
    { tex: r`P A = L U,\qquad A\,p = f`, caption: { en: 'The 63-class systems of the grinding circuit, solved by LU decomposition with partial pivoting.', es: 'Los sistemas de 63 clases del circuito de molienda, resueltos por descomposición LU con pivoteo parcial.' } },
    { tex: r`R_i = \begin{cases} a_i / b_i, & b_i > 10^{-8} \sum_j b_j \\ \varnothing, & b_i \le 10^{-8} \sum_j b_j \end{cases}`, caption: { en: 'Recovery by size of the payable: a class holding less than 1e-8 of the rougher-feed payable is reported empty in both engines.', es: 'Recuperación por tamaño del pagable: una clase con menos de 1e-8 del pagable de la alimentación rougher se informa vacía en ambos motores.' } },
  ],
  limits: [
    { en: 'Parity proves that the two engines compute the same thing, not that it is right: the port is held to the Python engine, never to plant data.', es: 'La paridad prueba que ambos motores calculan lo mismo, no que sea correcto: la versión en TypeScript se contrasta con el motor en Python, nunca con datos de planta.' },
    { en: 'Parity is tested on the 96 precomputed variants and the contract probes; other states run the same code without a comparison.', es: 'La paridad se prueba en las 96 variantes precalculadas y las sondas del contrato; otros estados ejecutan el mismo código sin comparación.' },
  ],
  figure: { caption: { en: 'Both engines re-simulate every precomputed variant from the artifact alone, and every number of the two traces is compared.', es: 'Ambos motores vuelven a simular cada variante precalculada solo desde el artefacto, y se compara cada número de las dos trazas.' }, render: lang => <ParityFigure lang={lang} /> },
  refs: [],
};

const BAKE: Topic = {
  id: 'bake',
  title: { en: 'The precompute', es: 'El precálculo' },
  paragraphs: [
    { en: 'The precompute turns the engine, the case catalog and the methods into the committed artifacts in eight stages: the contract is resolved for every case, the learned lane is trained and exported with the optimizer\'s screen, the cases are simulated with their method records (the optimizer reads the screen this precompute exported, so learning comes first), the benchmark is assembled, the ablations and the seed study run, the GeoMet samples run in the soft porphyry\'s circuit, the manifests and the index are written, and the artifact checks run in process. It trains, so it runs on a workstation and never in CI; CI only re-validates what it produced.',
      es: 'El precálculo convierte el motor, el catálogo de casos y los métodos en los artefactos versionados en ocho etapas: se resuelve el contrato de cada caso, se entrena y exporta la vía aprendida con el filtro del optimizador, se simulan los casos con sus registros de métodos (el optimizador lee el filtro que exportó este precálculo, así que el aprendizaje va primero), se arma el benchmark, corren las ablaciones y el estudio de semillas, las muestras GeoMet corren en el circuito del pórfido blando, se escriben los manifiestos y el índice, y las verificaciones de artefactos corren en proceso. Entrena, así que corre en una estación de trabajo y nunca en CI; CI solo vuelve a validar lo que produjo.' },
    { en: 'The case stage runs the optimizer of every target-mode variant twice from the same starts, with the screen and without it, so the record measures the screen instead of assuming it. In this precompute the screened searches spent 24,758 engine evaluations against 21,692 without the screen, 14.1% more, and where the screen proposed, the surrogate\'s recovery was 0.63 points from the engine\'s on average. The second run is the price of the measurement, paid once in the precompute; the browser runs only the screened search, at the user\'s request.',
      es: 'La etapa de casos corre el optimizador de cada variante en modo objetivo dos veces desde los mismos inicios, con el filtro y sin él, así que el registro mide el filtro en vez de suponerlo. En este precálculo las búsquedas filtradas gastaron 24.758 evaluaciones del motor frente a 21.692 sin el filtro, 14,1% más, y donde el filtro propuso, la recuperación del sustituto quedó a 0,63 puntos de la del motor en promedio. La segunda corrida es el precio de la medición, pagado una vez en el precálculo; el navegador corre solo la búsqueda filtrada, a pedido del usuario.' },
    { en: 'Every record is seeded: the Latin hypercube of the uncertainty record, the Saltelli design, the optimizer starts, the learning design, its splits and every model. The case stage therefore runs in parallel worker processes (half the logical cores and at most twelve, one BLAS thread each, because the engine\'s systems are small) without changing any result: the workers only decide the order in which cases finish, and the artifacts are assembled in catalog order.',
      es: 'Cada registro está sembrado: el hipercubo latino del registro de incertidumbre, el diseño de Saltelli, los inicios del optimizador, el diseño de aprendizaje, sus particiones y cada modelo. La etapa de casos corre entonces en procesos paralelos (la mitad de los núcleos lógicos y a lo más doce, un hilo BLAS cada uno, porque los sistemas del motor son pequeños) sin cambiar ningún resultado: los procesos solo deciden el orden en que terminan los casos, y los artefactos se arman en el orden del catálogo.' },
    { en: 'What cannot ship: the index and the benchmark are built from the records of the same run, never by listing files on disk, and every artifact carries the engine version and the contract digest. A precompute that stops halfway leaves an index that does not match, and the checks reject a record from another version or contract. The last stage recomputes every unit balance from the stored streams, and rejects any case file the index does not list, since the site copies those folders whole.',
      es: 'Lo que no puede publicarse: el índice y el benchmark se construyen desde los registros de la misma corrida, nunca listando archivos en disco, y cada artefacto lleva la versión del motor y la huella del contrato. Un precálculo que se detiene a medias deja un índice que no coincide, y las verificaciones rechazan un registro de otra versión o de otro contrato. La última etapa recalcula cada balance por unidad desde las corrientes guardadas, y rechaza cualquier archivo de caso que el índice no liste, porque el sitio copia esas carpetas completas.' },
    { en: 'Each stage and each finished case prints a timestamped line, and a precompute still running after four hours, well past a normal run, prints the stack of every thread once, so a stall shows where it is. The table reads the committed precompute\'s own timings on the development machine (32 logical cores and a laptop GPU): the learning and case stages take most of the time, and the others seconds or minutes.',
      es: 'Cada etapa y cada caso terminado imprime una línea con hora, y un precálculo que sigue corriendo a las cuatro horas, mucho más que una corrida normal, imprime una vez la pila de cada hilo, para que un atasco muestre dónde está. La tabla lee los tiempos del propio precálculo versionado en la máquina de desarrollo (32 núcleos lógicos y una GPU de portátil): las etapas de aprendizaje y de casos se llevan la mayor parte del tiempo, y las demás, segundos o minutos.' },
  ],
  equations: [
    { tex: r`B_w(\mathcal{C}, s) = B_1(\mathcal{C}, s)\qquad \forall\, w`, caption: { en: 'The precompute B of the catalog C with seeds s gives the same artifacts for any number of workers w.', es: 'El precálculo B del catálogo C con semillas s da los mismos artefactos para cualquier número de procesos w.' } },
    { tex: r`n = 256 \times 12 = 3072`, caption: { en: 'The learning design: 256 scrambled Sobol states per case over its contract envelope and ore factors.', es: 'El diseño de aprendizaje: 256 estados Sobol aleatorizados por caso sobre su envolvente del contrato y factores del mineral.' } },
  ],
  limits: [
    { en: 'The timings are the development machine\'s and depend on it; a precompute on a smaller machine takes longer and gives the same artifacts.', es: 'Los tiempos son de la máquina de desarrollo y dependen de ella; un precálculo en una máquina más pequeña toma más y da los mismos artefactos.' },
    { en: 'The learning stage uses CUDA when available; the exported networks are then checked against PyTorch on the same inputs.', es: 'La etapa de aprendizaje usa CUDA cuando está disponible; las redes exportadas se verifican luego contra PyTorch con las mismas entradas.' },
  ],
  figure: { caption: { en: 'The eight stages of the precompute, in order, and what each writes.', es: 'Las ocho etapas del precálculo, en orden, y lo que escribe cada una.' }, render: lang => <BakeFigure lang={lang} /> },
  data: lang => <StageTable lang={lang} />,
  refs: ['saltelli2010', 'pytorch2019'],
};

const CONTRACTS: Topic = {
  id: 'contracts',
  title: { en: 'Contracts and artifacts', es: 'Contratos y artefactos' },
  paragraphs: [
    { en: 'The operating contract declares every input once: its unit, its bounds, its slider step, whether it is whole, which circuit families use it and its help in both languages. Throughput, grind target, grade, hardness and collector dose are properties of a scenario, so they are bounded by factors of the case nominal; the classifier cut, when on, is bounded by factors of the cut the nominal state solves; circulating load, water, crusher setting, gas velocity, cells, bleed and desliming cut have plant-independent ranges, so their bounds are absolute. A cross-field rule keeps the desliming cut at most half the grind target. Validation rejects an unknown case or input, an inapplicable input, a value that is not a number, a non-finite or fractional value where it must be whole, and a value outside its bounds, each with its code and limits; the method controls also reject a value off their step; nothing is coerced.',
      es: 'El contrato de operación declara cada entrada una vez: su unidad, sus límites, su paso de deslizador, si es entera, qué familias de circuito la usan y su ayuda en ambos idiomas. Tratamiento, molienda objetivo, ley, dureza y dosis de colector son propiedades de un escenario, así que se acotan por factores del nominal del caso; el corte del clasificador, cuando está activo, se acota por factores del corte que resuelve el estado nominal; carga circulante, agua, abertura del chancador, velocidad de gas, celdas, purga y corte de deslamado tienen rangos independientes de la planta, así que sus límites son absolutos. Una regla entre campos mantiene el corte de deslamado en a lo más la mitad del objetivo de molienda. La validación rechaza un caso o una entrada desconocidos, una entrada no aplicable, un valor que no es número, un valor no finito o fraccionario donde debe ser entero, y un valor fuera de sus límites, cada uno con su código y sus límites; los controles de métodos además rechazan un valor fuera de su paso; nada se convierte a la fuerza.' },
    { en: 'A contract that accepted states the engine cannot solve would move failures from the validator to the solver, so every case is solved at both corners of its envelope, at every input\'s bounds and at eight seeded interior states: each must solve, serialize as strict JSON, raise no negative-mass or non-finite flag, close every unit within 1e-9 and keep its particle classes consistent.',
      es: 'Un contrato que aceptara estados que el motor no puede resolver movería las fallas del validador al solucionador, así que cada caso se resuelve en ambas esquinas de su envolvente, en los límites de cada entrada y en ocho estados interiores sembrados: cada uno debe resolverse, serializarse como JSON estricto, no levantar avisos de masa negativa ni de valores no finitos, cerrar cada unidad dentro de 1e-9 y mantener consistentes sus clases de partícula.' },
    { en: 'One evaluation produces one trace: the family, the operating point, the metrics with their units, the products, the topology with every unit\'s inputs and outputs, every stream record, the size-resolved curves, the balance of every unit, the kinetic record and the flags. A case artifact embeds the ore and plant definitions and eight variants, each with its point, its trace and its method records, so the browser can recompute any variant from the artifact alone; a manifest binds it to its bytes, hash, schema and headline checks, and the index lists the cases in catalog order.',
      es: 'Una evaluación produce una traza: la familia, el punto de operación, las métricas con sus unidades, los productos, la topología con las entradas y salidas de cada unidad, cada registro de corriente, las curvas por tamaño, el balance de cada unidad, el registro cinético y los avisos. Un artefacto de caso incluye las definiciones de mineral y planta y ocho variantes, cada una con su punto, su traza y sus registros de métodos, así que el navegador puede recalcular cualquier variante solo desde el artefacto; un manifiesto lo liga a sus bytes, hash, esquema y verificaciones principales, y el índice lista los casos en el orden del catálogo.' },
    { en: 'The learned lane exports two ONNX networks with a dynamic batch axis: the surrogate, from 22 standardized physical features to recovery, the logarithm of the upgrade ratio and specific energy, and the guard autoencoder with its threshold. A companion document carries the feature order, the scalers and a reference block with every case\'s nominal features, predictions and guard error as ONNX Runtime computed them, which the browser must reproduce.',
      es: 'La vía aprendida exporta dos redes ONNX con un eje de lote dinámico: el sustituto, desde 22 variables físicas estandarizadas a la recuperación, el logaritmo de la razón de enriquecimiento y la energía específica, y el autoencoder guardia con su umbral. Un documento acompañante lleva el orden de las variables, los escaladores y un bloque de referencia con las variables nominales, las predicciones y el error del guardia de cada caso tal como los calculó ONNX Runtime, que el navegador debe reproducir.' },
  ],
  equations: [
    { tex: r`u_j \in \left[a_j\,u^{(0)}_j,\ b_j\,u^{(0)}_j\right],\qquad u_k \in \left[a_k,\ b_k\right]`, caption: { en: 'The bounds of a scale-dependent input j (factors of the case nominal) and of an intensive input k (absolute).', es: 'Los límites de una entrada j dependiente de la escala (factores del nominal del caso) y de una entrada intensiva k (absolutos).' } },
    { tex: r`d_{des} \le 0.5\,P_{80}^{*}`, caption: { en: 'The cross-field rule of the desliming family, evaluated after every single input has passed.', es: 'La regla entre campos de la familia con deslamado, evaluada después de que cada entrada individual pasó.' } },
  ],
  limits: [
    { en: 'The envelope bounds where this engine, with each authored plant, is numerically sound; it does not say that a plant can run at every accepted state.', es: 'La envolvente acota dónde este motor, con cada planta de autor, es numéricamente sólido; no dice que una planta pueda operar en cada estado aceptado.' },
    { en: 'A state inside the envelope can still carry engine flags, such as power-limited: those are results, not rejections.', es: 'Un estado dentro de la envolvente puede llevar avisos del motor, como limitado por potencia: son resultados, no rechazos.' },
  ],
  figure: { caption: { en: 'A state is validated against the contract, solved by the engine into a trace, precomputed per variant into the case artifact, and bound by its manifest into the index.', es: 'Un estado se valida contra el contrato, el motor lo resuelve en una traza, se precalcula por variante en el artefacto de caso, y su manifiesto lo liga al índice.' }, render: lang => <ContractFigure lang={lang} /> },
  data: lang => <ArtifactTable lang={lang} />,
  refs: ['onnx-web', 'pytorch2019'],
};

const LANES: Topic = {
  id: 'lanes',
  title: { en: 'What runs where', es: 'Qué corre dónde' },
  paragraphs: [
    { en: 'In the browser, a moved control is validated against the contract first, then the engine port solves the new state in a Web Worker, and only the newest reply is kept, so a dragged slider never queues stale traces. Sweeps of one or two inputs run in the same worker only when asked: each cell is validated, solved and streamed back as it finishes, a newer sweep or a cancel stops an older one between cells, and rejected cells are recorded with their codes.',
      es: 'En el navegador, un control movido se valida primero contra el contrato, luego la versión en TypeScript del motor resuelve el nuevo estado en un Web Worker, y solo se conserva la respuesta más nueva, así que un deslizador arrastrado nunca encola trazas viejas. Los barridos de una o dos entradas corren en el mismo proceso solo cuando se piden: cada celda se valida, se resuelve y se devuelve al terminar, un barrido más nuevo o una cancelación detiene al anterior entre celdas, y las celdas rechazadas se registran con sus códigos.' },
    { en: 'The learned lane also runs in the browser. Its 22 features are computed exactly as the precompute computes them, standardized with the precompute\'s scalers, and passed to the exported surrogate and guard by onnxruntime-web on WebAssembly with one thread, in one call per network for a whole sweep, beside the engine\'s own answer for the same states.',
      es: 'La vía aprendida también corre en el navegador. Sus 22 variables se calculan exactamente como las calcula el precálculo, se estandarizan con los escaladores del precálculo y pasan al sustituto y al guardia exportados con onnxruntime-web sobre WebAssembly con un hilo, en una llamada por red para un barrido completo, junto a la respuesta del propio motor para los mismos estados.' },
    { en: 'The method records are precomputed and read: the kinetic fits, the screened pattern search from six starts with its weight path, the 128-sample uncertainty record, the Sobol indices and the learning protocol results take far longer to compute than a moved control can wait (the precompute tab times each stage), so the Methods view shows the records precomputed for the selected variant, and says so when a control has moved away from it. The uncertainty record can also be re-run there at another seed or sample count: the worker runs the engine on every sample of the current state with the same generator as the precompute, one run per tick, and stops on a cancel or a newer run. The optimizer can be re-run there as well, at the current state and any weight, with the precompute\'s screen: it runs in its own worker, shows its progress, and is terminated by a cancel or a newer run.',
      es: 'Los registros de métodos se precalculan y se leen: los ajustes cinéticos, la búsqueda por patrones filtrada desde seis inicios con su trayectoria de pesos, el registro de incertidumbre de 128 muestras, los índices de Sobol y los resultados de los protocolos de aprendizaje tardan mucho más en calcularse de lo que puede esperar un control movido (la pestaña del precálculo da el tiempo de cada etapa), así que la vista de Métodos muestra los registros precalculados para la variante elegida, y lo dice cuando un control se alejó de ella. El registro de incertidumbre también puede volver a correrse ahí con otra semilla o número de muestras: el proceso corre el motor en cada muestra del estado actual con el mismo generador del precálculo, una corrida por paso, y se detiene ante una cancelación o una corrida más nueva. El optimizador también puede volver a correrse ahí, en el estado actual y con cualquier peso, con el filtro del precálculo: corre en su propio worker, muestra su avance, y una cancelación o una corrida más nueva lo termina.' },
    { en: 'The service runs the Python engine behind the same contract. A validated simulation returns the trace with the contract digest; a rejected state returns every error with its code and limits; an engine failure on an accepted state is reported with the state that caused it. The service also serves the built site and the artifacts, and it never trains or rewrites an artifact.',
      es: 'El servicio ejecuta el motor en Python tras el mismo contrato. Una simulación validada devuelve la traza con la huella del contrato; un estado rechazado devuelve cada error con su código y sus límites; una falla del motor en un estado aceptado se informa con el estado que la causó. El servicio además sirve el sitio compilado y los artefactos, y nunca entrena ni reescribe un artefacto.' },
  ],
  equations: [
    { tex: r`N = n_x\,n_y`, caption: { en: 'A two-input sweep evaluates the engine on every cell of an $n_x$ by $n_y$ grid; one evaluation takes about 40 to 150 ms in the development machine\'s JavaScript runtime.', es: 'Un barrido de dos entradas evalúa el motor en cada celda de una grilla de $n_x$ por $n_y$; una evaluación toma cerca de 40 a 150 ms en el entorno JavaScript de la máquina de desarrollo.' } },
    { tex: r`\hat y = \sigma_y\, f_\theta\!\left(\frac{x - \mu_x}{\sigma_x}\right) + \mu_y`, caption: { en: 'The browser\'s surrogate: the exported network on features standardized with the precompute\'s scalers.', es: 'El sustituto del navegador: la red exportada sobre variables estandarizadas con los escaladores del precálculo.' } },
  ],
  limits: [
    { en: 'The live lane recomputes the circuit on every moved control, and the uncertainty record only when asked; a moved control does not re-run the optimizer or the Sobol analysis.', es: 'La vía viva recalcula el circuito con cada control movido, y el registro de incertidumbre solo cuando se pide; un control movido no vuelve a ejecutar el optimizador ni el análisis de Sobol.' },
    { en: 'The surrogate is as good as its leave-one-case-out scores; the guard flags unfamiliar states but cannot detect an error of the engine.', es: 'El sustituto vale lo que sus puntajes dejando un caso fuera; el guardia marca estados desconocidos pero no puede detectar un error del motor.' },
  ],
  figure: { caption: { en: 'What recomputes live in the browser, what is precomputed and read, and what the service does.', es: 'Qué se recalcula en vivo en el navegador, qué se precalcula y se lee, y qué hace el servicio.' }, render: lang => <LanesFigure lang={lang} /> },
  refs: ['onnx-web'],
};

const RELEASE: Topic = {
  id: 'release',
  title: { en: 'Gates and release', es: 'Controles y publicación' },
  paragraphs: [
    { en: 'The design states every requirement in the EARS form with the test that fails when it is violated. The Python suite covers streams and conservation, comminution, classification, separation, the physical directions, the methods, the contracts and the provenance of every parameter; it runs locally before a release, because it solves the envelope and trains sandbox models.',
      es: 'El diseño enuncia cada requisito en la forma EARS con la prueba que falla cuando se viola. La batería en Python cubre corrientes y conservación, conminución, clasificación, separación, las direcciones físicas, los métodos, los contratos y la procedencia de cada parámetro; corre localmente antes de publicar, porque resuelve la envolvente y entrena modelos de prueba.' },
    { en: 'CI runs only on develop and main and never trains. It lints the pipeline, checks the CI budget, the template residue and the content standards, scans both engines for undeclared constants and the interface for engine arithmetic, and recomputes the committed artifacts\' balances, hashes, digests and record schemas with the standard library alone; then it type-checks, tests and builds the site, including the contract, parity, sweep, surrogate, trace-curve, flowsheet, case-claim and locale tests.',
      es: 'CI corre solo en develop y main y nunca entrena. Revisa el estilo de la canalización, verifica el presupuesto de CI, los residuos de plantilla y los estándares de contenido, revisa ambos motores por constantes no declaradas y la interfaz por aritmética del motor, y recalcula los balances, hashes, huellas y esquemas de registro de los artefactos versionados solo con la biblioteca estándar; luego verifica tipos, prueba y compila el sitio, incluidas las pruebas de contrato, paridad, barridos, sustituto, curvas de la traza, diagrama de flujo, afirmaciones de casos e idioma.' },
    { en: 'The browser gate runs against the built site at 1280 by 800, 1600 by 900, 1920 by 1080 and 2560 by 1440, in both themes and both languages. It opens every view and every content page tab, runs the sweeps, and measures: no document scroll on the workbench, a rail that shows its own controls, one tab row, the instrument at least half the viewport and the focus stage at least 80%, the drawn flowsheet across at least 90% of its frame, no element outside the viewport or cut off past its view\'s edge without a scroll area, and no text an ellipsis shortens without its full text as a tooltip (none at all in the readout), no word or number split over two lines and no unit on the line after its number, no engine code in visible text, no select cutting its own text, no equation wider than its box, no figure text crossing its box or a line, the document language, and the focus round trip by clicking. A review pass drives the states a reviewer reached by hand: a sweep followed by a state change, a rejected state, the optimizer at its bounds and in a gold case, a flagged variant. At phone and tablet sizes, 390 by 844 and 768 by 1024, where the rail stacks above the instrument, it requires the rail whole, no sideways scroll and no flowsheet box over another. Every screenshot is read before a release.',
      es: 'El control en navegador corre contra el sitio compilado en 1280 por 800, 1600 por 900, 1920 por 1080 y 2560 por 1440, en ambos temas y ambos idiomas. Abre cada vista y cada pestaña de las páginas de contenido, ejecuta los barridos, y mide: sin desplazamiento del documento en el simulador, un riel que muestra sus propios controles, una fila de pestañas, el instrumento en al menos media pantalla y el escenario de foco en al menos 80%, el diagrama de flujo dibujado en al menos 90% de su marco, ningún elemento fuera de la pantalla ni cortado más allá del borde de su vista sin un área de desplazamiento, ningún texto acortado con puntos suspensivos sin su texto completo como ayuda emergente (ninguno en la fila de lectura), ninguna palabra ni número partido en dos líneas ni unidad en la línea siguiente a su número, ningún código del motor en texto visible, ninguna lista que corte su propio texto, ninguna ecuación más ancha que su caja, ningún texto de figura que cruce su caja o una línea, el idioma del documento, y el viaje de ida y vuelta al foco con clics. Una pasada de revisión recorre los estados a los que llegó a mano un revisor: un barrido seguido de un cambio de estado, un estado rechazado, el optimizador en sus límites y en un caso de oro, una variante con avisos. En tamaños de teléfono y tableta, 390 por 844 y 768 por 1024, donde el riel se apila sobre el instrumento, exige el riel completo, sin desplazamiento lateral y ninguna caja del diagrama de flujo sobre otra. Cada captura se lee antes de publicar.' },
    { en: 'A release goes from a task branch to develop to main. The site is built twice from the same sources: GitHub Pages under the project path, with a route file for every page and a fallback for deep links, and the service on a VPS behind nginx and TLS at oreflow.ml.fasl-work.com. A release is checked from outside: the health route, the pages, the catalog, the benchmark and a validated simulation.',
      es: 'Una versión va de una rama de tarea a develop y a main. El sitio se compila dos veces desde las mismas fuentes: GitHub Pages bajo la ruta del proyecto, con un archivo de ruta para cada página y un respaldo para enlaces profundos, y el servicio en un VPS tras nginx y TLS en oreflow.ml.fasl-work.com. Una versión se verifica desde fuera: la ruta de salud, las páginas, el catálogo, el benchmark y una simulación validada.' },
  ],
  equations: [
    { tex: r`A_I \ge 0.5\,A_V,\qquad A_S \ge 0.8\,A_V`, caption: { en: 'The share of the viewport V taken by the instrument I on the workbench and by the stage S on the focus route.', es: 'La fracción de la pantalla V que ocupa el instrumento I en el simulador y el escenario S en la ruta de foco.' } },
    { tex: r`x^{+}(e) \le W\qquad \forall\, e`, caption: { en: 'No element\'s right edge x+ passes the viewport width W, unless a scroll area inside the page owns it.', es: 'El borde derecho x+ de ningún elemento pasa el ancho W de la pantalla, salvo que lo contenga un área con desplazamiento propio.' } },
  ],
  table: {
    head: [{ en: 'What is held', es: 'Qué se sostiene' }, { en: 'How', es: 'Cómo' }, { en: 'Where it runs', es: 'Dónde corre' }],
    rows: GATES,
    wrap: [1],
  },
  limits: [
    { en: 'The Python suite and the browser gate run locally, not in CI, because they solve and train; a release record states that they passed.', es: 'La batería en Python y el control en navegador corren localmente, no en CI, porque resuelven y entrenan; el registro de cada versión dice que pasaron.' },
    { en: 'The gates prove that the code does what the design says; the design\'s scope, authored cases, still bounds what the results mean.', es: 'Los controles prueban que el código hace lo que dice el diseño; el alcance del diseño, casos de autor, sigue acotando lo que significan los resultados.' },
  ],
  figure: { caption: { en: 'Local gates first, then the task branch, develop and main, then the two builds, each checked from outside.', es: 'Primero los controles locales, luego la rama de tarea, develop y main, luego las dos compilaciones, cada una verificada desde fuera.' }, render: lang => <ReleaseFigure lang={lang} /> },
  refs: ['ears2009'],
};

export const IMPLEMENTATION: Array<{ id: string; label: Bi; topics: Topic[] }> = [
  { id: 'system', label: { en: 'The system', es: 'El sistema' }, topics: [SYSTEM] },
  { id: 'engine', label: { en: 'Engine and port', es: 'Motor y versión TypeScript' }, topics: [ENGINE] },
  { id: 'bake', label: { en: 'The precompute', es: 'El precálculo' }, topics: [BAKE] },
  { id: 'contracts', label: { en: 'Contracts and artifacts', es: 'Contratos y artefactos' }, topics: [CONTRACTS] },
  { id: 'lanes', label: { en: 'What runs where', es: 'Qué corre dónde' }, topics: [LANES] },
  { id: 'models', label: { en: 'Model registry', es: 'Registro de modelos' }, topics: [MODELS] },
  { id: 'gpu', label: { en: 'The GPU lane', es: 'La vía GPU' }, topics: [GPU] },
  { id: 'release', label: { en: 'Gates and release', es: 'Controles y publicación' }, topics: [RELEASE] },
  { id: 'deploy', label: { en: 'Deployment', es: 'Despliegue' }, topics: [DEPLOY] },
];
