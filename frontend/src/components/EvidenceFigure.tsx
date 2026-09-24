import { useEffect, useState } from 'react';
import { loadBenchmark, loadIndex, loadMethodMatrix, type MethodMatrix } from '../api/artifacts';
import { localizedCase } from '../lib/locale';
import type { Benchmark, CaseIndex } from '../lib/contract.types';

export default function EvidenceFigure({ name, es }: { name: string; es: boolean }) {
  const [index, setIndex] = useState<CaseIndex | null>(null);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [matrix, setMatrix] = useState<MethodMatrix | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([loadIndex(), loadBenchmark(), name === 'coverage-matrix' ? loadMethodMatrix() : Promise.resolve(null)]).then(([i, b, m]) => {
      if (active) { setIndex(i); setBenchmark(b); setMatrix(m); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  if (error) return <div role="alert">{es ? 'No se pudo cargar la evidencia.' : 'Evidence could not be loaded.'}</div>;
  if (!index || !benchmark || (name === 'coverage-matrix' && !matrix)) return <div role="status">{es ? 'Cargando evidencia…' : 'Loading evidence…'}</div>;

  if (name === 'coverage-matrix') {
    const codes: Record<string, string> = { rittinger: 'RIT', kick: 'KIC', bond: 'BON', whiten: 'WHI', pbm: 'PBM', partition: 'PAR', plitt: 'PLI', gravity_window: 'GRV', lims_capture: 'MAG', first_order: '1ST', kelsall: 'KEL', compressed_exponential: 'CEX', mass_balance: 'BAL', constrained_opt: 'OPT', robust_mc: 'MC', ridge: 'RID', random_forest: 'RF', hist_gradient_boosting: 'HGB', gaussian_process: 'GP', mlp: 'MLP', autoencoder: 'AE' };
    const methods = matrix!.methods;
    return <figure className="of-evidence-figure">
      <figcaption><strong>{es ? 'Aplicabilidad por circuito' : 'Method applicability by circuit'}</strong><span>{index.n_cases} {es ? 'casos' : 'cases'} · {benchmark.method_count} {es ? 'métodos' : 'methods'}</span></figcaption>
      <div className="of-coverage-scroll"><div className="of-coverage-matrix">
        <div className="of-coverage-matrix-row of-coverage-header"><span>{es ? 'Caso / método' : 'Case / method'}</span><div>{methods.map(method => <abbr key={method.id} title={method.name}>{codes[method.id] ?? method.id.slice(0, 3).toUpperCase()}</abbr>)}</div></div>
        {index.cases.map((entry, row) => <div className="of-coverage-matrix-row" key={entry.case_id}>
          <span title={entry.title}>{String(row + 1).padStart(2, '0')} {localizedCase(entry.case_id, entry.title, es)}</span>
          <div>{methods.map(method => {
            const record = matrix!.rows.find(item => item.case_id === entry.case_id && item.variant_id === 'nominal' && item.method_id === method.id);
            const status = record?.status ?? 'unavailable';
            return <i key={method.id} className={status === 'precomputed' ? 'covered' : status === 'not-applicable' ? 'inapplicable' : 'unavailable'} role="img" aria-label={`${method.name}: ${status}`} title={`${entry.title} · ${method.name} · ${status}`} />;
          })}</div>
        </div>)}
      </div></div>
      <div className="of-coverage-legend"><span><i className="covered" />{es ? 'Calculado' : 'Computed'}</span><span><i className="inapplicable" />{es ? 'No aplica' : 'Not applicable'}</span><span><i className="unavailable" />{es ? 'No disponible' : 'Unavailable'}</span></div>
      <p>{es ? 'El estado corresponde a la variante nominal de cada caso; las seis variantes conservan el mismo registro de aplicabilidad. Pase sobre una celda para ver el método. No son mediciones de planta.' : 'Status is shown for each nominal case; all six variants retain the same applicability registry. Hover a cell for its method. These are not plant measurements.'}</p>
    </figure>;
  }

  const models = Object.entries(benchmark.evaluation.models).filter(([, record]) => record.rmse_pct_points != null);
  const max = Math.max(...models.map(([, record]) => record.rmse_pct_points ?? 0), 0.01);
  const names: Record<string, string> = { ridge: 'Ridge', random_forest: es ? 'Bosque aleatorio' : 'Random forest', hist_gradient_boosting: 'Gradient boosting', gaussian_process: es ? 'Proceso gaussiano' : 'Gaussian process', mlp: 'PyTorch MLP' };
  return <figure className="of-evidence-figure">
    <figcaption><strong>{es ? 'Error de sustitutos' : 'Surrogate error'}</strong><span>n = {benchmark.evaluation.n_holdout}</span></figcaption>
    <div className="of-error-bars">{models.map(([id, record]) => <div className="of-error-bar-row" key={id}>
      <span>{names[id] ?? id}</span><div><i style={{ width: `${100 * (record.rmse_pct_points ?? 0) / max}%` }} /></div><strong>{record.rmse_pct_points?.toFixed(2)} pp</strong>
    </div>)}</div>
    <p>{es ? 'RMSE, perturbaciones reservadas del mismo simulador. Menor es mejor; no prueba transferencia a otra mina.' : 'RMSE on held-out perturbations of the same simulator. Lower is better; this does not test transfer to another mine.'}</p>
  </figure>;
}
