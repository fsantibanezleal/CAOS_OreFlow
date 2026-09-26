/**
 * The workbench rail (ADR-0071 rules 6 and 7): the case as the shell's CaseSelector dropdown, the
 * variant, the case question, and the contract's controls for the case's family, split into three
 * sections shown one at a time so the rail never scrolls. Every change is validated against the
 * operating contract before the engine sees it; a rejected value shows the contract's message.
 */
import { CaseSelector, type CaseDef } from '@fasl-work/caos-app-shell';
import { validate, type ContractError, type OperatingContract } from '../engine/contract';
import type { OperatingPoint } from '../engine/model';
import type { CaseArtifact, CaseIndex } from '../lib/artifacts.types';
import type { Lang } from '../lib/format';
import { t, UI } from '../lib/i18n';
import { contractMessage, ControlList } from './Controls';
import { changedInputs, useWorkbench, type Section } from './state';

export const SECTION_INPUTS: Record<Section, Array<keyof OperatingPoint>> = {
  feed: ['throughput_tph', 'work_index_kwh_t', 'head_grade', 'crusher_css_mm'],
  classification: ['target_p80_um', 'circulating_load', 'water_m3_t'],
  separation: ['collector_gpt', 'jg_cm_s', 'rougher_cells', 'gravity_bleed', 'deslime_cut_um'],
};

const CATEGORY: Record<string, { code: string; en: string; es: string }> = {
  liberation: { code: 'L', en: 'Liberation', es: 'Liberación' },
  classification: { code: 'C', en: 'Classification', es: 'Clasificación' },
  flotation: { code: 'F', en: 'Flotation', es: 'Flotación' },
  integration: { code: 'I', en: 'Integration', es: 'Integración' },
};

/**
 * Short catalog codes for the case selector (L1, C2, F3, ...): the shell's select shows the id before the
 * name, and a snake_case case id would crowd the rail (shell known defect: select labels lead with the id).
 */
export function caseCodes(index: CaseIndex): { toCode: Record<string, string>; toCase: Record<string, string> } {
  const counts: Record<string, number> = {};
  const toCode: Record<string, string> = {};
  const toCase: Record<string, string> = {};
  for (const c of index.cases) {
    counts[c.category] = (counts[c.category] ?? 0) + 1;
    const code = `${CATEGORY[c.category]?.code ?? c.category.slice(0, 1).toUpperCase()}${counts[c.category]}`;
    toCode[c.case_id] = code;
    toCase[code] = c.case_id;
  }
  return { toCode, toCase };
}

export function Rail({ index, contract, artifact, lang, errors, onFocus }: {
  index: CaseIndex;
  contract: OperatingContract;
  artifact: CaseArtifact;
  lang: Lang;
  errors: ContractError[];
  onFocus: () => void;
}) {
  const { caseId, variantId, base, point, section, setCase, setVariant, reset, setSection } = useWorkbench();
  const inputs = contract.cases[caseId]?.inputs ?? {};
  const { toCode, toCase } = caseCodes(index);
  const cases: CaseDef[] = index.cases.map(c => ({ id: toCode[c.case_id], name: c.title[lang], category: CATEGORY[c.category]?.[lang] ?? c.category }));
  const modified = Object.keys(changedInputs(base, point)).length > 0;
  const variant = artifact.variants.find(v => v.id === variantId);
  const sections = (Object.keys(SECTION_INPUTS) as Section[]).filter(s => SECTION_INPUTS[s].some(name => name in inputs));
  const active = sections.includes(section) ? section : sections[0];
  const hasError = (s: Section) => errors.some(e => e.input !== null && SECTION_INPUTS[s].includes(e.input as keyof OperatingPoint));
  const ruleErrors = errors.filter(e => e.input === null);

  return (
    <aside className="of-rail" aria-label={t(UI.case, lang)}>
      <CaseSelector cases={cases} selectedId={toCode[caseId]} onSelect={code => setCase(toCase[code] ?? code)} layout="select" lang={lang} ariaLabel={t(UI.case, lang)}
        modifiedFromId={modified ? toCode[caseId] : null} onResetToCanonical={reset}
        text={{ modifiedPrefix: t(UI.modified, lang), reset: t(UI.reset, lang) }} />
      <label className="of-field">
        <span>{t(UI.variant, lang)}</span>
        <select value={variantId} onChange={event => {
          const next = artifact.variants.find(v => v.id === event.target.value);
          if (next) setVariant(next.id, next.point);
        }}>
          {artifact.variants.map(v => <option key={v.id} value={v.id}>{v.label[lang]}</option>)}
        </select>
      </label>
      <p className="of-rail-question"><strong>{t(UI.question, lang)}:</strong> {artifact.question[lang]}</p>
      <div className="of-rail-sections" role="group">
        {sections.map(s => (
          <button key={s} type="button" className={[s === active ? 'active' : '', hasError(s) ? 'invalid' : ''].join(' ').trim()}
            aria-pressed={s === active} onClick={() => setSection(s)}>
            {t(UI.sections[s], lang)}
          </button>
        ))}
      </div>
      <ControlList contract={contract} caseId={caseId} names={SECTION_INPUTS[active]} variantPoint={variant?.point ?? null} errors={errors} lang={lang} />
      {ruleErrors.map(e => <p key={e.code} role="alert" className="of-knob-error">{contractMessage(contract, e, '', lang)}</p>)}
      <button type="button" className="of-focus-open" onClick={onFocus}>{t(UI.openFocus, lang)}</button>
    </aside>
  );
}

/** Validation of the current point against the contract (the same interpreter as the API). */
export function checkPoint(contract: OperatingContract, caseId: string, point: OperatingPoint | null) {
  if (!point) return { accepted: false, point: null, errors: [] as ContractError[] };
  return validate(contract, caseId, point as unknown as Record<string, unknown>);
}
