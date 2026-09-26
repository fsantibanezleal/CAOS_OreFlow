/**
 * The governing equations of each circuit family, in the forms the engine solves, transcribed from the
 * methodology (grid and liberation, grinding circuit, classification, flotation, gravity, magnetic
 * separation, desliming, energy). Captions are bilingual; symbols are defined in each caption.
 */
type Bi = { en: string; es: string };
export type Formula = { tex: string; caption: Bi };

const r = String.raw;

export const CIRCUIT: Formula[] = [
  { tex: r`S_i^E = \alpha_0 \frac{d_i^{\alpha_1}}{1 + (d_i/d_{crit})^{\alpha_2}}`,
    caption: { en: 'Energy-specific selection function (t/kWh) of size class i (Herbst and Fuerstenau; Moly-Cop form): breakage rate per unit of specific energy.',
      es: 'Función de selección por energía específica (t/kWh) de la clase i (Herbst y Fuerstenau; forma de Moly-Cop): tasa de fractura por unidad de energía específica.' } },
  { tex: r`\begin{aligned} B_{ij} &= \beta_0 \left(\frac{x_i}{x_{j+1}}\right)^{\beta_1} + (1-\beta_0)\left(\frac{x_i}{x_{j+1}}\right)^{\beta_2} \\ b_{ij} &= B_{ij} - B_{i+1,j} \end{aligned}`,
    caption: { en: 'Cumulative breakage function (Austin form) and the fraction of broken class j that reports to class i.',
      es: 'Función de fractura acumulada (forma de Austin) y fracción de la clase j fracturada que reporta a la clase i.' } },
  { tex: r`\begin{gathered} T^{-1}(e) = I + e\,D + c_2 e^2 D^2 + c_3 e^3 D^3 \\ D = (I - \tilde B)\,\mathrm{diag}(S^E) \end{gathered}`,
    caption: { en: 'The mill as three perfect mixers in series sharing one breakage operator: e is the specific energy per pass, c2 and c3 the symmetric sums of the mixers\' volume fractions.',
      es: 'El molino como tres mezcladores perfectos en serie que comparten un operador de fractura: e es la energía específica por pasada, c2 y c3 las sumas simétricas de las fracciones de volumen.' } },
  { tex: r`\left(T^{-1}(e) - \mathrm{diag}(C)\right) p = f`,
    caption: { en: 'Closed circuit: with the cyclone returning fraction C_i of the mill product, one lower-triangular solve gives the mill product p for new feed f; e is found so that the overflow meets the target P80 and the circulating load its design value.',
      es: 'Circuito cerrado: con el ciclón devolviendo la fracción C_i del producto del molino, una resolución triangular inferior da el producto p para la alimentación fresca f; e se busca para que el rebose cumpla el P80 objetivo y la carga circulante su valor de diseño.' } },
  { tex: r`\begin{gathered} y(d) = R_f + (1 - R_f)\left(1 - e^{-\ln 2\,(d/d_{50c})^{m}}\right) \\ d_{50c,k} = d_{50c}\sqrt{\frac{\rho_h - 1}{\rho_k - 1}} \end{gathered}`,
    caption: { en: 'Cyclone partition to underflow (Plitt, Rosin-Rammler form) with water bypass R_f, and the cut of a particle class k of density ρ_k from Plitt\'s density dependence on the host gangue density ρ_h: dense minerals return to the mill at finer sizes.',
      es: 'Partición del ciclón a la descarga (Plitt, forma Rosin-Rammler) con cortocircuito de agua R_f, y el corte de una clase k de densidad ρ_k según la dependencia de densidad de Plitt sobre la densidad de la ganga huésped ρ_h: los minerales densos vuelven al molino a tamaños más finos.' } },
  { tex: r`L_i = \frac{1}{1 + (d_i/x_L)^{n_L}}`,
    caption: { en: 'Liberated fraction of a valuable mineral in size class i, with liberation size x_L and slope n_L (after King 1979); the rest is held in composites of declared mineral content.',
      es: 'Fracción liberada de un mineral valioso en la clase i, con tamaño de liberación x_L y pendiente n_L (según King 1979); el resto queda en mixtos de contenido declarado.' } },
  { tex: r`\begin{gathered} W = W_i\left(\frac{10}{\sqrt{P_{80}}} - \frac{10}{\sqrt{F_{80}}}\right) \\ W_{i,o} = \frac{P/T}{10/\sqrt{P_{80}} - 10/\sqrt{F_{80}}} \end{gathered}`,
    caption: { en: 'Bond energy for a reduction (kWh/t, sizes in µm) and the operating work index recovered from the circuit\'s own specific energy P/T.',
      es: 'Energía de Bond para una reducción (kWh/t, tamaños en µm) y el índice de trabajo operacional obtenido de la propia energía específica del circuito P/T.' } },
];

export const FLOTATION: Formula[] = [
  { tex: r`\begin{aligned} k_{s,i} &= 60\,P_s\,S_b\,f_d(d_i)\,f_D(D) \\ f_d(d) &= \exp\!\left(-\tfrac12\left[\ln(d/x_{opt})/w\right]^2\right) \\ f_D(D) &= u + (1-u)\frac{D}{D + K_s} \\ S_b &= \frac{6 J_g}{D_{32}} \end{aligned}`,
    caption: { en: 'Rate constant (1/min) of particle class s in size class i: floatability P_s times the bubble surface area flux S_b (Gorain et al.), a size window f_d around x_opt (Trahar), and a collector response f_D to dose D that saturates at half-dose K_s.',
      es: 'Constante cinética (1/min) de la clase s en el tamaño i: flotabilidad P_s por el flujo de área superficial de burbujas S_b (Gorain y colaboradores), una ventana de tamaños f_d en torno a x_opt (Trahar) y una respuesta f_D a la dosis D de colector que se satura en la semidosis K_s.' } },
  { tex: r`\begin{aligned} ENT_i &= \frac{2}{e^{a_i} + e^{-a_i}},\qquad a_i = 2.292\,(d_i/\xi)^{adj} \\ adj &= 1 - \frac{\ln(1/\delta)}{\exp(d_i/\xi)} \end{aligned}`,
    caption: { en: 'Degree of entrainment of size class i (Savassi et al.): xi is the size at which ENT = 0.2 and delta the drainage parameter; entrained gangue follows the water recovered.',
      es: 'Grado de arrastre de la clase i (Savassi y colaboradores): xi es el tamaño con ENT = 0,2 y delta el parámetro de drenaje; la ganga arrastrada sigue al agua recuperada.' } },
  { tex: r`\begin{gathered} r = \frac{k\tau + ENT\,w}{1 + k\tau + ENT\,w} \\ w = \frac{r_w}{1-r_w},\qquad R_N = 1 - (1 - r)^N \end{gathered}`,
    caption: { en: 'Recovery per perfectly mixed cell with residence tau and water recovery r_w, and R_N over a bank of N cells; without entrainment it is the tanks-in-series result 1 - (N/(N + k tau_bank))^N.',
      es: 'Recuperación por celda perfectamente mezclada con residencia tau y recuperación de agua r_w, y R_N en un banco de N celdas; sin arrastre es el resultado de tanques en serie 1 - (N/(N + k tau_banco))^N.' } },
];

export const GRAVITY: Formula[] = [
  { tex: r`E_g(d) = E_{max}\left(1 - e^{-(d/x_g)^2}\right)`,
    caption: { en: 'Gravity-unit recovery of free gold by size on the underflow bleed, with a small fixed recovery of composites and a small mass yield of gangue; the unit\'s tail returns to the mill.',
      es: 'Recuperación gravimétrica de oro libre por tamaño en la purga del underflow, con una recuperación fija pequeña de mixtos y un rendimiento en masa pequeño de ganga; el relave de la unidad vuelve al molino.' } },
];

export const MAGNETIC: Formula[] = [
  { tex: r`\begin{aligned} p_{lib}(d) &= p_{max}\left(1 - e^{-d/d_f}\right) \\ p_{comp}(d, c) &= p_{max}\left(1 - e^{-c/c_0}\right)\left(1 - e^{-d/d_f}\right) \\ p_{g}(d) &= e_0 + e_1 e^{-d/d_e} \end{aligned}`,
    caption: { en: 'LIMS capture of liberated magnetite, of composites with magnetite content c, and entrapment of free gangue (scaled down in the cleaner drum); the concentrate iron grade follows from the mineral balance.',
      es: 'Captura LIMS de magnetita liberada, de mixtos con contenido de magnetita c y atrapamiento de ganga libre (reducido en el tambor de limpieza); la ley de hierro del concentrado sale del balance de minerales.' } },
];

export const DESLIME: Formula[] = [
  { tex: r`y_{des}(d) = R_b + (1 - R_b)\left(1 - e^{-\ln 2\,(d/d_{des})^{m}}\right)`,
    caption: { en: 'Desliming partition to underflow with the desliming cut d_des as an operating control, a declared sharpness m and water bypass R_b; the overflow leaves as slimes.',
      es: 'Partición del deslamado a la descarga con el corte d_des como control de operación, nitidez m y cortocircuito de agua R_b declarados; el rebose sale como lamas.' } },
];

/** The equations that govern a circuit family. */
export function familyFormulas(family: string): Formula[] {
  if (family === 'magnetic') return [...CIRCUIT, ...MAGNETIC];
  if (family === 'gravity_rougher') return [...CIRCUIT, ...GRAVITY, ...FLOTATION];
  if (family === 'deslime_rougher') return [...CIRCUIT, ...DESLIME, ...FLOTATION];
  return [...CIRCUIT, ...FLOTATION];
}
