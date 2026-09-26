/**
 * Methodology, comminution: the Whiten crusher (methodology page 02), the energy-specific population
 * balance in closed circuit (page 03) and the energy laws (page 09), transcribed from those pages.
 */
import { localizeAuthored, type Lang } from '../../lib/format';
import type { Topic } from '../doc';

const r = String.raw;

function Arrowhead({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" className="dg-arrowhead" />
      </marker>
    </defs>
  );
}

function CrusherFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  return (
    <svg className="fig-svg" viewBox="0 0 420 250" role="img" aria-label={es ? 'Modelo de Whiten: clasificación, fractura y retorno' : 'Whiten model: classification, breakage and return'}>
      <Arrowhead id="of-crusher-arrow" />
      <text className="dg-edge-label" x="14" y="52">f</text>
      <line className="dg-edge" x1="24" y1="48" x2="76" y2="48" markerEnd="url(#of-crusher-arrow)" />
      <rect className="dg-box accent" x="78" y="26" width="96" height="44" rx="7" />
      <text className="dg-box-title" x="126" y="46" textAnchor="middle">{es ? 'clasificación' : 'classification'}</text>
      <text className="dg-box-sub" x="126" y="61" textAnchor="middle">C(x)</text>
      <line className="dg-edge" x1="174" y1="48" x2="236" y2="48" markerEnd="url(#of-crusher-arrow)" />
      <text className="dg-edge-label" x="205" y="40" textAnchor="middle">C</text>
      <rect className="dg-box" x="238" y="26" width="96" height="44" rx="7" />
      <text className="dg-box-title" x="286" y="46" textAnchor="middle">{es ? 'fractura' : 'breakage'}</text>
      <text className="dg-box-sub" x="286" y="61" textAnchor="middle">B</text>
      <path className="dg-edge" d="M 286 70 L 286 96 L 126 96 L 126 72" markerEnd="url(#of-crusher-arrow)" />
      <text className="dg-edge-label" x="206" y="110" textAnchor="middle">{es ? 'vuelve a clasificarse' : 'returns to classification'}</text>
      <path className="dg-edge" d="M 100 70 L 100 128 L 360 128" markerEnd="url(#of-crusher-arrow)" />
      <text className="dg-edge-label" x="366" y="132">p</text>
      <text className="dg-edge-label" x="230" y="122" textAnchor="middle">{'(I - C)'}</text>
      <g transform="translate(60 150)">
        <line className="dg-axis" x1="0" y1="80" x2="300" y2="80" />
        <line className="dg-axis" x1="0" y1="80" x2="0" y2="0" />
        <path className="dg-curve" d="M 0 80 L 80 80 C 130 80, 170 30, 220 2 L 300 2" />
        <line className="dg-marker" x1="80" y1="80" x2="80" y2="0" />
        <line className="dg-marker" x1="220" y1="80" x2="220" y2="0" />
        <text className="dg-marker-label" x="84" y="14">K1</text>
        <text className="dg-marker-label" x="224" y="14">K2</text>
        <text className="dg-axis-label" x="150" y="96" textAnchor="middle">{es ? 'tamaño x' : 'size x'}</text>
      </g>
    </svg>
  );
}

function CircuitFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  return (
    <svg className="fig-svg wide" viewBox="0 0 560 220" role="img" aria-label={es ? 'Circuito cerrado de molino de bolas y ciclones' : 'Closed ball-mill and cyclone circuit'}>
      <Arrowhead id="of-circuit-arrow" />
      <text className="dg-edge-label" x="8" y="74">f</text>
      <line className="dg-edge" x1="18" y1="70" x2="54" y2="70" markerEnd="url(#of-circuit-arrow)" />
      <rect className="dg-box accent" x="56" y="30" width="210" height="80" rx="9" />
      <text className="dg-box-title" x="161" y="50" textAnchor="middle">{es ? 'molino de bolas' : 'ball mill'}</text>
      {[['0.70', 70, 72], ['0.15', 152, 40], ['0.15', 202, 40]].map(([label, x, w]) => (
        <g key={String(x)}>
          <rect className="dg-box" x={Number(x)} y="60" width={Number(w)} height="36" rx="5" />
          <text className="dg-box-sub" x={Number(x) + Number(w) / 2} y="82" textAnchor="middle">{localizeAuthored(String(label), lang)}</text>
        </g>
      ))}
      <line className="dg-edge" x1="142" y1="78" x2="150" y2="78" markerEnd="url(#of-circuit-arrow)" />
      <line className="dg-edge" x1="192" y1="78" x2="200" y2="78" markerEnd="url(#of-circuit-arrow)" />
      <line className="dg-edge" x1="266" y1="70" x2="312" y2="70" markerEnd="url(#of-circuit-arrow)" />
      <text className="dg-edge-label" x="289" y="62" textAnchor="middle">p</text>
      <rect className="dg-box" x="314" y="48" width="86" height="44" rx="7" />
      <text className="dg-box-title" x="357" y="74" textAnchor="middle">{es ? 'ciclones' : 'cyclones'}</text>
      <line className="dg-edge" x1="400" y1="70" x2="470" y2="70" markerEnd="url(#of-circuit-arrow)" />
      <text className="dg-edge-label" x="476" y="66">{es ? 'rebose' : 'overflow'}</text>
      <text className="dg-edge-label" x="476" y="80">P80</text>
      <path className="dg-curve-faint" d="M 357 92 L 357 160 L 110 160 L 110 112" markerEnd="url(#of-circuit-arrow)" />
      <text className="dg-edge-label" x="234" y="178" textAnchor="middle">{es ? 'descarga C p (carga circulante)' : 'underflow C p (circulating load)'}</text>
      <text className="dg-note" x="280" y="206" textAnchor="middle">{es ? 'tres mezcladores perfectos (0,70 · 0,15 · 0,15 del volumen); e se ajusta al P80, el corte a la carga circulante' : 'three perfect mixers (0.70 · 0.15 · 0.15 of the volume); e is set by the P80, the cut by the circulating load'}</text>
    </svg>
  );
}

// computed from the three laws (docs/methodologies/09_energy.md) at 33 log-spaced product sizes
const BOND_PATH = 'M 60.0 60.2 L 70.0 62.8 L 80.0 65.3 L 90.0 67.9 L 100.0 70.4 L 110.0 73.0 L 120.0 75.6 L 130.0 78.2 L 140.0 80.8 L 150.0 83.4 L 160.0 86.0 L 170.0 88.7 L 180.0 91.3 L 190.0 94.0 L 200.0 96.7 L 210.0 99.4 L 220.0 102.2 L 230.0 104.9 L 240.0 107.7 L 250.0 110.6 L 260.0 113.4 L 270.0 116.3 L 280.0 119.2 L 290.0 122.2 L 300.0 125.2 L 310.0 128.2 L 320.0 131.3 L 330.0 134.5 L 340.0 137.7 L 350.0 141.0 L 360.0 144.4 L 370.0 147.9 L 380.0 151.4';
const KICK_PATH = 'M 60.0 87.3 L 70.0 88.1 L 80.0 88.9 L 90.0 89.7 L 100.0 90.5 L 110.0 91.4 L 120.0 92.3 L 130.0 93.2 L 140.0 94.1 L 150.0 95.0 L 160.0 96.0 L 170.0 97.0 L 180.0 98.0 L 190.0 99.0 L 200.0 100.1 L 210.0 101.2 L 220.0 102.3 L 230.0 103.5 L 240.0 104.7 L 250.0 105.9 L 260.0 107.2 L 270.0 108.5 L 280.0 109.9 L 290.0 111.3 L 300.0 112.8 L 310.0 114.4 L 320.0 116.0 L 330.0 117.6 L 340.0 119.4 L 350.0 121.2 L 360.0 123.1 L 370.0 125.1 L 380.0 127.3';
const RITTINGER_PATH = 'M 60.0 24.1 L 70.0 28.9 L 80.0 33.8 L 90.0 38.6 L 100.0 43.5 L 110.0 48.3 L 120.0 53.2 L 130.0 58.0 L 140.0 62.9 L 150.0 67.8 L 160.0 72.6 L 170.0 77.5 L 180.0 82.4 L 190.0 87.3 L 200.0 92.2 L 210.0 97.1 L 220.0 102.0 L 230.0 106.9 L 240.0 111.8 L 250.0 116.8 L 260.0 121.7 L 270.0 126.7 L 280.0 131.7 L 290.0 136.7 L 300.0 141.7 L 310.0 146.8 L 320.0 151.9 L 330.0 157.0 L 340.0 162.1 L 350.0 167.3 L 360.0 172.6 L 370.0 177.9 L 380.0 183.3';

function EnergyFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  return (
    <svg className="fig-svg" viewBox="0 0 450 240" role="img" aria-label={es ? 'Leyes de energía calibradas en una reducción de referencia' : 'Energy laws calibrated at a reference reduction'}>
      <line className="dg-axis" x1="50" y1="190" x2="390" y2="190" />
      <line className="dg-axis" x1="50" y1="190" x2="50" y2="20" />
      {/* the three laws calibrated to agree at the engine's reference reduction (F 10000 um, P 150 um), on log-log
          axes over a product P80 of 20 to 1100 um (Wi = 1; E_B = 10 (P^-1/2 - F^-1/2), E_K = c ln(F/P),
          E_R = c (1/P - 1/F)); they meet at the reference and diverge away from it */}
      <path className="dg-curve" fill="none" d={BOND_PATH} />
      <path className="dg-curve-2" fill="none" d={RITTINGER_PATH} />
      <path className="dg-curve-faint" fill="none" d={KICK_PATH} />
      <line className="dg-marker" x1="220.9" y1="190" x2="220.9" y2="102.4" />
      <circle cx="220.9" cy="102.4" r="4" className="dg-fill-warn" />
      <text className="dg-marker-label" x="227" y="94">{es ? 'referencia' : 'reference'}</text>
      <text className="dg-edge-label" x="388" y="131">Kick</text>
      <text className="dg-edge-label" x="388" y="155">Bond</text>
      <text className="dg-edge-label" x="388" y="187">Rittinger</text>
      <text className="dg-axis-label" x="220" y="214" textAnchor="middle">{es ? 'P80 del producto (escala log)' : 'product P80 (log scale)'}</text>
      <text className="dg-axis-label" x="18" y="105" textAnchor="middle" transform="rotate(-90 18 105)">{es ? 'energía específica (escala log)' : 'specific energy (log scale)'}</text>
    </svg>
  );
}

export const COMMINUTION: Topic[] = [
  {
    id: 'crushing',
    title: { en: 'Crushing', es: 'Chancado' },
    paragraphs: [
      { en: 'Whiten\'s crusher model treats the crushing chamber as a classification step followed by breakage, with broken material returned to the classifier until it escapes. C is a diagonal matrix of the probability that a particle of each size enters the breakage zone, and B the lower-triangular breakage matrix. K1 is the size below which nothing is broken, K2 the size above which everything is broken and K3 the shape; industrial calibrations report K1 of about 0.5 to 0.95 times the closed-side setting and K2 of about 1.7 to 3.5 times.',
        es: 'El modelo de chancador de Whiten trata la cámara de chancado como una clasificación seguida de fractura, con el material fracturado devuelto al clasificador hasta que escapa. C es una matriz diagonal con la probabilidad de que una partícula de cada tamaño entre a la zona de fractura, y B la matriz de fractura triangular inferior. K1 es el tamaño bajo el cual nada se fractura, K2 el tamaño sobre el cual todo se fractura y K3 la forma; las calibraciones industriales reportan K1 de unas 0,5 a 0,95 veces la abertura de descarga y K2 de unas 1,7 a 3,5 veces.' },
      { en: 'The engine solves one lower-triangular system with unit diagonal, because B has no diagonal, and returns the product. B comes from the Austin breakage function with crusher parameters. The crusher runs in open circuit on the bulk ore; every mineral shares the bulk distribution of the crusher feed, a Rosin-Rammler curve with the case feed F80. Crushing energy is reported with Bond\'s equation and the case crushing work index.',
        es: 'El motor resuelve un sistema triangular inferior con diagonal unitaria, porque B no tiene diagonal, y entrega el producto. B viene de la función de fractura de Austin con parámetros del chancador. El chancador opera en circuito abierto sobre el mineral total; todos los minerales comparten la distribución de la alimentación, una curva Rosin-Rammler con el F80 del caso. La energía de chancado se informa con la ecuación de Bond y el índice de trabajo de chancado del caso.' },
    ],
    equations: [
      { tex: r`p = (I - C)(I - B\,C)^{-1} f`, caption: { en: 'Product of the Whiten model for feed f by size class.', es: 'Producto del modelo de Whiten para la alimentación f por clase de tamaño.' } },
      { tex: r`C(x) = \begin{cases} 0 & x < K_1 \\ 1 - \left(\dfrac{K_2 - x}{K_2 - K_1}\right)^{K_3} & K_1 \le x \le K_2 \\ 1 & x > K_2 \end{cases}`,
        caption: { en: 'Classification function of the crushing chamber.', es: 'Función de clasificación de la cámara de chancado.' } },
    ],
    table: {
      head: [{ en: 'Parameter', es: 'Parámetro' }, { en: 'Value', es: 'Valor' }, { en: 'Source', es: 'Fuente' }],
      rows: [
        ['K1', '0.8 CSS', { en: 'inside the reported 0.5 to 0.95 CSS', es: 'dentro de 0,5 a 0,95 CSS reportado' }],
        ['K2', '2.3 CSS', { en: 'inside the reported 1.7 to 3.5 CSS', es: 'dentro de 1,7 a 3,5 CSS reportado' }],
        ['K3', '2.3', { en: 'commonly used value', es: 'valor de uso común' }],
        ['β0, β1, β2', '0.4, 0.7, 3.5', { en: 'authored, Austin form', es: 'de autor, forma de Austin' }],
        [{ en: 'crusher feed F80', es: 'F80 de alimentación' }, '60 mm', { en: 'authored secondary-crusher feed', es: 'alimentación de chancado secundario de autor' }],
      ],
    },
    limits: [
      { en: 'The K values do not respond to throughput, feed size or liner wear as plant regressions do, and crusher power is not modelled: the crusher sets the ball-mill feed and the crushing energy.', es: 'Los valores K no responden al tratamiento, al tamaño de alimentación ni al desgaste de corazas como en las regresiones de planta, y la potencia del chancador no se modela: el chancador fija la alimentación al molino y la energía de chancado.' },
    ],
    figure: { caption: { en: 'Particles that enter the breakage zone (C) break (B) and return to classification; those that escape form the product.', es: 'Las partículas que entran a la zona de fractura (C) se fracturan (B) y vuelven a clasificarse; las que escapan forman el producto.' }, render: lang => <CrusherFigure lang={lang} /> },
    refs: ['crusher2021', 'crusher2024', 'syscad-crusher'],
  },
  {
    id: 'grinding',
    title: { en: 'Grinding circuit', es: 'Circuito de molienda' },
    paragraphs: [
      { en: 'Grinding follows a population balance: each size class loses mass to breakage at its specific rate and gains the fragments of coarser classes. Herbst and Fuerstenau showed that the specific rate is an energy-specific rate times the mill power over its holdup, and that the energy-specific rate is invariant with mill size and power, which makes population-balance scale-up possible. The breakage per pass therefore depends on the specific energy per tonne of mill feed. OreFlow uses the energy-specific form of the Moly-Cop ball-mill simulator.',
        es: 'La molienda sigue un balance poblacional: cada clase de tamaño pierde masa por fractura a su tasa específica y gana los fragmentos de clases más gruesas. Herbst y Fuerstenau mostraron que la tasa específica es una tasa por energía específica por la potencia del molino sobre su carga, y que la tasa por energía específica no cambia con el tamaño ni la potencia del molino, lo que permite escalar con balances poblacionales. La fractura por pasada depende entonces de la energía específica por tonelada de alimentación al molino. OreFlow usa la forma de energía específica del simulador de molinos de bolas de Moly-Cop.' },
      { en: 'A full-scale ball mill is represented as one large perfect mixer followed by two equal small ones (Austin, Klimpel and Luckie); the mixers share one breakage operator, so they commute and the mill transfer is a polynomial in that operator. With the cyclones returning a fraction of every size class, the closed circuit is one lower-triangular solve per evaluation, and at steady state the overflow carries exactly the new feed of every mineral.',
        es: 'Un molino de bolas industrial se representa como un mezclador perfecto grande seguido de dos pequeños iguales (Austin, Klimpel y Luckie); los mezcladores comparten un operador de fractura, por lo que conmutan y la transferencia del molino es un polinomio en ese operador. Con los ciclones devolviendo una fracción de cada clase, el circuito cerrado es una resolución triangular inferior por evaluación, y en estado estacionario el rebose lleva exactamente la alimentación fresca de cada mineral.' },
      { en: 'Two conditions set the solution: for a per-pass energy, the host-gangue cut is found so that the circulating load equals its design value, and the energy is found so that the overflow P80 equals the target (both by the Illinois root finder on logarithms). If the resulting mill power exceeds the installed power, the circuit runs at installed power, the cut is solved again, and the coarser achieved P80 is reported as power-limited: this is how a harder ore or a higher feed rate coarsens a real circuit. Liberated grains break at their own relative grindability and composites at the ore rate; a valuable-rich class limits its composites to the host gangue it carries, iterated to a fixed point.',
        es: 'Dos condiciones fijan la solución: para una energía por pasada, el corte de la ganga huésped se busca para que la carga circulante iguale su valor de diseño, y la energía se busca para que el P80 del rebose iguale el objetivo (ambas con el método de Illinois sobre logaritmos). Si la potencia resultante supera la instalada, el circuito opera a potencia instalada, el corte se resuelve de nuevo y se informa el P80 logrado más grueso como limitado por potencia: así un mineral más duro o más alimentación engruesan un circuito real. Los granos liberados se fracturan con su propia moliendabilidad relativa y los mixtos con la del mineral; una clase rica en mineral valioso limita sus mixtos a la ganga huésped que lleva, iterado hasta un punto fijo.' },
    ],
    equations: [
      { tex: r`\frac{dM_i}{dt} = -S_i M_i + \sum_{j<i} b_{ij} S_j M_j`, caption: { en: 'Batch population balance, class 1 the coarsest.', es: 'Balance poblacional batch, con la clase 1 la más gruesa.' } },
      { tex: r`\begin{gathered} S_i^E = \alpha_0 \frac{d_i^{\alpha_1}}{1 + (d_i/d_{crit})^{\alpha_2}} \\ S_i\,\tau = S_i^E\,\frac{P}{Q} \end{gathered}`, caption: { en: 'Energy-specific selection function and the breakage per pass at mill power P and solids feed rate Q.', es: 'Función de selección por energía específica y la fractura por pasada con potencia P y alimentación de sólidos Q.' } },
      { tex: r`\begin{aligned} B_{ij} &= \beta_0 \left(\frac{x_i}{x_{j+1}}\right)^{\beta_1} + (1 - \beta_0)\left(\frac{x_i}{x_{j+1}}\right)^{\beta_2} \\ b_{ij} &= B_{ij} - B_{i+1,j} \end{aligned}`, caption: { en: 'Cumulative breakage function (Austin form).', es: 'Función de fractura acumulada (forma de Austin).' } },
      { tex: r`\begin{gathered} T^{-1}(e) = I + e\,D + c_2 e^2 D^2 + c_3 e^3 D^3 \\ \left(T^{-1}(e) - \mathrm{diag}(C)\right) p = f \end{gathered}`, caption: { en: 'Three perfect mixers sharing D = (I - b) diag(S^E), and the closed circuit for new feed f.', es: 'Tres mezcladores perfectos que comparten D = (I - b) diag(S^E), y el circuito cerrado para la alimentación fresca f.' } },
    ],
    table: {
      head: [{ en: 'Parameter', es: 'Parámetro' }, { en: 'Value', es: 'Valor' }, { en: 'Source', es: 'Fuente' }],
      rows: [
        ['α0, α1, α2', '0.0091 t/kWh, 0.651, 2.5', { en: 'Moly-Cop defaults', es: 'valores por defecto de Moly-Cop' }],
        ['d_crit', '6514 µm', { en: 'Moly-Cop default', es: 'valor por defecto de Moly-Cop' }],
        ['β0, β1, β2', '0.4, 0.65, 4.02', { en: 'Moly-Cop documented alternative set', es: 'conjunto alternativo documentado de Moly-Cop' }],
        [{ en: 'mixer volume fractions', es: 'fracciones de volumen de los mezcladores' }, '0.70, 0.15, 0.15', { en: 'Austin structure; values declared', es: 'estructura de Austin; valores declarados' }],
        [{ en: 'mill discharge solids', es: 'sólidos en la descarga del molino' }, { en: '72% w/w', es: '72% p/p' }, { en: 'Moly-Cop base case', es: 'caso base de Moly-Cop' }],
      ],
    },
    limits: [
      { en: 'One breakage parameter set per ore, with hardness entering only through the work index; no ball size, filling or speed effects; no slurry rheology; the mixer fractions are declared, not fitted.', es: 'Un conjunto de parámetros de fractura por mineral, con la dureza entrando solo por el índice de trabajo; sin efectos de tamaño de bolas, llenado o velocidad; sin reología de pulpa; las fracciones de los mezcladores son declaradas, no ajustadas.' },
      { en: 'Checked against the Moly-Cop base case (504 t/h, F80 6913 µm, P80 169.4 µm, 277% circulating load): the engine lands within 20% of the reported 8.56 kWh/t; that is a published tool\'s example, not plant data.', es: 'Contrastado con el caso base de Moly-Cop (504 t/h, F80 6913 µm, P80 169,4 µm, 277% de carga circulante): el motor queda dentro de 20% de los 8,56 kWh/t reportados; es el ejemplo de una herramienta publicada, no datos de planta.' },
    ],
    figure: { caption: { en: 'The mill as three mixers in closed circuit with the cyclones; the underflow returns to the mill.', es: 'El molino como tres mezcladores en circuito cerrado con los ciclones; la descarga vuelve al molino.' }, render: lang => <CircuitFigure lang={lang} />, wide: true },
    refs: ['herbst1980', 'molycop'],
  },
  {
    id: 'energy',
    title: { en: 'Energy', es: 'Energía' },
    paragraphs: [
      { en: 'Bond\'s law gives the specific energy to reduce an ore from F80 to P80, and an operating circuit\'s work index is recovered from its own specific energy, pinion power over dry throughput, with the efficiency ratio of the standard to the operating work index. The guideline limits the method to products coarser than about 70 µm.',
        es: 'La ley de Bond da la energía específica para reducir un mineral de F80 a P80, y el índice de trabajo operacional de un circuito se obtiene de su propia energía específica, potencia en el piñón sobre tratamiento seco, con la razón de eficiencia del índice estándar al operacional. La guía limita el método a productos más gruesos que unos 70 µm.' },
      { en: 'Rittinger\'s law makes energy proportional to new surface and Kick\'s to the reduction ratio. They are alternative hypotheses for the same reduction, bracketing Bond at fine and coarse sizes; they are not energy components and are never added to Bond. Their constants are chosen so that both equal Bond at a reference reduction (10 000 to 150 µm with the case work index); at the case\'s own reduction they diverge, which is the comparison the workbench reports.',
        es: 'La ley de Rittinger hace la energía proporcional a la superficie nueva y la de Kick a la razón de reducción. Son hipótesis alternativas para la misma reducción, que acotan a Bond en tamaños finos y gruesos; no son componentes de energía y nunca se suman a Bond. Sus constantes se eligen para que ambas igualen a Bond en una reducción de referencia (10 000 a 150 µm con el índice del caso); en la reducción propia del caso divergen, que es la comparación que informa el laboratorio.' },
      { en: 'The engine reports crushing energy (Bond with the crushing work index), grinding energy (what the population balance needs per tonne of new feed), regrind energy (the declared regrind specific energy on the regrind feed, per tonne of ore) and their total, with the Bond requirement, the operating work index and the efficiency ratio of the achieved reduction.',
        es: 'El motor informa la energía de chancado (Bond con el índice de chancado), la de molienda (lo que necesita el balance poblacional por tonelada de alimentación fresca), la de remolienda (la energía específica declarada sobre la alimentación a remolienda, por tonelada de mineral) y su total, con el requerimiento de Bond, el índice de trabajo operacional y la razón de eficiencia de la reducción lograda.' },
    ],
    equations: [
      { tex: r`\begin{gathered} W = W_i\left(\frac{10}{\sqrt{P_{80}}} - \frac{10}{\sqrt{F_{80}}}\right) \\ W_{i,o} = \frac{P/T}{10/\sqrt{P_{80}} - 10/\sqrt{F_{80}}} \end{gathered}`, caption: { en: 'Bond energy (kWh/t, sizes in µm) and the operating work index.', es: 'Energía de Bond (kWh/t, tamaños en µm) y el índice de trabajo operacional.' } },
      { tex: r`E_R = K_R\left(\frac{1}{P} - \frac{1}{F}\right),\qquad E_K = K_K \ln\frac{F}{P}`, caption: { en: 'Rittinger and Kick, calibrated to Bond at the reference reduction.', es: 'Rittinger y Kick, calibradas a Bond en la reducción de referencia.' } },
    ],
    limits: [
      { en: 'No motor or transmission losses, no media or liner energy, no model for autogenous or semi-autogenous circuits.', es: 'Sin pérdidas de motor ni transmisión, sin energía de medios ni corazas, sin modelo para circuitos autógenos o semiautógenos.' },
      { en: 'Checked against the GMG worked example: 3150 kW at 450 t/h from 2500 to 212 µm gives 7.0 kWh/t and an operating work index of 14.4 kWh/t.', es: 'Contrastado con el ejemplo resuelto de GMG: 3150 kW a 450 t/h de 2500 a 212 µm dan 7,0 kWh/t y un índice operacional de 14,4 kWh/t.' },
    ],
    figure: { caption: { en: 'The three laws agree at the reference reduction and diverge away from it; only Bond is reported as the energy.', es: 'Las tres leyes coinciden en la reducción de referencia y divergen fuera de ella; solo Bond se informa como energía.' }, render: lang => <EnergyFigure lang={lang} /> },
    refs: ['bond1952', 'gmg2021'],
  },
];
