import { useEffect, useRef, useState } from 'react';
import { Cite, Refs, useShellLang } from '@fasl-work/caos-app-shell';
import { loadParticleBenchmark, type ParticleBenchmark } from '../api/artifacts';
import { PageHeading } from '../content/Research';
import { APP_VERSION } from '../lib/version';

const CONTROLS = [
  { id: 'aspect', index: 0, en: 'Aspect-ratio feature', es: 'Variable de razón de aspecto', min: -1.8, max: 0, step: 0.01 },
  { id: 'solidity', index: 1, en: 'Solidity feature', es: 'Variable de solidez', min: -0.35, max: 0.3, step: 0.01 },
  { id: 'ecd', index: 2, en: 'ECD feature', es: 'Variable ECD', min: 0.8, max: 4.1, step: 0.01 },
] as const;
type Session = import('onnxruntime-web').InferenceSession;

export default function ParticleInference() {
  const es = useShellLang() === 'es';
  const [data, setData] = useState<ParticleBenchmark | null>(null);
  const [values, setValues] = useState<number[]>([-0.44, -0.01, 2.21, 0]);
  const [prediction, setPrediction] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const session = useRef<Session | null>(null);
  useEffect(() => { loadParticleBenchmark().then(setData).catch(e => setError(String(e))); }, []);
  const update = (index: number, value: number) => {
    setValues(old => old.map((item, i) => i === index ? value : item));
    setPrediction(null);
  };
  async function run() {
    if (!data || busy) return;
    setBusy(true); setError('');
    try {
      const ort = await import('onnxruntime-web/wasm');
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;
      session.current ??= await ort.InferenceSession.create(`${import.meta.env.BASE_URL}models/particle_mlp.onnx?v=${encodeURIComponent(APP_VERSION)}`, { executionProviders: ['wasm'] });
      const normalized = values.map((value, i) => (value - data.standardization.mean[i]) / data.standardization.scale[i]);
      const outputs = await session.current.run({ features: new ort.Tensor('float32', Float32Array.from(normalized), [1, 4]) });
      const logits = Array.from(outputs.logits.data as Float32Array);
      if (logits.length !== 4 || logits.some(value => !Number.isFinite(value))) throw new Error('Invalid ONNX output');
      setPrediction(logits.map(value => 1 / (1 + Math.exp(-value)))); // not-engine: the particle classifier's logistic link
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      session.current = null;
    } finally {
      setBusy(false);
    }
  }
  return <div className="of-particle-inference">
    <PageHeading title={['Run the particle model locally', 'Ejecute el modelo de partículas localmente']} lede={[
      'Adjust four workbook feature values and evaluate the committed PyTorch model through ONNX Runtime Web. This is actual inference in your browser; no server performs the calculation. The outputs are Class B probabilities for four constructed separation cases, not production set-points.',
      'Ajuste cuatro variables del libro y evalúe el modelo PyTorch confirmado mediante ONNX Runtime Web. La inferencia ocurre en su navegador, sin cálculo en servidor. Las salidas son probabilidades de clase B para cuatro casos construidos, no consignas de producción.',
    ]} />
    <div className="of-inference-grid">
      <section className="of-inference-controls">
        <span className="of-kicker">01 / {es ? 'PARTÍCULA' : 'PARTICLE'}</span>
        <h2>{es ? 'Vector de entrada' : 'Input vector'}</h2>
        <p>{es ? 'Los intervalos muestran aproximadamente los percentiles 1 a 99 de entrenamiento; se usan las variables numéricas tal como figuran en el libro, sin inferir unidades físicas no documentadas.' : 'Ranges approximately cover training percentiles 1–99. Numeric features are used as recorded in the workbook; undocumented physical units are not inferred.'}</p>
        {CONTROLS.map(control => <label key={control.id}>
          <span>{es ? control.es : control.en}<output>{values[control.index].toFixed(2)}</output></span>
          <input type="range" min={control.min} max={control.max} step={control.step} value={values[control.index]} onChange={event => update(control.index, Number(event.target.value))} />
        </label>)}
        <label><span>{es ? 'Superficie de mineral 1' : 'Mineral-1 surface'}</span><select value={values[3]} onChange={event => update(3, Number(event.target.value))}><option value={0}>0</option><option value={1}>1</option></select></label>
        <button type="button" className="of-inference-run" onClick={run} disabled={!data || busy}>{busy ? (es ? 'Calculando…' : 'Calculating…') : (es ? 'Ejecutar ONNX local' : 'Run local ONNX inference')}</button>
        {error && <p role="alert" className="of-error">{error}</p>}
      </section>
      <section className="of-inference-results" aria-live="polite">
        <span className="of-kicker">02 / {es ? 'PROBABILIDADES CONSTRUIDAS' : 'CONSTRUCTED PROBABILITIES'}</span>
        <h2>{es ? 'Respuesta del modelo' : 'Model response'}</h2>
        {prediction ? prediction.map((value, i) => <div className="of-inference-result" key={i}><div><span>{es ? 'Caso de separación' : 'Separation case'} {i + 1}</span><strong>{(value * 100).toFixed(1)}%</strong></div><div className="of-balance-track"><i style={{ width: `${value * 100}%` }} /></div></div>) : <p className="of-inference-empty">{es ? 'Ajuste la partícula y ejecute el modelo para obtener cuatro probabilidades calculadas.' : 'Adjust the particle and run the model to obtain four calculated probabilities.'}</p>}
        <p className="of-inference-boundary">{es ? 'Insumo de entrenamiento: clases A/B de 68.008 filas HZDR. Evaluación: probabilidad construida en la hoja separada de 29.147 filas. La inferencia no predice mineralurgia de una mina.' : 'Training input: A/B classes from 68,008 HZDR rows. Evaluation: constructed probabilities on a separate 29,147-row test sheet. This inference does not predict mine metallurgy.'} <Cite id="hzdr" /> <Cite id="onnx" /></p>
      </section>
    </div>
    <Refs ids={['hzdr', 'particle-paper', 'onnx']} label={es ? 'Referencias' : 'References'} />
  </div>;
}
