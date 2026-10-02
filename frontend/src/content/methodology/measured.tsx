/**
 * Methodology, measured data: the real ore samples that run in the engine (methodology page 15) and the plant-hour
 * soft sensor (page 16). Transcribed from those pages and their dossiers (T-10, S-15 of the review of 2026-10-02:
 * until 0.08.000 neither appeared on a content page). Figures are schematics drawn with the shell's diagram classes.
 */
import type { Lang } from '../../lib/format';
import type { Topic } from '../doc';

const r = String.raw;

function SulphurBandsFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  // the molar S/Cu axis from 0 to 2.4, on 380 px
  const x = (v: number) => 30 + (v / 2.4) * 380;
  const bands: Array<[number, number, string, string]> = [
    [0, 0.5, es ? 'sin asignación' : 'no allocation', es ? 'excluida' : 'excluded'],
    [0.5, 0.8, es ? 'bornita + calcosina' : 'bornite + chalcocite', es ? '36 muestras' : '36 samples'],
    [0.8, 2.0, es ? 'calcopirita + bornita' : 'chalcopyrite + bornite', es ? '15 muestras' : '15 samples'],
    [2.0, 2.4, es ? 'calcopirita' : 'chalcopyrite', es ? '1 muestra' : '1 sample'],
  ];
  return (
    <svg className="fig-svg" viewBox="0 0 440 200" role="img" aria-label={es ? 'Las bandas de la mineralogía normativa según la razón molar azufre a cobre, con las muestras en cada una' : 'The normative mineralogy\'s bands by the molar sulphur to copper ratio, with the samples in each'}>
      {bands.map(([a, b, name, count], k) => (
        <g key={name}>
          <rect className={k === 0 ? 'dg-box' : k === 1 ? 'dg-box accent' : 'dg-box good'} x={x(a)} y={44} width={x(b) - x(a)} height={56} rx={4} />
          <text className="dg-box-sub" x={(x(a) + x(b)) / 2} y={k === 0 || k === 3 ? 66 : 68} textAnchor="middle">{k === 0 || k === 3 ? name.split(' ')[0] : name}</text>
          {(k === 0 || k === 3) && name.split(' ').length > 1 && <text className="dg-box-sub" x={(x(a) + x(b)) / 2} y={80} textAnchor="middle">{name.split(' ').slice(1).join(' ')}</text>}
          <text className="dg-note" x={(x(a) + x(b)) / 2} y={94} textAnchor="middle">{count}</text>
        </g>
      ))}
      <line className="dg-axis" x1={x(0)} y1={118} x2={x(2.4)} y2={118} />
      {[0, 0.5, 0.8, 2.0].map(v => (
        <g key={v}>
          <line className="dg-axis" x1={x(v)} y1={114} x2={x(v)} y2={122} />
          <text className="dg-tick" x={x(v)} y={136} textAnchor="middle">{es ? String(v).replace('.', ',') : String(v)}</text>
        </g>
      ))}
      <text className="dg-axis-label" x={x(1.2)} y={158} textAnchor="middle">{es ? 'razón molar s / c en la muestra' : 'molar ratio s / c in the sample'}</text>
      <text className="dg-note" x={x(0)} y={186}>{es ? 'umbrales: S/Cu de la calcosina (0,5), la bornita (0,8) y la calcopirita (2)' : 'thresholds: the S/Cu of chalcocite (0.5), bornite (0.8) and chalcopyrite (2)'}</text>
    </svg>
  );
}

function WindowsFigure({ lang }: { lang: Lang }) {
  const es = lang === 'es';
  // three forward windows over the 3,701 pairs: expanding history, an embargo, the test
  const rows: Array<[number, number, number]> = [[0.50, 0.507, 0.65], [0.65, 0.657, 0.80], [0.80, 0.807, 1.0]];
  const x = (v: number) => 20 + v * 400;
  return (
    <svg className="fig-svg" viewBox="0 0 440 190" role="img" aria-label={es ? 'Tres ventanas futuras en orden temporal: historia creciente, embargo y prueba' : 'Three forward windows in time order: an expanding history, an embargo and the test'}>
      {rows.map(([train, gap, test], k) => (
        <g key={k}>
          <text className="dg-box-sub" x={x(0)} y={30 + k * 40}>{es ? `ventana ${k + 1}` : `window ${k + 1}`}</text>
          <rect className="dg-fill-accent" x={x(0)} y={36 + k * 40} width={x(train) - x(0)} height={12} rx={2} />
          <rect className="dg-box" x={x(train)} y={36 + k * 40} width={Math.max(3, x(gap) - x(train))} height={12} rx={1} />
          <rect className="dg-fill-warn" x={x(gap)} y={36 + k * 40} width={x(test) - x(gap)} height={12} rx={2} />
        </g>
      ))}
      <line className="dg-axis" x1={x(0)} y1={160} x2={x(1)} y2={160} />
      <text className="dg-axis-label" x={x(0.5)} y={178} textAnchor="middle">{es ? 'pares horarios en orden temporal, marzo a septiembre de 2017' : 'hourly pairs in time order, March to September 2017'}</text>
      <text className="dg-note" x={x(0)} y={152}>{es ? 'entrenamiento' : 'training'}</text>
      <text className="dg-note" x={x(0.62)} y={152}>{es ? 'embargo de 24 h o más, luego prueba' : 'embargo of 24 h or more, then test'}</text>
    </svg>
  );
}

const REAL_SAMPLES: Topic = {
  id: 'real-samples',
  title: { en: 'Real ore samples in the engine', es: 'Muestras reales de mineral en el motor' },
  paragraphs: [
    { en: 'The synthetic cases are authored plants and ores. The real-sample source runs measured ore samples through one of those plants: the GeoMet samples (Hoffimann et al. 2022; Zenodo 7051975, CC BY 4.0), on their own assays and work index, in the soft porphyry\'s circuit. Two of the dataset\'s tables are pinned by Zenodo\'s MD5 and by SHA-256: 60 comminution samples with their Bond ball-mill test values, and 53 locked-cycle tests with head assays and the measured copper recovery, of which the one without a recovery is excluded, leaving 52. Nothing in the engine is fitted to them: they are inputs, and the measured recovery is set beside the engine\'s.',
      es: 'Los casos sintéticos son plantas y minerales de autor. La fuente de muestras reales hace pasar muestras de mineral medidas por una de esas plantas: las muestras GeoMet (Hoffimann y colaboradores 2022; Zenodo 7051975, CC BY 4.0), con sus propios ensayes e índice de trabajo, en el circuito del pórfido blando. Dos tablas del conjunto quedan fijadas por el MD5 de Zenodo y por SHA-256: 60 muestras de conminución con sus valores de la prueba de Bond en molino de bolas, y 53 ensayos en ciclo cerrado con los ensayes de cabeza y la recuperación de cobre medida, de los que se excluye el que no tiene recuperación, y quedan 52. Nada del motor se ajusta a ellas: son entradas, y la recuperación medida se pone junto a la del motor.' },
    { en: 'The paper is paywalled, so the comminution columns\' meaning is inferred from the Bond test and labelled so: A the closing screen $P_1$ (106 or 150 µm), M the net undersize per revolution $G_{bp}$ (g/rev), and F80 and P80 in µm. Bond\'s laboratory form, as Nikolić, Doll and Trumić (2022) state it (UNVERIFIED against the full text), gives kWh per short ton, and the factor 1.10231 converts it to the tonne. Over the 60 samples this gives 15.2 to 26.1 kWh/t, median 20.2; the soft porphyry\'s authored ore is 11 kWh/t, so every sample is harder than the circuit it runs in. Each locked-cycle sample takes the work index of the nearest comminution sample in its drill hole (42 of the 52) or else the deposit median (10).',
      es: 'El artículo es de pago, así que el significado de las columnas de conminución se infiere de la prueba de Bond y se rotula así: A el tamiz de cierre $P_1$ (106 o 150 µm), M el producto fino neto por revolución $G_{bp}$ (g/rev), y F80 y P80 en µm. La forma de laboratorio de Bond, como la enuncian Nikolić, Doll y Trumić (2022) (SIN VERIFICAR contra el texto completo), da kWh por tonelada corta, y el factor 1,10231 la lleva a la tonelada. Sobre las 60 muestras da 15,2 a 26,1 kWh/t, mediana 20,2; el mineral de autor del pórfido blando es de 11 kWh/t, así que cada muestra es más dura que el circuito en que corre. Cada muestra de ciclo cerrado toma el índice de trabajo de la muestra de conminución más cercana en su sondaje (42 de las 52) o si no la mediana del yacimiento (10).' },
    { en: 'The samples\' sulphur cannot cover chalcopyrite: of the 52, one has enough for it. The copper is therefore allocated by a sulphur-limited normative mineralogy in moles (after Whiten 2007 and Lund et al. 2013, which describe the least-squares form of the same element-to-mineral conversion), with $c$ the copper and $s$ the sulphur: the thresholds are each mineral\'s S/Cu from its formula, and each pair is the balance of copper and sulphur between two minerals. One sample falls in the first band, 15 in the second and 36 in the third; in the median sample bornite carries 56% of the copper and chalcocite 38%. The iron the sulphides leave goes to magnetite, an assumption, since the assays do not identify it (3.7 to 75% of the ore), and quartz closes the mass. The allocation is one choice in a family: pyrite could take part of the sulphur in the two deficient bands as well.',
      es: 'El azufre de las muestras no alcanza para la calcopirita: de las 52, una tiene suficiente. El cobre se asigna entonces con una mineralogía normativa limitada por el azufre, en moles (según Whiten 2007 y Lund y colaboradores 2013, que describen la forma por mínimos cuadrados de la misma conversión de elementos a minerales), con $c$ el cobre y $s$ el azufre: los umbrales son la razón S/Cu de cada mineral según su fórmula, y cada par es el balance de cobre y azufre entre dos minerales. Una muestra cae en la primera banda, 15 en la segunda y 36 en la tercera; en la muestra mediana la bornita lleva 56% del cobre y la calcosina 38%. El hierro que dejan los sulfuros va a magnetita, un supuesto, porque los ensayes no la identifican (3,7 a 75% del mineral), y el cuarzo cierra la masa. La asignación es una elección dentro de una familia: la pirita también podría tomar parte del azufre en las dos bandas con déficit.' },
    { en: 'Bornite and chalcocite join the mineral table with the Handbook of Mineralogy\'s densities (5.07 and 5.8 t/m³), and their flotation is authored relative to chalcopyrite as two declared constants. Bornite floats at 0.80 of chalcopyrite\'s floatability, an upper bound: Jiang et al. (2025; abstract only) report chalcopyrite above 90% recovery in every collector system and bornite at 84.2% at best, and with first-order kinetics at equal time that is a ratio of 0.80. Chalcocite floats at 1.5 times bornite, from Tafirenyika et al. (2022, Table 3, in plant water): 1.19 at pH 9 and 1.92 at pH 11, mass recoveries of impure samples, with 1.5 their geometric mean. That ratio is a choice, not a bound: the source\'s conditions do not fix its direction, and the Benchmark shows how the comparison moves over a grid of both ratios.',
      es: 'La bornita y la calcosina entran a la tabla de minerales con las densidades del Handbook of Mineralogy (5,07 y 5,8 t/m³), y su flotación se declara relativa a la calcopirita con dos constantes. La bornita flota a 0,80 de la flotabilidad de la calcopirita, una cota superior: Jiang y colaboradores (2025; solo el resumen) informan la calcopirita sobre 90% de recuperación en cada sistema de colector y la bornita en 84,2% en el mejor caso, y con cinética de primer orden a igual tiempo eso es una razón de 0,80. La calcosina flota a 1,5 veces la bornita, según Tafirenyika y colaboradores (2022, tabla 3, en agua de planta): 1,19 a pH 9 y 1,92 a pH 11, recuperaciones en masa de muestras impuras, con 1,5 su media geométrica. Esa razón es una elección, no una cota: las condiciones de la fuente no fijan su dirección, y el Benchmark muestra cómo se mueve la comparación sobre una grilla de ambas razones.' },
  ],
  equations: [
    { tex: r`W_i = 1.10231\,\frac{44.5}{P_1^{0.23}\,G_{bp}^{0.82}\left(\dfrac{10}{\sqrt{P_{80}}} - \dfrac{10}{\sqrt{F_{80}}}\right)}`, caption: { en: 'The Bond ball-mill work index (kWh/t) from the laboratory test: the closing screen $P_1$, the net undersize per revolution $G_{bp}$, and the test\'s $F_{80}$ and $P_{80}$ in µm.', es: 'El índice de trabajo de Bond en molino de bolas (kWh/t) desde la prueba de laboratorio: el tamiz de cierre $P_1$, el producto fino neto por revolución $G_{bp}$, y el $F_{80}$ y el $P_{80}$ de la prueba en µm.' } },
    { tex: r`0.8\,c \le s < 2c:\quad n_{\mathrm{CuFeS_2}} = \frac{5s - 4c}{6},\qquad n_{\mathrm{Cu_5FeS_4}} = \frac{2c - s}{6}`, caption: { en: 'One band of the allocation: the moles of chalcopyrite and bornite that hold the sample\'s copper $c$ and sulphur $s$ exactly.', es: 'Una banda de la asignación: los moles de calcopirita y bornita que contienen exactamente el cobre $c$ y el azufre $s$ de la muestra.' } },
    { tex: r`\frac{P_{\mathrm{bn}}}{P_{\mathrm{cp}}} = \frac{\ln(1 - 0.842)}{\ln(1 - 0.90)} = 0.80`, caption: { en: 'Bornite\'s floatability relative to chalcopyrite\'s, from first-order recoveries at equal time.', es: 'La flotabilidad de la bornita relativa a la de la calcopirita, desde recuperaciones de primer orden a igual tiempo.' } },
  ],
  table: {
    head: [{ en: 'Sulphur', es: 'Azufre' }, { en: 'Copper minerals', es: 'Minerales de cobre' }],
    rows: [
      ['$s \\ge 2c$', { en: 'chalcopyrite $c$; pyrite from the sulphur left', es: 'calcopirita $c$; pirita con el azufre restante' }],
      [{ en: '$0.8c \\le s < 2c$', es: '$0{,}8c \\le s < 2c$' }, { en: 'chalcopyrite $(5s - 4c)/6$, bornite $(2c - s)/6$', es: 'calcopirita $(5s - 4c)/6$, bornita $(2c - s)/6$' }],
      [{ en: '$0.5c \\le s < 0.8c$', es: '$0{,}5c \\le s < 0{,}8c$' }, { en: 'bornite $(2s - c)/3$, chalcocite $(4c - 5s)/3$', es: 'bornita $(2s - c)/3$, calcosina $(4c - 5s)/3$' }],
      [{ en: '$s < 0.5c$', es: '$s < 0{,}5c$' }, { en: 'no allocation: the sample is excluded, with the reason', es: 'sin asignación: la muestra se excluye, con la razón' }],
    ],
    wrap: [1],
  },
  limits: [
    { en: 'A comparison, not a calibration: one circuit, authored for another ore, runs 52 measured feeds. The allocation, the magnetite and the two floatability ratios are authored, and the comminution columns\' meaning is inferred.', es: 'Una comparación, no una calibración: un circuito, de autor para otro mineral, recibe 52 alimentaciones medidas. La asignación, la magnetita y las dos razones de flotabilidad son de autor, y el significado de las columnas de conminución se infiere.' },
    { en: 'The contract\'s throughput floor for the case, 360 t/h, sits above the lowest throughput at which a sample reaches the 150 µm target (340 t/h in the record), so the workbench cannot show every sample at its target grind.', es: 'El piso de tratamiento del contrato para el caso, 360 t/h, queda sobre el menor tratamiento con que una muestra llega al objetivo de 150 µm (340 t/h en el registro), así que el simulador no puede mostrar cada muestra en su molienda objetivo.' },
  ],
  figure: { caption: { en: 'The normative mineralogy\'s bands by the molar sulphur to copper ratio, with the locked-cycle samples in each.', es: 'Las bandas de la mineralogía normativa según la razón molar de azufre a cobre, con las muestras de ciclo cerrado en cada una.' }, render: lang => <SulphurBandsFigure lang={lang} /> },
  refs: ['geomet', 'geomet-paper', 'nikolic2022', 'whiten2007', 'lund2013', 'jiang2025', 'tafirenyika2022', 'handbook-mineralogy'],
};

const SOFT_SENSOR: Topic = {
  id: 'soft-sensor',
  title: { en: 'The plant-hour soft sensor', es: 'El sensor virtual de horas de planta' },
  paragraphs: [
    { en: 'A soft sensor predicts a quantity the plant measures rarely, here the laboratory silica of the flotation concentrate, from the quantities it records often (Kadlec, Gabrys and Strandt 2009). This lane forecasts one iron-ore plant\'s next-hour silica from its feed assays and sensors, on open data, and stays apart from the copper circuit, the optimizer and any set-point advice: the plant\'s reverse cationic flotation is not an engine family.',
      es: 'Un sensor virtual predice una magnitud que la planta mide pocas veces, aquí la sílice de laboratorio del concentrado de flotación, desde las magnitudes que registra seguido (Kadlec, Gabrys y Strandt 2009). Esta vía pronostica la sílice de la hora siguiente de una planta de mineral de hierro desde sus ensayes de alimentación y sus sensores, con datos abiertos, y se mantiene aparte del circuito de cobre, del optimizador y de cualquier consejo de punto de operación: la flotación catiónica inversa de la planta no es una familia del motor.' },
    { en: 'The data are Kaggle dataset 6294, version 1 (CC0), the publisher\'s archive pinned by SHA-256: 737,453 rows from 2017-03-10 to 2017-09-09. The date field is hourly while most channels have 174 to 180 rows an hour, and both concentrate assays are laboratory results. In 310 hours the silica label changes on almost every 20-second row: it was interpolated, not measured, and those hours are excluded whole (55,800 rows). The remaining hours become the median of each channel, and only exact consecutive hours with a measured label form a pair: hour t\'s 21 feed assays and sensors predict the silica measured at t + 1, 3,701 pairs.',
      es: 'Los datos son el conjunto 6294 de Kaggle, versión 1 (CC0), con el archivo del publicador fijado por SHA-256: 737.453 filas del 2017-03-10 al 2017-09-09. El campo de fecha es horario mientras la mayoría de los canales tienen 174 a 180 filas por hora, y ambos ensayes del concentrado son resultados de laboratorio. En 310 horas la etiqueta de sílice cambia en casi cada fila de 20 segundos: se interpoló, no se midió, y esas horas se excluyen completas (55.800 filas). Las horas restantes pasan a la mediana de cada canal, y solo horas consecutivas exactas con una etiqueta medida forman un par: los 21 ensayes de alimentación y sensores de la hora t predicen la sílice medida en t + 1, 3.701 pares.' },
    { en: 'Three forward windows are scored in time order (Bergmeir and Benítez 2012): each trains on an expanding history, leaves at least 24 hours of embargo, and tests on the next 15, 15 and 20% of the pairs, with median imputation and scaling fitted inside each training window. Pooled over the windows, the previous assay alone forecasts the next hour with a mean absolute error of 0.464 points, and the fitted last assay, the previous assay regressed on the next one in each training window, has the lowest RMSE (0.707): which forecast wins depends on the metric. Adding the sensors to the previous assay does worse than the fitted last assay under both metrics, and the sensor-only models do no better than the training mean. 14% of the test hours repeat the previous assay exactly, which persistence scores as no error.',
      es: 'Se evalúan tres ventanas futuras en orden temporal (Bergmeir y Benítez 2012): cada una se entrena con una historia creciente, deja al menos 24 horas de embargo y prueba en el 15, 15 y 20% siguiente de los pares, con la imputación por mediana y el escalado ajustados dentro de cada ventana de entrenamiento. Sumadas las ventanas, el ensaye anterior solo pronostica la hora siguiente con un error absoluto medio de 0,464 puntos, y el último ensaye ajustado, el ensaye anterior regresado sobre el siguiente en cada ventana de entrenamiento, tiene el menor RMSE (0,707): cuál pronóstico gana depende de la métrica. Agregar los sensores al ensaye anterior empeora frente al último ensaye ajustado en ambas métricas, y los modelos solo con sensores no mejoran a la media de entrenamiento. 14% de las horas de prueba repiten exactamente el ensaye anterior, lo que la persistencia cuenta como error nulo.' },
  ],
  equations: [
    { tex: r`\hat y_{t+1} = f\left(\tilde x_t\right),\qquad \tilde x_t = \operatorname{median}_{s \in t}\ x_s,\qquad \mathrm{MAE} = \frac{1}{n}\sum_t \left|\hat y_{t+1} - y_{t+1}\right|`, caption: { en: 'The forecast of the next hour\'s silica from the hour\'s channel medians, and its mean absolute error.', es: 'El pronóstico de la sílice de la hora siguiente desde las medianas horarias de los canales, y su error absoluto medio.' } },
    { tex: r`\hat y_{t+1} = a + b\,y_t`, caption: { en: 'The fitted last assay: $a$ and $b$ fitted on each training window by least squares.', es: 'El último ensaye ajustado: $a$ y $b$ ajustados por mínimos cuadrados en cada ventana de entrenamiento.' } },
  ],
  table: {
    head: [{ en: 'Model', es: 'Modelo' }, { en: 'Inputs', es: 'Entradas' }],
    rows: [
      [{ en: 'training mean', es: 'media de entrenamiento' }, { en: 'none', es: 'ninguna' }],
      [{ en: 'previous laboratory assay (persistence)', es: 'ensaye de laboratorio anterior (persistencia)' }, { en: 'the hour\'s own silica assay', es: 'el propio ensaye de sílice de la hora' }],
      [{ en: 'fitted last assay (AR(1))', es: 'último ensaye ajustado (AR(1))' }, { en: 'the hour\'s assay, regressed on the next one in each training window', es: 'el ensaye de la hora, regresado sobre el siguiente en cada ventana de entrenamiento' }],
      [{ en: 'ridge, random forest, gradient boosting', es: 'ridge, bosque aleatorio, gradient boosting' }, { en: 'the 21 feed assays and sensors', es: 'los 21 ensayes de alimentación y sensores' }],
      [{ en: 'ridge and gradient boosting with the previous assay', es: 'ridge y gradient boosting con el ensaye anterior' }, { en: 'the feed assays, the sensors and the hour\'s assay', es: 'los ensayes de alimentación, los sensores y el ensaye de la hora' }],
    ],
    wrap: [0, 1],
  },
  limits: [
    { en: 'One plant, one season and observational data: the scores say how well the next hour is forecast here, not what a change of any sensor would do, and nothing here recommends a set point.', es: 'Una planta, una temporada y datos observacionales: los puntajes dicen qué tan bien se pronostica aquí la hora siguiente, no qué haría un cambio de algún sensor, y nada aquí recomienda un punto de operación.' },
    { en: 'The persistence and the assay-conditioned models assume the previous hour\'s assay is known when the forecast is made; the data do not establish the laboratory\'s reporting latency.', es: 'La persistencia y los modelos condicionados al ensaye suponen que el ensaye de la hora anterior se conoce al hacer el pronóstico; los datos no establecen la latencia de informe del laboratorio.' },
  ],
  figure: { caption: { en: 'Three forward windows in time order, each trained on the expanding history before it and tested after at least 24 hours of embargo.', es: 'Tres ventanas futuras en orden temporal, cada una entrenada con la historia creciente anterior y probada tras al menos 24 horas de embargo.' }, render: lang => <WindowsFigure lang={lang} /> },
  refs: ['kaggle6294', 'kadlec2009', 'bergmeir2012', 'pural2023', 'ramos2025'],
};

export const MEASURED: Topic[] = [REAL_SAMPLES, SOFT_SENSOR];

