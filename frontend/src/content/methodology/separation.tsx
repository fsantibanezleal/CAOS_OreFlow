/**
 * Methodology, separation: classification (methodology page 04), flotation (page 05), gravity gold
 * (page 06), magnetic separation (page 07) and desliming (page 08), transcribed from those pages.
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

function PartitionFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  return (
    <svg className="fig-svg" viewBox="0 0 420 240" role="img" aria-label={es ? 'Partición del ciclón para la ganga y para un mineral denso' : 'Cyclone partition for the gangue and for a dense mineral'}>
      <line className="dg-axis" x1="50" y1="190" x2="390" y2="190" />
      <line className="dg-axis" x1="50" y1="190" x2="50" y2="20" />
      <line className="dg-asymptote" x1="50" y1="160" x2="390" y2="160" />
      <text className="dg-marker-label" x="330" y="155">R_f</text>
      <path className="dg-curve" d="M 55 160 C 170 160, 220 150, 250 105 S 300 32, 385 30" />
      <path className="dg-curve-2" d="M 55 160 C 120 160, 160 150, 185 105 S 235 32, 385 30" />
      <line className="dg-marker" x1="250" y1="190" x2="250" y2="95" />
      <line className="dg-marker" x1="185" y1="190" x2="185" y2="95" />
      <text className="dg-marker-label" x="254" y="206">d50c</text>
      <text className="dg-marker-label" x="150" y="206">d50c,k</text>
      <text className="dg-edge-label" x="300" y="70">{es ? 'ganga' : 'gangue'}</text>
      <text className="dg-edge-label" x="140" y="80">{es ? 'mineral denso' : 'dense mineral'}</text>
      <text className="dg-axis-label" x="220" y="228" textAnchor="middle">{es ? 'tamaño (escala log)' : 'size (log scale)'}</text>
      <text className="dg-axis-label" x="18" y="105" textAnchor="middle" transform="rotate(-90 18 105)">{es ? 'fracción a la descarga' : 'fraction to underflow'}</text>
    </svg>
  );
}

function FlotationFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  return (
    <svg className="fig-svg wide" viewBox="0 0 560 230" role="img" aria-label={es ? 'Banco rougher, remolienda y limpieza con recirculación' : 'Rougher bank, regrind and cleaner with recycle'}>
      <Arrowhead id="of-flot-arrow" />
      <text className="dg-edge-label" x="6" y="104">{es ? 'alim.' : 'feed'}</text>
      <line className="dg-edge" x1="36" y1="100" x2="58" y2="100" markerEnd="url(#of-flot-arrow)" />
      {[0, 1, 2, 3].map(k => (
        <g key={k} transform={`translate(${60 + k * 58} 80)`}>
          <rect className="dg-box" x="0" y="0" width="50" height="40" rx="5" />
          <line className="dg-edge" x1="25" y1="0" x2="25" y2="-22" markerEnd="url(#of-flot-arrow)" />
          {k < 3 && <line className="dg-edge" x1="50" y1="20" x2="58" y2="20" markerEnd="url(#of-flot-arrow)" />}
        </g>
      ))}
      <text className="dg-box-sub" x="210" y="144" textAnchor="middle">{es ? 'rougher: N celdas, k de S_b' : 'rougher: N cells, k from S_b'}</text>
      <line className="dg-edge" x1="85" y1="56" x2="287" y2="56" />
      <line className="dg-edge" x1="284" y1="100" x2="330" y2="100" markerEnd="url(#of-flot-arrow)" />
      <text className="dg-edge-label" x="340" y="104">{es ? 'relave' : 'tail'}</text>
      <path className="dg-edge" d="M 287 56 L 300 56 L 300 30 L 360 30" markerEnd="url(#of-flot-arrow)" />
      <rect className="dg-box" x="362" y="12" width="70" height="36" rx="6" />
      <text className="dg-box-title" x="397" y="34" textAnchor="middle">{es ? 'remolienda' : 'regrind'}</text>
      <line className="dg-edge" x1="432" y1="30" x2="458" y2="30" markerEnd="url(#of-flot-arrow)" />
      <rect className="dg-box accent" x="460" y="12" width="80" height="36" rx="6" />
      <text className="dg-box-title" x="500" y="34" textAnchor="middle">{es ? 'limpieza' : 'cleaner'}</text>
      <path className="dg-curve-faint" d="M 500 48 L 500 178 L 110 178 L 110 122" markerEnd="url(#of-flot-arrow)" />
      <text className="dg-edge-label" x="300" y="194" textAnchor="middle">{es ? 'relave de limpieza de vuelta al rougher' : 'cleaner tail back to the rougher'}</text>
      <path className="dg-edge" d="M 540 30 L 552 30 L 552 6" markerEnd="url(#of-flot-arrow)" />
      <text className="dg-edge-label" x="548" y="64" textAnchor="end">{es ? 'concentrado' : 'concentrate'}</text>
      <text className="dg-note" x="280" y="220" textAnchor="middle">{es ? 'recuperación por flotación verdadera y por arrastre con el agua (ENT)' : 'recovery by true flotation and by entrainment with the water (ENT)'}</text>
    </svg>
  );
}

function GravityFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  return (
    <svg className="fig-svg" viewBox="0 0 420 210" role="img" aria-label={es ? 'Purga gravimétrica del underflow' : 'Gravity bleed of the underflow'}>
      <Arrowhead id="of-grav-arrow" />
      <rect className="dg-box" x="30" y="30" width="90" height="42" rx="7" />
      <text className="dg-box-title" x="75" y="56" textAnchor="middle">{es ? 'molino' : 'mill'}</text>
      <line className="dg-edge" x1="120" y1="51" x2="180" y2="51" markerEnd="url(#of-grav-arrow)" />
      <rect className="dg-box" x="182" y="30" width="90" height="42" rx="7" />
      <text className="dg-box-title" x="227" y="56" textAnchor="middle">{es ? 'ciclones' : 'cyclones'}</text>
      <line className="dg-edge" x1="272" y1="51" x2="330" y2="51" markerEnd="url(#of-grav-arrow)" />
      <text className="dg-edge-label" x="334" y="55">{es ? 'a flotación' : 'to flotation'}</text>
      <path className="dg-edge" d="M 227 72 L 227 104" markerEnd="url(#of-grav-arrow)" />
      <circle cx="227" cy="110" r="5" className="dg-fill-warn" />
      <path className="dg-curve-faint" d="M 222 110 L 75 110 L 75 74" markerEnd="url(#of-grav-arrow)" />
      <text className="dg-edge-label" x="140" y="104" textAnchor="middle">{'1 - b'}</text>
      <path className="dg-edge" d="M 227 115 L 227 140" markerEnd="url(#of-grav-arrow)" />
      <text className="dg-edge-label" x="235" y="132">b</text>
      <rect className="dg-box accent" x="172" y="142" width="110" height="40" rx="7" />
      <text className="dg-box-title" x="227" y="160" textAnchor="middle">{es ? 'gravimetría' : 'gravity unit'}</text>
      <text className="dg-box-sub" x="227" y="174" textAnchor="middle">E_g(d)</text>
      <line className="dg-edge" x1="282" y1="162" x2="340" y2="162" markerEnd="url(#of-grav-arrow)" />
      <text className="dg-edge-label" x="344" y="166">{es ? 'concentrado' : 'concentrate'}</text>
      <path className="dg-curve-faint" d="M 172 162 L 60 162 L 60 74" markerEnd="url(#of-grav-arrow)" />
      <text className="dg-edge-label" x="116" y="178" textAnchor="middle">{es ? 'relave al molino' : 'tail to the mill'}</text>
    </svg>
  );
}

function MagneticFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  return (
    <svg className="fig-svg" viewBox="0 0 420 180" role="img" aria-label={es ? 'Tambores LIMS rougher y de limpieza' : 'LIMS rougher and cleaner drums'}>
      <Arrowhead id="of-lims-arrow" />
      <text className="dg-edge-label" x="6" y="64">{es ? 'rebose' : 'overflow'}</text>
      <line className="dg-edge" x1="58" y1="60" x2="96" y2="60" markerEnd="url(#of-lims-arrow)" />
      {[[98, es ? 'LIMS rougher' : 'LIMS rougher'], [246, es ? 'LIMS limpieza' : 'LIMS cleaner']].map(([x, label]) => (
        <g key={String(x)}>
          <circle cx={Number(x) + 40} cy="60" r="30" className="dg-node" />
          <text className="dg-node-label" x={Number(x) + 40} y="104" textAnchor="middle">{String(label)}</text>
        </g>
      ))}
      <line className="dg-edge" x1="168" y1="60" x2="244" y2="60" markerEnd="url(#of-lims-arrow)" />
      <text className="dg-edge-label" x="206" y="52" textAnchor="middle">{es ? 'magnético' : 'magnetic'}</text>
      <line className="dg-edge" x1="316" y1="60" x2="380" y2="60" markerEnd="url(#of-lims-arrow)" />
      <text className="dg-edge-label" x="384" y="64">{es ? 'conc.' : 'conc.'}</text>
      <path className="dg-curve-faint" d="M 138 90 L 138 140 L 380 140" markerEnd="url(#of-lims-arrow)" />
      <path className="dg-curve-faint" d="M 286 90 L 286 140" />
      <text className="dg-edge-label" x="384" y="144">{es ? 'relave' : 'tail'}</text>
      <text className="dg-note" x="210" y="170" textAnchor="middle">{es ? 'captura por clase: liberada, mixtos según contenido, ganga atrapada' : 'capture by class: liberated, composites by content, entrapped gangue'}</text>
    </svg>
  );
}

function DeslimeFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  return (
    <svg className="fig-svg" viewBox="0 0 420 180" role="img" aria-label={es ? 'Deslamado antes de flotación' : 'Desliming before flotation'}>
      <Arrowhead id="of-des-arrow" />
      <text className="dg-edge-label" x="6" y="74">{es ? 'rebose' : 'overflow'}</text>
      <line className="dg-edge" x1="58" y1="70" x2="116" y2="70" markerEnd="url(#of-des-arrow)" />
      <rect className="dg-box accent" x="118" y="48" width="104" height="44" rx="7" />
      <text className="dg-box-title" x="170" y="68" textAnchor="middle">{es ? 'deslamado' : 'desliming'}</text>
      <text className="dg-box-sub" x="170" y="83" textAnchor="middle">d_des</text>
      <path className="dg-edge" d="M 170 48 L 170 20 L 300 20" markerEnd="url(#of-des-arrow)" />
      <text className="dg-edge-label" x="306" y="24">{es ? 'lamas a relave' : 'slimes to tail'}</text>
      <line className="dg-edge" x1="222" y1="70" x2="270" y2="70" markerEnd="url(#of-des-arrow)" />
      <rect className="dg-box" x="272" y="50" width="70" height="40" rx="7" />
      <text className="dg-box-title" x="307" y="74" textAnchor="middle">{es ? 'repulpeo' : 'repulp'}</text>
      <line className="dg-edge" x1="342" y1="70" x2="392" y2="70" markerEnd="url(#of-des-arrow)" />
      <text className="dg-edge-label" x="352" y="62">rougher</text>
      <text className="dg-note" x="210" y="130" textAnchor="middle">{es ? 'un corte más grueso limpia la alimentación y pierde más fosfato fino' : 'a coarser cut cleans the feed and loses more fine phosphate'}</text>
    </svg>
  );
}

export const SEPARATION: Topic[] = [
  {
    id: 'classification',
    title: { en: 'Classification', es: 'Clasificación' },
    paragraphs: [
      { en: 'A hydrocyclone sends particles to the underflow with a probability that rises with size and density, and carries a share of the fines to the underflow with the water, the bypass. Plitt\'s model expresses the partition as a Rosin-Rammler curve on the corrected cut size with that water bypass.',
        es: 'Un hidrociclón envía las partículas a la descarga con una probabilidad que crece con el tamaño y la densidad, y lleva una parte de los finos a la descarga con el agua, el cortocircuito. El modelo de Plitt expresa la partición como una curva Rosin-Rammler sobre el tamaño de corte corregido con ese cortocircuito de agua.' },
      { en: 'Plitt\'s cut depends on the solids density as the inverse square root of the density difference, so a denser particle classifies as if it were larger. The engine applies that dependence per particle class, which sends liberated sulphides, magnetite and gold to the underflow at finer sizes than the gangue. In a closed circuit this returns dense minerals to the mill until they are fine, the known overgrinding of dense minerals; plant audits of gold circuits show the same shift of the partition curve.',
        es: 'El corte de Plitt depende de la densidad de los sólidos como la inversa de la raíz de la diferencia de densidades, por lo que una partícula más densa se clasifica como si fuera más grande. El motor aplica esa dependencia por clase de partícula, lo que envía sulfuros liberados, magnetita y oro a la descarga a tamaños más finos que la ganga. En circuito cerrado esto devuelve los minerales densos al molino hasta que son finos, la conocida sobremolienda de los minerales densos; las auditorías de circuitos de oro muestran el mismo corrimiento de la curva de partición.' },
      { en: 'The circuit solver finds the cut the circuit needs; Plitt\'s equations then answer the equipment question at the solved cyclone feed: the flow per cyclone that gives that cut, the number of cyclones, and the pressure, volume split and sharpness at that count. A pressure outside 35 to 200 kPa is flagged, not rejected.',
        es: 'El solucionador del circuito encuentra el corte que necesita el circuito; las ecuaciones de Plitt responden luego la pregunta de equipos con la alimentación resuelta: el caudal por ciclón que da ese corte, el número de ciclones, y la presión, la partición de volumen y la nitidez con ese número. Una presión fuera de 35 a 200 kPa se avisa, no se rechaza.' },
    ],
    equations: [
      { tex: r`y(d) = R_f + (1 - R_f)\left(1 - e^{-\ln 2\,(d/d_{50c})^{m}}\right),\qquad d_{50c,k} = d_{50c}\sqrt{\frac{\rho_{host} - 1}{\rho_k - 1}}`, caption: { en: 'Partition to underflow with water bypass R_f, and the density-corrected cut of particle class k.', es: 'Partición a la descarga con cortocircuito de agua R_f, y el corte corregido por densidad de la clase k.' } },
      { tex: r`d_{50c} = \frac{50.5\,D_c^{0.46} D_i^{0.6} D_o^{1.21} e^{0.063 C_v}}{D_u^{0.71} h^{0.38} Q^{0.45} (\rho_s - \rho_l)^{0.5}}\ \mu\mathrm{m}`, caption: { en: 'Plitt cut size (lengths in cm, Q in L/min per cyclone, C_v in percent solids by volume).', es: 'Tamaño de corte de Plitt (longitudes en cm, Q en L/min por ciclón, C_v en porcentaje de sólidos en volumen).' } },
      { tex: r`\Delta P = \frac{1.88\,Q^{1.78} e^{0.0055 C_v}}{D_c^{0.37} D_i^{0.94} h^{0.28} (D_u^2 + D_o^2)^{0.87}}\ \mathrm{kPa},\qquad m = 1.94\,e^{-1.58 R_v}\left(\frac{D_c^2 h}{Q}\right)^{0.15}`, caption: { en: 'Plitt pressure drop and sharpness (R_v the volume split to underflow).', es: 'Caída de presión y nitidez de Plitt (R_v la partición de volumen a la descarga).' } },
    ],
    table: {
      head: [{ en: 'Parameter', es: 'Parámetro' }, { en: 'Value', es: 'Valor' }, { en: 'Source', es: 'Fuente' }],
      rows: [
        [{ en: 'sharpness m', es: 'nitidez m' }, '2.0', { en: 'authored; Moly-Cop example 1.66', es: 'de autor; ejemplo de Moly-Cop 1,66' }],
        [{ en: 'underflow solids', es: 'sólidos en la descarga' }, '75% w/w', { en: 'authored', es: 'de autor' }],
        [{ en: 'geometry ratios Di, Do, Du, h', es: 'razones geométricas Di, Do, Du, h' }, '0.256, 0.335, 0.197, 2.95 Dc', { en: 'typical proportions', es: 'proporciones típicas' }],
        ['Dc', '25 - 91 cm', { en: 'chosen so the nominal Plitt pressure lies in the window', es: 'elegido para que la presión nominal de Plitt quede en la ventana' }],
      ],
    },
    limits: [
      { en: 'Plitt\'s equations are uncalibrated here (a plant fits correction factors to a survey), so the cyclone count and pressure are a design check, not a selection. No roping, no fish-hook.', es: 'Las ecuaciones de Plitt no están calibradas aquí (una planta ajusta factores de corrección a un muestreo), por lo que el número de ciclones y la presión son una verificación de diseño, no una selección. Sin acordonamiento ni efecto anzuelo.' },
    ],
    figure: { caption: { en: 'A dense mineral classifies at a finer cut than the gangue; both curves start at the water bypass.', es: 'Un mineral denso se clasifica con un corte más fino que la ganga; ambas curvas parten del cortocircuito de agua.' }, render: lang => <PartitionFigure lang={lang} /> },
    refs: ['plitt1976', 'laplante-staunton'],
  },
  {
    id: 'flotation',
    title: { en: 'Flotation', es: 'Flotación' },
    paragraphs: [
      { en: 'Gorain, Franzidis and Manlapig showed in industrial cells that the flotation rate constant is governed not by gas velocity, bubble size or gas holdup separately but by their combination in the bubble surface area flux. The Sauter bubble size grows with gas velocity, so the flux saturates at high air. Recovery falls at fine and coarse sizes (Trahar), so each class\'s rate carries a size window around an optimum size, and a composite floats on its exposed valuable surface.',
        es: 'Gorain, Franzidis y Manlapig mostraron en celdas industriales que la constante cinética de flotación no la gobiernan por separado la velocidad de gas, el tamaño de burbuja ni la retención de gas, sino su combinación en el flujo de área superficial de burbujas. El tamaño de Sauter crece con la velocidad de gas, por lo que el flujo se satura con mucho aire. La recuperación cae en tamaños finos y gruesos (Trahar), por lo que la tasa de cada clase lleva una ventana de tamaños en torno a un óptimo, y un mixto flota según su superficie valiosa expuesta.' },
      { en: 'Gangue saturates at a higher collector dose than the valuable mineral, so beyond the valuable saturation dose more collector buys little recovery and floats gangue and poorly liberated particles, lowering grade, which is what plant practice reports for xanthate. Fine free gangue also reports to the concentrate with the water: Savassi\'s degree of entrainment gives the share by size.',
        es: 'La ganga se satura a una dosis de colector mayor que el mineral valioso, por lo que pasada la dosis de saturación del valioso, más colector compra poca recuperación y flota ganga y partículas mal liberadas, bajando la ley, que es lo que informa la práctica de planta para los xantatos. La ganga libre fina además reporta al concentrado con el agua: el grado de arrastre de Savassi da la fracción por tamaño.' },
      { en: 'Banks of mechanical cells behave as perfect mixers in series. The circuit is a rougher, an optional regrind of the rougher concentrate, a cleaner and an optional recleaner; cleaner tails return to the rougher feed and recleaner tails to the cleaner feed. Residence follows from cell volume, gas holdup and pulp flow, so a higher feed rate or a larger recycle shortens it. The circuit is solved by fixed-point iteration until the largest absolute change is below 1e-10 t/h and the largest change of any particle class, relative to its own flow, below 1e-12; the relative criterion keeps trace gold in balance.',
        es: 'Los bancos de celdas mecánicas se comportan como mezcladores perfectos en serie. El circuito es un rougher, una remolienda opcional del concentrado rougher, una limpieza y una relimpieza opcional; el relave de limpieza vuelve a la alimentación rougher y el de relimpieza a la de limpieza. La residencia sale del volumen de celda, la retención de gas y el caudal de pulpa, por lo que más alimentación o más recirculación la acortan. El circuito se resuelve por iteración de punto fijo hasta que el mayor cambio absoluto baja de 1e-10 t/h y el mayor cambio de cualquier clase, relativo a su propio caudal, baja de 1e-12; el criterio relativo mantiene en balance el oro traza.' },
    ],
    equations: [
      { tex: r`k_{s,i} = 60\,P_s\,S_b\,\exp\!\left(-\tfrac12\left[\ln(d_i/x_{opt})/w\right]^2\right)\left[u + (1-u)\frac{D}{D + K_s}\right],\qquad S_b = \frac{6J_g}{D_{32}},\qquad P_{comp} = P_V\,c^{2/3}`, caption: { en: 'Rate constant (1/min) of particle class s in size class i, and the floatability of a composite of valuable content c.', es: 'Constante cinética (1/min) de la clase s en el tamaño i, y la flotabilidad de un mixto de contenido valioso c.' } },
      { tex: r`ENT_i = \frac{2}{\exp\!\left(2.292\,(d_i/\xi)^{adj}\right) + \exp\!\left(-2.292\,(d_i/\xi)^{adj}\right)},\qquad adj = 1 - \frac{\ln(1/\delta)}{\exp(d_i/\xi)}`, caption: { en: 'Degree of entrainment (Savassi et al.).', es: 'Grado de arrastre (Savassi y colaboradores).' } },
      { tex: r`r = \frac{k\tau + ENT\,w}{1 + k\tau + ENT\,w},\quad w = \frac{r_w}{1 - r_w},\qquad R_{bank} = 1 - (1 - r)^N`, caption: { en: 'Recovery per cell and per bank; without entrainment the tanks-in-series result, and for water (k = 0, ENT = 1) the water recovery itself.', es: 'Recuperación por celda y por banco; sin arrastre el resultado de tanques en serie, y para el agua (k = 0, ENT = 1) la propia recuperación de agua.' } },
    ],
    table: {
      head: [{ en: 'Parameter', es: 'Parámetro' }, { en: 'Typical value', es: 'Valor típico' }, { en: 'Source', es: 'Fuente' }],
      rows: [
        ['J_g', '1.3 - 1.4 cm/s', { en: 'gas-dispersion literature range 0.5 to 2.5', es: 'rango de la literatura de dispersión de gas 0,5 a 2,5' }],
        ['D32', '0.8 + 0.45 J_g mm', { en: 'declared linear form of the reported increase', es: 'forma lineal declarada del aumento reportado' }],
        [{ en: 'P, liberated sulphide', es: 'P, sulfuro liberado' }, '1.8e-4 - 3.2e-4', { en: 'authored so nominal KPIs fall in literature ranges', es: 'de autor para que los KPI nominales caigan en rangos de la literatura' }],
        [{ en: 'K valuable, gangue', es: 'K valioso, ganga' }, '12 - 60, 40 - 1500 g/t', { en: 'authored; gangue saturates later', es: 'de autor; la ganga se satura después' }],
        ['ξ, δ', '30 - 60 µm, 1', { en: 'inside the Savassi and Hoang fits', es: 'dentro de los ajustes de Savassi y Hoang' }],
      ],
    },
    limits: [
      { en: 'No froth model beyond the recovery factor folded into P, no pulp chemistry (pH, Eh and depressants appear only through the authored floatabilities), no cell-by-cell change in residence and no collector adsorption balance.', es: 'Sin modelo de espuma más allá del factor de recuperación incorporado en P, sin química de pulpa (pH, Eh y depresores aparecen solo en las flotabilidades de autor), sin cambio de residencia celda a celda y sin balance de adsorción del colector.' },
    ],
    figure: { caption: { en: 'The rougher bank, the regrind and the cleaner, with the cleaner tail returning to the rougher.', es: 'El banco rougher, la remolienda y la limpieza, con el relave de limpieza volviendo al rougher.' }, render: lang => <FlotationFigure lang={lang} />, wide: true },
    refs: ['gorain1997', 'gorain1999', 'trahar1981', 'savassi1998', 'hoang2019', 'banks2012', 'collector2022'],
  },
  {
    id: 'gravity',
    title: { en: 'Gravity gold', es: 'Oro gravimétrico' },
    paragraphs: [
      { en: 'Free gold is dense (electrum about 15.7 t/m³) and malleable, so it breaks slowly and cyclones return almost all gravity-recoverable gold to the mill. Gold therefore circulates many times more than the ore does, and a gravity concentrator on a bleed of the cyclone underflow recovers it. Measured gravity-recoverable gold ranges from about 25 to 92% across ores, mostly between 15 and 300 µm.',
        es: 'El oro libre es denso (electrum de unas 15,7 t/m³) y maleable, por lo que se fractura lento y los ciclones devuelven casi todo el oro recuperable por gravedad al molino. El oro circula entonces muchas veces más que el mineral, y un concentrador gravimétrico sobre una purga de la descarga del ciclón lo recupera. El oro recuperable por gravedad medido va de unos 25 a 92% según el mineral, mayormente entre 15 y 300 µm.' },
      { en: 'In the engine gold is a mineral of the grinding circuit like any other, with liberation by size, a slow grindability for liberated grains (0.15 of the ore rate) and the density-corrected cut. A fraction of the underflow passes a gravity unit that recovers liberated gold by size, composite gold with a small fixed recovery and gangue at a small mass yield. The mill recycle stays linear, so the closed-circuit solve keeps its form; overall gold recovery is the gravity concentrate plus the flotation concentrate.',
        es: 'En el motor el oro es un mineral del circuito de molienda como cualquier otro, con liberación por tamaño, una moliendabilidad lenta para los granos liberados (0,15 de la del mineral) y el corte corregido por densidad. Una fracción de la descarga pasa por una unidad gravimétrica que recupera el oro liberado por tamaño, el oro en mixtos con una recuperación fija pequeña y la ganga con un rendimiento en masa pequeño. La recirculación al molino sigue siendo lineal, por lo que la resolución del circuito cerrado conserva su forma; la recuperación total de oro es el concentrado gravimétrico más el de flotación.' },
    ],
    equations: [
      { tex: r`E_g(d) = E_{max}\left(1 - e^{-(d/x_g)^2}\right),\qquad m_{mill} = f + (1 - b\,E_{eff})\,C\,p`, caption: { en: 'Gravity recovery of liberated gold by size on the bleed b, and the mill feed with the gravity unit in the loop.', es: 'Recuperación gravimétrica del oro liberado por tamaño en la purga b, y la alimentación al molino con la unidad gravimétrica en el circuito.' } },
    ],
    table: {
      head: [{ en: 'Parameter', es: 'Parámetro' }, { en: 'Value', es: 'Valor' }, { en: 'Source', es: 'Fuente' }],
      rows: [
        [{ en: 'gold held as free electrum', es: 'oro como electrum libre' }, '45%', { en: 'authored, inside the 25 to 92% range', es: 'de autor, dentro del rango 25 a 92%' }],
        [{ en: 'electrum liberation size', es: 'tamaño de liberación del electrum' }, '400 µm', { en: 'authored free-milling ore', es: 'mineral de molienda libre de autor' }],
        ['E_max, x_g', '0.8, 30 µm', { en: 'authored per-pass concentrator response', es: 'respuesta del concentrador por pasada de autor' }],
        [{ en: 'bleed b', es: 'purga b' }, '0.3', { en: 'the Laplante example treats 10 to 60%', es: 'el ejemplo de Laplante trata 10 a 60%' }],
      ],
    },
    limits: [
      { en: 'The concentrator response is authored, not a fitted Knelson or Falcon unit, and the gravity concentrate is not upgraded further (intensive leaching is outside the scope).', es: 'La respuesta del concentrador es de autor, no un equipo Knelson o Falcon ajustado, y el concentrado gravimétrico no se sigue mejorando (la lixiviación intensiva queda fuera del alcance).' },
      { en: 'Checked against the shape of the Laplante simulator example: recovery rises with the share of underflow treated, with diminishing returns, while the gold circulating load falls.', es: 'Contrastado con la forma del ejemplo de simulador de Laplante: la recuperación sube con la fracción de descarga tratada, con retornos decrecientes, mientras cae la carga circulante de oro.' },
    ],
    figure: { caption: { en: 'A fraction b of the underflow passes the gravity unit; its tail and the rest return to the mill.', es: 'Una fracción b de la descarga pasa por la unidad gravimétrica; su relave y el resto vuelven al molino.' }, render: lang => <GravityFigure lang={lang} /> },
    refs: ['laplante-staunton', 'laplante2005'],
  },
  {
    id: 'magnetic',
    title: { en: 'Magnetic separation', es: 'Separación magnética' },
    paragraphs: [
      { en: 'Low-intensity magnetic separators (drums at 800 to 2000 G) recover magnetite almost completely, including composites that carry enough magnetite, so the concentrate\'s iron grade is set by how much silica those composites carry, which is set by the grind. At Zandrivierspoort a 35.7% Fe feed gave 64.9% Fe (7.7% SiO2) at 80% passing 75 µm and 69.0% Fe (2.25% SiO2) at 80% passing 45 µm, with rougher magnetite recovery above 98%.',
        es: 'Los separadores magnéticos de baja intensidad (tambores de 800 a 2000 G) recuperan la magnetita casi por completo, incluidos los mixtos con suficiente magnetita, por lo que la ley de hierro del concentrado la fija cuánta sílice llevan esos mixtos, y eso lo fija la molienda. En Zandrivierspoort una alimentación de 35,7% Fe dio 64,9% Fe (7,7% SiO2) al 80% bajo 75 µm y 69,0% Fe (2,25% SiO2) al 80% bajo 45 µm, con recuperación rougher de magnetita sobre 98%.' },
      { en: 'The grinding overflow feeds a rougher drum and a cleaner drum. Liberated magnetite is captured except at the ultrafine end; composites are captured in proportion to their magnetite content; free gangue is entrapped at a small rate that grows at fine sizes and is scaled down in the cleaner. Iron grade and recovery come from the mineral balance, with magnetite at 72.36% Fe and an iron-bearing silicate gangue at a declared 5% Fe; recovery is reported both as total iron and as magnetite.',
        es: 'El rebose de la molienda alimenta un tambor rougher y uno de limpieza. La magnetita liberada se captura salvo en el extremo ultrafino; los mixtos se capturan según su contenido de magnetita; la ganga libre queda atrapada a una tasa pequeña que crece en los finos y se reduce en la limpieza. La ley y la recuperación de hierro salen del balance de minerales, con la magnetita a 72,36% Fe y una ganga silicatada con hierro a un 5% Fe declarado; la recuperación se informa como hierro total y como magnetita.' },
    ],
    equations: [
      { tex: r`p_{lib}(d) = p_{max}\left(1 - e^{-d/d_f}\right),\quad p_{comp}(d,c) = p_{max}\left(1 - e^{-c/c_0}\right)\left(1 - e^{-d/d_f}\right),\quad p_g(d) = e_0 + e_1\,e^{-d/d_e}`, caption: { en: 'Capture of liberated magnetite, of composites of magnetite content c, and entrapment of free gangue.', es: 'Captura de magnetita liberada, de mixtos con contenido de magnetita c, y atrapamiento de ganga libre.' } },
    ],
    table: {
      head: [{ en: 'Parameter', es: 'Parámetro' }, { en: 'Value', es: 'Valor' }, { en: 'Source', es: 'Fuente' }],
      rows: [
        ['p_max, d_f', '0.995, 1.5 µm', { en: 'authored; rougher recovery above 98% reported', es: 'de autor; recuperación rougher sobre 98% reportada' }],
        ['c_0', '0.1', { en: 'authored composite response', es: 'respuesta de mixtos de autor' }],
        ['e_0, e_1, d_e', '0.02, 0.12, 12 µm', { en: 'authored entrapment', es: 'atrapamiento de autor' }],
        [{ en: 'cleaner factor', es: 'factor de limpieza' }, '0.4', { en: 'authored', es: 'de autor' }],
      ],
    },
    limits: [
      { en: 'The drum response is authored; the published grind-grade pairs check the direction and size of the effect (grade rising by more than 1.5 points from 75 to 45 µm), not a calibration.', es: 'La respuesta de los tambores es de autor; los pares molienda-ley publicados verifican la dirección y el tamaño del efecto (la ley sube más de 1,5 puntos de 75 a 45 µm), no una calibración.' },
    ],
    figure: { caption: { en: 'Rougher and cleaner drums; each captures by particle class.', es: 'Tambores rougher y de limpieza; cada uno captura por clase de partícula.' }, render: lang => <MagneticFigure lang={lang} /> },
    refs: ['muthaphuli2014'],
  },
  {
    id: 'desliming',
    title: { en: 'Desliming', es: 'Deslamado' },
    paragraphs: [
      { en: 'Phosphate plants deslime the flotation feed, commonly below about 20 µm, because clay slimes consume fatty-acid collector and entrain into the froth; the price is the apatite lost with the slimes. A coarser desliming cut makes a cleaner flotation feed and loses more phosphate, and a coarser grind makes fewer slimes, which is why overgrinding a desliming feed costs recovery.',
        es: 'Las plantas de fosfato deslaman la alimentación a flotación, por lo general bajo unos 20 µm, porque las lamas de arcilla consumen colector de ácidos grasos y se arrastran a la espuma; el precio es la apatita que se va con las lamas. Un corte más grueso da una alimentación más limpia y pierde más fosfato, y una molienda más gruesa produce menos lamas, por eso sobremoler una alimentación a deslamado cuesta recuperación.' },
      { en: 'A desliming cyclone on the grinding overflow partitions each particle class with the Rosin-Rammler form, a declared sharpness and a water bypass; its cut is an operating control. The overflow reports to tailings as slimes; the underflow is repulped to a declared solids fraction before the rougher, and the dilution water is audited. Apatite is softer than quartz and clay is very soft, so the fines, and the P2O5 they carry, emerge from the grinding balance rather than being assumed.',
        es: 'Un ciclón de deslamado sobre el rebose de la molienda particiona cada clase de partícula con la forma Rosin-Rammler, una nitidez y un cortocircuito de agua declarados; su corte es un control de operación. El rebose reporta a relaves como lamas; la descarga se repulpea a una fracción de sólidos declarada antes del rougher, y el agua de dilución se audita. La apatita es más blanda que el cuarzo y la arcilla es muy blanda, por lo que los finos, y el P2O5 que llevan, salen del balance de molienda en vez de suponerse.' },
    ],
    equations: [
      { tex: r`y_{des}(d) = R_b + (1 - R_b)\left(1 - e^{-\ln 2\,(d/d_{des})^{m}}\right),\qquad d_{des} \le \tfrac12\,P_{80}^{target}`, caption: { en: 'Desliming partition to underflow, and the contract rule that keeps the cut at most half the grind target.', es: 'Partición del deslamado a la descarga, y la regla del contrato que mantiene el corte bajo la mitad del objetivo de molienda.' } },
    ],
    table: {
      head: [{ en: 'Parameter', es: 'Parámetro' }, { en: 'Value', es: 'Valor' }, { en: 'Source', es: 'Fuente' }],
      rows: [
        [{ en: 'desliming cut', es: 'corte de deslamado' }, '20 µm', { en: 'practice below about 20 µm', es: 'práctica bajo unos 20 µm' }],
        [{ en: 'sharpness, water bypass', es: 'nitidez, cortocircuito de agua' }, '2.5, 0.12', { en: 'authored', es: 'de autor' }],
        [{ en: 'rougher feed solids after repulping', es: 'sólidos de alimentación rougher tras repulpeo' }, '33% w/w', { en: 'authored', es: 'de autor' }],
      ],
    },
    limits: [
      { en: 'The practice figures come from a review summary, because the full text was not reachable when the research was done; the desliming response itself is authored.', es: 'Las cifras de práctica vienen del resumen de una revisión, porque el texto completo no estaba disponible al hacer la investigación; la respuesta del deslamado es de autor.' },
    ],
    figure: { caption: { en: 'The desliming cyclone sends the slimes to tailings and the deslimed underflow, repulped, to the rougher.', es: 'El ciclón de deslamado envía las lamas a relaves y la descarga deslamada, repulpeada, al rougher.' }, render: lang => <DeslimeFigure lang={lang} /> },
    refs: ['phosphate2019', 'hoang2019'],
  },
];
