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

const r = String.raw;

function ArchitectureFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-impl-arrow)';
  const column = (x: number, title: string, boxes: Array<{ y: number; h: number; title: string; lines: string[]; kind?: 'accent' | 'good' }>) => (
    <g>
      <rect className="of-dg-frame" x={x} y="14" width="250" height="332" rx="10" />
      <text className="dg-box-title accent" x={x + 12} y="34">{title}</text>
      {boxes.map(b => <Box key={b.title} x={x + 12} y={b.y} w={226} h={b.h} title={b.title} lines={b.lines} kind={b.kind} />)}
    </g>
  );
  return (
    <svg className="fig-svg" viewBox="0 0 900 440" role="img" aria-label={p('The offline bake, the committed artifacts, the browser and the service', 'El horneado fuera de línea, los artefactos versionados, el navegador y el servicio')}>
      <Arrow id="of-impl-arrow" />
      {column(12, p('Bake (workstation)', 'Horneado (estación de trabajo)'), [
        { y: 48, h: 58, title: p('Python engine', 'Motor en Python'), kind: 'accent', lines: [p('grid, units, solvers', 'malla, unidades, solucionadores'), p('audit, trace', 'auditoría, traza')] },
        { y: 116, h: 44, title: p('Contract export', 'Exportación del contrato'), lines: [p('bounds, rules, digest', 'límites, reglas, huella')] },
        { y: 170, h: 58, title: p('Case stage, 12 workers', 'Etapa de casos, 12 procesos'), lines: [p('traces, optimizer,', 'trazas, optimizador,'), p('uncertainty, Sobol', 'incertidumbre, Sobol')] },
        { y: 238, h: 44, title: p('Learning stage, CUDA', 'Etapa de aprendizaje, CUDA'), lines: [p('5 models, guard, ONNX', '5 modelos, guardia, ONNX')] },
        { y: 292, h: 44, title: p('Benchmark and manifests', 'Benchmark y manifiestos'), lines: [p('and the balance recheck', 'y la verificación de balances')] },
      ])}
      {column(325, p('Committed artifacts', 'Artefactos versionados'), [
        { y: 48, h: 44, title: p('Operating contract', 'Contrato de operación'), lines: [p('12 inputs, 4 families', '12 entradas, 4 familias')] },
        { y: 102, h: 58, title: p('12 case artifacts', '12 artefactos de caso'), lines: [p('72 variants with traces', '72 variantes con trazas'), p('and method records', 'y registros de métodos')] },
        { y: 170, h: 44, title: p('Manifests and index', 'Manifiestos e índice'), lines: [p('bytes, SHA-256, digest', 'bytes, SHA-256, huella')] },
        { y: 224, h: 58, title: p('Learning record', 'Registro de aprendizaje'), lines: [p('surrogate and guard ONNX', 'ONNX de sustituto y guardia'), p('scalers, reference', 'escaladores, referencia')] },
        { y: 292, h: 44, title: p('Benchmark, validation', 'Benchmark, validación'), lines: [p('oracles, lanes, timings', 'oráculos, vías, tiempos')] },
      ])}
      {column(638, p('Browser (the site)', 'Navegador (el sitio)'), [
        { y: 48, h: 44, title: p('Contract validator', 'Validador del contrato'), lines: [p('same codes as the service', 'mismos códigos del servicio')] },
        { y: 102, h: 58, title: p('TypeScript engine port', 'Motor traducido a TypeScript'), kind: 'good', lines: [p('a trace per control change', 'una traza por cada cambio'), p('within 1e-6 of Python', 'a 1e-6 del de Python')] },
        { y: 170, h: 44, title: p('Web Worker sweeps', 'Barridos en Web Worker'), lines: [p('on request, cancellable', 'a pedido, cancelables')] },
        { y: 224, h: 58, title: p('ONNX surrogate and guard', 'Sustituto y guardia ONNX'), lines: [p('onnxruntime-web, wasm', 'onnxruntime-web, wasm'), p('one call per sweep', 'una llamada por barrido')] },
        { y: 292, h: 44, title: p('Views draw the trace', 'Las vistas dibujan la traza'), lines: [p('no formula in the interface', 'sin fórmulas en la interfaz')] },
      ])}
      <line className="dg-edge" x1="262" y1="180" x2="323" y2="180" markerEnd={arrow} />
      <line className="dg-edge" x1="575" y1="180" x2="636" y2="180" markerEnd={arrow} />
      <text className="dg-edge-label" x="293" y="364" textAnchor="middle">{p('the bake writes, then validates', 'el horneado escribe y luego valida')}</text>
      <text className="dg-edge-label" x="606" y="364" textAnchor="middle">{p('the build copies them into the site', 'la compilación los copia al sitio')}</text>
      <line className="dg-edge" x1="450" y1="346" x2="450" y2="386" markerEnd={arrow} />
      <Box x={12} y={388} w={876} h={46} title={p('Service: the Python engine behind the same contract', 'Servicio: el motor en Python tras el mismo contrato')}
        lines={[p('validated simulation, catalog and benchmark; serves the built site; never trains or rewrites an artifact', 'simulación validada, catálogo y benchmark; sirve el sitio compilado; nunca entrena ni reescribe un artefacto')]} />
    </svg>
  );
}

function ParityFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-impl-arrow-2)';
  return (
    <svg className="fig-svg" viewBox="0 0 440 250" role="img" aria-label={p('Both engines re-simulate every baked variant and every number is compared', 'Ambos motores vuelven a simular cada variante horneada y se compara cada número')}>
      <Arrow id="of-impl-arrow-2" />
      <Box x={8} y={96} w={128} h={58} title={p('case artifact', 'artefacto de caso')} lines={[p('definition', 'definición'), p('and point', 'y punto')]} />
      <Box x={170} y={30} w={128} h={50} title={p('Python engine', 'motor en Python')} kind="accent" lines={[p('the baked trace', 'la traza horneada')]} />
      <Box x={170} y={170} w={128} h={50} title={p('TypeScript port', 'traducción TS')} kind="good" lines={[p('the port trace', 'la traza traducida')]} />
      <Box x={326} y={96} w={106} h={58} title={p('compare', 'comparar')} lines={[p('1e-6 relative', '1e-6 relativo'), p('every number', 'cada número')]} />
      <path className="dg-edge" d="M 136 116 L 152 116 L 152 55 L 168 55" markerEnd={arrow} />
      <path className="dg-edge" d="M 136 134 L 152 134 L 152 195 L 168 195" markerEnd={arrow} />
      <path className="dg-edge" d="M 298 55 L 312 55 L 312 116 L 324 116" markerEnd={arrow} />
      <path className="dg-edge" d="M 298 195 L 312 195 L 312 134 L 324 134" markerEnd={arrow} />
      <text className="dg-note" x="220" y="244" textAnchor="middle">{p('72 variants: every metric, stream, curve and kinetic record', '72 variantes: cada métrica, corriente, curva y registro cinético')}</text>
    </svg>
  );
}

function BakeFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-impl-arrow-3)';
  const stages: Array<[string, string]> = [
    [p('contract', 'contrato'), p('operating contract, probes', 'contrato de operación, sondas')],
    [p('cases, 12 workers', 'casos, 12 procesos'), p('12 case artifacts', '12 artefactos de caso')],
    [p('learning, CUDA', 'aprendizaje, CUDA'), p('learning record, ONNX', 'registro de aprendizaje, ONNX')],
    [p('benchmark', 'benchmark'), p('the cross-case summary', 'el resumen entre casos')],
    [p('manifests', 'manifiestos'), p('manifests and the index', 'manifiestos y el índice')],
    [p('validation', 'validación'), p('the validation record', 'el registro de validación')],
  ];
  return (
    <svg className="fig-svg" viewBox="0 0 440 290" role="img" aria-label={p('The six stages of the bake and what each writes', 'Las seis etapas del horneado y lo que escribe cada una')}>
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
      <text className="dg-note" x="220" y="280" textAnchor="middle">{p('a failing check fails the bake; nothing partial is indexed', 'una verificación fallida hace fallar el horneado; nada parcial se indexa')}</text>
    </svg>
  );
}

function ContractFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-impl-arrow-4)';
  const top: Array<[string, string]> = [[p('state', 'estado'), p('case + point', 'caso + punto')], [p('validate', 'validar'), p('same file', 'mismo archivo')], [p('engine', 'motor'), p('solves', 'resuelve')], [p('trace', 'traza'), p('v2, strict', 'v2, estricta')]];
  const bottom: Array<[string, string, number, number]> = [[p('case artifact', 'artefacto'), p('6 variants', '6 variantes'), 10, 120], [p('manifest', 'manifiesto'), 'bytes, SHA-256', 160, 120], [p('index', 'índice'), p('this run only', 'solo esta corrida'), 310, 120]];
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
      <text className="dg-edge-label" x="380" y="152" textAnchor="end">{p('baked per variant', 'horneada por variante')}</text>
      {bottom.map(([title, sub, x, w], k) => (
        <g key={title}>
          <Box x={x} y={176} w={w} h={48} title={title} lines={[sub]} />
          {k < bottom.length - 1 && <line className="dg-edge" x1={x + w} y1="200" x2={bottom[k + 1][2] - 2} y2="200" markerEnd={arrow} />}
        </g>
      ))}
      <text className="dg-note" x="220" y="250" textAnchor="middle">{p('every file carries the engine version and the contract digest', 'cada archivo lleva la versión del motor y la huella del contrato')}</text>
    </svg>
  );
}

function LanesFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const lanes: Array<{ title: string; kind: 'accent' | 'good' | undefined; items: string[] }> = [
    { title: p('Live (browser)', 'Vivo (navegador)'), kind: 'good', items: [p('validator', 'validador'), p('engine port', 'motor traducido'), p('worker sweeps', 'barridos en worker'), p('ONNX surrogate', 'sustituto ONNX'), p('ONNX guard', 'guardia ONNX')] },
    { title: p('Baked (read)', 'Horneado (leído)'), kind: 'accent', items: [p('kinetic fits', 'ajustes cinéticos'), p('optimization', 'optimización'), p('uncertainty', 'incertidumbre'), p('Sobol indices', 'índices de Sobol'), p('learning results', 'resultados ML')] },
    { title: p('Service', 'Servicio'), kind: undefined, items: [p('same contract', 'mismo contrato'), p('validated simulate', 'simulación validada'), p('catalog, benchmark', 'catálogo, benchmark'), p('serves the site', 'sirve el sitio'), p('never trains', 'nunca entrena')] },
  ];
  return (
    <svg className="fig-svg" viewBox="0 0 440 222" role="img" aria-label={p('What runs live in the browser, what is baked and read, and what the service does', 'Qué corre en vivo en el navegador, qué se hornea y se lee, y qué hace el servicio')}>
      {lanes.map((lane, k) => <Box key={lane.title} x={5 + 145 * k} y={10} w={140} h={164} title={lane.title} lines={lane.items} step={28} kind={lane.kind} />)}
      <text className="dg-note" x="220" y="198" textAnchor="middle">{p('a moved control re-solves the circuit live;', 'un control movido resuelve el circuito en vivo;')}</text>
      <text className="dg-note" x="220" y="212" textAnchor="middle">{p('the method records stay those baked for the variant', 'los registros de métodos siguen siendo los de la variante')}</text>
    </svg>
  );
}

function ReleaseFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-impl-arrow-5)';
  return (
    <svg className="fig-svg" viewBox="0 0 440 260" role="img" aria-label={p('Local gates, then the task branch, develop and main, then Pages and the service', 'Controles locales, luego la rama de tarea, develop y main, luego Pages y el servicio')}>
      <Arrow id="of-impl-arrow-5" />
      <Box x={10} y={14} w={420} h={46} title={p('Local, before a release', 'Local, antes de publicar')} kind="accent" lines={[p('Python tests · bake · browser gate · screenshots read', 'pruebas Python · horneado · control en navegador · capturas leídas')]} />
      <line className="dg-edge" x1="220" y1="60" x2="220" y2="78" markerEnd={arrow} />
      <Box x={10} y={80} w={120} h={46} title={p('task branch', 'rama de tarea')} lines={[p('no CI', 'sin CI')]} />
      <Box x={160} y={80} w={120} h={46} title="develop" lines={[p('CI checks', 'controles CI')]} />
      <Box x={310} y={80} w={120} h={46} title="main" lines={[p('CI and Pages', 'CI y Pages')]} />
      <line className="dg-edge" x1="130" y1="103" x2="158" y2="103" markerEnd={arrow} />
      <line className="dg-edge" x1="280" y1="103" x2="308" y2="103" markerEnd={arrow} />
      <path className="dg-edge" d="M 370 126 L 370 150 L 110 150 L 110 166" markerEnd={arrow} />
      <path className="dg-edge" d="M 370 150 L 330 150 L 330 166" markerEnd={arrow} />
      <Box x={10} y={168} w={200} h={46} title="GitHub Pages" kind="good" lines={[p('project path, route files', 'ruta del proyecto, rutas')]} />
      <Box x={230} y={168} w={200} h={46} title={p('Service (VPS)', 'Servicio (VPS)')} kind="good" lines={[p('behind nginx and TLS', 'tras nginx y TLS')]} />
      <text className="dg-note" x="220" y="240" textAnchor="middle">{p('checked from outside: health, routes, catalog, a simulation', 'verificado desde fuera: salud, rutas, catálogo, una simulación')}</text>
    </svg>
  );
}

const STAGE_TEXT: Record<string, { name: Bi; what: Bi; output: Bi }> = {
  contract: { name: { en: 'contract', es: 'contrato' }, what: { en: 'Resolves the operating contract for every case and records the probe verdicts', es: 'Resuelve el contrato de operación de cada caso y registra los veredictos de las sondas' }, output: { en: 'the operating contract and its probes', es: 'el contrato de operación y sus sondas' } },
  cases: { name: { en: 'cases', es: 'casos' }, what: { en: "Per case, in parallel: every variant's trace, optimization and uncertainty records, and the nominal variant's Sobol record", es: 'Por caso, en paralelo: la traza de cada variante, sus registros de optimización e incertidumbre, y el registro de Sobol de la variante nominal' }, output: { en: 'twelve case artifacts', es: 'doce artefactos de caso' } },
  learning: { name: { en: 'learning', es: 'aprendizaje' }, what: { en: 'The learned lane on a 3072-state design: two protocols, five models, the guard and the ONNX export', es: 'La vía aprendida sobre un diseño de 3072 estados: dos protocolos, cinco modelos, el guardia y la exportación ONNX' }, output: { en: 'the learning record and two networks', es: 'el registro de aprendizaje y dos redes' } },
  benchmark: { name: { en: 'benchmark', es: 'benchmark' }, what: { en: "The cross-case summary from this run's records and the recomputed oracles", es: 'El resumen entre casos desde los registros de esta corrida y los oráculos recalculados' }, output: { en: 'the benchmark', es: 'el benchmark' } },
  manifests: { name: { en: 'manifests', es: 'manifiestos' }, what: { en: 'Removes files the catalog no longer has; byte counts, SHA-256, headline metrics and checks per case; the index', es: 'Elimina archivos que el catálogo ya no tiene; bytes, SHA-256, métricas principales y verificaciones por caso; el índice' }, output: { en: 'twelve manifests and the index', es: 'doce manifiestos y el índice' } },
  validation: { name: { en: 'validation', es: 'validación' }, what: { en: 'The artifact checks, in process; a failure fails the bake', es: 'Las verificaciones de artefactos, en proceso; una falla hace fallar el horneado' }, output: { en: 'the validation record', es: 'el registro de validación' } },
};

const TEXT = {
  stage: { en: 'Stage', es: 'Etapa' },
  what: { en: 'What it does', es: 'Qué hace' },
  output: { en: 'Output', es: 'Salida' },
  seconds: { en: 'Seconds', es: 'Segundos' },
  stagesCaption: {
    en: 'The committed bake, read from its validation record: engine version {v}, {w} case workers, checks {p}.',
    es: 'El horneado versionado, leído desde su registro de validación: versión del motor {v}, {w} procesos de casos, verificaciones {p}.',
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
            <caption>{fill(TEXT.stagesCaption[lang], { v: v.engine_version, w: String(v.workers), p: v.passed ? TEXT.passed[lang] : TEXT.failed[lang] })}</caption>
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
              <caption>{fill(TEXT.networksCaption[lang], { rows: formatFixed(l.design.rows, lang, 0), device: training.device.toUpperCase(), best: String(training.best_epoch), epochs: String(training.epochs_run) })}</caption>
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
  [{ en: 'Every accepted state solves', es: 'Todo estado aceptado se resuelve' }, { en: 'corners, every bound and seeded interior states of every case', es: 'esquinas, cada límite y estados interiores sembrados de cada caso' }, { en: 'local tests', es: 'pruebas locales' }],
  [{ en: 'Browser engine parity', es: 'Paridad del motor en el navegador' }, { en: 'all 72 baked variants re-simulated within 1e-6 relative', es: 'las 72 variantes horneadas vueltas a simular dentro de 1e-6 relativo' }, { en: 'CI', es: 'CI' }],
  [{ en: 'The surrogate in the browser', es: 'El sustituto en el navegador' }, { en: 'features within 1e-12, predictions at float32 precision, the guard verdict exactly', es: 'variables dentro de 1e-12, predicciones con precisión float32, el veredicto del guardia exacto' }, { en: 'CI', es: 'CI' }],
  [{ en: 'Charts plot trace numbers', es: 'Los gráficos dibujan números de la traza' }, { en: 'every value the grinding and separation charts plot, on every baked variant', es: 'cada valor de los gráficos de molienda y separación, en cada variante horneada' }, { en: 'CI', es: 'CI' }],
  [{ en: 'No engine arithmetic in the interface', es: 'Sin aritmética del motor en la interfaz' }, { en: 'a static scan of every interface file', es: 'una revisión estática de cada archivo de interfaz' }, { en: 'CI', es: 'CI' }],
  [{ en: 'Every constant declared with its unit', es: 'Cada constante declarada con su unidad' }, { en: 'a static scan of both engines', es: 'una revisión estática de ambos motores' }, { en: 'CI', es: 'CI' }],
  [{ en: 'The case contexts hold', es: 'Los contextos de los casos se sostienen' }, { en: 'every qualitative claim of every case context checked on the baked results', es: 'cada afirmación cualitativa de cada contexto verificada sobre los resultados horneados' }, { en: 'CI', es: 'CI' }],
  [{ en: 'Layout, language and figures', es: 'Diseño, idioma y figuras' }, { en: 'the browser gate at three viewports, both themes and both languages', es: 'el control en navegador en tres tamaños, ambos temas y ambos idiomas' }, { en: 'local, before a release', es: 'local, antes de publicar' }],
];

const SYSTEM: Topic = {
  id: 'system',
  title: { en: 'The system', es: 'El sistema' },
  paragraphs: [
    { en: 'OreFlow has one engine and three places where it runs. The engine, written in Python, is the reference: it holds the size grid, the ore and plant models, every unit, the closed-circuit solvers, the audit and the trace. An offline bake runs it over the twelve cases and their variants and writes the method records, the learned lane and the benchmark as versioned artifacts. The browser runs a line-by-line TypeScript port of the same engine, so the workbench recomputes a state instead of looking it up, and a small service runs the Python engine behind the same contract for anyone who wants a trace over HTTP.',
      es: 'OreFlow tiene un motor y tres lugares donde corre. El motor, escrito en Python, es la referencia: contiene la malla de tamaños, los modelos de mineral y planta, cada unidad, los solucionadores de circuito cerrado, la auditoría y la traza. Un horneado fuera de línea lo ejecuta sobre los doce casos y sus variantes y escribe los registros de métodos, la vía aprendida y el benchmark como artefactos versionados. El navegador ejecuta una traducción línea a línea a TypeScript del mismo motor, así que el laboratorio recalcula un estado en vez de buscarlo, y un servicio pequeño ejecuta el motor en Python tras el mismo contrato para quien quiera una traza por HTTP.' },
    { en: 'Every hand-off is a declared document. The operating contract says which states exist; the trace says what one evaluation produced; the case artifact embeds the ore and plant definitions with six variants and their method records; manifests and an index bind each artifact to its bytes, its hash, the engine version and the contract digest; the learning record and the exported networks carry their own scalers and a reference that the browser must reproduce.',
      es: 'Cada traspaso es un documento declarado. El contrato de operación dice qué estados existen; la traza dice qué produjo una evaluación; el artefacto de caso incluye las definiciones de mineral y planta con seis variantes y sus registros de métodos; los manifiestos y un índice ligan cada artefacto a sus bytes, su hash, la versión del motor y la huella del contrato; el registro de aprendizaje y las redes exportadas llevan sus propios escaladores y una referencia que el navegador debe reproducir.' },
    { en: 'Nothing is computed twice in different ways. The constants the port uses are the Python engine\'s own data files, imported at build time; the kinetic quadrature is the node table exported with the contract; the browser\'s validator interprets the same exported contract as the service. Where two computations must agree, a test holds them to a stated tolerance on every baked variant.',
      es: 'Nada se calcula dos veces de maneras distintas. Las constantes de la traducción son los propios archivos de datos del motor en Python, importados al compilar; la cuadratura cinética es la tabla de nodos exportada con el contrato; el validador del navegador interpreta el mismo contrato exportado que el servicio. Donde dos cálculos deben coincidir, una prueba los sostiene a una tolerancia declarada en cada variante horneada.' },
    { en: 'The interface only draws. Every view reads the trace or a baked record and formats numbers in the interface language; a static check rejects engine arithmetic in interface files, and a test checks that every value a chart plots is a number of the trace.',
      es: 'La interfaz solo dibuja. Cada vista lee la traza o un registro horneado y formatea los números en el idioma de la interfaz; una verificación estática rechaza aritmética del motor en archivos de interfaz, y una prueba verifica que cada valor que dibuja un gráfico sea un número de la traza.' },
  ],
  equations: [
    { tex: r`\mathcal{T} = E(c, u),\qquad u \in U_c`, caption: { en: 'One evaluation: the engine E maps a case c and an operating point u of its contract envelope U_c to a trace.', es: 'Una evaluación: el motor E lleva un caso c y un punto de operación u de su envolvente U_c a una traza.' } },
    { tex: r`\delta = H\left(C \setminus \delta\right)`, caption: { en: 'The contract digest: the SHA-256 hash H of the contract document C without its digest field; every artifact and every service response carries it.', es: 'La huella del contrato: el hash SHA-256 H del documento del contrato C sin su campo de huella; cada artefacto y cada respuesta del servicio la lleva.' } },
  ],
  limits: [
    { en: 'The service and the site share the engine and the contract, not the machine: the service answers on the VPS, the site computes on the reader\'s device.', es: 'El servicio y el sitio comparten el motor y el contrato, no la máquina: el servicio responde en el VPS, el sitio calcula en el equipo del lector.' },
  ],
  figure: { wide: true, caption: { en: 'The bake writes and validates the artifacts, the build copies them into the site, the browser recomputes with the port, and the service runs the Python engine behind the same contract.', es: 'El horneado escribe y valida los artefactos, la compilación los copia al sitio, el navegador recalcula con la traducción, y el servicio ejecuta el motor en Python tras el mismo contrato.' }, render: lang => <ArchitectureFigure lang={lang} /> },
  refs: ['scipy2020', 'onnx-web'],
};

const ENGINE: Topic = {
  id: 'engine',
  title: { en: 'Engine and port', es: 'Motor y traducción' },
  paragraphs: [
    { en: 'The Python engine is canonical. The TypeScript port mirrors it module by module: the size grid, the Whiten crusher, the three-mixer population balance, the Plitt cyclone, the Illinois root finders, the host-limited composite fixed point, the flotation banks and recycles, magnetic separation, desliming, the energy report, the audit and the trace. Sums run in the same order and additions are grouped the same way, so the iterates of the root finders and fixed points follow the same path, and Python\'s round-half-to-even is reproduced where the cyclone count is rounded.',
      es: 'El motor en Python es el canónico. La traducción a TypeScript lo refleja módulo por módulo: la malla de tamaños, el chancador de Whiten, el balance poblacional de tres mezcladores, el ciclón de Plitt, los buscadores de raíces de Illinois, el punto fijo de mixtos limitado por la ganga huésped, los bancos y recirculaciones de flotación, la separación magnética, el deslamado, el informe de energía, la auditoría y la traza. Las sumas corren en el mismo orden y las adiciones se agrupan igual, así que las iteraciones de los buscadores de raíces y de los puntos fijos siguen el mismo camino, y el redondeo al par de Python se reproduce donde se redondea el número de ciclones.' },
    { en: 'The port solves the 63-class systems by LU decomposition with partial pivoting instead of LAPACK. It is not bit-identical and does not need to be: the two agree to about 1e-14 relative. The constants come from the Python engine\'s data files at build time, so a number cannot drift between the languages, and a static check rejects any undeclared numeric literal in either engine.',
      es: 'La traducción resuelve los sistemas de 63 clases por descomposición LU con pivoteo parcial en vez de LAPACK. No es idéntica bit a bit y no necesita serlo: ambas coinciden a cerca de 1e-14 relativo. Las constantes vienen de los archivos de datos del motor en Python al compilar, así que un número no puede divergir entre lenguajes, y una verificación estática rechaza cualquier literal numérico no declarado en cualquiera de los dos motores.' },
    { en: 'The parity test re-simulates every one of the 72 baked variants in the port, from the artifact\'s own definition and point, and compares every metric, stream record, curve and kinetic record within 1e-6 relative, with the same flag codes. Audit residuals, which are round-off, are held below 1e-9 instead, and iteration counters may differ by two. The kinetic fits\' step counts are not compared: on a flat valley a last-bit difference changes when the stopping test is met, while the fitted parameters and projections still agree. On the nominal cases the largest difference in a physical metric is about 1e-14.',
      es: 'La prueba de paridad vuelve a simular en la traducción cada una de las 72 variantes horneadas, desde la definición y el punto del propio artefacto, y compara cada métrica, registro de corriente, curva y registro cinético dentro de 1e-6 relativo, con los mismos códigos de aviso. Los residuos de la auditoría, que son redondeo, se acotan en cambio bajo 1e-9, y los contadores de iteraciones pueden diferir en dos. Los pasos de los ajustes cinéticos no se comparan: en un valle plano una diferencia en el último bit cambia cuándo se cumple el criterio de parada, mientras los parámetros ajustados y las proyecciones siguen coincidiendo. En los casos nominales la mayor diferencia en una métrica física es cerca de 1e-14.' },
    { en: 'The first full bake showed one real disagreement: the payable\'s recovery by size in classes holding 1e-17 to 1e-10 of the rougher-feed payable differed by up to 2.5% between the languages, because the composition of those classes is round-off of the cyclone split. Both engines now report such classes as empty below a declared share of 1e-8, and the parity test compares the empty classes exactly.',
      es: 'El primer horneado completo mostró un desacuerdo real: la recuperación por tamaño del pagable en clases con 1e-17 a 1e-10 del pagable de la alimentación rougher difería hasta 2,5% entre lenguajes, porque la composición de esas clases es redondeo de la división del ciclón. Ambos motores informan ahora esas clases como vacías bajo una fracción declarada de 1e-8, y la prueba de paridad compara exactamente las clases vacías.' },
  ],
  equations: [
    { tex: r`|a_{TS} - a_{Py}| \le \max\!\left(10^{-6}\,\max(|a_{TS}|, |a_{Py}|),\ 10^{-12}\right)`, caption: { en: 'The parity criterion, applied to every number of every baked variant\'s trace.', es: 'El criterio de paridad, aplicado a cada número de la traza de cada variante horneada.' } },
    { tex: r`P A = L U,\qquad A\,p = f`, caption: { en: 'The 63-class systems of the grinding circuit, solved by LU decomposition with partial pivoting.', es: 'Los sistemas de 63 clases del circuito de molienda, resueltos por descomposición LU con pivoteo parcial.' } },
    { tex: r`R_i = \begin{cases} a_i / b_i, & b_i > 10^{-8} \sum_j b_j \\ \varnothing, & b_i \le 10^{-8} \sum_j b_j \end{cases}`, caption: { en: 'Recovery by size of the payable: a class holding less than 1e-8 of the rougher-feed payable is reported empty in both engines.', es: 'Recuperación por tamaño del pagable: una clase con menos de 1e-8 del pagable de la alimentación rougher se informa vacía en ambos motores.' } },
  ],
  limits: [
    { en: 'Parity proves that the two languages compute the same thing, not that it is right: the port is held to the Python engine, never to plant data.', es: 'La paridad prueba que ambos lenguajes calculan lo mismo, no que sea correcto: la traducción se contrasta con el motor en Python, nunca con datos de planta.' },
    { en: 'Parity is tested on the 72 baked variants and the contract probes; other states run the same code without a comparison.', es: 'La paridad se prueba en las 72 variantes horneadas y las sondas del contrato; otros estados ejecutan el mismo código sin comparación.' },
  ],
  figure: { caption: { en: 'Both engines re-simulate every baked variant from the artifact alone, and every number of the two traces is compared.', es: 'Ambos motores vuelven a simular cada variante horneada solo desde el artefacto, y se compara cada número de las dos trazas.' }, render: lang => <ParityFigure lang={lang} /> },
  refs: [],
};

const BAKE: Topic = {
  id: 'bake',
  title: { en: 'The bake', es: 'El horneado' },
  paragraphs: [
    { en: 'The bake turns the engine, the case catalog and the methods into the committed artifacts in six stages: the contract is resolved for every case, the cases are simulated with their method records, the learned lane is trained and exported, the benchmark is assembled, the manifests and the index are written, and the artifact checks run in process. It trains, so it runs on a workstation and never in CI; CI only re-validates what it produced.',
      es: 'El horneado convierte el motor, el catálogo de casos y los métodos en los artefactos versionados en seis etapas: se resuelve el contrato de cada caso, se simulan los casos con sus registros de métodos, se entrena y exporta la vía aprendida, se arma el benchmark, se escriben los manifiestos y el índice, y las verificaciones de artefactos corren en proceso. Entrena, así que corre en una estación de trabajo y nunca en CI; CI solo vuelve a validar lo que produjo.' },
    { en: 'Every record is seeded: the Latin hypercube of the uncertainty record, the Saltelli design, the optimizer starts, the learning design, its splits and every model. The case stage therefore runs in parallel worker processes (half the logical cores and at most twelve, one BLAS thread each, because the engine\'s systems are small) without changing any result: the workers only decide the order in which cases finish, and the artifacts are assembled in catalog order.',
      es: 'Cada registro está sembrado: el hipercubo latino del registro de incertidumbre, el diseño de Saltelli, los inicios del optimizador, el diseño de aprendizaje, sus particiones y cada modelo. La etapa de casos corre entonces en procesos paralelos (la mitad de los núcleos lógicos y a lo más doce, un hilo BLAS cada uno, porque los sistemas del motor son pequeños) sin cambiar ningún resultado: los procesos solo deciden el orden en que terminan los casos, y los artefactos se arman en el orden del catálogo.' },
    { en: 'What cannot ship: the index and the benchmark are built from the records of the same run, never by listing files on disk, and every artifact carries the engine version and the contract digest. A bake that stops halfway leaves an index that does not match, and the checks reject a record from another version or contract. The last stage recomputes every unit balance from the stored streams, and rejects any case file the index does not list, since the site copies those folders whole.',
      es: 'Lo que no puede publicarse: el índice y el benchmark se construyen desde los registros de la misma corrida, nunca listando archivos en disco, y cada artefacto lleva la versión del motor y la huella del contrato. Un horneado que se detiene a medias deja un índice que no coincide, y las verificaciones rechazan un registro de otra versión o de otro contrato. La última etapa recalcula cada balance por unidad desde las corrientes guardadas, y rechaza cualquier archivo de caso que el índice no liste, porque el sitio copia esas carpetas completas.' },
    { en: 'Each stage and each finished case prints a timestamped line, and a bake still running after 45 minutes prints the stack of every thread once, so a stall shows where it is. The table reads the committed bake\'s own timings: the case stage takes minutes and the learning stage about half an hour on the development machine (32 logical cores and a laptop GPU); every other stage takes under a second.',
      es: 'Cada etapa y cada caso terminado imprime una línea con hora, y un horneado que sigue corriendo a los 45 minutos imprime una vez la pila de cada hilo, para que un atasco muestre dónde está. La tabla lee los tiempos del propio horneado versionado: la etapa de casos toma minutos y la de aprendizaje cerca de media hora en la máquina de desarrollo (32 núcleos lógicos y una GPU de portátil); cada otra etapa toma menos de un segundo.' },
  ],
  equations: [
    { tex: r`B_w(\mathcal{C}, s) = B_1(\mathcal{C}, s)\qquad \forall\, w`, caption: { en: 'The bake B of the catalog C with seeds s gives the same artifacts for any number of workers w.', es: 'El horneado B del catálogo C con semillas s da los mismos artefactos para cualquier número de procesos w.' } },
    { tex: r`n = 256 \times 12 = 3072`, caption: { en: 'The learning design: 256 scrambled Sobol states per case over its contract envelope and ore factors.', es: 'El diseño de aprendizaje: 256 estados Sobol aleatorizados por caso sobre su envolvente del contrato y factores del mineral.' } },
  ],
  limits: [
    { en: 'The timings are the development machine\'s and depend on it; a bake on a smaller machine takes longer and gives the same artifacts.', es: 'Los tiempos son de la máquina de desarrollo y dependen de ella; un horneado en una máquina más pequeña toma más y da los mismos artefactos.' },
    { en: 'The learning stage uses CUDA when available; the exported networks are then checked against PyTorch on the same inputs.', es: 'La etapa de aprendizaje usa CUDA cuando está disponible; las redes exportadas se verifican luego contra PyTorch con las mismas entradas.' },
  ],
  figure: { caption: { en: 'The six stages of the bake, in order, and what each writes.', es: 'Las seis etapas del horneado, en orden, y lo que escribe cada una.' }, render: lang => <BakeFigure lang={lang} /> },
  data: lang => <StageTable lang={lang} />,
  refs: ['saltelli2010', 'pytorch2019'],
};

const CONTRACTS: Topic = {
  id: 'contracts',
  title: { en: 'Contracts and artifacts', es: 'Contratos y artefactos' },
  paragraphs: [
    { en: 'The operating contract declares every input once: its unit, its bounds, its slider step, whether it is whole, which circuit families use it and its help in both languages. Throughput, grade, hardness and collector dose are properties of a scenario, so they are bounded by factors of the case nominal; circulating load, water, crusher setting, gas velocity, cells, bleed and desliming cut have plant-independent ranges, so their bounds are absolute. A cross-field rule keeps the desliming cut at most half the grind target. Validation rejects an unknown case or input, an inapplicable input, a value that is not a number, a non-finite or fractional value where it must be whole, and a value outside its bounds, each with its code and limits; nothing is coerced.',
      es: 'El contrato de operación declara cada entrada una vez: su unidad, sus límites, su paso de deslizador, si es entera, qué familias de circuito la usan y su ayuda en ambos idiomas. Tonelaje, ley, dureza y dosis de colector son propiedades de un escenario, así que se acotan por factores del nominal del caso; carga circulante, agua, abertura del chancador, velocidad de gas, celdas, purga y corte de deslamado tienen rangos independientes de la planta, así que sus límites son absolutos. Una regla entre campos mantiene el corte de deslamado en a lo más la mitad del objetivo de molienda. La validación rechaza un caso o una entrada desconocidos, una entrada no aplicable, un valor que no es número, un valor no finito o fraccionario donde debe ser entero, y un valor fuera de sus límites, cada uno con su código y sus límites; nada se convierte a la fuerza.' },
    { en: 'A contract that accepted states the engine cannot solve would move failures from the validator to the solver, so every case is solved at both corners of its envelope, at every input\'s bounds and at eight seeded interior states: each must solve, serialize as strict JSON, raise no negative-mass or non-finite flag, close every unit within 1e-9 and keep its particle classes consistent.',
      es: 'Un contrato que aceptara estados que el motor no puede resolver movería las fallas del validador al solucionador, así que cada caso se resuelve en ambas esquinas de su envolvente, en los límites de cada entrada y en ocho estados interiores sembrados: cada uno debe resolverse, serializarse como JSON estricto, no levantar avisos de masa negativa ni de valores no finitos, cerrar cada unidad dentro de 1e-9 y mantener consistentes sus clases de partícula.' },
    { en: 'One evaluation produces one trace: the family, the operating point, the metrics with their units, the products, the topology with every unit\'s inputs and outputs, every stream record, the size-resolved curves, the balance of every unit, the kinetic record and the flags. A case artifact embeds the ore and plant definitions and six variants, each with its point, its trace and its method records, so the browser can recompute any variant from the artifact alone; a manifest binds it to its bytes, hash, schema and headline checks, and the index lists the cases in catalog order.',
      es: 'Una evaluación produce una traza: la familia, el punto de operación, las métricas con sus unidades, los productos, la topología con las entradas y salidas de cada unidad, cada registro de corriente, las curvas por tamaño, el balance de cada unidad, el registro cinético y los avisos. Un artefacto de caso incluye las definiciones de mineral y planta y seis variantes, cada una con su punto, su traza y sus registros de métodos, así que el navegador puede recalcular cualquier variante solo desde el artefacto; un manifiesto lo liga a sus bytes, hash, esquema y verificaciones principales, y el índice lista los casos en el orden del catálogo.' },
    { en: 'The learned lane exports two ONNX networks with a dynamic batch axis: the surrogate, from 22 standardized physical features to recovery, the logarithm of the upgrade ratio and specific energy, and the guard autoencoder with its threshold. A companion document carries the feature order, the scalers and a reference block with every case\'s nominal features, predictions and guard error as ONNX Runtime computed them, which the browser must reproduce.',
      es: 'La vía aprendida exporta dos redes ONNX con un eje de lote dinámico: el sustituto, desde 22 variables físicas estandarizadas a la recuperación, el logaritmo de la razón de enriquecimiento y la energía específica, y el autoencoder guardia con su umbral. Un documento acompañante lleva el orden de las variables, los escaladores y un bloque de referencia con las variables nominales, las predicciones y el error del guardia de cada caso tal como los calculó ONNX Runtime, que el navegador debe reproducir.' },
  ],
  equations: [
    { tex: r`u_j \in \left[a_j\,u^{(0)}_j,\ b_j\,u^{(0)}_j\right],\qquad u_k \in \left[a_k,\ b_k\right]`, caption: { en: 'The bounds of a scale-dependent input j (factors of the case nominal) and of an intensive input k (absolute).', es: 'Los límites de una entrada j dependiente de la escala (factores del nominal del caso) y de una entrada intensiva k (absolutos).' } },
    { tex: r`d_{des} \le 0.5\,P_{80}^{*}`, caption: { en: 'The cross-field rule of the desliming family, evaluated after every single input has passed.', es: 'La regla entre campos de la familia con deslamado, evaluada después de que cada entrada individual pasó.' } },
  ],
  limits: [
    { en: 'The envelope bounds where this engine, with each authored plant, is numerically sound; it does not say that a plant can run at every accepted state.', es: 'La envolvente acota dónde este motor, con cada planta de autor, es numéricamente sólido; no dice que una planta pueda operar en cada estado aceptado.' },
    { en: 'A state inside the envelope can still carry engine flags, such as power-limited or a cyclone pressure outside the practical window: those are results, not rejections.', es: 'Un estado dentro de la envolvente puede llevar avisos del motor, como limitado por potencia o una presión de ciclón fuera de la ventana práctica: son resultados, no rechazos.' },
  ],
  figure: { caption: { en: 'A state is validated against the contract, solved by the engine into a trace, baked per variant into the case artifact, and bound by its manifest into the index.', es: 'Un estado se valida contra el contrato, el motor lo resuelve en una traza, se hornea por variante en el artefacto de caso, y su manifiesto lo liga al índice.' }, render: lang => <ContractFigure lang={lang} /> },
  data: lang => <ArtifactTable lang={lang} />,
  refs: ['onnx-web', 'pytorch2019'],
};

const LANES: Topic = {
  id: 'lanes',
  title: { en: 'What runs where', es: 'Qué corre dónde' },
  paragraphs: [
    { en: 'In the browser, a moved control is validated against the contract first, then the engine port solves the new state in a Web Worker, and only the newest reply is kept, so a dragged slider never queues stale traces. Sweeps of one or two inputs run in the same worker only when asked: each cell is validated, solved and streamed back as it finishes, a newer sweep or a cancel stops an older one between cells, and rejected cells are recorded with their codes.',
      es: 'En el navegador, un control movido se valida primero contra el contrato, luego la traducción del motor resuelve el nuevo estado en un Web Worker, y solo se conserva la respuesta más nueva, así que un deslizador arrastrado nunca encola trazas viejas. Los barridos de una o dos entradas corren en el mismo proceso solo cuando se piden: cada celda se valida, se resuelve y se devuelve al terminar, un barrido más nuevo o una cancelación detiene al anterior entre celdas, y las celdas rechazadas se registran con sus códigos.' },
    { en: 'The learned lane also runs in the browser. Its 22 features are computed exactly as the bake computes them, standardized with the bake\'s scalers, and passed to the exported surrogate and guard by onnxruntime-web on WebAssembly with one thread, in one call per network for a whole sweep, beside the engine\'s own answer for the same states.',
      es: 'La vía aprendida también corre en el navegador. Sus 22 variables se calculan exactamente como las calcula el horneado, se estandarizan con los escaladores del horneado y pasan al sustituto y al guardia exportados con onnxruntime-web sobre WebAssembly con un hilo, en una llamada por red para un barrido completo, junto a la respuesta del propio motor para los mismos estados.' },
    { en: 'The method records are baked and read: the kinetic fits, the constrained optimum from six starts, the 128-sample uncertainty record, the Sobol indices and the learning protocol results take from seconds to half an hour each to compute, so the Methods view shows the records baked for the selected variant, and says so when a control has moved away from it.',
      es: 'Los registros de métodos se hornean y se leen: los ajustes cinéticos, el óptimo con restricciones desde seis inicios, el registro de incertidumbre de 128 muestras, los índices de Sobol y los resultados de los protocolos de aprendizaje toman de segundos a media hora cada uno, así que la vista de Métodos muestra los registros horneados para la variante elegida, y lo dice cuando un control se alejó de ella.' },
    { en: 'The service runs the Python engine behind the same contract. A validated simulation returns the trace with the contract digest; a rejected state returns every error with its code and limits; an engine failure on an accepted state is reported with the state that caused it. The service also serves the built site and the artifacts, and it never trains or rewrites an artifact.',
      es: 'El servicio ejecuta el motor en Python tras el mismo contrato. Una simulación validada devuelve la traza con la huella del contrato; un estado rechazado devuelve cada error con su código y sus límites; una falla del motor en un estado aceptado se informa con el estado que la causó. El servicio además sirve el sitio compilado y los artefactos, y nunca entrena ni reescribe un artefacto.' },
  ],
  equations: [
    { tex: r`N = n_x\,n_y`, caption: { en: 'A two-input sweep evaluates the engine on every cell of an n_x by n_y grid; one evaluation takes about 40 to 150 ms in the development machine\'s JavaScript runtime.', es: 'Un barrido de dos entradas evalúa el motor en cada celda de una grilla de n_x por n_y; una evaluación toma cerca de 40 a 150 ms en el entorno JavaScript de la máquina de desarrollo.' } },
    { tex: r`\hat y = \sigma_y\, f_\theta\!\left(\frac{x - \mu_x}{\sigma_x}\right) + \mu_y`, caption: { en: 'The browser\'s surrogate: the exported network on features standardized with the bake\'s scalers.', es: 'El sustituto del navegador: la red exportada sobre variables estandarizadas con los escaladores del horneado.' } },
  ],
  limits: [
    { en: 'The live lane recomputes the circuit, not the method records: a moved control does not re-run the optimizer, the uncertainty or the Sobol analysis.', es: 'La vía viva recalcula el circuito, no los registros de métodos: un control movido no vuelve a ejecutar el optimizador, la incertidumbre ni el análisis de Sobol.' },
    { en: 'The surrogate is as good as its leave-one-case-out scores; the guard flags unfamiliar states but cannot detect an error of the engine.', es: 'El sustituto vale lo que sus puntajes dejando un caso fuera; el guardia marca estados desconocidos pero no puede detectar un error del motor.' },
  ],
  figure: { caption: { en: 'What recomputes live in the browser, what is baked and read, and what the service does.', es: 'Qué se recalcula en vivo en el navegador, qué se hornea y se lee, y qué hace el servicio.' }, render: lang => <LanesFigure lang={lang} /> },
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
    { en: 'The browser gate runs against the built site at 1280 by 800, 1600 by 900 and 2560 by 1440, in both themes and both languages. It opens every view and every content page tab, runs the sweeps, and measures: no document scroll on the workbench, a rail that shows its own controls, one tab row, the instrument at least half the viewport and the focus stage at least 80%, no element outside the viewport or clipped inside a view, no equation wider than its box, no figure text crossing its box, the document language, and the focus round trip by clicking. Every screenshot is read before a release.',
      es: 'El control en navegador corre contra el sitio compilado en 1280 por 800, 1600 por 900 y 2560 por 1440, en ambos temas y ambos idiomas. Abre cada vista y cada pestaña de las páginas de contenido, ejecuta los barridos, y mide: sin desplazamiento del documento en el laboratorio, un riel que muestra sus propios controles, una fila de pestañas, el instrumento en al menos media pantalla y el escenario de foco en al menos 80%, ningún elemento fuera de la pantalla ni recortado dentro de una vista, ninguna ecuación más ancha que su caja, ningún texto de figura que cruce su caja, el idioma del documento, y el viaje de ida y vuelta al foco con clics. Cada captura se lee antes de publicar.' },
    { en: 'A release goes from a task branch to develop to main. The site is built twice from the same sources: GitHub Pages under the project path, with a route file for every page and a fallback for deep links, and the service on a VPS behind nginx and TLS at oreflow.ml.fasl-work.com. A release is checked from outside: the health route, the pages, the catalog, the benchmark and a validated simulation.',
      es: 'Una versión va de una rama de tarea a develop y a main. El sitio se compila dos veces desde las mismas fuentes: GitHub Pages bajo la ruta del proyecto, con un archivo de ruta para cada página y un respaldo para enlaces profundos, y el servicio en un VPS tras nginx y TLS en oreflow.ml.fasl-work.com. Una versión se verifica desde fuera: la ruta de salud, las páginas, el catálogo, el benchmark y una simulación validada.' },
  ],
  equations: [
    { tex: r`A_{inst} \ge 0.5\,A_{view},\qquad A_{stage} \ge 0.8\,A_{view}`, caption: { en: 'The instrument\'s share of the viewport on the workbench, and the stage\'s on the focus route.', es: 'La fracción de la pantalla del instrumento en el laboratorio, y la del escenario en la ruta de foco.' } },
    { tex: r`x_{right}(e) \le W\qquad \forall\, e`, caption: { en: 'No element\'s box ends past the viewport width W, unless a scroll area inside the page owns it.', es: 'Ninguna caja de elemento termina más allá del ancho W de la pantalla, salvo que la contenga un área con desplazamiento propio.' } },
  ],
  table: {
    head: [{ en: 'What is held', es: 'Qué se sostiene' }, { en: 'How', es: 'Cómo' }, { en: 'Where it runs', es: 'Dónde corre' }],
    rows: GATES,
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
  { id: 'engine', label: { en: 'Engine and port', es: 'Motor y traducción' }, topics: [ENGINE] },
  { id: 'bake', label: { en: 'The bake', es: 'El horneado' }, topics: [BAKE] },
  { id: 'contracts', label: { en: 'Contracts and artifacts', es: 'Contratos y artefactos' }, topics: [CONTRACTS] },
  { id: 'lanes', label: { en: 'What runs where', es: 'Qué corre dónde' }, topics: [LANES] },
  { id: 'release', label: { en: 'Gates and release', es: 'Controles y publicación' }, topics: [RELEASE] },
];
