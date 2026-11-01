/** Read-only evidence from the validated learning-v2 producer boundary. */
import type { LearningRecord } from '../../generated/oreflow-learning-v2';
import type { Lang } from '../../lib/format';
import { formatFixed, formatFraction } from '../../lib/format';
import { formatFoldCounts, formatLearningMetric, formatScore, LEARNING_MODELS, LEARNING_TARGETS, LEARNING_TEXT as TEXT } from '../../learning/evidence';
import { transferFoldEvidence } from '../../contracts/learning-evidence';

export function LearningEvidence({ record, lang, target, foldNames = {} }: {
  record: LearningRecord; lang: Lang; target: string; foldNames?: Record<string, string>;
}) {
  const name = (id: string) => foldNames[id] ?? id;
  const protocols = [
    { id: 'leave_one_case_out' as const, prefix: 'loco' as const, title: TEXT.loco[lang], folds: record.leave_one_case_out.map(f => ({ id: f.held_out, models: f.models, flagRate: f.held_out_flag_rate })) },
    { id: 'transfer' as const, prefix: 'transfer' as const, title: TEXT.transfer[lang], folds: transferFoldEvidence(record) },
  ];
  const modelName = (id: string) => LEARNING_MODELS[id]?.[lang] ?? id;
  return (
    <section className="of-doc-panel of-learning-evidence" aria-label={`${TEXT.conditional[lang]}: ${LEARNING_TARGETS[target]?.[lang] ?? target}`}>
      <h4>{LEARNING_TARGETS[target]?.[lang] ?? target}</h4>
      <p>{TEXT.definition[lang]}</p>
      {protocols.map(protocol => {
        const cohort = record.common_cohorts[protocol.id][target];
        return <section key={protocol.id} aria-label={protocol.title}>
          <div className="of-doc-scroll">
            <table className="of-doc-table of-doc-table-data">
              <caption>{`${protocol.title}: ${TEXT.conditional[lang]}`}</caption>
              <thead><tr><th scope="col">{TEXT.model[lang]}</th><th scope="col">R²</th><th scope="col">RMSE</th><th scope="col">{lang === 'en' ? 'Planned coverage' : 'Cobertura prevista'}</th></tr></thead>
              <tbody>{record.models.map(model => {
                const summary = record.summary[model][target];
                return <tr key={model}><th scope="row">{modelName(model)}</th>
                  <td>{formatLearningMetric(protocol.prefix === 'loco' ? summary.loco_r2_median : summary.transfer_r2_median, lang)}</td>
                  <td>{formatLearningMetric(protocol.prefix === 'loco' ? summary.loco_rmse_mean : summary.transfer_rmse_mean, lang)}</td>
                  <td className="of-doc-soft">{formatFoldCounts(summary[`${protocol.prefix}_folds`], lang)}</td></tr>;
              })}</tbody>
            </table>
          </div>
          <div className="of-doc-scroll">
            <table className="of-doc-table of-doc-table-data">
              <caption>{`${TEXT.common[lang]}: ${formatFixed(cohort.folds.length, lang, 0)} / ${formatFixed(cohort.attempted, lang, 0)}`}</caption>
              <thead><tr><th scope="col">{TEXT.model[lang]}</th><th scope="col">R²</th><th scope="col">RMSE</th></tr></thead>
              <tbody>{record.models.map(model => <tr key={model}><th scope="row">{modelName(model)}</th>
                <td>{formatLearningMetric(cohort.models[model].r2_median, lang)}</td><td>{formatLearningMetric(cohort.models[model].rmse_mean, lang)}</td></tr>)}</tbody>
            </table>
          </div>
          {cohort.folds.length === 0 ? <p role="status">{TEXT.empty[lang]}</p>
            : <p>{`${TEXT.common[lang]}: ${cohort.folds.map(name).join(', ')}.`}</p>}
          <p>{`${TEXT.excluded[lang]}: ${cohort.excluded.length ? cohort.excluded.map(name).join(', ') : TEXT.none[lang]}.`}</p>
          {protocol.folds.length > 0 && <div className="of-doc-scroll">
            <table className="of-doc-table of-doc-table-data">
              <caption>{`${protocol.title}: R²`}</caption>
              <thead><tr><th scope="col">{TEXT.fold[lang]}</th><th scope="col">{lang === 'en' ? 'Guard flags' : 'Alertas del detector'}</th>{record.models.map(model => <th scope="col" key={model}>{modelName(model)}</th>)}</tr></thead>
              <tbody>{protocol.folds.map(fold => <tr key={fold.id}><th scope="row" className="of-doc-soft">{name(fold.id)}</th>
                <td>{formatFraction(fold.flagRate, lang, 0)}</td>
                {record.models.map(model => <td key={model} className="of-doc-soft">{formatScore(fold.models[model][target], 'r2', lang)}</td>)}</tr>)}</tbody>
            </table>
          </div>}
        </section>;
      })}
      <div className="of-doc-scroll">
        <table className="of-doc-table of-doc-table-data">
          <caption>{`${TEXT.interpolation[lang]}: R²`}</caption>
          <thead><tr><th scope="col">{TEXT.model[lang]}</th><th scope="col">R²</th><th scope="col">{lang === 'en' ? 'Within-case R²' : 'R² dentro de cada caso'}</th></tr></thead>
          <tbody>{record.models.map(model => <tr key={model}><th scope="row">{modelName(model)}</th><td>{formatLearningMetric(record.summary[model][target].interpolation_r2, lang)}</td>
            <td>{formatLearningMetric(record.interpolation.models[model][target].r2_within_case, lang)}</td></tr>)}</tbody>
        </table>
      </div>
      <p>{`${lang === 'en' ? 'Case-mean baseline R²' : 'R² de la referencia de media por caso'}: ${formatScore(record.interpolation.case_mean_baseline[target], 'r2', lang)}. `}
        {`${lang === 'en' ? 'Gaussian-process interpolation interval coverage' : 'Cobertura de intervalos del proceso gaussiano en interpolación'}: ${formatFraction(record.interpolation.models.gaussian_process[target].coverage_95, lang, 1)}.`}</p>
      <p>{lang === 'en' ? 'Gaussian-process interval coverage with one case out (conditional pooled / worst fold): ' : 'Cobertura de intervalos del proceso gaussiano con un caso fuera (agrupada condicional / peor partición): '}
        {[record.summary.gaussian_process[target].loco_coverage_pooled, record.summary.gaussian_process[target].loco_coverage_worst]
          .map(value => value == null ? TEXT.unavailable[lang] : formatFraction(value, lang, 1)).join(' / ')}</p>
      <div className="of-doc-scroll">
        <table className="of-doc-table of-doc-table-data">
          <caption>{lang === 'en' ? 'MLP seed stability: conditional one-case-out metrics' : 'Estabilidad del MLP entre semillas: métricas condicionales con un caso fuera'}</caption>
          <thead><tr><th scope="col">{TEXT.seed[lang]}</th><th scope="col">R²</th><th scope="col">RMSE</th><th scope="col">{lang === 'en' ? 'Planned coverage' : 'Cobertura prevista'}</th></tr></thead>
          <tbody>{record.mlp_seeds.seeds.map((seed, i) => <tr key={seed}><th scope="row">{formatFixed(seed, lang, 0)}</th>
            <td>{formatLearningMetric(record.mlp_seeds.summary[target].loco_r2_median[i], lang)}</td>
            <td>{formatLearningMetric(record.mlp_seeds.summary[target].loco_rmse_mean[i], lang)}</td>
            <td className="of-doc-soft">{formatFoldCounts(record.mlp_seeds.summary[target].loco_folds[i], lang)}</td></tr>)}</tbody>
        </table>
      </div>
      <details>
        <summary>{lang === 'en' ? 'MLP scores and rejection diagnostics by fold and seed' : 'Puntuaciones y diagnósticos de rechazo del MLP por partición y semilla'}</summary>
        <div className="of-doc-scroll"><table className="of-doc-table of-doc-table-data">
          <caption>{`${TEXT.loco[lang]} / ${TEXT.interpolation[lang]}: R²`}</caption>
          <thead><tr><th scope="col">{TEXT.fold[lang]}</th>{record.mlp_seeds.seeds.map(seed => <th scope="col" key={seed}>{`${TEXT.seed[lang]} ${formatFixed(seed, lang, 0)}`}</th>)}</tr></thead>
          <tbody>{Object.entries(record.mlp_seeds.scores).map(([split, targets]) => <tr key={split}>
            <th scope="row" className="of-doc-soft">{split === 'interpolation' ? TEXT.interpolation[lang] : name(split)}</th>
            {targets[target].map((score, index) => <td className="of-doc-soft" key={record.mlp_seeds.seeds[index]}>{formatScore(score, 'r2', lang)}</td>)}
          </tr>)}</tbody>
        </table></div>
      </details>
    </section>
  );
}
