/**
 * Implementation, the three tabs that 0.07.000 adds (PG-02): the model registry, the GPU lane and the
 * deployment. Transcribed from methods/learning.py, stages/particle_experiment.py, run_geomet.py,
 * requirements-gpu.txt, deploy/setup-vps.sh and architecture 05. The registry's training facts are read
 * from the learning and particle records at run time, and each served file's bytes and SHA-256 are
 * computed in the browser from the file this site serves, so no number here is retyped.
 */
import { useEffect, useState } from 'react';
import { loadLearning, loadParticleBenchmark, loadValidation } from '../lib/artifacts';
import { formatFixed, formatSignificant, type Lang } from '../lib/format';
import { APP_VERSION } from '../lib/version';
import { Loaded, useArtifact } from './data';
import type { Topic } from './doc';
import { Arrow, Box, pick } from './figures';

const r = String.raw;

/** The files the site serves under models/, by the copy-data step of the build. */
export const SERVED_MODELS = ['process_surrogate.onnx', 'process_guard.onnx', 'process_surrogate.json', 'process_screen.json', 'process_gp_cholesky.bin', 'particle_mlp.onnx'] as const;

async function fingerprint(file: string): Promise<{ bytes: number; sha256: string }> {
  const response = await fetch(`${import.meta.env.BASE_URL}models/${file}?v=${encodeURIComponent(APP_VERSION)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status} models/${file}`);
  const data = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', data);
  return { bytes: data.byteLength, sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') };
}

function useFingerprints(): Record<string, { bytes: number; sha256: string } | { error: string }> | null {
  const [state, setState] = useState<Record<string, { bytes: number; sha256: string } | { error: string }> | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(SERVED_MODELS.map(f => fingerprint(f).then(v => [f, v] as const, (e: unknown) => [f, { error: String(e) }] as const)))
      .then(rows => { if (live) setState(Object.fromEntries(rows)); });
    return () => { live = false; };
  }, []);
  return state;
}

function RegistryFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-registry-arrow)';
  const row = (y: number, source: string, model: string, detail: string, where: string, kind?: 'accent' | 'good') => (
    <g key={model}>
      <Box x={10} y={y} w={190} h={46} title={source} lines={[]} />
      <line className="dg-edge" x1={200} y1={y + 23} x2={236} y2={y + 23} markerEnd={arrow} />
      <Box x={240} y={y} w={210} h={46} title={model} lines={[detail]} kind={kind} />
      <line className="dg-edge" x1={450} y1={y + 23} x2={486} y2={y + 23} markerEnd={arrow} />
      <Box x={490} y={y} w={200} h={46} title={where} lines={[]} />
    </g>
  );
  return (
    <svg className="fig-svg" viewBox="0 0 700 320" role="img" aria-label={p('Each exported model, the data it learned from and where it runs', 'Cada modelo exportado, los datos de los que aprendió y dónde corre')}>
      <Arrow id="of-registry-arrow" />
      <text className="dg-box-title accent" x={10} y={16}>{p('Trained on', 'Entrenado con')}</text>
      <text className="dg-box-title accent" x={240} y={16}>{p('Exported model', 'Modelo exportado')}</text>
      <text className="dg-box-title accent" x={490} y={16}>{p('Runs in', 'Corre en')}</text>
      {row(26, p('3072 engine states', '3072 estados del motor'), p('Surrogate (ONNX)', 'Sustituto (ONNX)'), p('22 features to 3 targets', '22 variables a 3 objetivos'), p('Methods view, browser', 'Vista de Métodos, navegador'), 'accent')}
      {row(84, p('3072 engine states', '3072 estados del motor'), p('Guard (ONNX)', 'Guardia (ONNX)'), p('22 features reconstructed', '22 variables reconstruidas'), p('Methods view, browser', 'Vista de Métodos, navegador'), 'accent')}
      {row(142, p('500 engine states', '500 estados del motor'), p('Optimizer screen (GP)', 'Filtro del optimizador (GP)'), p('recovery, in float64', 'recuperación, en float64'), p('Optimizer, browser', 'Optimizador, navegador'), 'accent')}
      {row(200, p('HZDR training sheet', 'Hoja de entrenamiento HZDR'), p('Particle network (ONNX)', 'Red de partículas (ONNX)'), p('4 features to 4 cases', '4 variables a 4 casos'), p('Benchmark, browser', 'Benchmark, navegador'), 'good')}
      {row(258, p('52 locked-cycle tests', '52 ensayos de ciclo cerrado'), p('GeoMet checkpoint', 'Modelo guardado GeoMet'), p('5 assays to recovery', '5 ensayes a recuperación'), p('predict-geomet command', 'comando predict-geomet'), 'good')}
    </svg>
  );
}

function ModelRegistry({ lang }: { lang: Lang }) {
  const learning = useArtifact(loadLearning);
  const particles = useArtifact(loadParticleBenchmark);
  const prints = useFingerprints();
  const p = (en: string, es: string) => pick(lang, en, es);
  return (
    <Loaded lang={lang} errors={[learning.error, particles.error]} ready={Boolean(learning.value && particles.value && prints)}>
      {() => {
        const L = learning.value!, P = particles.value!.protocol;
        const mlp = L.final.mlp_training as { parameters: number; best_epoch: number; epochs_run: number; device: string };
        const exp = L.final.exports;
        const hidden = (L.settings.mlp_hidden as number[]).join(', '), ae = (L.settings.autoencoder_hidden as number[]).join(', ');
        const fp = (file: string) => {
          const v = prints![file];
          return 'error' in v ? v.error : `${v.bytes.toLocaleString(lang === 'es' ? 'es-CL' : 'en-US')} B, ${v.sha256.slice(0, 16)}`;
        };
        const rows = [
          [p('Surrogate', 'Sustituto'), 'process_surrogate.onnx', p(`${L.features.length} features to ${L.targets.length} targets; hidden ${hidden}, SiLU; ${mlp.parameters.toLocaleString(lang === 'es' ? 'es-CL' : 'en-US')} parameters`, `${L.features.length} variables a ${L.targets.length} objetivos; ocultas ${hidden}, SiLU; ${mlp.parameters.toLocaleString(lang === 'es' ? 'es-CL' : 'en-US')} parámetros`),
            p(`${L.design.rows} engine states; best epoch ${mlp.best_epoch} of ${mlp.epochs_run} on ${mlp.device}`, `${L.design.rows} estados del motor; mejor época ${mlp.best_epoch} de ${mlp.epochs_run} en ${mlp.device}`),
            p(`opset ${exp.surrogate.opset}; ${formatSignificant(exp.surrogate.max_abs_difference, lang, 2)} from PyTorch`, `opset ${exp.surrogate.opset}; ${formatSignificant(exp.surrogate.max_abs_difference, lang, 2)} de PyTorch`), fp('process_surrogate.onnx')],
          [p('Guard', 'Guardia'), 'process_guard.onnx', p(`autoencoder, hidden ${ae}, tanh; threshold ${formatFixed(L.final.guard_threshold, lang, 3)}`, `autoencoder, ocultas ${ae}, tanh; umbral ${formatFixed(L.final.guard_threshold, lang, 3)}`),
            p(`the same states; 99th percentile of validation error`, `los mismos estados; percentil 99 del error de validación`),
            p(`opset ${exp.guard.opset}; ${formatSignificant(exp.guard.max_abs_difference, lang, 2)} from PyTorch`, `opset ${exp.guard.opset}; ${formatSignificant(exp.guard.max_abs_difference, lang, 2)} de PyTorch`), fp('process_guard.onnx')],
          [p('Scalers and reference', 'Escaladores y referencia'), 'process_surrogate.json', p('feature, target and guard means and scales; reference answers at every nominal state', 'medias y escalas de variables, objetivos y guardia; respuestas de referencia en cada estado nominal'),
            p('the same fit', 'el mismo ajuste'), p('the browser test compares every nominal state', 'la prueba del navegador compara cada estado nominal'), fp('process_surrogate.json')],
          [p('Optimizer screen', 'Filtro del optimizador'), 'process_screen.json', p(`a Gaussian process on recovery over ${exp.screen.gp_rows} engine states, with the two networks\' weights; run in float64 in the browser`, `un proceso gaussiano sobre la recuperación con ${exp.screen.gp_rows} estados del motor, con los pesos de las dos redes; corre en float64 en el navegador`),
            p('the learning stage\'s states', 'los estados de la etapa de aprendizaje'),
            p(`${formatSignificant(exp.screen.gp_max_abs_difference ?? Number.NaN, lang, 2)} from scikit-learn`, `${formatSignificant(exp.screen.gp_max_abs_difference ?? Number.NaN, lang, 2)} de scikit-learn`), fp('process_screen.json')],
          [p('Screen factor', 'Factor del filtro'), 'process_gp_cholesky.bin', p('the Cholesky factor of the screen\'s kernel matrix', 'el factor de Cholesky de la matriz de núcleo del filtro'),
            p('the same fit', 'el mismo ajuste'), p('read with the screen', 'se lee con el filtro'), fp('process_gp_cholesky.bin')],
          [p('Particle network', 'Red de partículas'), 'particle_mlp.onnx', p(`${P.features.length} particle features to 4 cases; hidden 32, 32, ReLU`, `${P.features.length} variables de partícula a 4 casos; ocultas 32, 32, ReLU`),
            p(`${P.fit_rows.toLocaleString(lang === 'es' ? 'es-CL' : 'en-US')} HZDR rows; best epoch ${P.mlp_best_epoch} on ${P.device}`, `${P.fit_rows.toLocaleString(lang === 'es' ? 'es-CL' : 'en-US')} filas HZDR; mejor época ${P.mlp_best_epoch} en ${P.device}`),
            p('scored against the constructed probabilities', 'evaluada frente a las probabilidades construidas'), fp('particle_mlp.onnx')],
          [p('GeoMet checkpoint', 'Modelo guardado GeoMet'), 'geomet_lct.joblib', p('ridge, random forest and Gaussian process on five assays', 'ridge, bosque aleatorio y proceso gaussiano sobre cinco ensayes'),
            p('52 locked-cycle tests, source pinned by SHA-256', '52 ensayos de ciclo cerrado, fuente fijada por SHA-256'), p('refused when the source hash differs', 'se rechaza si la huella de la fuente difiere'), p('not served: kept for the command line', 'no se sirve: se guarda para la línea de comandos')],
        ];
        return (
          <div>
            <table className="of-doc-table of-doc-table-data">
              <thead><tr>{[p('Model', 'Modelo'), p('File', 'Archivo'), p('What it is', 'Qué es'), p('Trained on', 'Entrenado con'), p('Check', 'Verificación'), p('Served bytes, SHA-256', 'Bytes servidos, SHA-256')].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>{rows.map(row => <tr key={row[1]}>{row.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th>
                : <td key={i} className={i === 1 || i === 5 ? 'of-doc-soft' : 'of-doc-wrap'}>{i === 1 || i === 5 ? <code>{cell}</code> : cell}</td>))}</tr>)}</tbody>
            </table>
            <p className="of-footnote">{p('The first 16 hexadecimal digits of each SHA-256, computed in this browser from the file this site serves.', 'Los primeros 16 dígitos hexadecimales de cada SHA-256, calculados en este navegador desde el archivo que sirve este sitio.')}</p>
          </div>
        );
      }}
    </Loaded>
  );
}

export const MODELS: Topic = {
  id: 'models',
  title: { en: 'Model registry', es: 'Registro de modelos' },
  paragraphs: [
    { en: 'Five trained models ship with OreFlow. Three come from the precompute\'s learning stage: the surrogate, a perceptron from the 22 standardized physical features to recovery, the logarithm of the upgrade ratio and specific energy, the guard, an autoencoder that reconstructs the same features and flags a state whose reconstruction error passes its threshold, and the Gaussian process that screens the optimizer\'s candidates (500 training states, run in float64 in the browser). The particle network is trained by the particle-lane script on the HZDR workbook, and the GeoMet checkpoint, which holds the three locked-cycle models the prediction command uses, by the GeoMet-lane script; the precompute reads their records.',
      es: 'Cinco modelos entrenados acompañan a OreFlow. Tres vienen de la etapa de aprendizaje del precálculo: el sustituto, un perceptrón desde las 22 variables físicas estandarizadas a la recuperación, el logaritmo de la razón de enriquecimiento y la energía específica, el guardia, un autoencoder que reconstruye las mismas variables y marca un estado cuyo error de reconstrucción pasa su umbral, y el proceso gaussiano que filtra los candidatos del optimizador (500 estados de entrenamiento, ejecutado en float64 en el navegador). La red de partículas la entrena el script de la vía de partículas con el libro HZDR, y el modelo guardado GeoMet, que guarda los tres modelos de ciclo cerrado que usa el comando de predicción, el script de la vía GeoMet; el precálculo lee sus registros.' },
    { en: 'The networks are exported to ONNX with a dynamic batch axis, and each export is run on the same inputs as the PyTorch network it came from: the record keeps the largest difference, which must stay under the declared tolerance of 1e-5. A companion document carries the scalers and the reference answers at every case\'s nominal state, which the browser test compares with onnxruntime-web\'s. The GeoMet checkpoint records the SHA-256 of its source file and is refused if the file on disk differs.',
      es: 'Las redes se exportan a ONNX con un eje de lote dinámico, y cada exportación se ejecuta con las mismas entradas que la red de PyTorch de la que vino: el registro guarda la mayor diferencia, que debe quedar bajo la tolerancia declarada de 1e-5. Un documento acompañante lleva los escaladores y las respuestas de referencia en el estado nominal de cada caso, que la prueba del navegador compara con las de onnxruntime-web. El modelo guardado GeoMet registra el SHA-256 de su archivo fuente y se rechaza si el archivo en disco difiere.' },
    { en: 'The table reads the learning and particle records, and computes the size and SHA-256 of each file this site serves, in the browser, from the bytes it received. A model that changed without a precompute would show a hash its release record does not name.',
      es: 'La tabla lee los registros de aprendizaje y de partículas, y calcula el tamaño y el SHA-256 de cada archivo que sirve este sitio, en el navegador, desde los bytes que recibió. Un modelo que cambiara sin un precálculo mostraría una huella que el registro de su versión no nombra.' },
  ],
  equations: [
    { tex: r`z = \frac{x - \mu_x}{\sigma_x},\qquad \hat y = \sigma_y\,f_\theta(z) + \mu_y`, caption: { en: 'The surrogate on standardized features, with the scalers the precompute wrote.', es: 'El sustituto sobre variables estandarizadas, con los escaladores que escribió el precálculo.' } },
    { tex: r`e(z) = \lVert z - g_\phi(z)\rVert^2 > q_{0.99}`, caption: { en: 'The guard flags a state whose reconstruction error e passes the 99th percentile q of its validation errors.', es: 'El guardia marca un estado cuyo error de reconstrucción e pasa el percentil 99 q de sus errores de validación.' } },
    { tex: r`\max\,\lvert \hat y_{\mathrm{ONNX}} - \hat y_{\mathrm{PyTorch}}\rvert \le 10^{-5}`, caption: { en: 'Each export against its network on the same inputs.', es: 'Cada exportación frente a su red con las mismas entradas.' } },
  ],
  limits: [
    { en: 'The surrogate and the guard learned engine states of authored plants; their leave-one-case-out scores bound what they can say about a new plant.', es: 'El sustituto y el guardia aprendieron estados del motor de plantas de autor; sus puntajes dejando un caso fuera acotan lo que pueden decir de una planta nueva.' },
    { en: 'A hash identifies the served bytes; the model\'s provenance is its record, written by the stage or the lane script that trained it.', es: 'Una huella identifica los bytes servidos; la procedencia del modelo es su registro, escrito por la etapa o el script de la vía que lo entrenó.' },
  ],
  figure: { caption: { en: 'Each exported model, the data it learned from and where it runs.', es: 'Cada modelo exportado, los datos de los que aprendió y dónde corre.' }, render: lang => <RegistryFigure lang={lang} />, wide: true },
  data: lang => <ModelRegistry lang={lang} />,
  refs: ['pytorch2019', 'onnx-web', 'hzdr', 'particle-paper'],
};

function GpuFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-gpu-arrow)';
  return (
    <svg className="fig-svg" viewBox="0 0 440 300" role="img" aria-label={p('Which trainings run on the GPU and how their exports are checked', 'Qué entrenamientos corren en la GPU y cómo se verifican sus exportaciones')}>
      <Arrow id="of-gpu-arrow" />
      <Box x={10} y={12} w={200} h={58} title={p('CPU: scikit-learn', 'CPU: scikit-learn')} lines={[p('ridge, forest, boosting,', 'ridge, bosque, boosting,'), p('Gaussian process', 'proceso gaussiano')]} />
      <Box x={230} y={12} w={200} h={58} title={p('GPU: PyTorch, CUDA', 'GPU: PyTorch, CUDA')} kind="accent" lines={[p('surrogate, guard;', 'sustituto, guardia;'), p('particle net (its script)', 'red de partículas (su script)')]} />
      <Box x={230} y={92} w={200} h={58} title={p('14 fits per process network', '14 ajustes por red de proceso')} lines={[p('interpolation, 12 folds,', 'interpolación, 12 particiones,'), p('then the final fit', 'luego el ajuste final')]} />
      <line className="dg-edge" x1={330} y1={70} x2={330} y2={90} markerEnd={arrow} />
      <Box x={230} y={172} w={200} h={44} title={p('ONNX export', 'Exportación ONNX')} lines={[p('checked against PyTorch', 'verificada frente a PyTorch')]} />
      <line className="dg-edge" x1={330} y1={150} x2={330} y2={170} markerEnd={arrow} />
      <Box x={230} y={238} w={200} h={44} title={p('Browser, WebAssembly', 'Navegador, WebAssembly')} kind="good" lines={[p('one thread, no GPU', 'un hilo, sin GPU')]} />
      <line className="dg-edge" x1={330} y1={216} x2={330} y2={236} markerEnd={arrow} />
      <Box x={10} y={92} w={200} h={58} title={p('The record keeps', 'El registro guarda')} lines={[p('the device, epochs run,', 'el dispositivo, épocas,'), p('best epoch, seconds', 'mejor época, segundos')]} />
    </svg>
  );
}

function GpuTable({ lang }: { lang: Lang }) {
  const learning = useArtifact(loadLearning);
  const particles = useArtifact(loadParticleBenchmark);
  const validation = useArtifact(loadValidation);
  const p = (en: string, es: string) => pick(lang, en, es);
  return (
    <Loaded lang={lang} errors={[learning.error, particles.error, validation.error]} ready={Boolean(learning.value && particles.value && validation.value)}>
      {() => {
        const L = learning.value!, P = particles.value!.protocol, V = validation.value!;
        const mlp = L.final.mlp_training as { device: string; epochs_run: number; best_epoch: number; best_validation_mse: number };
        const rows: Array<[string, string]> = [
          [p('Device of the surrogate\'s final fit', 'Dispositivo del ajuste final del sustituto'), mlp.device],
          [p('Epochs run, best epoch (surrogate)', 'Épocas corridas, mejor época (sustituto)'), `${mlp.epochs_run}, ${mlp.best_epoch}`],
          [p('Best validation MSE (surrogate, standardized)', 'Mejor MSE de validación (sustituto, estandarizado)'), formatSignificant(mlp.best_validation_mse, lang, 3)],
          [p('Learning rate, weight decay (AdamW)', 'Tasa de aprendizaje, decaimiento de pesos (AdamW)'), `${formatSignificant(Number(L.settings.mlp_learning_rate), lang, 2)}, ${formatSignificant(Number(L.settings.mlp_weight_decay), lang, 2)}`],
          [p('Epoch cap, early-stopping patience', 'Tope de épocas, paciencia de parada temprana'), `${String(L.settings.max_epochs)}, ${String(L.settings.patience)}`],
          [p('Particle network: device, PyTorch', 'Red de partículas: dispositivo, PyTorch'), `${P.device}, ${P.torch_version}`],
          [p('Learning stage of the committed precompute', 'Etapa de aprendizaje del precálculo versionado'), `${formatFixed(V.seconds.learning ?? L.seconds, lang, 0)} s`],
        ];
        return (
          <table className="of-doc-table of-doc-table-data"><tbody>{rows.map(([k, v]) => <tr key={k}><th scope="row" className="of-doc-soft">{k}</th><td>{v}</td></tr>)}</tbody></table>
        );
      }}
    </Loaded>
  );
}

export const GPU: Topic = {
  id: 'gpu',
  title: { en: 'The GPU lane', es: 'La vía GPU' },
  paragraphs: [
    { en: 'Only the networks train on the GPU. The learning stage fits ridge, the random forest, histogram gradient boosting and the Gaussian process with scikit-learn on the CPU, and the surrogate and the guard with PyTorch on CUDA when the machine has it; the particle-lane script fits the particle network the same way. Every record names the device it ran on, and a precompute on a machine without a GPU runs the same code on the CPU and says so.',
      es: 'Solo las redes se entrenan en la GPU. La etapa de aprendizaje ajusta ridge, el bosque aleatorio, gradient boosting de histograma y el proceso gaussiano con scikit-learn en la CPU, y el sustituto y el guardia con PyTorch en CUDA cuando la máquina la tiene; el script de la vía de partículas ajusta la red de partículas de la misma forma. Cada registro nombra el dispositivo en que corrió, y un precálculo en una máquina sin GPU ejecuta el mismo código en la CPU y lo dice.' },
    { en: 'The networks train full batch with AdamW: the design has at most 3072 rows and the networks a few thousand parameters, so one step over every row is cheap and the loss curve is deterministic for a given seed and device. Training stops when the validation loss has not improved for the declared patience, or at the epoch cap, and the weights of the best epoch are restored. The surrogate and the guard are each fitted 14 times: on the interpolation split, with each of the twelve cases held out, and once more on every state for the export; the surrogate is refitted at four more seeds on every split to measure its seed spread. The particle network is fitted once, on the HZDR training sheet.',
      es: 'Las redes se entrenan con lote completo y AdamW: el diseño tiene a lo más 3072 filas y las redes unos miles de parámetros, así que un paso sobre todas las filas es barato y la curva de pérdida es determinista para una semilla y un dispositivo dados. El entrenamiento se detiene cuando la pérdida de validación no mejora durante la paciencia declarada, o en el tope de épocas, y se restauran los pesos de la mejor época. El sustituto y el guardia se ajustan 14 veces cada uno: en la partición de interpolación, con cada uno de los doce casos reservado, y una vez más en todos los estados para la exportación; el sustituto se vuelve a ajustar con cuatro semillas más en cada partición para medir su dispersión entre semillas. La red de partículas se ajusta una vez, con la hoja de entrenamiento HZDR.' },
    { en: 'The GPU shortens the wall time; it does not change what the models can learn, and it makes bit-level reproduction depend on the device. The exports are therefore checked against their own networks on the same inputs, and the browser, which runs them on WebAssembly with one thread and no GPU, is held to the precompute\'s reference answers at every nominal state. The GPU environment is a separate one (requirements-gpu.txt pins the CUDA build of PyTorch, onnx and onnxruntime, and the table names the version the particle network trained with); a probe script prints the device before a precompute, and CI never trains.',
      es: 'La GPU acorta el tiempo; no cambia lo que los modelos pueden aprender, y hace que la reproducción bit a bit dependa del dispositivo. Por eso las exportaciones se verifican frente a sus propias redes con las mismas entradas, y el navegador, que las ejecuta sobre WebAssembly con un hilo y sin GPU, se sostiene a las respuestas de referencia del precálculo en cada estado nominal. El entorno GPU es uno aparte (requirements-gpu.txt fija la compilación CUDA de PyTorch, onnx y onnxruntime, y la tabla nombra la versión con que se entrenó la red de partículas); un script de prueba imprime el dispositivo antes de un precálculo, y CI nunca entrena.' },
  ],
  equations: [
    { tex: r`\theta_{t+1} = \theta_t - \eta\left(\frac{\hat m_t}{\sqrt{\hat v_t} + \epsilon} + \lambda\,\theta_t\right)`, caption: { en: 'AdamW: the Adam step with the weight decay λ applied to the weights directly (Loshchilov and Hutter 2019).', es: 'AdamW: el paso de Adam con el decaimiento de pesos λ aplicado directamente a los pesos (Loshchilov y Hutter 2019).' } },
    { tex: { en: r`t^{*} = \arg\min_{t \le T}\ L_{\mathrm{val}}(t),\qquad \text{stop at } t^{*} + P`, es: r`t^{*} = \arg\min_{t \le T}\ L_{\mathrm{val}}(t),\qquad \text{detener en } t^{*} + P` }, caption: { en: 'Early stopping: the best epoch t* by validation loss, with patience P and the cap T.', es: 'Parada temprana: la mejor época t* por pérdida de validación, con paciencia P y tope T.' } },
  ],
  limits: [
    { en: 'A precompute on another device gives numbers equal within round-off, not bit for bit; the release compares a new precompute with the committed records file by file before adopting it.', es: 'Un precálculo en otro dispositivo da números iguales al redondeo, no bit a bit; la publicación compara un precálculo nuevo con los registros versionados archivo por archivo antes de adoptarlo.' },
  ],
  figure: { caption: { en: 'Which trainings run on the GPU, how often, and how their exports reach the browser.', es: 'Qué entrenamientos corren en la GPU, cuántas veces, y cómo llegan sus exportaciones al navegador.' }, render: lang => <GpuFigure lang={lang} /> },
  data: lang => <GpuTable lang={lang} />,
  refs: ['pytorch2019', 'adamw2019', 'onnx-web'],
};

function DeployFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-deploy-arrow)';
  return (
    <svg className="fig-svg" viewBox="0 0 760 250" role="img" aria-label={p('From main to the two public hosts, and the checks from outside', 'Desde main a los dos hosts públicos, y las verificaciones desde fuera')}>
      <Arrow id="of-deploy-arrow" />
      <Box x={10} y={98} w={140} h={44} title="main" kind="accent" lines={[p('tagged release', 'versión etiquetada')]} />
      <line className="dg-edge" x1={150} y1={112} x2={196} y2={52} markerEnd={arrow} />
      <line className="dg-edge" x1={150} y1={128} x2={196} y2={188} markerEnd={arrow} />
      <Box x={200} y={22} w={290} h={58} title="GitHub Pages" lines={[p('static site under the project path', 'sitio estático en la ruta del proyecto'), p('a route file per page, a 404 fallback', 'una ruta por página, respaldo 404')]} />
      <Box x={200} y={160} w={290} h={72} title={p('VPS: setup-vps.sh', 'VPS: setup-vps.sh')} lines={[p('fast-forward, runtime, build,', 'avance, entorno, compilación,'), p('ownership, restart, TLS host,', 'propietario, reinicio, host TLS,'), p('local checks with retries', 'verificación local con reintentos')]} />
      <line className="dg-edge" x1={490} y1={51} x2={536} y2={112} markerEnd={arrow} />
      <line className="dg-edge" x1={490} y1={196} x2={536} y2={132} markerEnd={arrow} />
      <Box x={540} y={78} w={210} h={86} title={p('Checked from outside', 'Verificado desde fuera')} kind="good" lines={[p('health, catalog, benchmark,', 'salud, catálogo, benchmark,'), p('a simulation and a rejection,', 'una simulación y un rechazo,'), p('routes, certificate,', 'rutas, certificado,'), p('the browser gate', 'el control en navegador')]} />
    </svg>
  );
}

const HOSTS: Array<[{ en: string; es: string }, { en: string; es: string }, { en: string; es: string }]> = [
  [{ en: 'GitHub Pages', es: 'GitHub Pages' }, { en: 'the built site and the records, under the project path; the engine runs in the browser', es: 'el sitio compilado y los registros, bajo la ruta del proyecto; el motor corre en el navegador' }, { en: 'the Pages workflow on every push to main', es: 'el flujo de Pages en cada push a main' }],
  [{ en: 'oreflow.ml.fasl-work.com', es: 'oreflow.ml.fasl-work.com' }, { en: 'the same site and records, and the Python engine behind the contract: /healthz, /api/cases, /api/benchmark, POST /api/simulate', es: 'el mismo sitio y registros, y el motor en Python tras el contrato: /healthz, /api/cases, /api/benchmark, POST /api/simulate' }, { en: 'deploy/setup-vps.sh, run as root from a copy outside the checkout', es: 'deploy/setup-vps.sh, ejecutado como root desde una copia fuera del repositorio' }],
];

export const DEPLOY: Topic = {
  id: 'deploy',
  title: { en: 'Deployment', es: 'Despliegue' },
  paragraphs: [
    { en: 'A release is built twice from the same tagged commit. GitHub Pages serves the static site under the project path, with a route file for every page and a fallback for deep links, and the engine runs in the visitor\'s browser. The VPS serves the same site and records from a FastAPI service behind nginx with TLS, and adds the Python engine behind the same contract, so a state can also be simulated by the service. The service never trains and never writes an artifact.',
      es: 'Una versión se compila dos veces desde el mismo commit etiquetado. GitHub Pages sirve el sitio estático bajo la ruta del proyecto, con un archivo de ruta para cada página y un respaldo para enlaces profundos, y el motor corre en el navegador del visitante. El VPS sirve el mismo sitio y registros desde un servicio FastAPI tras nginx con TLS, y agrega el motor en Python tras el mismo contrato, así que un estado también puede simularse en el servicio. El servicio nunca entrena ni escribe un artefacto.' },
    { en: 'One script installs the VPS and updates it. It installs only the packages that are missing, because installing one that is present upgrades it and nginx serves the host\'s other sites; it fast-forwards main, builds the environment and the site, and returns them to the service user after they are made; it restarts the running service, which enabling alone would leave on its old code; once the certificate exists it installs the TLS virtual host directly; and it checks the health and the catalog on the local port, retrying while the restarted port refuses connections. It runs from a copy outside the checkout, so its own fast-forward cannot rewrite the file the shell is reading.',
      es: 'Un script instala el VPS y lo actualiza. Instala solo los paquetes que faltan, porque instalar uno presente lo actualiza y nginx sirve los otros sitios del host; avanza main, construye el entorno y el sitio, y los devuelve al usuario del servicio después de crearlos; reinicia el servicio en marcha, que solo habilitarlo dejaría con su código viejo; cuando el certificado existe instala directamente el host virtual TLS; y verifica la salud y el catálogo en el puerto local, reintentando mientras el puerto reiniciado rechaza conexiones. Corre desde una copia fuera del repositorio, para que su propio avance no reescriba el archivo que la consola está leyendo.' },
    { en: 'A release is checked from outside the machine that built it, on the public names, after both hosts serve the same commit: the health route reports the new version, the catalog and the benchmark carry the same contract digest, a simulation matches the precompute and a state outside the contract is rejected with its code, every page answers with and without its trailing slash, the certificate names the host, and the browser gate runs against each public host with its screenshots read.',
      es: 'Una versión se verifica desde fuera de la máquina que la compiló, en los nombres públicos, cuando ambos hosts sirven el mismo commit: la ruta de salud informa la nueva versión, el catálogo y el benchmark llevan la misma huella de contrato, una simulación coincide con el precálculo y un estado fuera del contrato se rechaza con su código, cada página responde con y sin su barra final, el certificado nombra el host, y el control en navegador corre contra cada host público con sus capturas leídas.' },
  ],
  table: {
    head: [{ en: 'Host', es: 'Host' }, { en: 'What it serves', es: 'Qué sirve' }, { en: 'How it is updated', es: 'Cómo se actualiza' }],
    rows: HOSTS,
    wrap: [1, 2],
  },
  limits: [
    { en: 'No uptime monitor is claimed: a host is known to be up when a release check or a visitor reaches it.', es: 'No se afirma un monitor de disponibilidad: se sabe que un host está en línea cuando una verificación de versión o un visitante llega a él.' },
  ],
  figure: { caption: { en: 'From the tagged release on main to the two public hosts, and the checks made from outside.', es: 'Desde la versión etiquetada en main a los dos hosts públicos, y las verificaciones hechas desde fuera.' }, render: lang => <DeployFigure lang={lang} />, wide: true },
  refs: [],
};
