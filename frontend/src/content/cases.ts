/**
 * The authored context of every case (ADR-0016 section 9.B): the problem, its scope and assumptions,
 * and how to read the workbench for it, in English and Spanish. Facts are transcribed from the case
 * catalog and the 2026-09-26 research dossier (practice ranges, published examples); numbers that the
 * engine computes are never typed here: the Case view reads them from the artifact.
 */
type Bi = { en: string; es: string };
export type CaseContext = { problem: Bi[]; scope: Bi[]; read: Bi[]; refs: string[] };

/** What a variant of each kind changes and why, stated so it holds whatever the case (the measured effect is shown beside it). */
export const VARIANT_NOTES: Record<string, Bi> = {
  nominal: {
    en: 'The design state every other variant departs from: each variant changes exactly one input.',
    es: 'El estado de diseño del que parte cada otra variante: cada variante cambia exactamente una entrada.',
  },
  harder_ore: {
    en: 'Bond work index 25% higher. The circuit needs more energy per tonne for the same grind; where the installed power runs out the mill runs at its limit and the product coarsens, which then costs liberation.',
    es: 'Índice de trabajo de Bond 25% mayor. El circuito necesita más energía por tonelada para la misma molienda; si la potencia instalada no alcanza, el molino opera en su límite y el producto se engruesa, lo que cuesta liberación.',
  },
  coarser_grind: {
    en: 'Grind target 35% coarser. Less energy per tonne, fewer liberated particles and a coarser separation feed: the price of the energy saved is paid in recovery.',
    es: 'Objetivo de molienda 35% más grueso. Menos energía por tonelada, menos partículas liberadas y una alimentación más gruesa a la separación: la energía ahorrada se paga en recuperación.',
  },
  finer_grind: {
    en: 'Grind target 25% finer. More of the valuable mineral is liberated from its host, so a concentrate that depends on liberation gains grade, at a higher specific energy.',
    es: 'Objetivo de molienda 25% más fino. Se libera más mineral valioso de su huésped, por lo que un concentrado que depende de la liberación gana ley, con mayor energía específica.',
  },
  higher_throughput: {
    en: 'Throughput 25% higher. Flotation residence falls in proportion, and once the mill reaches its installed power the grind coarsens as well.',
    es: 'Tratamiento 25% mayor. La residencia en flotación cae en proporción y, cuando el molino llega a su potencia instalada, la molienda también se engruesa.',
  },
  more_collector: {
    en: 'More collector. The valuable mineral\'s response saturates at a lower dose than the gangue\'s and the composites\', so extra reagent adds recovery with diminishing returns and floats more of what dilutes the concentrate.',
    es: 'Más colector. La respuesta del mineral valioso se satura a menor dosis que la de la ganga y los mixtos, por lo que el reactivo adicional suma recuperación con retornos decrecientes y flota más de lo que diluye el concentrado.',
  },
  more_air: {
    en: 'Gas velocity 40% higher. A larger bubble surface area flux raises every rate constant, and the froth recovers more water, which carries more entrained gangue.',
    es: 'Velocidad de gas 40% mayor. Un mayor flujo de área superficial de burbujas eleva todas las constantes cinéticas, y la espuma recupera más agua, que arrastra más ganga.',
  },
  larger_bleed: {
    en: 'Twice the underflow sent to the gravity unit. More free gold is taken out of the grinding loop before it overgrinds or reaches flotation, and less gold circulates.',
    es: 'El doble del underflow enviado a la unidad gravimétrica. Se retira más oro libre del circuito de molienda antes de que se sobremuela o llegue a flotación, y circula menos oro.',
  },
  finer_crusher: {
    en: 'Crusher closed-side setting 20% tighter. The mill receives a finer feed, so the same grind target needs less grinding energy per tonne.',
    es: 'Abertura de descarga del chancador 20% menor. El molino recibe una alimentación más fina, por lo que el mismo objetivo de molienda necesita menos energía por tonelada.',
  },
  coarser_deslime: {
    en: 'Desliming cut 50% coarser. The flotation feed carries fewer slimes, and more of the phosphate in the fine classes leaves with them.',
    es: 'Corte de deslamado 50% más grueso. La alimentación a flotación lleva menos lamas, y más del fosfato de las clases finas se va con ellas.',
  },
};

export const CASE_CONTEXT: Record<string, CaseContext> = {
  copper_porphyry_soft: {
    problem: [
      { en: 'Grinding finer keeps paying while chalcopyrite is still locked in composites, and stops paying below its liberation size, where every extra micron costs energy and the fines float more slowly and entrain more gangue.',
        es: 'Moler más fino rinde mientras la calcopirita sigue atrapada en mixtos y deja de rendir bajo su tamaño de liberación, donde cada micrón extra cuesta energía y los finos flotan más lento y arrastran más ganga.' },
      { en: 'Porphyry plants clean a rougher concentrate to reach smelter grades of about 25 to 50% Cu and usually recover 80 to 90% of the copper, above 90% for sulphide copper. The case asks where on that trade the grind should sit.',
        es: 'Las plantas de pórfido limpian un concentrado rougher hasta leyes de fundición de unos 25 a 50% Cu y suelen recuperar 80 a 90% del cobre, sobre 90% en cobre sulfurado. El caso pregunta dónde de ese compromiso conviene fijar la molienda.' },
    ],
    scope: [
      { en: 'An authored plant: every parameter is inside a range recorded in the research, none is a plant measurement or a calibration.', es: 'Una planta de autor: cada parámetro está dentro de un rango registrado en la investigación; ninguno es una medición de planta ni una calibración.' },
      { en: 'Liberation follows a characteristic liberation size (King 1979); composites float on their exposed chalcopyrite surface.', es: 'La liberación sigue un tamaño característico de liberación (King 1979); los mixtos flotan según su superficie expuesta de calcopirita.' },
      { en: 'Pyrite is depressed but not inert, and quartz reports by entrainment, so the concentrate grade is a result, not an input.', es: 'La pirita está deprimida pero no es inerte y el cuarzo reporta por arrastre, por lo que la ley del concentrado es un resultado, no una entrada.' },
    ],
    read: [
      { en: 'Grinding: the liberation curve with the liberation size and the target P80 marked shows how much chalcopyrite the grind frees.', es: 'Molienda: la curva de liberación con el tamaño de liberación y el P80 objetivo marcados muestra cuánta calcopirita libera la molienda.' },
      { en: 'Response: sweep the grind target against recovery, then add collector as the second input to see the decision surface with the grade specification and installed power drawn.', es: 'Respuesta: barra el objetivo de molienda contra la recuperación y agregue el colector como segunda entrada para ver la superficie de decisión con la ley mínima y la potencia instalada dibujadas.' },
      { en: 'Methods, optimizer: where the six starts converge and which constraint binds at the optimum.', es: 'Métodos, optimizador: dónde convergen los seis inicios y qué restricción queda activa en el óptimo.' },
    ],
    refs: ['king1979', 'trahar1981', 'porphyry-practice', 'herbst1980', 'gorain1997'],
  },
  copper_porphyry_hard: {
    problem: [
      { en: 'The ball mill needs most of its installed power to reach the design grind at the design throughput. Any further hardness or tonnage cannot be met with more energy, so the grind coarsens until the power balance closes.',
        es: 'El molino de bolas necesita casi toda su potencia instalada para alcanzar la molienda de diseño al tratamiento de diseño. Más dureza o más toneladas ya no se pueden cubrir con energía, por lo que la molienda se engruesa hasta que el balance de potencia cierra.' },
      { en: 'This is the most common way a concentrator loses recovery without any change in its flotation circuit, and the case is built to show that chain: power, then grind, then liberation, then recovery.',
        es: 'Es la forma más común en que un concentrador pierde recuperación sin cambio alguno en su flotación, y el caso está hecho para mostrar esa cadena: potencia, luego molienda, luego liberación, luego recuperación.' },
    ],
    scope: [
      { en: 'The energy-specific population balance (Herbst and Fuerstenau 1980) scales breakage with power per tonne, so a power cap is a cap on breakage.', es: 'El balance poblacional de energía específica (Herbst y Fuerstenau 1980) escala la fractura con la potencia por tonelada, por lo que un tope de potencia es un tope de fractura.' },
      { en: 'Installed power and every ore parameter are authored inside the recorded ranges; the case is not a specific plant.', es: 'La potencia instalada y cada parámetro del mineral son de autor dentro de los rangos registrados; el caso no es una planta específica.' },
    ],
    read: [
      { en: 'At the nominal state the mill already draws nearly all its installed power; in the harder-ore and higher-throughput variants the readout flags a power-limited state and the achieved P80 departs from the target.', es: 'En el estado nominal el molino ya consume casi toda su potencia instalada; en las variantes de mineral más duro y mayor tratamiento la lectura avisa un estado limitado por potencia y el P80 logrado se aparta del objetivo.' },
      { en: 'Response: sweep throughput or work index and watch mill power reach the installed value and recovery turn down.', es: 'Respuesta: barra el tratamiento o el índice de trabajo y observe cómo la potencia llega a la instalada y la recuperación baja.' },
    ],
    refs: ['herbst1980', 'bond1952', 'gmg2021', 'molycop'],
  },
  gold_free_milling: {
    problem: [
      { en: 'Cyclones send free gold to the underflow at sizes far finer than the gangue, so it circulates in the grinding loop at many times the ore circulating load, and flotation then takes the gold carried by pyrite.',
        es: 'Los ciclones envían el oro libre al underflow a tamaños mucho más finos que la ganga, por lo que circula en la molienda a muchas veces la carga circulante del mineral, y la flotación toma luego el oro contenido en la pirita.' },
      { en: 'Plant audits measured about 90% of the underflow gold as gravity recoverable, and a published simulator example shows gold recovery rising with the share of underflow treated while the gold circulating load falls. The case asks how much a bleed is worth.',
        es: 'Auditorías de planta midieron cerca de 90% del oro del underflow como recuperable por gravedad, y un ejemplo de simulador publicado muestra la recuperación de oro subiendo con la fracción de underflow tratada mientras cae la carga circulante de oro. El caso pregunta cuánto vale una purga.' },
    ],
    scope: [
      { en: 'Gold is a species with its own density, slow breakage and a size window for gravity capture; composites and gangue report to the gravity concentrate at small fixed yields.', es: 'El oro es una especie con su propia densidad, fractura lenta y una ventana de tamaños para la captura gravimétrica; mixtos y ganga reportan al concentrado gravimétrico con rendimientos pequeños y fijos.' },
      { en: 'The gravity model is checked against the direction of the Laplante simulator example, not calibrated to a plant.', es: 'El modelo gravimétrico se contrasta con la tendencia del ejemplo de simulador de Laplante, no se calibra a una planta.' },
    ],
    read: [
      { en: 'Circuit: the gravity unit sits on the underflow return; its concentrate is a product and its tail returns to the mill.', es: 'Circuito: la unidad gravimétrica está sobre el retorno del underflow; su concentrado es un producto y su relave vuelve al molino.' },
      { en: 'Separation: the gravity and flotation recoveries are reported separately, with the gold circulating load.', es: 'Separación: las recuperaciones gravimétrica y de flotación se informan por separado, con la carga circulante de oro.' },
      { en: 'Response: sweep the gravity bleed to see recovery saturate.', es: 'Respuesta: barra la purga gravimétrica para ver cómo se satura la recuperación.' },
    ],
    refs: ['laplante-staunton', 'laplante2005', 'plitt1976'],
  },
  iron_magnetite_fine: {
    problem: [
      { en: 'The drums work at 800 to 2000 G and lose little beyond the ultrafine magnetite, so the concentrate grade pays for the silica that composites carry into it.',
        es: 'Los tambores operan a 800 a 2000 G y pierden poco más que la magnetita ultrafina, por lo que la ley del concentrado paga la sílice que los mixtos llevan a él.' },
      { en: 'At Zandrivierspoort a 35.7% Fe feed gave 64.9% Fe at 80% passing 75 µm and 69.0% Fe at 80% passing 45 µm, with rougher magnetite recovery above 98%. The case asks how fine the ore must be ground for a pellet-feed grade.',
        es: 'En Zandrivierspoort una alimentación de 35,7% Fe dio 64,9% Fe al 80% bajo 75 µm y 69,0% Fe al 80% bajo 45 µm, con recuperación rougher de magnetita sobre 98%. El caso pregunta qué tan fino debe molerse el mineral para una ley de pellet feed.' },
    ],
    scope: [
      { en: 'There is no flotation: the rougher and cleaner drums capture by particle class, with ultrafine losses and gangue entrapment.', es: 'No hay flotación: los tambores rougher y de limpieza capturan por clase de partícula, con pérdidas de ultrafinos y atrapamiento de ganga.' },
      { en: 'The published grind-grade pairs are the oracle for the direction and size of the effect, not a calibration of this plant.', es: 'Los pares molienda-ley publicados son el oráculo para la dirección y el tamaño del efecto, no una calibración de esta planta.' },
    ],
    read: [
      { en: 'Separation: the LIMS capture curves by particle class show why composites lower the grade.', es: 'Separación: las curvas de captura LIMS por clase de partícula muestran por qué los mixtos bajan la ley.' },
      { en: 'Case, variants and cases: the finer-grind and coarser-grind variants bracket the nominal grade.', es: 'Caso, variantes y casos: las variantes de molienda más fina y más gruesa acotan la ley nominal.' },
    ],
    refs: ['muthaphuli2014', 'king1979'],
  },
  nickel_sulphide: {
    problem: [
      { en: 'Fine pentlandite also floats slowly, so grinding finer to liberate it produces more of the slimes that dilute the concentrate.',
        es: 'La pentlandita fina además flota lento, por lo que moler más fino para liberarla produce más de las lamas que diluyen el concentrado.' },
      { en: 'Plants of this type make concentrates of about 20% Ni with MgO rejection above 99.5%, and serpentine slimes impair both grade and recovery. The case asks how the slimes set the grade-recovery compromise.',
        es: 'Las plantas de este tipo producen concentrados de unos 20% Ni con rechazo de MgO sobre 99,5%, y las lamas de serpentina afectan tanto la ley como la recuperación. El caso pregunta cómo las lamas fijan el compromiso ley-recuperación.' },
    ],
    scope: [
      { en: 'Entrainment follows Savassi\'s size-dependent degree of entrainment with a coarser entrainment size than a clean ore.', es: 'El arrastre sigue el grado de arrastre por tamaño de Savassi, con un tamaño de arrastre mayor que en un mineral limpio.' },
      { en: 'Serpentine is modelled as soft, slightly floatable gangue; chemical depression by dispersants is outside the model.', es: 'La serpentina se modela como ganga blanda y levemente flotable; la depresión química con dispersantes queda fuera del modelo.' },
    ],
    read: [
      { en: 'Separation: the entrained share of the host gangue by size is where the grade is lost.', es: 'Separación: la fracción arrastrada de la ganga huésped por tamaño es donde se pierde la ley.' },
      { en: 'Methods, uncertainty: floatability dominates the spread of recovery; the Sobol view quantifies it.', es: 'Métodos, incertidumbre: la flotabilidad domina la dispersión de la recuperación; la vista de Sobol la cuantifica.' },
    ],
    refs: ['nickel2024', 'savassi1998', 'hoang2019'],
  },
  phosphate_clay: {
    problem: [
      { en: 'Clay slimes consume fatty-acid collector and entrain into the froth, which is why plants deslime; the phosphate in the fine classes leaves with the slimes.',
        es: 'Las lamas de arcilla consumen colector de ácidos grasos y se arrastran a la espuma, por eso las plantas deslaman; el fosfato de las clases finas se va con las lamas.' },
      { en: 'Plants target about 35% P2O5 (stoichiometric fluorapatite holds 42.2%). A coarser cut makes a cleaner flotation feed and loses more phosphate; a coarser grind makes fewer slimes. The case asks what the cut costs.',
        es: 'Las plantas apuntan a unos 35% P2O5 (la fluorapatita estequiométrica tiene 42,2%). Un corte más grueso da una alimentación más limpia a flotación y pierde más fosfato; una molienda más gruesa produce menos lamas. El caso pregunta cuánto cuesta el corte.' },
    ],
    scope: [
      { en: 'The desliming cyclone uses the Rosin-Rammler partition with a declared sharpness and water bypass; its cut is an operating control bounded by half the grind target.', es: 'El ciclón de deslamado usa la partición Rosin-Rammler con nitidez y cortocircuito de agua declarados; su corte es un control de operación acotado por la mitad del objetivo de molienda.' },
      { en: 'The phosphate practice figures come from a review summary (the full text was not reachable when the research was done).', es: 'Las cifras de práctica del fosfato vienen del resumen de una revisión (el texto completo no estaba disponible al hacer la investigación).' },
    ],
    read: [
      { en: 'Separation: the desliming partition by particle class shows what leaves with the slimes.', es: 'Separación: la partición del deslamado por clase de partícula muestra qué se va con las lamas.' },
      { en: 'Response: sweep the desliming cut against recovery; the contract rejects a cut above half the grind target.', es: 'Respuesta: barra el corte de deslamado contra la recuperación; el contrato rechaza un corte sobre la mitad del objetivo de molienda.' },
    ],
    refs: ['phosphate2019', 'hoang2019', 'plitt1976'],
  },
  copper_molybdenum: {
    problem: [
      { en: 'In bulk roughers molybdenite usually recovers 2 to 12 points below copper, and more variably, because part of it is platy, fine and unresponsive.',
        es: 'En roughers colectivos la molibdenita suele recuperarse entre 2 y 12 puntos bajo el cobre, y con más variabilidad, porque parte de ella es laminar, fina y poco respondedora.' },
      { en: 'The case asks why molybdenite trails copper in the same froth, and how much of that gap belongs to size and how much to the mineral itself.',
        es: 'El caso pregunta por qué la molibdenita queda detrás del cobre en la misma espuma, y cuánto de esa brecha es tamaño y cuánto es el mineral mismo.' },
    ],
    scope: [
      { en: 'Molybdenite carries an unresponsive fraction and a finer optimum size than chalcopyrite; both are authored within the mechanisms Zanin et al. describe.', es: 'La molibdenita tiene una fracción poco respondedora y un tamaño óptimo más fino que la calcopirita; ambos son de autor dentro de los mecanismos que describen Zanin y colaboradores.' },
      { en: 'Molybdenum is a second payable: the grade specification applies to copper, and molybdenum recovery is reported beside it.', es: 'El molibdeno es un segundo pagable: la ley mínima aplica al cobre y la recuperación de molibdeno se informa junto a ella.' },
    ],
    read: [
      { en: 'The readout and the Compare table give copper recovery; the molybdenum recovery is in the Separation facts.', es: 'La lectura y la tabla de Comparar dan la recuperación de cobre; la de molibdeno está en los datos de Separación.' },
      { en: 'Separation, batch kinetics: the fitted models show how a slow, unresponsive fraction flattens the curve.', es: 'Separación, cinética batch: los modelos ajustados muestran cómo una fracción lenta y poco respondedora aplana la curva.' },
    ],
    refs: ['zanin2009', 'polat2000', 'porphyry-practice'],
  },
  copper_oxide: {
    problem: [
      { en: 'Chrysocolla behaves like quartz in flotation. Reported studies reach 15 to 21% Cu at 77 to 86% recovery on malachite ores.',
        es: 'La crisocola se comporta como cuarzo en flotación. Los estudios reportados alcanzan 15 a 21% Cu con 77 a 86% de recuperación en minerales de malaquita.' },
      { en: 'The case asks what limits recovery when reagent is not the constraint: here the ceiling is mineralogical, set by the copper held in chrysocolla.',
        es: 'El caso pregunta qué limita la recuperación cuando el reactivo no es la restricción: aquí el techo es mineralógico, fijado por el cobre contenido en crisocola.' },
    ],
    scope: [
      { en: 'Sulphidisation is folded into malachite\'s floatability and collector response; the reagent chemistry is not modelled.', es: 'La sulfidización se incorpora en la flotabilidad y la respuesta al colector de la malaquita; la química del reactivo no se modela.' },
      { en: 'Chrysocolla is a copper carrier with a gangue-like floatability, so it is counted in the head grade and mostly lost.', es: 'La crisocola es un portador de cobre con flotabilidad de ganga, por lo que cuenta en la ley de cabeza y se pierde en su mayoría.' },
      { en: 'With a fifth of the copper in chrysocolla, the nominal state sits at a higher grade and a lower recovery than the malachite studies: the recoverable copper is malachite\'s, cleaned to a high grade.', es: 'Con un quinto del cobre en crisocola, el estado nominal queda con más ley y menos recuperación que los estudios de malaquita: el cobre recuperable es el de la malaquita, limpiado a alta ley.' },
    ],
    read: [
      { en: 'Response: collector against recovery flattens early; more reagent does not reach the chrysocolla copper.', es: 'Respuesta: el colector contra la recuperación se aplana pronto; más reactivo no alcanza el cobre de la crisocola.' },
      { en: 'Methods, optimizer: whether the optimum is set by grade, power or water.', es: 'Métodos, optimizador: si el óptimo lo fija la ley, la potencia o el agua.' },
    ],
    refs: ['oxide2022', 'collector2022'],
  },
  zinc_sulfide: {
    problem: [
      { en: 'Stoichiometric ZnS holds 67.1% Zn and commercial concentrates run at about 50 to 55% Zn, so the concentrate grade is set by how much pyrite and gangue the froth carries.',
        es: 'El ZnS estequiométrico tiene 67,1% Zn y los concentrados comerciales rondan 50 a 55% Zn, por lo que la ley del concentrado la fija cuánta pirita y ganga lleva la espuma.' },
      { en: 'The high head grade makes the grade-recovery separation explicit: the case asks how pyrite controls the zinc grade.',
        es: 'La alta ley de cabeza hace explícita la separación ley-recuperación: el caso pregunta cómo controla la pirita la ley del zinc.' },
    ],
    scope: [
      { en: 'Activation is folded into sphalerite\'s floatability; pyrite depression into pyrite\'s lower floatability.', es: 'La activación se incorpora en la flotabilidad de la esfalerita; la depresión de la pirita en su menor flotabilidad.' },
      { en: 'The commercial grade range is recorded as unverified as a single figure; the grade specification is authored.', es: 'El rango de ley comercial está registrado como no verificado como cifra única; la ley mínima es de autor.' },
    ],
    read: [
      { en: 'Separation: the bank profile shows the grade falling cell by cell as recovery accumulates.', es: 'Separación: el perfil del banco muestra la ley cayendo celda a celda a medida que se acumula la recuperación.' },
      { en: 'Case, variants and cases: more collector raises recovery at a lower grade, while more air raises both, because the extra bubble surface floats sphalerite faster than the extra water entrains gangue.', es: 'Caso, variantes y casos: más colector sube la recuperación con menor ley, mientras más aire sube ambas, porque la superficie adicional de burbujas flota la esfalerita más rápido de lo que el agua adicional arrastra ganga.' },
    ],
    refs: ['gorain1997', 'savassi1998', 'collector2022'],
  },
  mixed_ore_high_clay: {
    problem: [
      { en: 'Clay reports almost entirely by entrainment with the water the froth recovers, so the froth washing in the cleaners and the gas velocity decide how much of it reaches the concentrate.',
        es: 'La arcilla reporta casi por completo por arrastre con el agua que recupera la espuma, por lo que el lavado de espuma en la limpieza y la velocidad de gas deciden cuánta llega al concentrado.' },
      { en: 'The case asks how much grade the clay entrainment takes, and what the circuit can do about it without losing copper.',
        es: 'El caso pregunta cuánta ley se lleva el arrastre de arcilla y qué puede hacer el circuito sin perder cobre.' },
    ],
    scope: [
      { en: 'Clay is soft, fine and barely floatable, so it reports almost entirely by entrainment with the recovered water.', es: 'La arcilla es blanda, fina y casi no flota, por lo que reporta casi por completo por arrastre con el agua recuperada.' },
      { en: 'Rheology (the viscosity clay adds to the pulp) is outside the model.', es: 'La reología (la viscosidad que la arcilla agrega a la pulpa) queda fuera del modelo.' },
    ],
    read: [
      { en: 'Separation: the entrained share of gangue by size and the rougher water recovery.', es: 'Separación: la fracción arrastrada de la ganga por tamaño y la recuperación de agua rougher.' },
      { en: 'Case, variants and cases: more air raises recovery and the water recovered, while more collector raises recovery at a lower grade.', es: 'Caso, variantes y casos: más aire sube la recuperación y el agua recuperada, mientras más colector sube la recuperación con menor ley.' },
    ],
    refs: ['savassi1998', 'hoang2019', 'trahar1981'],
  },
  low_grade_copper: {
    problem: [
      { en: 'Once the installed power is used up the grind coarsens and recovery falls, so more tonnes can mean less metal recovered per tonne treated, though not necessarily less per hour.',
        es: 'Cuando se agota la potencia instalada la molienda se engruesa y la recuperación cae, por lo que más toneladas pueden significar menos metal recuperado por tonelada tratada, aunque no necesariamente menos por hora.' },
      { en: 'The case asks whether it pays to push tonnes or to hold the grind: recovered metal per hour is the measure, not recovery alone.',
        es: 'El caso pregunta si conviene empujar toneladas o sostener la molienda: la medida es el metal recuperado por hora, no la recuperación sola.' },
    ],
    scope: [
      { en: 'The optimizer maximises recovered metal per hour under the grade, power and water constraints.', es: 'El optimizador maximiza el metal recuperado por hora bajo las restricciones de ley, potencia y agua.' },
      { en: 'Throughput is an operating input bounded by the contract, not a design variable of the plant.', es: 'El tratamiento es una entrada de operación acotada por el contrato, no una variable de diseño de la planta.' },
    ],
    read: [
      { en: 'Case, variants and cases: the higher-throughput variant trades recovery for tonnes; its recovered metal per hour decides.', es: 'Caso, variantes y casos: la variante de mayor tratamiento cambia recuperación por toneladas; su metal recuperado por hora decide.' },
      { en: 'Response: sweep throughput with recovered metal as the metric.', es: 'Respuesta: barra el tratamiento con el metal recuperado como métrica.' },
    ],
    refs: ['herbst1980', 'gmg2021', 'porphyry-practice'],
  },
  refractory_gold: {
    problem: [
      { en: 'The concentrate goes to roasting or pressure oxidation, so the flotation circuit is judged by sulphide recovery at a mass pull the oxidation plant can take.',
        es: 'El concentrado va a tostación u oxidación a presión, por lo que el circuito de flotación se juzga por la recuperación de sulfuros con un rendimiento en masa que la planta de oxidación pueda recibir.' },
      { en: 'The two carriers float differently, arsenopyrite more slowly, so the case asks how they share the recovery and where the slower one is lost.',
        es: 'Los dos portadores flotan distinto, la arsenopirita más lento, por lo que el caso pregunta cómo se reparten la recuperación y dónde se pierde el más lento.' },
    ],
    scope: [
      { en: 'Gold is a trace element in each carrier with a declared share; its recovery follows the carriers\' recovery.', es: 'El oro es un elemento traza en cada portador con una fracción declarada; su recuperación sigue la de los portadores.' },
      { en: 'Concentrate grade and mass pull are ore specific; the case is authored and labelled as such.', es: 'La ley del concentrado y el rendimiento en masa son propios de cada mineral; el caso es de autor y está marcado como tal.' },
    ],
    read: [
      { en: 'Separation: recovery by size of the payable combines both carriers.', es: 'Separación: la recuperación por tamaño del pagable combina ambos portadores.' },
      { en: 'Methods, Sobol sensitivity: floatability is the dominant source of the spread in recovery.', es: 'Métodos, sensibilidad de Sobol: la flotabilidad es la fuente dominante de la dispersión de la recuperación.' },
    ],
    refs: ['laplante2005', 'polat2000', 'trahar1981'],
  },
};
