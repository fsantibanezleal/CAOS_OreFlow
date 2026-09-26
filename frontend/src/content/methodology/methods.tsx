/**
 * Methodology, method records: kinetic fits and bank projection (methodology page 11), constrained
 * operating-point optimization (page 12), uncertainty and Sobol sensitivity (page 13) and the learned
 * lane (page 14), transcribed from those pages. The baked results are on the Experiments page, read
 * from the artifacts; these topics state the methods.
 */
import type { Lang } from '../../lib/format';
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

function KineticsFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  const samples: Array<[number, number]> = [[62, 150], [74, 128], [98, 104], [122, 90], [146, 82], [194, 72], [242, 67], [338, 61], [380, 58]];
  return (
    <svg className="fig-svg" viewBox="0 0 420 240" role="img" aria-label={es ? 'Curva batch con ajustes agregados y proyección al banco' : 'Batch curve with lumped fits and the bank projection'}>
      <line className="dg-axis" x1="50" y1="190" x2="390" y2="190" />
      <line className="dg-axis" x1="50" y1="190" x2="50" y2="20" />
      <path className="dg-curve-faint" d="M 50 190 C 70 110, 110 70, 390 64" />
      <path className="dg-curve" d="M 50 190 C 62 120, 110 80, 200 70 S 330 58, 390 55" />
      {samples.map(([x, y]) => <circle key={x} cx={x} cy={y - 4} r="3.2" className="dg-fill-accent" />)}
      <line className="dg-asymptote" x1="50" y1="40" x2="390" y2="40" />
      <text className="dg-marker-label" x="300" y="34">{es ? 'banco exacto' : 'exact bank'}</text>
      <text className="dg-edge-label" x="380" y="100" textAnchor="end">{es ? 'primer orden: tope en la meseta' : 'first order: capped at the plateau'}</text>
      <text className="dg-edge-label" x="120" y="60">{es ? 'Kelsall, gamma' : 'Kelsall, gamma'}</text>
      <text className="dg-axis-label" x="220" y="214" textAnchor="middle">{es ? 'tiempo batch (min)' : 'batch time (min)'}</text>
      <text className="dg-axis-label" x="18" y="105" textAnchor="middle" transform="rotate(-90 18 105)">{es ? 'recuperación' : 'recovery'}</text>
    </svg>
  );
}

function OptimizerFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  const starts: Array<[number, number]> = [[90, 160], [300, 170], [120, 60], [330, 70], [210, 120], [260, 40]];
  return (
    <svg className="fig-svg" viewBox="0 0 420 240" role="img" aria-label={es ? 'Región factible, restricciones activas y seis inicios' : 'Feasible region, active constraints and six starts'}>
      <Arrowhead id="of-opt-arrow" />
      <line className="dg-axis" x1="50" y1="200" x2="390" y2="200" />
      <line className="dg-axis" x1="50" y1="200" x2="50" y2="20" />
      <path className="dg-fill-accent" d="M 150 200 L 150 60 C 220 70, 300 110, 390 150 L 390 200 Z" opacity="0.5" />
      <line className="dg-asymptote" x1="150" y1="200" x2="150" y2="24" />
      <text className="dg-marker-label" x="154" y="34">{es ? 'potencia instalada' : 'installed power'}</text>
      <path className="dg-marker" d="M 60 40 C 220 70, 300 110, 390 150" fill="none" />
      <text className="dg-marker-label" x="300" y="104">{es ? 'ley mínima' : 'grade spec'}</text>
      <circle cx="152" cy="62" r="5" className="dg-fill-warn" />
      <text className="dg-marker-label" x="160" y="58">{es ? 'óptimo' : 'optimum'}</text>
      {starts.map(([x, y]) => <line key={`${x}-${y}`} className="dg-edge" x1={x} y1={y} x2={x + (152 - x) * 0.82} y2={y + (62 - y) * 0.82} markerEnd="url(#of-opt-arrow)" />)}
      {starts.map(([x, y]) => <circle key={`s${x}-${y}`} cx={x} cy={y} r="3" className="dg-fill-accent" />)}
      <text className="dg-axis-label" x="220" y="222" textAnchor="middle">{es ? 'objetivo de molienda P80 (más fino a la izquierda)' : 'grind target P80 (finer to the left)'}</text>
      <text className="dg-axis-label" x="18" y="110" textAnchor="middle" transform="rotate(-90 18 110)">{es ? 'dosis de colector' : 'collector dose'}</text>
    </svg>
  );
}

function UncertaintyFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  const bars = [4, 9, 16, 24, 30, 26, 18, 10, 5];
  return (
    <svg className="fig-svg" viewBox="0 0 420 220" role="img" aria-label={es ? 'Hipercubo latino, distribución de una salida e índices de Sobol' : 'Latin hypercube, the distribution of one output and Sobol indices'}>
      <g transform="translate(20 20)">
        <rect className="dg-box" x="0" y="0" width="120" height="120" />
        {Array.from({ length: 8 }, (_, i) => <line key={`h${i}`} className="dg-grid" x1="0" y1={15 * i} x2="120" y2={15 * i} />)}
        {Array.from({ length: 8 }, (_, i) => <line key={`v${i}`} className="dg-grid" x1={15 * i} y1="0" x2={15 * i} y2="120" />)}
        {[3, 6, 0, 5, 7, 2, 4, 1].map((row, col) => <circle key={col} cx={15 * col + 7.5} cy={15 * row + 7.5} r="3" className="dg-fill-accent" />)}
        <text className="dg-box-sub" x="60" y="138" textAnchor="middle">{es ? 'una muestra por fila y columna' : 'one sample per row and column'}</text>
      </g>
      <g transform="translate(160 20)">
        {bars.map((h, i) => <rect key={i} className="dg-bar" x={i * 12} y={120 - 3.4 * h} width="10" height={3.4 * h} />)}
        <line className="dg-marker" x1="28" y1="0" x2="28" y2="122" />
        <line className="dg-marker" x1="80" y1="0" x2="80" y2="122" />
        <text className="dg-marker-label" x="2" y="10">P05</text>
        <text className="dg-marker-label" x="84" y="10">P95</text>
        <text className="dg-box-sub" x="54" y="138" textAnchor="middle">{es ? 'distribución de la salida' : 'output distribution'}</text>
      </g>
      <g transform="translate(290 20)">
        {[[0.12, 0.13], [0.01, 0.01], [0.06, 0.06], [0.8, 0.79]].map(([s1, st], i) => (
          <g key={i}>
            <rect className="dg-bar" x={i * 28} y={120 - 140 * s1} width="11" height={140 * s1} />
            <rect className="dg-bar-2" x={i * 28 + 12} y={120 - 140 * st} width="11" height={140 * st} />
          </g>
        ))}
        <text className="dg-box-sub" x="50" y="138" textAnchor="middle">S1 · ST</text>
      </g>
      <text className="dg-note" x="210" y="196" textAnchor="middle">{es ? '128 muestras para los cuantiles; N = 256 en el diseño de Saltelli para los índices' : '128 samples for the quantiles; N = 256 in the Saltelli design for the indices'}</text>
    </svg>
  );
}

function LearnedFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  const boxes: Array<[string, string]> = es
    ? [['diseño Sobol', '256 por caso'], ['motor', 'estados'], ['22 variables', 'físicas'], ['5 modelos', 'protocolos'], ['ONNX', 'MLP y guardia'], ['navegador', 'onnxruntime-web']]
    : [['Sobol design', '256 per case'], ['engine', 'states'], ['22 features', 'physical'], ['5 models', 'protocols'], ['ONNX', 'MLP and guard'], ['browser', 'onnxruntime-web']];
  return (
    <svg className="fig-svg wide" viewBox="0 0 600 150" role="img" aria-label={es ? 'La vía aprendida desde el diseño hasta el navegador' : 'The learned lane from design to browser'}>
      <Arrowhead id="of-learn-arrow" />
      {boxes.map(([title, sub], i) => (
        <g key={title} transform={`translate(${8 + i * 98} 30)`}>
          <rect className={i === 3 ? 'dg-box accent' : 'dg-box'} x="0" y="0" width="84" height="46" rx="7" />
          <text className="dg-box-title" x="42" y="20" textAnchor="middle">{title}</text>
          <text className="dg-box-sub" x="42" y="35" textAnchor="middle">{sub}</text>
          {i < boxes.length - 1 && <line className="dg-edge" x1="84" y1="23" x2="96" y2="23" markerEnd="url(#of-learn-arrow)" />}
        </g>
      ))}
      <text className="dg-note" x="300" y="112" textAnchor="middle">{es ? 'interpolación: 80/20 dentro de cada caso · transferencia: dejando un caso fuera' : 'interpolation: 80/20 inside every case · transfer: leave one case out'}</text>
    </svg>
  );
}

export const METHODS: Topic[] = [
  {
    id: 'kinetics',
    title: { en: 'Kinetic fits and bank projection', es: 'Ajustes cinéticos y proyección al banco' },
    paragraphs: [
      { en: 'A laboratory batch flotation test gives one recovery-time curve; a plant rougher is a bank of continuously fed cells. Lumped kinetic models connect the two: fit a few parameters to the batch curve, then predict the bank. OreFlow uses its own engine as the laboratory. In a virtual batch test of the rougher feed every particle class floats by first-order true flotation, so the batch curve is a mixture of exponentials (fast liberated grains near the optimum size, slow composites and ultrafines), not one exponential.',
        es: 'Una prueba batch de flotación de laboratorio entrega una curva recuperación-tiempo; un rougher de planta es un banco de celdas alimentadas en continuo. Los modelos cinéticos agregados conectan ambas cosas: se ajustan unos pocos parámetros a la curva batch y luego se predice el banco. OreFlow usa su propio motor como laboratorio. En una prueba batch virtual de la alimentación rougher cada clase de partícula flota con flotación verdadera de primer orden, por lo que la curva batch es una mezcla de exponenciales (granos liberados rápidos cerca del tamaño óptimo, mixtos y ultrafinos lentos), no una sola exponencial.' },
      { en: 'Five classical forms summarize such a curve: first order, Kelsall\'s fast and slow fractions, Klimpel\'s rectangular distribution of rates, the gamma distribution, and the compressed or stretched exponential. Each is fitted by Levenberg-Marquardt with analytic Jacobians and bounded by reparameterization, with every sum in a fixed order so the browser port follows the same path. A bank of N equal mixed cells has an Erlang residence distribution; every first-order class obeys segregated flow exactly, so a lumped model projects to the bank by integrating it against that distribution, in closed form where one exists and by a 64-node Gauss-Laguerre rule, exported with the contract, where it does not.',
        es: 'Cinco formas clásicas resumen una curva así: primer orden, las fracciones rápida y lenta de Kelsall, la distribución rectangular de tasas de Klimpel, la distribución gamma y la exponencial comprimida o estirada. Cada una se ajusta por Levenberg-Marquardt con jacobianos analíticos y límites por reparametrización, con cada suma en un orden fijo para que la versión del navegador siga el mismo camino. Un banco de N celdas mezcladas iguales tiene una distribución de residencia de Erlang; cada clase de primer orden cumple exactamente el flujo segregado, por lo que un modelo agregado se proyecta al banco integrándolo contra esa distribución, en forma cerrada cuando existe y con una regla de Gauss-Laguerre de 64 nodos, exportada con el contrato, cuando no.' },
      { en: 'Because the engine knows every class rate, it also computes the unlumped bank recovery. The lumping error of a model is its projection minus that exact value, and the ultimate gap is the fitted ultimate recovery minus the fitted recovery at the last batch time: the part of the projection that rests on extrapolation, because a bank residence is often longer than the 16-minute test. On the nominal cases the first-order model underestimates the exact bank, because it caps the ultimate recovery at the plateau of the test, while the Kelsall and gamma forms fit and project closely.',
        es: 'Como el motor conoce la tasa de cada clase, también calcula la recuperación exacta del banco sin agregar. El error de agregación de un modelo es su proyección menos ese valor exacto, y la brecha última es la recuperación última ajustada menos la recuperación ajustada al último tiempo batch: la parte de la proyección que descansa en extrapolación, porque la residencia de un banco suele ser más larga que la prueba de 16 minutos. En los casos nominales el modelo de primer orden subestima el banco exacto, porque limita la recuperación última a la meseta de la prueba, mientras las formas de Kelsall y gamma ajustan y proyectan de cerca.' },
    ],
    equations: [
      { tex: r`R_{batch}(t) = \frac{\sum_j c_j x_j \left(1 - e^{-k_j t}\right)}{\sum_j c_j x_j}`, caption: { en: 'The engine\'s batch curve: a mixture of first-order classes j of content c_j and feed x_j.', es: 'La curva batch del motor: una mezcla de clases j de primer orden con contenido c_j y alimentación x_j.' } },
      { tex: r`R = A(1-e^{-kt}),\quad A\left[(1-\phi)(1-e^{-k_f t}) + \phi(1-e^{-k_s t})\right],\quad A\left[1 - \frac{1-e^{-kt}}{kt}\right],\quad A\left[1-(1+at)^{-p}\right],\quad A\left(1-e^{-(kt)^{\beta}}\right)`, caption: { en: 'First order, Kelsall, Klimpel, gamma, and the compressed (β > 1) or stretched (β < 1) exponential.', es: 'Primer orden, Kelsall, Klimpel, gamma, y la exponencial comprimida (β > 1) o estirada (β < 1).' } },
      { tex: r`R_{bank} = \int_0^\infty R_{batch}(t)\,\frac{t^{N-1}e^{-t/\tau_c}}{\tau_c^N (N-1)!}\,dt,\qquad R^{FO}_{bank} = A\left[1 - (1 + k\tau_c)^{-N}\right]`, caption: { en: 'Projection to a bank of N cells of residence tau_c, and its first-order closed form.', es: 'Proyección a un banco de N celdas de residencia tau_c, y su forma cerrada de primer orden.' } },
    ],
    limits: [
      { en: 'The batch test is virtual: it has the rougher\'s hydrodynamics and no froth-recovery or entrainment effects, which a laboratory test would include. The lumped parameters describe this engine\'s rate distribution, not plant or laboratory data.', es: 'La prueba batch es virtual: tiene la hidrodinámica del rougher y no los efectos de recuperación de espuma ni de arrastre que incluiría una prueba de laboratorio. Los parámetros agregados describen la distribución de tasas de este motor, no datos de planta ni de laboratorio.' },
      { en: 'Where a batch curve has no plateau (it reaches only 6 to 35% by 16 minutes at some envelope states), the ultimate recovery and the slow rate trade off along a flat valley; such fits stop at the iteration cap and are reported as not converged, never as converged.', es: 'Donde una curva batch no tiene meseta (solo llega a 6 a 35% a los 16 minutos en algunos estados de la envolvente), la recuperación última y la tasa lenta se compensan a lo largo de un valle plano; esos ajustes se detienen en el tope de iteraciones y se informan como no convergidos, nunca como convergidos.' },
    ],
    figure: { caption: { en: 'The first-order fit caps at the test plateau; two-rate and gamma fits follow the curve and project closer to the exact bank.', es: 'El ajuste de primer orden queda limitado por la meseta de la prueba; los ajustes de dos tasas y gamma siguen la curva y proyectan más cerca del banco exacto.' }, render: lang => <KineticsFigure lang={lang} /> },
    refs: ['polat2000', 'bu2017', 'vinnett2025', 'marquardt1963'],
  },
  {
    id: 'optimization',
    title: { en: 'Constrained optimization', es: 'Optimización con restricciones' },
    paragraphs: [
      { en: 'The question a plant engineer asks of a circuit model is rarely what happens at this point, and more often where to run it. For each baked variant the engine maximizes the recovered primary payable (t/h of Cu or of Au) over the decisions an operator controls day to day: the grind target, the collector dose and the rougher gas velocity (the grind target alone for magnetite), each bounded by the contract envelope. Everything else stays at the variant\'s value.',
        es: 'La pregunta que un ingeniero de planta le hace a un modelo de circuito rara vez es qué pasa en este punto, y más a menudo dónde operar. Para cada variante horneada el motor maximiza el pagable principal recuperado (t/h de Cu o de Au) sobre las decisiones que un operador controla día a día: el objetivo de molienda, la dosis de colector y la velocidad de gas rougher (solo el objetivo de molienda en la magnetita), cada una acotada por la envolvente del contrato. Todo lo demás queda en el valor de la variante.' },
      { en: 'Three constraints shape the answer: the final concentrate grade at or above the case specification (more collector and air raise recovery and can lower grade), the required mill power at or below the installed power (beyond it the target is not reachable), and the process water per tonne at or below the plant\'s capacity, authored 5% above each case\'s nominal requirement. The engine is not differentiable in closed form (root finders, recycles, a power-limited branch), so the method is COBYLA, Powell\'s derivative-free method that models the objective and each constraint by linear interpolation in a trust region, in SciPy\'s implementation from PRIMA.',
        es: 'Tres restricciones dan forma a la respuesta: la ley del concentrado final sobre la especificación del caso (más colector y aire suben la recuperación y pueden bajar la ley), la potencia requerida del molino bajo la instalada (más allá el objetivo no es alcanzable), y el agua de proceso por tonelada bajo la capacidad de la planta, de autor 5% sobre el requerimiento nominal de cada caso. El motor no es diferenciable en forma cerrada (buscadores de raíces, recirculaciones, una rama limitada por potencia), por lo que el método es COBYLA, el método sin derivadas de Powell que modela el objetivo y cada restricción por interpolación lineal en una región de confianza, en la implementación de SciPy tomada de PRIMA.' },
      { en: 'Decisions are scaled to the unit cube of their bounds, and six starts are used: the variant\'s own point and five declared interior points. The best start that ends feasible is simulated again from scratch, and its values and slacks come from that fresh run; constraints within 1e-3 of their limit are reported as active. If no start ends feasible the status is infeasible and the least-violating end point is reported; an infeasible point is never labelled optimal.',
        es: 'Las decisiones se escalan al cubo unitario de sus límites y se usan seis inicios: el punto de la propia variante y cinco puntos interiores declarados. El mejor inicio que termina factible se simula otra vez desde cero, y sus valores y holguras salen de esa corrida nueva; las restricciones a menos de 1e-3 de su límite se informan como activas. Si ningún inicio termina factible el estado es infactible y se informa el punto final de menor violación; un punto infactible nunca se etiqueta como óptimo.' },
    ],
    equations: [
      { tex: r`\max_{u \in U}\ \dot m_{pay}(u)\quad \text{s.t.}\quad g(u) \ge g_{min},\quad P_{req}(u) \le P_{inst},\quad w(u) \le w_{max}`, caption: { en: 'Recovered payable over the operating decisions u in the contract envelope U, under the grade, power and water constraints.', es: 'Pagable recuperado sobre las decisiones de operación u en la envolvente U del contrato, con las restricciones de ley, potencia y agua.' } },
      { tex: r`s_c = \frac{\text{value} - \text{limit}}{\text{limit}}\ (\text{signed so feasible} \ge 0),\qquad \text{feasible} \iff \min_c s_c \ge -10^{-6}`, caption: { en: 'Constraints as relative slacks.', es: 'Restricciones como holguras relativas.' } },
    ],
    limits: [
      { en: 'A steady-state optimum of an authored plant model. It knows nothing about froth stability, reagent cost, concentrate payability or the value of energy; the objective is recovered metal alone, which is why it spends every kilowatt the mill has and why the gas velocity tends to its upper bound: the engine has no froth-stability penalty.', es: 'Un óptimo de estado estacionario de un modelo de planta de autor. No sabe nada de estabilidad de espuma, costo de reactivos, condiciones comerciales del concentrado ni valor de la energía; el objetivo es solo el metal recuperado, por eso gasta cada kilowatt que tiene el molino y por eso la velocidad de gas tiende a su límite superior: el motor no penaliza la estabilidad de la espuma.' },
    ],
    figure: { caption: { en: 'Six starts converge to one optimum where the grade and power constraints meet.', es: 'Seis inicios convergen a un óptimo donde se encuentran las restricciones de ley y potencia.' }, render: lang => <OptimizerFigure lang={lang} /> },
    refs: ['powell1994', 'prima2023', 'scipy2020'],
  },
  {
    id: 'uncertainty',
    title: { en: 'Uncertainty and sensitivity', es: 'Incertidumbre y sensibilidad' },
    paragraphs: [
      { en: 'A single steady state hides how much the answer depends on ore properties nobody knows exactly. Four inputs vary: the work index, the head grade, the liberation size of every valuable mineral and, in flotation circuits, its floatability. Each is a uniform factor around its value, with half widths of 20, 20, 25 and 25%, authored for these records rather than fitted to a deposit.',
        es: 'Un solo estado estacionario oculta cuánto depende la respuesta de propiedades del mineral que nadie conoce con exactitud. Varían cuatro entradas: el índice de trabajo, la ley de cabeza, el tamaño de liberación de cada mineral valioso y, en circuitos de flotación, su flotabilidad. Cada una es un factor uniforme en torno a su valor, con semianchos de 20, 20, 25 y 25%, de autor para estos registros en vez de ajustados a un yacimiento.' },
      { en: 'A seeded scrambled Latin hypercube of 128 points is simulated. For recovery, concentrate grade, grinding energy and recovered metal the record gives the P05, P50 and P95, the mean, the standard deviation and every sampled value, so a histogram can be drawn from the record itself, plus the probability of meeting each constraint of the optimizer and all of them together.',
        es: 'Se simula un hipercubo latino aleatorizado y sembrado de 128 puntos. Para la recuperación, la ley del concentrado, la energía de molienda y el metal recuperado el registro da P05, P50 y P95, la media, la desviación estándar y cada valor muestreado, para poder dibujar un histograma desde el propio registro, más la probabilidad de cumplir cada restricción del optimizador y todas a la vez.' },
      { en: 'Which input drives the spread is measured by Sobol indices: the first-order index is the share of the output variance an input explains alone, the total index adds every interaction the input takes part in. They are estimated with Saltelli\'s design and estimators (SALib, N = 256 base samples at the nominal state, bootstrap 95% intervals). An input the output does not depend on gives exactly zero, which is a structural check: grinding energy has floatability indices of exactly 0.',
        es: 'Qué entrada explica la dispersión se mide con índices de Sobol: el índice de primer orden es la parte de la varianza de la salida que una entrada explica sola, el total suma cada interacción en que participa. Se estiman con el diseño y los estimadores de Saltelli (SALib, N = 256 muestras base en el estado nominal, intervalos bootstrap de 95%). Una entrada de la que la salida no depende da exactamente cero, lo que es una verificación estructural: la energía de molienda tiene índices de flotabilidad exactamente 0.' },
    ],
    equations: [
      { tex: r`S_i = \frac{V\left[E(Y \mid X_i)\right]}{V(Y)},\qquad S_{T_i} = \frac{E\left[V(Y \mid X_{\sim i})\right]}{V(Y)}`, caption: { en: 'First-order and total Sobol indices; S_T - S_1 is the interaction share.', es: 'Índices de Sobol de primer orden y total; S_T - S_1 es la parte de interacción.' } },
      { tex: r`V_i \approx \frac{1}{N}\sum_j f(B)_j\left(f(A_B^{(i)})_j - f(A)_j\right),\qquad V_{T_i} \approx \frac{1}{2N}\sum_j\left(f(A)_j - f(A_B^{(i)})_j\right)^2`, caption: { en: 'Saltelli estimators on base matrices A and B and the matrix A with column i taken from B; N(D + 2) evaluations.', es: 'Estimadores de Saltelli sobre las matrices base A y B y la matriz A con la columna i tomada de B; N(D + 2) evaluaciones.' } },
    ],
    limits: [
      { en: 'The spreads are authored, so the records say nothing about any deposit. The inputs are independent by construction while real ore properties co-vary, and the indices are only as meaningful as that assumption. Operating inputs are held fixed: the records describe the ore\'s uncertainty at a given way of running the plant.', es: 'Las dispersiones son de autor, por lo que los registros no dicen nada de un yacimiento. Las entradas son independientes por construcción mientras las propiedades reales del mineral covarían, y los índices valen lo que vale ese supuesto. Las entradas de operación quedan fijas: los registros describen la incertidumbre del mineral para una forma dada de operar la planta.' },
    ],
    figure: { caption: { en: 'A Latin hypercube fills every input\'s range evenly; the output distribution gives the quantiles, the Sobol indices say which input drives it.', es: 'Un hipercubo latino cubre parejo el rango de cada entrada; la distribución de la salida da los cuantiles y los índices de Sobol dicen qué entrada la explica.' }, render: lang => <UncertaintyFigure lang={lang} /> },
    refs: ['saltelli2010', 'salib2017', 'scipy2020'],
  },
  {
    id: 'learned',
    title: { en: 'Learned lane', es: 'Vía aprendida' },
    paragraphs: [
      { en: 'The learned lane asks whether a surrogate can stand in for the engine, and where it cannot. For every case a seeded scrambled Sobol design covers its contract envelope and two ore properties (liberation and floatability factors), 256 accepted states per case, 3072 in all; the engine simulates every state. The features are 22 physical properties and controls computed before simulation, never the case identity, so that holding a case out measures transfer to an unseen ore and plant. The targets are the recovery, the log10 upgrade ratio (concentrate over head grade, unit-free across payables) and the total specific energy.',
        es: 'La vía aprendida pregunta si un sustituto puede reemplazar al motor, y dónde no. Para cada caso un diseño de Sobol aleatorizado y sembrado cubre su envolvente del contrato y dos propiedades del mineral (factores de liberación y flotabilidad), 256 estados aceptados por caso, 3072 en total; el motor simula cada estado. Las variables son 22 propiedades físicas y controles calculados antes de simular, nunca la identidad del caso, para que dejar un caso fuera mida la transferencia a un mineral y una planta no vistos. Los objetivos son la recuperación, el log10 de la razón de enriquecimiento (concentrado sobre cabeza, sin unidades entre pagables) y la energía específica total.' },
      { en: 'Two protocols score five models (ridge, a random forest, histogram gradient boosting, an ARD Gaussian process with interval coverage, and a PyTorch MLP that stops on validation loss): an interpolation split of 80/20 inside every case, and leave one case out, where the models that predict a case never saw any of its states. An autoencoder trained on the features guards against states unlike the training design. The final MLP and guard are trained on every state and exported to ONNX, checked against PyTorch, and the browser runs them with onnxruntime-web beside the engine.',
        es: 'Dos protocolos evalúan cinco modelos (ridge, un bosque aleatorio, gradient boosting por histogramas, un proceso gaussiano ARD con cobertura de intervalos y un MLP de PyTorch que se detiene por pérdida de validación): una partición de interpolación 80/20 dentro de cada caso, y dejar un caso fuera, donde los modelos que predicen un caso nunca vieron ninguno de sus estados. Un autoencoder entrenado con las variables vigila los estados distintos del diseño de entrenamiento. El MLP final y el guardia se entrenan con todos los estados y se exportan a ONNX, verificados contra PyTorch, y el navegador los ejecuta con onnxruntime-web junto al motor.' },
    ],
    equations: [
      { tex: r`\hat y = f_\theta\!\left(\frac{x - \mu_x}{\sigma_x}\right)\sigma_y + \mu_y,\qquad \text{flag} \iff \frac{1}{D}\sum_d \left(g_\phi(z)_d - z_d\right)^2 > q_{0.99}`, caption: { en: 'The exported surrogate on standardized features, and the guard: a state is flagged when its reconstruction error exceeds the 99th percentile of the validation errors.', es: 'El sustituto exportado sobre variables estandarizadas, y el guardia: un estado se marca cuando su error de reconstrucción supera el percentil 99 de los errores de validación.' } },
    ],
    limits: [
      { en: 'A replacement for the engine only inside the trained envelopes: the surrogates learn this engine on these twelve authored plants, and leave-one-case-out says how badly they transfer to a thirteenth. The guard detects states unlike its training features, not errors in the engine. The measured results are on the Experiments page.', es: 'Un reemplazo del motor solo dentro de las envolventes entrenadas: los sustitutos aprenden este motor en estas doce plantas de autor, y dejar un caso fuera dice qué tan mal transfieren a una decimotercera. El guardia detecta estados distintos de sus variables de entrenamiento, no errores del motor. Los resultados medidos están en la página de Experimentos.' },
    ],
    figure: { caption: { en: 'From the Sobol design to the models the browser runs.', es: 'Del diseño de Sobol a los modelos que ejecuta el navegador.' }, render: lang => <LearnedFigure lang={lang} />, wide: true },
    refs: ['breiman2001', 'friedman2001', 'rasmussen2006', 'sklearn2011', 'adam2015', 'adamw2019', 'onnx-web'],
  },
];
