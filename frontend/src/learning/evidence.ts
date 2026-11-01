/** Presentation of generated learning evidence. Null is unavailable, never zero. */
import type { FoldCounts, LearningRecord, TargetScores } from '../generated/oreflow-learning-v2';
import { formatFixed, formatSignificant, type Lang } from '../lib/format';

export const LEARNING_TEXT = {
  conditional: { en: 'Conditional performance', es: 'Rendimiento condicional' },
  definition: { en: 'Conditional metrics use admissible scored folds only. Rejected attempts remain in the planned denominator. Compare models on matched common folds; a smaller conditional error alone does not establish a better model.', es: 'Las métricas condicionales usan solo particiones admisibles evaluadas. Los intentos rechazados siguen en el total previsto. Compare modelos sobre las mismas particiones comunes; un error condicional menor por sí solo no demuestra que un modelo sea mejor.' },
  common: { en: 'Matched common folds', es: 'Particiones comunes entre modelos' },
  empty: { en: 'No common admissible folds. Model comparison is unavailable.', es: 'No hay particiones admisibles comunes. La comparación entre modelos no está disponible.' },
  gap: { en: 'Unavailable and rejected results leave gaps in the plot; counts and rejection diagnostics are shown in the tables.', es: 'Los resultados no disponibles y rechazados dejan huecos en el gráfico; las tablas muestran los recuentos y los diagnósticos de rechazo.' },
  unavailable: { en: 'Unavailable', es: 'No disponible' },
  rejected: { en: 'Rejected', es: 'Rechazado' },
  scored: { en: 'Scored', es: 'Evaluado' },
  model: { en: 'Model', es: 'Modelo' },
  loco: { en: 'One case out', es: 'Un caso fuera' },
  transfer: { en: 'One ore group out', es: 'Un grupo de mineral fuera' },
  interpolation: { en: 'Interpolation', es: 'Interpolación' },
  excluded: { en: 'Excluded folds', es: 'Particiones excluidas' },
  none: { en: 'None', es: 'Ninguna' },
  fold: { en: 'Held-out fold', es: 'Partición reservada' },
  seed: { en: 'Training seed', es: 'Semilla de entrenamiento' },
  target: { en: 'Target', es: 'Objetivo' },
};

export const LEARNING_MODELS: Record<string, Record<Lang, string>> = {
  ridge: { en: 'Ridge', es: 'Ridge' },
  random_forest: { en: 'Random forest', es: 'Bosque aleatorio' },
  hist_gradient_boosting: { en: 'Gradient boosting', es: 'Potenciación por gradiente' },
  gaussian_process: { en: 'Gaussian process', es: 'Proceso gaussiano' },
  mlp: { en: 'MLP', es: 'MLP' },
};
export const LEARNING_TARGETS: Record<string, Record<Lang, string>> = {
  recovery_pct: { en: 'Recovery (percentage points)', es: 'Recuperación (puntos porcentuales)' },
  log_upgrade: { en: 'Log upgrade ratio', es: 'Log de la razón de enriquecimiento' },
  specific_energy_total_kwh_t: { en: 'Specific energy (kWh/t)', es: 'Energía específica (kWh/t)' },
};

export const formatLearningMetric = (value: number | null | undefined, lang: Lang): string =>
  value == null ? LEARNING_TEXT.unavailable[lang] : formatSignificant(value, lang, 3, true);

export function formatFoldCounts(counts: FoldCounts, lang: Lang): string {
  const n = (value: number) => formatFixed(value, lang, 0);
  return lang === 'en' ? `${n(counts.attempted)} planned / ${n(counts.scored)} scored / ${n(counts.rejected)} rejected`
    : `${n(counts.attempted)} previstas / ${n(counts.scored)} evaluadas / ${n(counts.rejected)} rechazadas`;
}

export function formatScore(score: TargetScores, metric: 'rmse' | 'mae' | 'r2', lang: Lang): string {
  if (score.status === 'scored') return formatLearningMetric(score[metric], lang);
  const diagnostic = [score.observable, ...Object.values(score.observable_by_case ?? {})].find(d => d.status === 'rejected-outside-range') ?? score.observable;
  const range = (values: number[]) => `[${values.map(v => formatSignificant(v, lang, 4)).join('; ')}]`;
  return lang === 'en'
    ? `Rejected: prediction range ${range(diagnostic.prediction_range)} outside allowed envelope ${range(diagnostic.allowed_range)} (${formatFixed(score.rejection.affected_rows, lang, 0)} rows).`
    : `Rechazado: rango de predicción ${range(diagnostic.prediction_range)} fuera de la envolvente admisible ${range(diagnostic.allowed_range)} (${formatFixed(score.rejection.affected_rows, lang, 0)} filas).`;
}

export function learningSeries(record: LearningRecord, target: string, protocol: 'interpolation' | 'leave_one_case_out' | 'transfer', comparison: 'conditional' | 'common'): Array<number | null> {
  return record.models.map(model => {
    if (protocol === 'interpolation') return record.summary[model][target].interpolation_r2;
    if (comparison === 'common') return record.common_cohorts[protocol][target].models[model].r2_median;
    const summary = record.summary[model][target];
    return protocol === 'transfer' ? summary.transfer_r2_median : summary.loco_r2_median;
  });
}
