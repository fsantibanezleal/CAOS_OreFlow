/**
 * Introduction (ADR-0016 section 9.C): what OreFlow is and who it is for, the approach, the twelve
 * cases, the scope and the evidence behind it, and how to use the workbench. Transcribed from the
 * process-engine design and requirements, the methodology pages (their "what it is not" sections) and
 * the verified research dossier; the case catalog is read from the baked index, contract and benchmark.
 */
import { Link } from 'react-router';
import { loadBenchmark, loadContract, loadIndex } from '../lib/artifacts';
import { formatValue, formatWithUnit, unitLabel, type Lang } from '../lib/format';
import { categoryName, CATEGORY, familyName } from '../lib/i18n';
import { Loaded, useArtifact } from './data';
import type { Bi, Topic } from './doc';

const r = String.raw;
const pick = (lang: Lang, en: string, es: string) => (lang === 'es' ? es : en);

function Arrow({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" className="dg-arrowhead" />
      </marker>
    </defs>
  );
}

/** One box with a title and sub lines; `lines` start 16 px under the title. */
function Box({ x, y, w, h, title, lines = [], kind }: { x: number; y: number; w: number; h: number; title: string; lines?: string[]; kind?: 'accent' | 'good' | 'optional' }) {
  const cls = kind === 'accent' ? 'dg-box accent' : kind === 'good' ? 'dg-box good' : kind === 'optional' ? 'dg-box of-dg-optional' : 'dg-box';
  return (
    <g>
      <rect className={cls} x={x} y={y} width={w} height={h} rx="7" />
      <text className="dg-box-title" x={x + 12} y={y + 20}>{title}</text>
      {lines.map((line, i) => <text key={i} className="dg-box-sub" x={x + 12} y={y + 36 + 14 * i}>{line}</text>)}
    </g>
  );
}

function OverviewFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-intro-arrow)';
  return (
    <svg className="fig-svg" viewBox="0 0 900 474" role="img" aria-label={p('From an ore, a plant and an operating point, through the circuit, to products and method records', 'Desde un mineral, una planta y un punto de operación, por el circuito, hasta productos y registros de métodos')}>
      <Arrow id="of-intro-arrow" />
      {/* inputs */}
      <Box x={12} y={30} w={160} h={86} title={p('Ore', 'Mineral')} lines={[p('minerals and densities', 'minerales y densidades'), p('head grade', 'ley de cabeza'), p('Bond work index', 'índice de Bond'), p('liberation size', 'tamaño de liberación')]} />
      <Box x={12} y={128} w={160} h={72} title={p('Plant', 'Planta')} lines={[p('installed mill power', 'potencia instalada'), p('cyclone cluster', 'batería de ciclones'), p('flotation cells', 'celdas de flotación')]} />
      <Box x={12} y={212} w={160} h={72} title={p('Operating point', 'Punto de operación')} kind="accent" lines={[p('12 inputs', '12 entradas'), p('bounds per case', 'límites por caso'), p('validated first', 'se valida primero')]} />
      {[73, 164, 248].map(y => <line key={y} className="dg-edge" x1="172" y1={y} x2="194" y2={y} markerEnd={arrow} />)}

      {/* the circuit */}
      <rect className="of-dg-frame" x="196" y="22" width="484" height="322" rx="10" />
      <text className="dg-box-title accent" x="210" y="42">{p('Circuit, solved at steady state', 'Circuito, resuelto en estado estacionario')}</text>
      <text className="dg-box-sub" x="210" y="58">{p('63 size classes × every mineral, plus water', '63 clases de tamaño × cada mineral, más agua')}</text>
      <Box x={210} y={104} w={128} h={50} title={p('Crusher', 'Chancador')} lines={[p('Whiten matrix', 'matriz de Whiten')]} />
      <Box x={368} y={104} w={128} h={50} title={p('Ball mill', 'Molino de bolas')} lines={[p('PBM, 3 mixers', 'PBM, 3 mezcladores')]} />
      <Box x={526} y={104} w={128} h={50} title={p('Hydrocyclones', 'Hidrociclones')} lines={[p('Plitt sizing', 'dimensionado Plitt')]} />
      <line className="dg-edge" x1="338" y1="129" x2="366" y2="129" markerEnd={arrow} />
      <line className="dg-edge" x1="496" y1="129" x2="524" y2="129" markerEnd={arrow} />
      {/* underflow recycle through the optional gravity unit */}
      <path className="dg-edge" d="M 590 104 L 590 84 L 558 84" markerEnd={arrow} />
      <path className="dg-edge" d="M 466 84 L 432 84 L 432 102" markerEnd={arrow} />
      <rect className="dg-box of-dg-optional" x="466" y="68" width="90" height="32" rx="6" />
      <text className="dg-box-sub" x="511" y="81" textAnchor="middle">{p('gravity', 'gravimetría')}</text>
      <text className="dg-note" x="511" y="94" textAnchor="middle">{p('gold only', 'solo oro')}</text>
      <text className="dg-edge-label" x="596" y="96">{p('underflow', 'descarga')}</text>
      {/* overflow to separation */}
      <path className="dg-edge" d="M 654 129 L 668 129 L 668 196 L 274 196 L 274 224" markerEnd={arrow} />
      <text className="dg-edge-label" x="660" y="190" textAnchor="end">{p('overflow at the target P80', 'rebose al P80 objetivo')}</text>
      <Box x={210} y={226} w={128} h={50} title={p('Desliming', 'Deslamado')} kind="optional" lines={[p('phosphate only', 'solo fosfato')]} />
      <Box x={368} y={226} w={128} h={50} title={p('Rougher bank', 'Banco rougher')} lines={[p('N cells in series', 'N celdas en serie')]} />
      <Box x={526} y={226} w={128} h={50} title={p('Cleaner bank', 'Banco cleaner')} lines={[p('k from Sb, ENT', 'k desde Sb, ENT')]} />
      <line className="dg-edge" x1="338" y1="251" x2="366" y2="251" markerEnd={arrow} />
      <line className="dg-edge" x1="496" y1="251" x2="524" y2="251" markerEnd={arrow} />
      <path className="dg-edge" d="M 560 276 L 560 292 L 470 292 L 470 278" markerEnd={arrow} />
      <text className="dg-edge-label" x="515" y="306" textAnchor="middle">{p('cleaner tails', 'colas del cleaner')}</text>
      <path className="dg-edge" d="M 400 276 L 400 318 L 702 318" markerEnd={arrow} />
      <text className="dg-edge-label" x="580" y="312">{p('rougher tails', 'colas rougher')}</text>
      <text className="dg-note" x="210" y="336">{p('magnetite: LIMS drums replace flotation', 'magnetita: tambores LIMS en lugar de flotación')}</text>
      <line className="dg-edge" x1="654" y1="251" x2="702" y2="251" markerEnd={arrow} />

      {/* products and what every state reports */}
      <line className="dg-edge" x1="680" y1="96" x2="702" y2="96" markerEnd={arrow} />
      <Box x={704} y={30} w={184} h={136} title={p('Every state reports', 'Cada estado informa')} kind="good"
        lines={[p('recovery and grade', 'recuperación y ley'), p('specific energy', 'energía específica'), p('mill power and P80', 'potencia y P80'), p('water per tonne', 'agua por tonelada'), p('unit balances', 'balances por unidad'), p('engine flags', 'avisos del motor')]} />
      <Box x={704} y={222} w={184} h={58} title={p('Concentrate', 'Concentrado')} lines={[p('grade, recovery', 'ley, recuperación'), p('mass pull', 'rendimiento másico')]} />
      <Box x={704} y={296} w={184} h={44} title={p('Tails', 'Relaves')} lines={[p('grade, losses', 'ley, pérdidas')]} />

      {/* the method records */}
      <line className="dg-edge" x1="438" y1="344" x2="438" y2="368" markerEnd={arrow} />
      <text className="dg-edge-label" x="446" y="361">{p('baked for every variant', 'horneados para cada variante')}</text>
      <rect className="of-dg-frame" x="12" y="370" width="876" height="96" rx="10" />
      <text className="dg-box-title accent" x="26" y="390">{p('Method records, each re-running the same engine', 'Registros de métodos, cada uno sobre el mismo motor')}</text>
      <Box x={24} y={400} w={204} h={58} title={p('Kinetic fits', 'Ajustes cinéticos')} lines={[p('5 lumped models', '5 modelos agrupados'), p('vs the exact bank', 'frente al banco exacto')]} />
      <Box x={240} y={400} w={204} h={58} title={p('Optimization', 'Optimización')} lines={[p('COBYLA, 6 starts', 'COBYLA, 6 inicios'), p('grade, power, water', 'ley, potencia, agua')]} />
      <Box x={456} y={400} w={204} h={58} title={p('Uncertainty', 'Incertidumbre')} lines={[p('128 Latin-hypercube runs', '128 corridas hipercubo latino'), p('Sobol indices, N = 256', 'índices de Sobol, N = 256')]} />
      <Box x={672} y={400} w={204} h={58} title={p('Learned surrogate', 'Sustituto aprendido')} lines={[p('5 models and a guard', '5 modelos y un guardia'), p('ONNX, run in the browser', 'ONNX, en el navegador')]} />
    </svg>
  );
}

function StreamFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-intro-arrow-2)';
  const matrix = (x: number, y: number, shade: number[]) => (
    <g>
      {Array.from({ length: 7 }, (_, row) => Array.from({ length: 4 }, (_, col) => (
        <rect key={`${row}-${col}`} x={x + col * 18} y={y + row * 14} width="17" height="13"
          className={shade[(row * 4 + col) % shade.length] ? 'dg-fill-accent' : 'dg-box'} />
      )))}
      <rect x={x + 80} y={y} width="12" height="97" className="dg-fill-warn" />
    </g>
  );
  return (
    <svg className="fig-svg" viewBox="0 0 440 262" role="img" aria-label={p('A stream is mass by size class and mineral plus water; a unit splits it and the audit re-sums it', 'Una corriente es masa por clase de tamaño y mineral más agua; una unidad la divide y la auditoría la vuelve a sumar')}>
      <Arrow id="of-intro-arrow-2" />
      <text className="dg-box-title" x="20" y="26">{p('Stream', 'Corriente')}</text>
      {matrix(20, 40, [1, 0, 0, 1, 0, 1])}
      <text className="dg-tick" x="20" y="152">{p('minerals', 'minerales')}</text>
      <text className="dg-tick" x="100" y="152">{p('water', 'agua')}</text>
      <text className="dg-tick" x="20" y="168">{p('rows: 63 size classes', 'filas: 63 clases')}</text>
      <line className="dg-edge" x1="118" y1="88" x2="160" y2="88" markerEnd={arrow} />
      <rect className="dg-box accent" x="160" y="62" width="120" height="54" rx="7" />
      <text className="dg-box-title" x="220" y="84" textAnchor="middle">{p('unit model', 'modelo de unidad')}</text>
      <text className="dg-box-sub" x="220" y="102" textAnchor="middle">{p('split by class', 'divide por clase')}</text>
      <line className="dg-edge" x1="280" y1="76" x2="300" y2="52" markerEnd={arrow} />
      <line className="dg-edge" x1="280" y1="102" x2="300" y2="126" markerEnd={arrow} />
      <g transform="translate(302 26) scale(0.6)">{matrix(0, 0, [1, 1, 0, 0])}</g>
      <g transform="translate(302 110) scale(0.6)">{matrix(0, 0, [0, 0, 0, 1, 0])}</g>
      <text className="dg-tick" x="370" y="46">{p('product A', 'producto A')}</text>
      <text className="dg-tick" x="370" y="130">{p('product B', 'producto B')}</text>
      <rect className="of-dg-frame" x="20" y="190" width="400" height="56" rx="8" />
      <text className="dg-box-sub" x="220" y="212" textAnchor="middle">{p('audit: Σ in = Σ out for every mineral,', 'auditoría: Σ entra = Σ sale para cada mineral,')}</text>
      <text className="dg-box-sub" x="220" y="230" textAnchor="middle">{p('every element and the water, per unit', 'cada elemento y el agua, por unidad')}</text>
    </svg>
  );
}

function VariantFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const cx = 220, cy = 132, R = 80;
  const spokes: Array<[string, string]> = [
    [p('harder ore', 'mineral más duro'), p('Wi × 1.25', 'Wi × 1,25')],
    [p('coarser grind', 'molienda más gruesa'), p('P80 × 1.35', 'P80 × 1,35')],
    [p('higher throughput', 'más tonelaje'), p('F × 1.25', 'F × 1,25')],
    [p('more collector', 'más colector'), p('D × 1.6', 'D × 1,6')],
    [p('more air', 'más aire'), p('Jg × 1.4', 'Jg × 1,4')],
  ];
  return (
    <svg className="fig-svg" viewBox="0 0 440 336" role="img" aria-label={p('Every variant changes one input of the nominal state by a declared factor', 'Cada variante cambia una entrada del estado nominal por un factor declarado')}>
      {spokes.map(([name, factor], k) => {
        const a = -Math.PI / 2 + (2 * Math.PI * k) / spokes.length;
        const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
        const top = Math.sin(a) < -0.9, bottom = Math.sin(a) > 0.5;
        const anchor = top ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
        const dx = anchor === 'start' ? 10 : anchor === 'end' ? -10 : 0;
        const ny = top ? y - 30 : bottom ? y + 16 : y;
        return (
          <g key={name}>
            <line className="dg-edge" x1={cx + 26 * Math.cos(a)} y1={cy + 26 * Math.sin(a)} x2={x} y2={y} />
            <circle cx={x} cy={y} r="6" className="dg-fill-warn" />
            <text className="dg-box-title" x={x + dx} y={ny} textAnchor={anchor}>{name}</text>
            <text className="dg-box-sub" x={x + dx} y={ny + 14} textAnchor={anchor}>{factor}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="26" className="dg-fill-accent" />
      <text className="dg-box-title" x={cx} y={cy + 4} textAnchor="middle">nominal</text>
      <rect className="of-dg-frame" x="20" y="246" width="400" height="80" rx="8" />
      <text className="dg-box-title" x="32" y="266">{p('Levers of their own', 'Palancas propias')}</text>
      <text className="dg-box-sub" x="32" y="284">{p('gold: bleed × 2 instead of more air', 'oro: purga × 2 en lugar de más aire')}</text>
      <text className="dg-box-sub" x="32" y="300">{p('magnetite: P80 × 0.75, CSS × 0.8 (no flotation)', 'magnetita: P80 × 0,75, CSS × 0,8 (sin flotación)')}</text>
      <text className="dg-box-sub" x="32" y="316">{p('phosphate: cut × 1.5 instead of air; collector × 1.4', 'fosfato: corte × 1,5 en lugar de aire; colector × 1,4')}</text>
    </svg>
  );
}

function EvidenceFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const tiers: Array<{ title: string; lines: string[]; kind?: 'accent' | 'good' | 'optional' }> = [
    { title: p('Engine on authored cases', 'Motor sobre casos de autor'), kind: 'accent', lines: [p('directions, trade-offs, balances', 'direcciones, compromisos, balances'), p('12 cases, 72 variants', '12 casos, 72 variantes')] },
    { title: p('Published examples (oracles)', 'Ejemplos publicados (oráculos)'), lines: [p('Moly-Cop, GMG, Laplante,', 'Moly-Cop, GMG, Laplante,'), p('Zandrivierspoort magnetite', 'magnetita de Zandrivierspoort')] },
    { title: p('Measured lanes, kept separate', 'Vías medidas, separadas'), kind: 'good', lines: [p('HZDR particles (RODARE 336)', 'partículas HZDR (RODARE 336)'), p('GeoMet locked-cycle tests', 'ensayos de ciclo cerrado GeoMet')] },
    { title: p('Not available: a plant campaign', 'No disponible: una campaña de planta'), kind: 'optional', lines: [p('states joined to metallurgy', 'estados unidos a metalurgia'), p('under an open license', 'con licencia abierta')] },
  ];
  return (
    <svg className="fig-svg" viewBox="0 0 440 300" role="img" aria-label={p('The evidence behind the results, from the authored engine to what is not available', 'La evidencia detrás de los resultados, desde el motor de autor hasta lo que no está disponible')}>
      {tiers.map((tier, k) => <Box key={tier.title} x={20} y={14 + 70 * k} w={300} h={62} title={tier.title} lines={tier.lines} kind={tier.kind} />)}
      <line className="dg-axis" x1="352" y1="24" x2="352" y2="274" />
      <text className="dg-axis-label" x="366" y="40">{p('claims', 'afirma')}</text>
      <text className="dg-axis-label" x="366" y="56">{p('about the', 'sobre el')}</text>
      <text className="dg-axis-label" x="366" y="72">{p('model', 'modelo')}</text>
      <text className="dg-axis-label" x="366" y="236">{p('claims', 'afirma')}</text>
      <text className="dg-axis-label" x="366" y="252">{p('about a', 'sobre una')}</text>
      <text className="dg-axis-label" x="366" y="268">{p('plant', 'planta')}</text>
    </svg>
  );
}

function WorkbenchFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const tabs = [p('Circuit', 'Circuito'), p('Grinding', 'Molienda'), p('Separation', 'Separación'), p('Response', 'Respuesta'), p('Methods', 'Métodos'), p('Case', 'Caso')];
  return (
    <svg className="fig-svg" viewBox="0 0 500 270" role="img" aria-label={p('The workbench: the rail, the readout row, the view tabs and the instrument', 'El laboratorio: el riel, la fila de lectura, las pestañas de vistas y el instrumento')}>
      <rect className="of-dg-frame" x="10" y="10" width="480" height="250" rx="10" />
      <Box x={20} y={20} w={120} h={230} title={p('Rail', 'Riel')} lines={[p('case, variant', 'caso, variante'), p('question', 'pregunta'), p('feed and grind', 'alimentación'), p('classification', 'clasificación'), p('separation', 'separación'), p('reset, focus', 'volver, foco')]} />
      <rect className="dg-box accent" x="150" y="20" width="340" height="28" rx="6" />
      <text className="of-dg-small" x="320" y="38" textAnchor="middle">{p('recovery · grade · energy · P80 · power · flags', 'recuperación · ley · energía · P80 · potencia · avisos')}</text>
      {tabs.map((tab, k) => (
        <g key={tab}>
          <rect className={k === 0 ? 'dg-box accent' : 'dg-box'} x={150 + k * 57.2} y="56" width="54" height="22" rx="5" />
          <text className="of-dg-small" x={150 + k * 57.2 + 27} y="71" textAnchor="middle">{tab}</text>
        </g>
      ))}
      <rect className="dg-box" x="150" y="86" width="340" height="164" rx="6" />
      <path className="dg-curve" d="M 170 220 C 240 216, 280 160, 330 140 S 430 110, 474 108" />
      <line className="dg-marker" x1="360" y1="96" x2="360" y2="232" />
      <text className="dg-marker-label" x="366" y="110">cursor</text>
      <text className="dg-note" x="320" y="244" textAnchor="middle">{p('the instrument: at least half the screen', 'el instrumento: al menos media pantalla')}</text>
    </svg>
  );
}

const TEXT = {
  code: { en: 'Code', es: 'Código' },
  case: { en: 'Case', es: 'Caso' },
  category: { en: 'Category', es: 'Categoría' },
  circuit: { en: 'Circuit after grinding', es: 'Circuito tras la molienda' },
  payable: { en: 'Payable', es: 'Pagable' },
  recovery: { en: 'Recovery (%)', es: 'Recuperación (%)' },
  grade: { en: 'Concentrate grade', es: 'Ley de concentrado' },
  energy: { en: 'Specific energy (kWh/t)', es: 'Energía específica (kWh/t)' },
  p80: { en: 'P80 (µm)', es: 'P80 (µm)' },
  checks: { en: 'Plausibility checks', es: 'Verificaciones de plausibilidad' },
  inside: { en: 'inside the published range', es: 'dentro del rango publicado' },
  caption: {
    en: 'The nominal state of every case, from the baked results; a case name opens it in the workbench.',
    es: 'El estado nominal de cada caso, desde los resultados horneados; el nombre de un caso lo abre en el laboratorio.',
  },
};

function CaseCatalog({ lang }: { lang: Lang }) {
  const index = useArtifact(loadIndex);
  const contract = useArtifact(loadContract);
  const benchmark = useArtifact(loadBenchmark);
  return (
    <Loaded lang={lang} errors={[index.error, contract.error, benchmark.error]} ready={Boolean(index.value && contract.value && benchmark.value)}>
      {() => {
        const counts: Record<string, number> = {};
        return (
          <table className="of-doc-table of-doc-table-data">
            <caption>{TEXT.caption[lang]}</caption>
            <thead><tr>{[TEXT.code, TEXT.case, TEXT.category, TEXT.circuit, TEXT.payable, TEXT.recovery, TEXT.grade, TEXT.energy, TEXT.p80, TEXT.checks].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
            <tbody>{index.value!.cases.map(entry => {
              counts[entry.category] = (counts[entry.category] ?? 0) + 1;
              const code = `${CATEGORY[entry.category]?.code ?? '?'}${counts[entry.category]}`;
              const primary = contract.value!.cases[entry.case_id].primary;
              const record = benchmark.value!.cases.find(c => c.case_id === entry.case_id);
              const nominal = record?.variants.nominal ?? {};
              const kpis = Object.values(record?.kpis ?? {});
              return (
                <tr key={entry.case_id}>
                  <td>{code}</td>
                  <th scope="row"><Link to={`/?case=${entry.case_id}`}>{entry.title[lang]}</Link></th>
                  <td>{categoryName(entry.category, lang)}</td>
                  <td>{familyName(entry.family, lang)}</td>
                  <td>{`${primary.species} (${unitLabel(primary.unit)})`}</td>
                  <td>{formatValue(nominal.recovery_pct as number, '%', lang)}</td>
                  <td>{formatWithUnit(nominal.concentrate_grade as number, primary.unit, lang)}</td>
                  <td>{formatValue(nominal.specific_energy_total_kwh_t as number, 'kWh/t', lang)}</td>
                  <td>{formatValue(nominal.p80_um as number, 'um', lang)}</td>
                  <td>{`${kpis.filter(k => k.within).length} / ${kpis.length} ${TEXT.inside[lang]}`}</td>
                </tr>
              );
            })}</tbody>
          </table>
        );
      }}
    </Loaded>
  );
}

const WHAT: Topic = {
  id: 'what',
  title: { en: 'What OreFlow is', es: 'Qué es OreFlow' },
  paragraphs: [
    { en: 'A concentrator is a chain of transformations. The ore is crushed and ground until its valuable grains are free enough to separate, classified so that only material at the target size leaves the grinding circuit, and then separated by flotation, gravity or magnetism. Every lever pulls on several results at once: a finer grind frees more of the valuable mineral but costs energy and makes slimes; more collector recovers more metal but floats more gangue; more tonnes leave less mill energy for each tonne and less time in each flotation cell. OreFlow is a workbench for seeing those trade-offs as numbers (recovery, concentrate grade, energy and water) for a stated ore and plant at an operating point of your choosing.',
      es: 'Un concentrador es una cadena de transformaciones. El mineral se chanca y se muele hasta que sus granos valiosos quedan lo bastante libres para separarse, se clasifica para que solo salga del circuito de molienda el material al tamaño objetivo, y luego se separa por flotación, gravedad o magnetismo. Cada palanca mueve varios resultados a la vez: una molienda más fina libera más mineral valioso pero cuesta energía y genera lamas; más colector recupera más metal pero también flota más ganga; más toneladas dejan menos energía del molino para cada tonelada y menos tiempo en cada celda de flotación. OreFlow es un laboratorio para ver esos compromisos como números (recuperación, ley de concentrado, energía y agua) para un mineral y una planta declarados, en el punto de operación que se elija.' },
    { en: 'The workbench opens on a case. Moving a control (throughput, ore hardness, head grade, crusher setting, target grind, circulating load, overflow water, collector dose, gas velocity, rougher cells, gravity bleed or desliming cut) re-solves the whole circuit in the browser: the grinding circuit to its steady state, the classification, the separation with its recycles, and the energy and water accounts. The views draw what the engine computed: the flowsheet with the tonnage and grade of every stream, the size distributions and the cyclone partition, recovery by size and down the flotation bank, one- and two-input response maps, the method records and the context of the case.',
      es: 'El laboratorio se abre en un caso. Mover un control (tonelaje, dureza del mineral, ley de cabeza, abertura del chancador, molienda objetivo, carga circulante, agua del rebose, dosis de colector, velocidad de gas, celdas rougher, purga gravimétrica o corte de deslamado) vuelve a resolver todo el circuito en el navegador: el circuito de molienda hasta su estado estacionario, la clasificación, la separación con sus recirculaciones, y las cuentas de energía y agua. Las vistas dibujan lo que calculó el motor: el diagrama de flujo con el tonelaje y la ley de cada corriente, las distribuciones granulométricas y la partición del ciclón, la recuperación por tamaño y a lo largo del banco de flotación, mapas de respuesta de una y dos entradas, los registros de métodos y el contexto del caso.' },
    { en: 'It is written for three readers. A process metallurgist can check the direction and the size of a trade-off before arguing about it. A student of mineral processing can see why recovery, grade and energy move together, with every equation on the Methodology page. A data scientist can see how far a learned surrogate of a process can be trusted when the ore changes, because the learned lane is scored against the engine on cases it never saw.',
      es: 'Está escrito para tres lectores. Un metalurgista de procesos puede verificar la dirección y el tamaño de un compromiso antes de discutirlo. Un estudiante de procesamiento de minerales puede ver por qué la recuperación, la ley y la energía se mueven juntas, con cada ecuación en la página de Metodología. Un científico de datos puede ver hasta dónde confiar en un sustituto aprendido de un proceso cuando cambia el mineral, porque la vía aprendida se evalúa contra el motor en casos que nunca vio.' },
    { en: 'Every number is a mass balance. The engine carries every stream as mass by size class and mineral, plus water, and computes grades from mineral masses and their element contents; the interface re-implements no formula and draws no curve of its own. Every unit, and the circuit as a whole, closes within 1e-9 relative, and the published results are audited again from their stored streams.',
      es: 'Cada número es un balance de masa. El motor lleva cada corriente como masa por clase de tamaño y mineral, más agua, y calcula las leyes desde las masas de minerales y sus contenidos de elementos; la interfaz no reimplementa ninguna fórmula ni dibuja curvas propias. Cada unidad, y el circuito completo, cierra dentro de 1e-9 relativo, y los resultados publicados se auditan otra vez desde sus corrientes guardadas.' },
  ],
  equations: [
    { tex: r`R = 100\,\frac{C\,c}{F\,f}`, caption: { en: 'Recovery of the primary payable: concentrate flow C at grade c over feed flow F at head grade f.', es: 'Recuperación del pagable principal: flujo de concentrado C con ley c sobre el flujo de alimentación F con ley de cabeza f.' } },
    { tex: r`c_S = \frac{\sum_k w_{S,k}\,M_k}{\sum_k M_k}`, caption: { en: 'Grade of species S in a stream, from the flow M of each mineral k and its content w of S; no grade is stored.', es: 'Ley de la especie S en una corriente, desde el flujo M de cada mineral k y su contenido w de S; ninguna ley se guarda.' } },
    { tex: r`E = E_{crush} + \frac{P_{mill}}{F},\qquad \omega = \frac{W_{fresh}}{F}`, caption: { en: 'Specific energy of crushing and grinding (kWh/t) and water intensity (m3 of fresh water per tonne of ore).', es: 'Energía específica de chancado y molienda (kWh/t) e intensidad de agua (m3 de agua fresca por tonelada de mineral).' } },
  ],
  limits: [
    { en: 'The ores and plants are authored scenarios inside published ranges, not calibrated plants.', es: 'Los minerales y las plantas son escenarios de autor dentro de rangos publicados, no plantas calibradas.' },
    { en: 'The engine is a steady-state model: it has no dynamics, control loops or start-up behaviour.', es: 'El motor es un modelo de estado estacionario: no tiene dinámica, lazos de control ni comportamiento de partida.' },
  ],
  figure: { wide: true, caption: { en: 'The inputs, the circuit the engine solves, what every state reports, and the method records built on the same engine.', es: 'Las entradas, el circuito que resuelve el motor, lo que informa cada estado y los registros de métodos construidos sobre el mismo motor.' }, render: lang => <OverviewFigure lang={lang} /> },
  refs: ['herbst1980', 'gorain1997', 'king1979'],
};

const APPROACH: Topic = {
  id: 'approach',
  title: { en: 'The approach', es: 'El enfoque' },
  paragraphs: [
    { en: 'The engine is a steady-state mass balance by size and mineral. A stream is a matrix: the mass flow of every mineral in each of 63 size classes, in t/h, and a water flow. Units transform streams: the crusher and the ball mill move mass between size classes without changing any mineral\'s total, while the cyclone, the gravity unit, the desliming cyclone, the flotation banks and the magnetic drums split each particle class (liberated valuable grains, composites and free gangue) between two products. Grades are computed, never stored, from mineral masses and element contents derived from standard atomic weights.',
      es: 'El motor es un balance de masa en estado estacionario por tamaño y mineral. Una corriente es una matriz: el flujo másico de cada mineral en cada una de 63 clases de tamaño, en t/h, y un caudal de agua. Las unidades transforman corrientes: el chancador y el molino de bolas mueven masa entre clases de tamaño sin cambiar el total de ningún mineral, mientras que el ciclón, la unidad gravimétrica, el ciclón de deslamado, los bancos de flotación y los tambores magnéticos dividen cada clase de partícula (granos valiosos liberados, mixtos y ganga libre) entre dos productos. Las leyes se calculan, nunca se guardan, desde las masas de minerales y los contenidos de elementos derivados de los pesos atómicos estándar.' },
    { en: 'The closed circuits are solved, not approximated. In the grinding circuit the engine searches the specific energy per pass and the cyclone cut that together give the target overflow P80 and the design circulating load, with root finders on the logarithm of each. Installed power is a ceiling: when the required power exceeds it, the mill runs at installed power and the product comes out coarser than the target, which the state reports as power-limited. In flotation the cleaner tails return to the rougher feed, and the recycle is iterated until it changes by less than 1e-10 t/h in total and 1e-12 relative in every class.',
      es: 'Los circuitos cerrados se resuelven, no se aproximan. En el circuito de molienda el motor busca la energía específica por pasada y el corte del ciclón que juntos dan el P80 objetivo del rebose y la carga circulante de diseño, con buscadores de raíces sobre el logaritmo de cada uno. La potencia instalada es un techo: cuando la potencia requerida la supera, el molino opera a potencia instalada y el producto sale más grueso que el objetivo, lo que el estado informa como limitado por potencia. En flotación las colas del cleaner vuelven a la alimentación del rougher, y la recirculación se itera hasta que cambia menos de 1e-10 t/h en total y 1e-12 relativo en cada clase.' },
    { en: 'One contract declares every operating input: its unit, its bounds for each case, its step and the cross-field rules. The browser and the service validate against the same exported document and reject the same states with the same codes, and every state the contract accepts is solved with closed balances; the envelope is tested at its corners, at every single bound and at seeded interior states of every case.',
      es: 'Un contrato declara cada entrada de operación: su unidad, sus límites para cada caso, su paso y las reglas entre campos. El navegador y el servicio validan contra el mismo documento exportado y rechazan los mismos estados con los mismos códigos, y cada estado que acepta el contrato se resuelve con balances cerrados; la envolvente se prueba en sus esquinas, en cada límite individual y en estados interiores sembrados de cada caso.' },
    { en: 'Two computations share the engine. The live one runs in the browser: a line-by-line TypeScript port of the Python engine re-solves the circuit when a control moves and sweeps inputs in a Web Worker on request, reproducing every baked result within 1e-6 relative. The baked one runs offline: for every variant of every case it records the kinetic fits, the constrained optimum and the uncertainty quantiles, at the nominal state the Sobol indices, and it trains the learned lane, whose exported network also runs in the browser.',
      es: 'Dos cálculos comparten el motor. El vivo corre en el navegador: una traducción línea a línea a TypeScript del motor en Python vuelve a resolver el circuito cuando se mueve un control y barre entradas en un Web Worker a pedido, reproduciendo cada resultado horneado dentro de 1e-6 relativo. El horneado corre fuera de línea: para cada variante de cada caso registra los ajustes cinéticos, el óptimo con restricciones y los cuantiles de incertidumbre, en el estado nominal los índices de Sobol, y entrena la vía aprendida, cuya red exportada también corre en el navegador.' },
  ],
  equations: [
    { tex: r`m^{(s)}_{i,k} \ge 0\ \ (\mathrm{t/h}),\qquad i = 1,\dots,63,\quad k \in \mathcal{M}`, caption: { en: 'A stream s: the mass flow of mineral k of the case (the set M) in size class i, plus its water flow.', es: 'Una corriente s: el flujo másico del mineral k del caso (el conjunto M) en la clase de tamaño i, más su caudal de agua.' } },
    { tex: r`\sum_{s\,\in\,\mathcal{I}(u)} \sum_i m^{(s)}_{i,k} = \sum_{s\,\in\,\mathcal{O}(u)} \sum_i m^{(s)}_{i,k}\quad \forall\,k`, caption: { en: 'Conservation at every unit u over its input streams I(u) and output streams O(u), audited for every mineral, element and the water.', es: 'Conservación en cada unidad u sobre sus corrientes de entrada I(u) y de salida O(u), auditada para cada mineral, elemento y el agua.' } },
    { tex: r`P_{80,o} = P_{80}^{*},\qquad \frac{U}{F} = CL,\qquad E\,F \le P_{inst}`, caption: { en: 'The grinding circuit\'s steady state: the overflow P80 at the target, the underflow U per tonne of new feed F at the design circulating load, and the installed-power ceiling.', es: 'El estado estacionario del circuito de molienda: el P80 del rebose en el objetivo, la descarga U por tonelada de alimentación nueva F en la carga circulante de diseño, y el techo de potencia instalada.' } },
  ],
  limits: [
    { en: 'One breakage parameter set per ore, with hardness entering only through the work index; no ball size, filling, speed or slurry rheology effects.', es: 'Un solo conjunto de parámetros de fractura por mineral, con la dureza solo a través del índice de trabajo; sin efectos de tamaño de bolas, llenado, velocidad ni reología de la pulpa.' },
    { en: 'Flotation banks are perfect mixers in series with no froth model beyond the recovery factor in the floatability and no pulp chemistry beyond authored floatabilities.', es: 'Los bancos de flotación son mezcladores perfectos en serie, sin modelo de espuma más allá del factor de recuperación en la flotabilidad y sin química de pulpa más allá de flotabilidades de autor.' },
  ],
  figure: { caption: { en: 'A stream is mass by size class and mineral plus water; a unit splits it by particle class, and the audit re-sums every product.', es: 'Una corriente es masa por clase de tamaño y mineral más agua; una unidad la divide por clase de partícula, y la auditoría vuelve a sumar cada producto.' }, render: lang => <StreamFigure lang={lang} /> },
  refs: ['herbst1980', 'plitt1976', 'gorain1997', 'savassi1998'],
};

const CASES: Topic = {
  id: 'cases',
  title: { en: 'The twelve cases', es: 'Los doce casos' },
  paragraphs: [
    { en: 'Twelve authored cases span four circuit families and four teaching categories. Every case declares an ore (its minerals with their densities, the head grade of each payable, liberation sizes, composite contents, floatabilities and the Bond work index) and a plant (installed mill power, cyclone cluster, flotation cells or magnetic drums). Every value is authored inside a range the research records, and carries its unit and its source.',
      es: 'Doce casos de autor cubren cuatro familias de circuito y cuatro categorías de enseñanza. Cada caso declara un mineral (sus minerales con sus densidades, la ley de cabeza de cada pagable, tamaños de liberación, contenidos de los mixtos, flotabilidades y el índice de trabajo de Bond) y una planta (potencia instalada del molino, batería de ciclones, celdas de flotación o tambores magnéticos). Cada valor es de autor dentro de un rango que registra la investigación, y lleva su unidad y su fuente.' },
    { en: 'The liberation cases (two copper porphyries and a fine magnetite) are about the grind: how far to grind before energy stops buying recovery or grade. The classification cases (free-milling gold with gravity recovery inside the grinding loop, nickel sulphide with serpentine slimes, phosphate with clay slimes) are about what the cyclone and the fines do. The flotation cases (bulk copper-molybdenum, oxide copper by sulphidisation, zinc sulphide) are about floatability and the grade-recovery trade. The integration cases (copper ore with clay, low-grade copper at high throughput, refractory gold in sulphides) combine several of these effects at once.',
      es: 'Los casos de liberación (dos pórfidos de cobre y una magnetita fina) tratan de la molienda: hasta dónde moler antes de que la energía deje de comprar recuperación o ley. Los casos de clasificación (oro de molienda libre con recuperación gravimétrica dentro del circuito de molienda, sulfuro de níquel con lamas de serpentina, fosfato con lamas de arcilla) tratan de lo que hacen el ciclón y los finos. Los casos de flotación (cobre-molibdeno en flotación colectiva, cobre oxidado por sulfidización, sulfuro de zinc) tratan de la flotabilidad y del compromiso entre ley y recuperación. Los casos de integración (mineral de cobre con arcilla, cobre de baja ley a alto tonelaje, oro refractario en sulfuros) combinan varios de estos efectos a la vez.' },
    { en: 'Each case carries six variants: the nominal state and five that each change exactly one input by a declared factor: harder ore, a coarser grind, higher throughput, more collector and more air, and where the family has them a larger gravity bleed, a finer grind, a finer crusher setting or a coarser desliming cut. Because only one input moves, the difference between a variant and its nominal is the effect of that input at that state.',
      es: 'Cada caso lleva seis variantes: el estado nominal y cinco que cambian exactamente una entrada por un factor declarado: mineral más duro, molienda más gruesa, más tonelaje, más colector y más aire, y donde la familia los tiene una purga gravimétrica mayor, una molienda más fina, una abertura de chancador menor o un corte de deslamado más grueso. Como solo se mueve una entrada, la diferencia entre una variante y su nominal es el efecto de esa entrada en ese estado.' },
    { en: 'The nominal results of each case are checked against published ranges for its ore type (for the soft porphyry, 84 to 94% recovery at 24 to 32% Cu). The table below reads the nominal state of every case and its checks from the baked results.',
      es: 'Los resultados nominales de cada caso se verifican contra rangos publicados para su tipo de mineral (para el pórfido blando, 84 a 94% de recuperación con 24 a 32% Cu). La tabla de abajo lee el estado nominal de cada caso y sus verificaciones desde los resultados horneados.' },
  ],
  equations: [
    { tex: r`x^{(v)}_j = f_v\,x^{(0)}_j,\qquad x^{(v)}_l = x^{(0)}_l\ \ (l \ne j)`, caption: { en: 'A variant v multiplies one input j of the nominal point by its declared factor and keeps every other input.', es: 'Una variante v multiplica una entrada j del punto nominal por su factor declarado y conserva todas las demás.' } },
  ],
  figure: { caption: { en: 'The five variants around each nominal state, each changing one input by a declared factor; three families replace variants with levers of their own.', es: 'Las cinco variantes alrededor de cada estado nominal, cada una cambiando una entrada por un factor declarado; tres familias reemplazan variantes con palancas propias.' }, render: lang => <VariantFigure lang={lang} /> },
  data: lang => <CaseCatalog lang={lang} />,
  refs: ['porphyry-practice', 'zanin2009', 'nickel2024', 'oxide2022', 'phosphate2019', 'muthaphuli2014', 'laplante-staunton'],
};

const SCOPE: Topic = {
  id: 'scope',
  title: { en: 'Scope and evidence', es: 'Alcance y evidencia' },
  paragraphs: [
    { en: 'OreFlow simulates authored plants. The research behind it found no open dataset that joins grinding, classification and flotation states with measured metallurgy under a clear license, so the cases are scenarios built inside published ranges, and the results are statements about those scenarios, not about any operating plant.',
      es: 'OreFlow simula plantas de autor. La investigación detrás no encontró ningún conjunto de datos abierto que vincule estados de molienda, clasificación y flotación con metalurgia medida bajo una licencia clara, así que los casos son escenarios construidos dentro de rangos publicados, y los resultados son afirmaciones sobre esos escenarios, no sobre una planta en operación.' },
    { en: 'The engine is checked against published examples instead, each labelled as a published example and not as plant data: the Moly-Cop BallSim base case (the closed-circuit solver meets its P80 and circulating load and comes within 7% of its specific energy), the GMG worked examples of the Bond operating work index, the Laplante and Staunton gravity example (gravity recovery rising with the bleed with diminishing returns, and gold circulating far above the ore) and the Zandrivierspoort magnetite (concentrate grade rising by about four points of Fe from 75 to 45 µm).',
      es: 'El motor se contrasta en cambio con ejemplos publicados, cada uno rotulado como ejemplo publicado y no como datos de planta: el caso base BallSim de Moly-Cop (el solucionador de circuito cerrado cumple su P80 y su carga circulante y queda dentro de 7% de su energía específica), los ejemplos resueltos de GMG del índice de trabajo operacional de Bond, el ejemplo gravimétrico de Laplante y Staunton (la recuperación gravimétrica sube con la purga con rendimientos decrecientes, y el oro circula muy por encima del mineral) y la magnetita de Zandrivierspoort (la ley del concentrado sube cerca de cuatro puntos de Fe de 75 a 45 µm).' },
    { en: 'Two lanes use measured data and stay separate from the engine. The HZDR particle dataset (RODARE 336) trains classifiers of constructed separation classes from particle descriptors. The GeoMet locked-cycle tests (Zenodo 7051975) are 52 measured recoveries from 29 drill holes, predicted from five assays under hole-grouped and spatial folds. Neither calibrates the engine\'s controls, and the benchmark reports that the five assays carry little transferable signal about locked-cycle recovery on that deposit.',
      es: 'Dos vías usan datos medidos y se mantienen separadas del motor. El conjunto de partículas HZDR (RODARE 336) entrena clasificadores de clases de separación construidas desde descriptores de partícula. Los ensayos de ciclo cerrado GeoMet (Zenodo 7051975) son 52 recuperaciones medidas de 29 sondajes, predichas desde cinco ensayes químicos con particiones agrupadas por sondaje y espaciales. Ninguna calibra los controles del motor, y el benchmark informa que los cinco ensayes llevan poca señal transferible sobre la recuperación en ciclo cerrado de ese yacimiento.' },
    { en: 'The learned lane is scored where it would be used: on a case it has never seen. Its leave-one-case-out errors, not its interpolation scores, bound how far it can be trusted for a new plant, and a guard flags the states that look unlike its training design. Every requirement of the design names the test that fails when it is violated, and those tests run before anything ships.',
      es: 'La vía aprendida se evalúa donde se usaría: en un caso que nunca vio. Sus errores dejando un caso fuera, no sus puntajes de interpolación, acotan cuánto se puede confiar en ella para una planta nueva, y un guardia marca los estados que no se parecen a su diseño de entrenamiento. Cada requisito del diseño nombra la prueba que falla cuando se viola, y esas pruebas corren antes de publicar cualquier cosa.' },
  ],
  limits: [
    { en: 'No froth model beyond the recovery factor, no pulp chemistry (pH, Eh and depressants act only through authored floatabilities) and no collector adsorption balance.', es: 'Sin modelo de espuma más allá del factor de recuperación, sin química de pulpa (pH, Eh y depresores actúan solo a través de flotabilidades de autor) y sin balance de adsorción del colector.' },
    { en: 'Plitt\'s cyclone equations are uncalibrated, so the cyclone count and pressure are a design check, not a selection.', es: 'Las ecuaciones de ciclón de Plitt no están calibradas, así que el número de ciclones y la presión son una verificación de diseño, no una selección.' },
    { en: 'The gravity concentrator and the magnetic drums have authored responses, not fitted unit models.', es: 'El concentrador gravimétrico y los tambores magnéticos tienen respuestas de autor, no modelos de unidad ajustados.' },
    { en: 'The energy account has no motor or transmission losses, no media or liner energy and no AG or SAG circuits.', es: 'La cuenta de energía no tiene pérdidas de motor ni de transmisión, ni energía de medios o revestimientos, ni circuitos AG o SAG.' },
    { en: 'The uncertainty spreads are authored and the uncertain inputs independent by construction, while real ore properties co-vary.', es: 'Los rangos de incertidumbre son de autor y las entradas inciertas son independientes por construcción, mientras que las propiedades reales del mineral covarían.' },
  ],
  figure: { caption: { en: 'What stands behind the results: the authored engine, published examples it reproduces, measured lanes kept apart, and the plant campaign that is not available.', es: 'Lo que respalda los resultados: el motor de autor, ejemplos publicados que reproduce, vías medidas separadas, y la campaña de planta que no está disponible.' }, render: lang => <EvidenceFigure lang={lang} /> },
  refs: ['molycop', 'gmg2021', 'laplante-staunton', 'muthaphuli2014', 'hzdr', 'geomet', 'ears2009'],
};

const USE: Topic = {
  id: 'use',
  title: { en: 'Using the workbench', es: 'Cómo usar el laboratorio' },
  paragraphs: [
    { en: 'The rail on the left holds the case, its variant, the case\'s question and the controls of its circuit family, grouped as feed and grind, classification, and separation. Every control shows its unit, its bounds for this case and its help. A value outside the bounds is refused with the reason and the limits, and a changed control marks the state as modified from the variant, with a reset.',
      es: 'El riel de la izquierda tiene el caso, su variante, la pregunta del caso y los controles de su familia de circuito, agrupados en alimentación y molienda, clasificación y separación. Cada control muestra su unidad, sus límites para este caso y su ayuda. Un valor fuera de los límites se rechaza con el motivo y los límites, y un control cambiado marca el estado como modificado respecto de la variante, con un botón para volver.' },
    { en: 'The row above the views reads the state: recovery, concentrate grade, specific energy, P80, mill power and any engine flag. Circuit draws the flowsheet with every stream; Grinding the size distributions, the cyclone partition and liberation; Separation recovery by size, the bank profile and the kinetic record; Response sweeps one or two inputs when asked; Methods holds the optimizer, uncertainty, sensitivity and learned-lane records; Case gives the case\'s context and compares its variants and the twelve cases.',
      es: 'La fila sobre las vistas lee el estado: recuperación, ley de concentrado, energía específica, P80, potencia del molino y cualquier aviso del motor. Circuito dibuja el diagrama de flujo con cada corriente; Molienda las distribuciones granulométricas, la partición del ciclón y la liberación; Separación la recuperación por tamaño, el perfil del banco y el registro cinético; Respuesta barre una o dos entradas cuando se pide; Métodos contiene los registros del optimizador, la incertidumbre, la sensibilidad y la vía aprendida; Caso da el contexto del caso y compara sus variantes y los doce casos.' },
    { en: 'Every chart reads its values at the cursor, zooms by dragging across it and hides a series when its legend entry is clicked. The focus view puts one instrument (the flowsheet, any single chart or the response sweep) on a full stage with the controls beside it, and returns to the same state.',
      es: 'Cada gráfico lee sus valores en el cursor, hace zoom al arrastrar sobre él y oculta una serie al hacer clic en su entrada de la leyenda. La vista de foco pone un instrumento (el diagrama de flujo, cualquier gráfico o el barrido de respuesta) en un escenario completo con los controles al lado, y vuelve al mismo estado.' },
    { en: 'Flags are results, not errors. Power-limited means the mill runs at installed power and the grind is coarser than the target; a cyclone pressure outside 35 to 200 kPa means the Plitt sizing falls outside the practical window. The response surfaces draw the grade specification and the installed power as boundaries, so the feasible region is visible.',
      es: 'Los avisos son resultados, no errores. Limitado por potencia significa que el molino opera a potencia instalada y la molienda es más gruesa que el objetivo; una presión de ciclón fuera de 35 a 200 kPa significa que el dimensionado de Plitt cae fuera de la ventana práctica. Las superficies de respuesta dibujan la especificación de ley y la potencia instalada como fronteras, para que la región factible quede a la vista.' },
  ],
  equations: [
    { tex: r`E_{req}\,F > P_{inst}\ \Rightarrow\ E = \frac{P_{inst}}{F},\quad P_{80} > P_{80}^{*}`, caption: { en: 'The power-limited state: the mill runs at installed power and the achieved P80 exceeds the target.', es: 'El estado limitado por potencia: el molino opera a potencia instalada y el P80 logrado supera el objetivo.' } },
    { tex: r`35 \le \Delta p \le 200\ \mathrm{kPa}`, caption: { en: 'The practical window of the Plitt cyclone pressure; outside it the state carries a flag.', es: 'La ventana práctica de la presión de ciclón de Plitt; fuera de ella el estado lleva un aviso.' } },
  ],
  limits: [
    { en: 'A moved control jumps to the new steady state; the workbench shows no transient between two states.', es: 'Un control movido salta al nuevo estado estacionario; el laboratorio no muestra transitorios entre dos estados.' },
    { en: 'Response sweeps run in the browser only when asked; a 9 by 9 surface takes a few seconds.', es: 'Los barridos de respuesta corren en el navegador solo cuando se piden; una superficie de 9 por 9 toma unos segundos.' },
  ],
  figure: { caption: { en: 'The workbench: the rail with the case and its controls, the readout row, one row of view tabs, and the instrument.', es: 'El laboratorio: el riel con el caso y sus controles, la fila de lectura, una fila de pestañas de vistas y el instrumento.' }, render: lang => <WorkbenchFigure lang={lang} /> },
  refs: ['plitt1976'],
};

export const INTRODUCTION: Array<{ id: string; label: Bi; topics: Topic[] }> = [
  { id: 'what', label: { en: 'What it is', es: 'Qué es' }, topics: [WHAT] },
  { id: 'approach', label: { en: 'Approach', es: 'Enfoque' }, topics: [APPROACH] },
  { id: 'cases', label: { en: 'The cases', es: 'Los casos' }, topics: [CASES] },
  { id: 'scope', label: { en: 'Scope and evidence', es: 'Alcance y evidencia' }, topics: [SCOPE] },
  { id: 'use', label: { en: 'Using it', es: 'Cómo usarlo' }, topics: [USE] },
];
