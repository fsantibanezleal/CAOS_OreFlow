/** Workbench evidence accompanies the existing live surrogate instrument. */
import type { ComponentProps } from 'react';
import { Learned } from './methods/Learned';
import { LearningEvidence } from '../../content/implementation/learned';
import { loadIndex, loadLearning } from '../../lib/artifacts';
import { Loaded, useArtifact } from '../../content/data';
import { formatFoldCounts, LEARNING_TARGETS, LEARNING_TEXT } from '../../learning/evidence';

export function LearningView(props: Omit<ComponentProps<typeof Learned>, 'learning' | 'evidence'>) {
  const learning = useArtifact(loadLearning);
  const index = useArtifact(loadIndex);
  const foldNames = Object.fromEntries((index.value?.cases ?? []).map(entry => [entry.case_id, entry.title[props.lang]]));
  return <Learned {...props} learning={learning.value} evidence={<>
    <p className="of-footnote">{LEARNING_TEXT.definition[props.lang]}</p>
    <details>
      <summary>{props.lang === 'en' ? 'Full evaluation evidence (all three targets)' : 'Evidencia completa de evaluación (los tres objetivos)'}</summary>
      <Loaded lang={props.lang} errors={[learning.error, index.error]} ready={Boolean(learning.value && index.value)}>{() => <>
        <dl className="of-facts">{learning.value!.targets.map(id => <div key={id} className="of-facts-wide">
          <dt>{`MLP: ${LEARNING_TARGETS[id]?.[props.lang] ?? id}`}</dt><dd>{`${LEARNING_TEXT.loco[props.lang]}: ${formatFoldCounts(learning.value!.summary.mlp[id].loco_folds, props.lang)}. ${LEARNING_TEXT.transfer[props.lang]}: ${formatFoldCounts(learning.value!.summary.mlp[id].transfer_folds, props.lang)}.`}</dd>
        </div>)}</dl>
        {learning.value!.targets.map(target => <LearningEvidence key={target} record={learning.value!} target={target} lang={props.lang} foldNames={foldNames} />)}
      </>}</Loaded>
    </details>
  </>} />;
}
