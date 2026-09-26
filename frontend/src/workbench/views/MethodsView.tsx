/**
 * Methods view (design §12.1, view 5): the method records of the selected variant, one at a time as the
 * shell's sub-tabs (ADR-0071 rule 5): the optimizer, the uncertainty record, the Sobol indices (baked
 * at the nominal state) and the learned lane, which runs the exported surrogate in the browser. Each
 * panel is keyed by the case, so a choice that only makes sense for one case (a factor, an input) never
 * carries over to another.
 */
import { SubTabs } from '@fasl-work/caos-app-shell';
import type { OperatingContract } from '../../engine/contract';
import type { OperatingPoint } from '../../engine/model';
import type { Trace } from '../../engine/trace';
import type { CaseArtifact, VariantArtifact } from '../../lib/artifacts.types';
import type { Lang } from '../../lib/format';
import { Learned } from './methods/Learned';
import { Optimizer } from './methods/Optimizer';
import { Sensitivity } from './methods/Sensitivity';
import { Uncertainty } from './methods/Uncertainty';

const TEXT = {
  label: { en: 'Method records', es: 'Registros de métodos' },
  optimizer: { en: 'Optimizer', es: 'Optimizador' },
  uncertainty: { en: 'Uncertainty', es: 'Incertidumbre' },
  sensitivity: { en: 'Sobol sensitivity', es: 'Sensibilidad de Sobol' },
  learned: { en: 'Learned lane', es: 'Vía aprendida' },
};

export function MethodsView({ contract, artifact, variant, point, trace, modified, lang, onCursor }: {
  contract: OperatingContract; artifact: CaseArtifact; variant: VariantArtifact; point: OperatingPoint; trace: Trace | null;
  modified: boolean; lang: Lang; onCursor: (text: string | null) => void;
}) {
  const caseId = artifact.case_id;
  const nominal = artifact.variants.find(v => v.id === 'nominal') ?? artifact.variants[0];
  const sensitivity = variant.methods.sensitivity ?? nominal.methods.sensitivity;
  const gradeUnit = contract.cases[caseId].primary.unit;
  const tabs = [
    { id: 'optimizer', label: TEXT.optimizer[lang],
      content: <Optimizer key={caseId} record={variant.methods.optimization} contract={contract} caseId={caseId} modified={modified} lang={lang} onCursor={onCursor} /> },
    { id: 'uncertainty', label: TEXT.uncertainty[lang],
      content: <Uncertainty key={caseId} record={variant.methods.uncertainty} gradeUnit={gradeUnit} modified={modified} lang={lang} onCursor={onCursor} /> },
    ...(sensitivity ? [{ id: 'sensitivity', label: TEXT.sensitivity[lang],
      content: <Sensitivity key={caseId} record={sensitivity} atNominal={variant.id === 'nominal'} lang={lang} onCursor={onCursor} /> }] : []),
    { id: 'learned', label: TEXT.learned[lang],
      content: <Learned key={caseId} contract={contract} artifact={artifact} point={point} trace={trace} lang={lang} onCursor={onCursor} /> },
  ];
  return (
    <div className="of-view of-view-tabbed of-view-methods">
      <SubTabs tabs={tabs} ariaLabel={TEXT.label[lang]} />
    </div>
  );
}
