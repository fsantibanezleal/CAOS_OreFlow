/**
 * Methodology, streams and conservation: the size grid, streams, element contents, the ore at an
 * operating point, liberation and particle classes (methodology page 01), and the conservation audit
 * (page 10). Transcribed from those pages; figures are schematics drawn with the shell's diagram
 * classes, so they follow the theme.
 */
import type { Lang } from '../../lib/format';
import type { Topic } from '../doc';

const r = String.raw;

function LiberationFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  return (
    <svg className="fig-svg" viewBox="0 0 420 250" role="img" aria-label={es ? 'Curva de liberación por tamaño y las tres clases de partícula' : 'Liberation curve by size and the three particle classes'}>
      <line className="dg-axis" x1="50" y1="200" x2="270" y2="200" />
      <line className="dg-axis" x1="50" y1="200" x2="50" y2="30" />
      <line className="dg-grid" x1="50" y1="115" x2="270" y2="115" />
      <path className="dg-curve" d="M 55 40 C 120 42, 130 70, 150 115 S 200 196, 265 198" />
      <line className="dg-marker" x1="150" y1="200" x2="150" y2="30" />
      <text className="dg-marker-label" x="154" y="44">x_L</text>
      <text className="dg-tick" x="40" y="44" textAnchor="end">1</text>
      <text className="dg-tick" x="40" y="119" textAnchor="end">{es ? '0,5' : '0.5'}</text>
      <text className="dg-tick" x="40" y="204" textAnchor="end">0</text>
      <text className="dg-axis-label" x="160" y="226" textAnchor="middle">{es ? 'tamaño d (escala log)' : 'size d (log scale)'}</text>
      <text className="dg-axis-label" x="18" y="115" textAnchor="middle" transform="rotate(-90 18 115)">{es ? 'fracción liberada L' : 'liberated fraction L'}</text>
      <g transform="translate(288 40)">
        <rect className="dg-box accent" x="0" y="0" width="126" height="44" rx="6" />
        <circle cx="22" cy="22" r="11" className="dg-fill-accent" />
        <text className="dg-box-title" x="38" y="20">{es ? 'liberada' : 'liberated'}</text>
        <text className="dg-box-sub" x="38" y="34">{es ? 'valioso' : 'valuable'}</text>
        <rect className="dg-box" x="0" y="58" width="126" height="44" rx="6" />
        <path d="M 11 80 a 11 11 0 0 1 22 0 z" className="dg-fill-accent" />
        <path d="M 11 80 a 11 11 0 0 0 22 0 z" className="dg-fill-warn" />
        <text className="dg-box-title" x="38" y="78">{es ? 'mixto' : 'composite'}</text>
        <text className="dg-box-sub" x="38" y="92">{es ? 'contenido c' : 'content c'}</text>
        <rect className="dg-box" x="0" y="116" width="126" height="44" rx="6" />
        <circle cx="22" cy="138" r="11" className="dg-fill-warn" />
        <text className="dg-box-title" x="38" y="136">{es ? 'libre' : 'free'}</text>
        <text className="dg-box-sub" x="38" y="150">{es ? 'ganga huésped' : 'host gangue'}</text>
      </g>
    </svg>
  );
}

function AuditFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  return (
    <svg className="fig-svg" viewBox="0 0 420 220" role="img" aria-label={es ? 'Balance por unidad y del circuito completo' : 'Balance of each unit and of the whole circuit'}>
      <defs>
        <marker id="of-doc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="dg-arrowhead" />
        </marker>
      </defs>
      <rect x="18" y="18" width="384" height="150" rx="10" fill="none" className="dg-marker" />
      <text className="dg-marker-label" x="26" y="34">{es ? 'circuito: alimentación = productos' : 'circuit: feed = products'}</text>
      {[0, 1, 2].map(k => (
        <g key={k} transform={`translate(${60 + k * 120} 70)`}>
          <rect className={k === 1 ? 'dg-box accent' : 'dg-box'} x="0" y="0" width="84" height="46" rx="7" />
          <text className="dg-box-title" x="42" y="21" textAnchor="middle">{es ? `unidad ${k + 1}` : `unit ${k + 1}`}</text>
          <text className="dg-box-sub" x="42" y="36" textAnchor="middle">{'Σ in = Σ out'}</text>
        </g>
      ))}
      <line className="dg-edge" x1="30" y1="93" x2="58" y2="93" markerEnd="url(#of-doc-arrow)" />
      <line className="dg-edge" x1="144" y1="93" x2="178" y2="93" markerEnd="url(#of-doc-arrow)" />
      <line className="dg-edge" x1="264" y1="93" x2="298" y2="93" markerEnd="url(#of-doc-arrow)" />
      <line className="dg-edge" x1="384" y1="93" x2="398" y2="93" markerEnd="url(#of-doc-arrow)" />
      <path className="dg-edge" d="M 342 116 L 342 142 L 222 142 L 222 118" markerEnd="url(#of-doc-arrow)" />
      <text className="dg-edge-label" x="282" y="156" textAnchor="middle">{es ? 'recirculación' : 'recycle'}</text>
      <text className="dg-note" x="210" y="196" textAnchor="middle">{es ? 'por mineral, por elemento u óxido, y agua; error relativo máximo reportado' : 'per mineral, per element or oxide, and water; largest relative error reported'}</text>
    </svg>
  );
}

export const STREAMS: Topic[] = [
  {
    id: 'grid',
    title: { en: 'Size grid, streams and ore', es: 'Malla de tamaños, corrientes y mineral' },
    paragraphs: [
      { en: 'Every stream shares one grid of 63 size classes on a fourth-root-of-two progression, from 150 mm down to a pan below 3.24 µm. The representative size of a class is the geometric mean of its bounds, and percentiles such as the P80 interpolate linearly in the logarithm of size. The top bound sits above the coarsest crusher feed in the catalogue and the fine end resolves the slimes that desliming and entrainment act on; one fixed grid makes every case comparable and gives the learned models a common feature space.',
        es: 'Todas las corrientes comparten una malla de 63 clases de tamaño en progresión de raíz cuarta de dos, desde 150 mm hasta un fondo bajo 3,24 µm. El tamaño representativo de una clase es la media geométrica de sus límites, y percentiles como el P80 se interpolan linealmente en el logaritmo del tamaño. El límite superior está sobre la alimentación más gruesa del chancador en el catálogo y el extremo fino resuelve las lamas sobre las que actúan el deslamado y el arrastre; una malla fija hace comparables todos los casos y da a los modelos aprendidos un espacio de variables común.' },
      { en: 'A stream holds, for every mineral, a mass vector by size in t/h, and a water flow. Element and oxide assays are computed from mineral masses and element contents; nothing stores a grade directly, so a grade can only change when mineral masses change. Mineral compositions come from their formulas and the IUPAC standard atomic weights: chalcopyrite gives 34.63% Cu, fluorapatite 42.2% P₂O₅ and magnetite 72.36% Fe. Non-stoichiometric phases (electrum at 73% Au, chrysocolla, iron-bearing silicate gangue) declare their composition with a source, as do all densities.',
        es: 'Una corriente guarda, para cada mineral, un vector de masa por tamaño en t/h, y un caudal de agua. Los ensayes de elementos y óxidos se calculan desde las masas de minerales y sus contenidos; nada guarda una ley directamente, por lo que una ley solo cambia cuando cambian las masas de minerales. Las composiciones salen de las fórmulas y de los pesos atómicos estándar de la IUPAC: la calcopirita da 34,63% Cu, la fluorapatita 42,2% P₂O₅ y la magnetita 72,36% Fe. Las fases no estequiométricas (electrum con 73% Au, crisocola, ganga silicatada con hierro) declaran su composición con fuente, igual que todas las densidades.' },
      { en: 'A case declares its payable species and the minerals that carry them. A stoichiometric carrier takes the ore fraction its share of the head grade implies; a trace carrier (gold in pyrite) keeps a declared fraction and receives the content its share implies. Exactly one gangue mineral takes the balance and hosts the composites.',
        es: 'Un caso declara sus especies pagables y los minerales que las portan. Un portador estequiométrico toma la fracción de mineral que implica su parte de la ley de cabeza; un portador traza (oro en pirita) conserva una fracción declarada y recibe el contenido que implica su parte. Exactamente un mineral de ganga toma el balance y aloja los mixtos.' },
      { en: 'Liberation follows King\'s idea that it is governed by particle size relative to a characteristic liberation size, decoupled from breakage. The valuable mass not liberated in a class is held in binary composites with the host gangue at a declared content c. The split into liberated, composite and free-gangue classes is applied only to a product of breakage (the mill and regrind products); separations then carry the classes forward, because a cyclone or a flotation bank treats them differently. Composites are limited by the host gangue actually present in each class, which conserves every mineral exactly.',
        es: 'La liberación sigue la idea de King de que la gobierna el tamaño de partícula relativo a un tamaño característico de liberación, desacoplado de la fractura. La masa valiosa no liberada en una clase queda en mixtos binarios con la ganga huésped a un contenido declarado c. La separación en clases liberada, mixta y ganga libre se aplica solo a un producto de fractura (los productos del molino y de la remolienda); las separaciones luego arrastran las clases, porque un ciclón o un banco de flotación las trata distinto. Los mixtos quedan limitados por la ganga huésped presente en cada clase, lo que conserva exactamente cada mineral.' },
    ],
    equations: [
      { tex: r`x_i = 150\,000 \cdot 2^{-i/4}\ \mu\mathrm{m},\qquad d_i = \sqrt{x_i\,x_{i+1}},\qquad i = 0,\dots,62`,
        caption: { en: 'Upper bound and representative size of class i.', es: 'Límite superior y tamaño representativo de la clase i.' } },
      { tex: r`w_m = \frac{g\,s}{c_m}`,
        caption: { en: 'Ore fraction of a stoichiometric carrier m: head grade g, its share s of the payable, element content c_m.', es: 'Fracción de mineral de un portador estequiométrico m: ley de cabeza g, su parte s del pagable, contenido del elemento c_m.' } },
      { tex: r`L_i = \frac{1}{1 + (d_i/x_L)^{n_L}},\qquad \rho_c = \frac{1}{c/\rho_V + (1-c)/\rho_h}`,
        caption: { en: 'Liberated fraction with liberation size x_L and slope n_L, and the density of a composite of valuable content c from the densities of the valuable mineral ρ_V and the host gangue ρ_h.', es: 'Fracción liberada con tamaño de liberación x_L y pendiente n_L, y la densidad de un mixto de contenido valioso c desde las densidades del mineral valioso ρ_V y de la ganga huésped ρ_h.' } },
      { tex: r`C_i = \min\!\left(\frac{(1-L_i)\,V_i}{c},\ \frac{H_i}{1-c}\right)`,
        caption: { en: 'Composite mass in class i, limited by the host gangue H_i present; the valuable mass V_i not in composites is liberated.', es: 'Masa de mixtos en la clase i, limitada por la ganga huésped H_i presente; la masa valiosa V_i que no está en mixtos queda liberada.' } },
    ],
    limits: [
      { en: 'The liberation curve is a one-parameter family by size: it does not model the distribution of composite grades, textures or preferential breakage along grain boundaries.', es: 'La curva de liberación es una familia de un parámetro por tamaño: no modela la distribución de leyes de los mixtos, las texturas ni la fractura preferente por bordes de grano.' },
      { en: 'Liberation sizes, slopes and composite contents are authored per case inside the recorded ranges.', es: 'Los tamaños de liberación, pendientes y contenidos de los mixtos son de autor por caso dentro de los rangos registrados.' },
    ],
    figure: { caption: { en: 'The liberated fraction falls with size around x_L; the unliberated valuable mass forms composites with the host gangue.', es: 'La fracción liberada cae con el tamaño en torno a x_L; la masa valiosa no liberada forma mixtos con la ganga huésped.' }, render: lang => <LiberationFigure lang={lang} /> },
    refs: ['king1979'],
  },
  {
    id: 'audit',
    title: { en: 'Conservation audit', es: 'Auditoría de conservación' },
    paragraphs: [
      { en: 'A balance that is computed as R + (1 - R) closes by construction and proves nothing. The engine audits conservation from the named streams alone: every unit receives its input streams, its output streams and any water added, and the audit re-sums the solids of every mineral, every reported element and oxide (from mineral masses and contents) and the water.',
        es: 'Un balance calculado como R + (1 - R) cierra por construcción y no prueba nada. El motor audita la conservación solo desde las corrientes nombradas: cada unidad recibe sus corrientes de entrada, sus corrientes de salida y el agua agregada, y la auditoría vuelve a sumar los sólidos de cada mineral, cada elemento y óxido informado (desde las masas de minerales y sus contenidos) y el agua.' },
      { en: 'The units audited are the crusher, the mill-feed junction, the mill (mass per mineral is conserved through breakage), the sump, the cyclone, the underflow return or gravity split, the desliming cyclone, the flotation links, junctions and banks, the regrind, the dilution points, the LIMS drums, and the whole circuit from crusher feed to products. The largest relative error is reported with every state; a separate check rebuilds the mineral overflow from the particle-class overflow, and any negative class mass raises a flag.',
        es: 'Las unidades auditadas son el chancador, la unión de alimentación al molino, el molino (la masa por mineral se conserva en la fractura), el cajón, el ciclón, el retorno de descarga o el divisor gravimétrico, el ciclón de deslamado, los enlaces, uniones y bancos de flotación, la remolienda, los puntos de dilución, los tambores LIMS y el circuito completo desde la alimentación al chancador hasta los productos. El mayor error relativo se informa con cada estado; una verificación aparte reconstruye el rebose de minerales desde el rebose por clase de partícula, y cualquier masa de clase negativa levanta un aviso.' },
      { en: 'Every unit of every baked variant closes within 1e-9 relative, and in practice at floating-point round-off (1e-12 to 1e-16). The same closure is required across the whole operating envelope, at the corners, the single-input bounds and seeded interior states of every case, and the shipped artifacts are audited again, from their stored streams, by an independent checker.',
        es: 'Cada unidad de cada variante horneada cierra dentro de 1e-9 relativo, y en la práctica al nivel del redondeo de punto flotante (1e-12 a 1e-16). El mismo cierre se exige en toda la envolvente de operación, en las esquinas, los límites de cada entrada y estados interiores sembrados de cada caso, y los artefactos publicados se auditan otra vez, desde sus corrientes guardadas, con un verificador independiente.' },
    ],
    limits: [
      { en: 'The audit proves conservation of what the engine computes; it cannot show that a unit model is right, only that it neither creates nor destroys mass.', es: 'La auditoría prueba la conservación de lo que calcula el motor; no puede mostrar que un modelo de unidad sea correcto, solo que no crea ni destruye masa.' },
    ],
    figure: { caption: { en: 'Each unit is balanced on its own streams, and the circuit as a whole from feed to products.', es: 'Cada unidad se balancea con sus propias corrientes, y el circuito completo desde la alimentación hasta los productos.' }, render: lang => <AuditFigure lang={lang} /> },
    refs: [],
  },
];
