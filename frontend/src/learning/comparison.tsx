import { useState } from 'react';
import type uPlot from 'uplot';
import { Chart } from '../components/charts/Chart';
import type { LearningRecord } from '../generated/oreflow-learning-v2';
import { formatFixed, type Lang } from '../lib/format';
import { formatFoldCounts, formatLearningMetric, learningSeries, LEARNING_MODELS, LEARNING_TARGETS, LEARNING_TEXT as TEXT } from './evidence';

export function LearningComparison({ record, lang }: { record: LearningRecord; lang: Lang }) {
  const [target, setTarget] = useState('recovery_pct');
  const [protocol, setProtocol] = useState<'leave_one_case_out' | 'transfer'>('transfer');
  const [comparison, setComparison] = useState<'conditional' | 'common'>('common');
  const [reading, setReading] = useState<string | null>(null);
  const interp = learningSeries(record, target, 'interpolation', comparison);
  const heldOut = learningSeries(record, target, protocol, comparison);
  const label = comparison === 'common' ? TEXT.common[lang] : TEXT.conditional[lang];
  const cohort = record.common_cohorts[protocol][target];
  const counts = record.models.map(model => `${LEARNING_MODELS[model]?.[lang] ?? model}: ${formatFoldCounts(record.summary[model][target][protocol === 'transfer' ? 'transfer_folds' : 'loco_folds'], lang)}`).join('; ');
  const summary = `${TEXT.gap[lang]} ${label}. ${counts}.`;
  return <div className="of-doc-panel">
    <label className="of-doc-control"><span>{TEXT.target[lang]}</span><select value={target} onChange={e => setTarget(e.target.value)}>
      {record.targets.map(id => <option key={id} value={id}>{LEARNING_TARGETS[id]?.[lang] ?? id}</option>)}
    </select></label>
    <label className="of-doc-control"><span>{lang === 'en' ? 'Protocol' : 'Protocolo'}</span><select value={protocol} onChange={e => setProtocol(e.target.value === 'transfer' ? 'transfer' : 'leave_one_case_out')}>
      <option value="transfer">{TEXT.transfer[lang]}</option><option value="leave_one_case_out">{TEXT.loco[lang]}</option>
    </select></label>
    <label className="of-doc-control"><span>{lang === 'en' ? 'Comparison' : 'Comparación'}</span><select value={comparison} onChange={e => setComparison(e.target.value === 'common' ? 'common' : 'conditional')}>
      <option value="common">{TEXT.common[lang]}</option><option value="conditional">{TEXT.conditional[lang]}</option>
    </select></label>
    <p>{TEXT.definition[lang]}</p>
    {comparison === 'common' && <p>{cohort.folds.length ? `${TEXT.common[lang]}: ${formatFixed(cohort.folds.length, lang, 0)} / ${formatFixed(cohort.attempted, lang, 0)}` : TEXT.empty[lang]}</p>}
    <div className="of-doc-chart of-learning-comparison-chart">
      <Chart data={[record.models.map((_, i) => i), interp, heldOut] as uPlot.AlignedData}
        categories={record.models.map(model => LEARNING_MODELS[model]?.[lang] ?? model)}
        xLabel={TEXT.model[lang]} yLabel="R²" title={`${TEXT.interpolation[lang]} / ${label}`} summary={summary}
        series={[{ label: TEXT.interpolation[lang], colour: 'accent', bars: true, align: -1 }, { label, colour: 'warn', bars: true, align: 1 }]}
        levels={[{ y: 0, label: '0' }]} format={(v, axis) => axis === 'x' ? '' : formatFixed(v, lang, 3)}
        onCursor={cursor => setReading(cursor ? `${LEARNING_MODELS[record.models[cursor.index]]?.[lang] ?? record.models[cursor.index]}: ${TEXT.interpolation[lang]} ${formatLearningMetric(interp[cursor.index], lang)}, ${label} ${formatLearningMetric(heldOut[cursor.index], lang)}` : null)} />
    </div>
    <p className="of-doc-reading" aria-live="polite">{reading ?? TEXT.gap[lang]}</p>
    <p>{counts}</p>
  </div>;
}
