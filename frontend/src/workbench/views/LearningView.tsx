/** Workbench evidence accompanies the existing live surrogate instrument. */
import type { ComponentProps } from 'react';
import { Learned } from './methods/Learned';
import { LearningEvidence } from '../../content/implementation/learned';
import { loadLearning } from '../../lib/artifacts';
import { Loaded, useArtifact } from '../../content/data';
import { formatFoldCounts, LEARNING_TARGETS, LEARNING_TEXT } from '../../learning/evidence';

export function LearningView(props: ComponentProps<typeof Learned>) {
  const learning = useArtifact(loadLearning);
  return <>
    <p className="of-footnote">{LEARNING_TEXT.definition[props.lang]} {props.lang === 'en' ? 'A dash in the live summary means an unavailable metric.' : 'Un guion en el resumen en vivo indica una métrica no disponible.'}</p>
    <Learned {...props} />
    {learning.value && <dl className="of-facts">{learning.value.targets.map(id => <div key={id}>
      <dt>{`MLP: ${LEARNING_TARGETS[id]?.[props.lang] ?? id}`}</dt><dd>{`${LEARNING_TEXT.loco[props.lang]}: ${formatFoldCounts(learning.value!.summary.mlp[id].loco_folds, props.lang)}. ${LEARNING_TEXT.transfer[props.lang]}: ${formatFoldCounts(learning.value!.summary.mlp[id].transfer_folds, props.lang)}.`}</dd>
    </div>)}</dl>}
    <details>
      <summary>{LEARNING_TEXT.conditional[props.lang]}</summary>
      <Loaded lang={props.lang} errors={[learning.error]} ready={Boolean(learning.value)}>{() => <>
        {learning.value!.targets.map(target => <LearningEvidence key={target} record={learning.value!} target={target} lang={props.lang} />)}
      </>}</Loaded>
    </details>
  </>;
}
