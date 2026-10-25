/**
 * The workbench rail (ADR-0071 rules 6 and 7): the case as the shell's CaseSelector dropdown, the
 * variant, the case question, and the contract's controls for the case's family, split into three
 * sections shown one at a time so the rail never scrolls. Every change is validated against the
 * operating contract before the engine sees it; a rejected value shows the contract's message. The source switch
 * on top (RS-07, RS-08) turns the rail to a GeoMet sample, whose head grade and work index are fixed by the sample
 * while the plant's operating controls stay, or to an iron-plant hour, which has no control.
 */
import { CaseSelector, type CaseDef } from '@fasl-work/caos-app-shell';
import type { RefObject } from 'react';
import { validate, type ContractError, type OperatingContract } from '../engine/contract';
import type { OperatingPoint } from '../engine/model';
import type { IronPlant, RealSamples } from '../lib/artifacts';
import type { CaseArtifact, CaseIndex } from '../lib/artifacts.types';
import type { Lang } from '../lib/format';
import { CATEGORY, t, UI } from '../lib/i18n';
import { contractMessage, ControlList } from './Controls';
import { HourPicker, SamplePicker, SourceSwitch } from './SourcePicker';
import { changedInputs, useWorkbench, type Section } from './state';

/** What a GeoMet sample fixes, and why (RS-08). */
export const SAMPLE_FIXED = {
  head_grade: { en: 'Fixed by the sample: its copper assay.', es: 'Fijada por la muestra: su ensaye de cobre.' },
  work_index_kwh_t: { en: 'Fixed by the sample: the Bond test of the nearest comminution sample in its hole, or the deposit median.', es: 'Fijado por la muestra: el ensayo de Bond de la muestra de conminución más cercana de su sondaje, o la mediana del yacimiento.' },
};

export const SECTION_INPUTS: Record<Section, Array<keyof OperatingPoint>> = {
  feed: ['throughput_tph', 'work_index_kwh_t', 'head_grade', 'crusher_css_mm'],
  classification: ['d50c_um', 'target_p80_um', 'circulating_load', 'water_m3_t'],
  separation: ['collector_gpt', 'jg_cm_s', 'rougher_cells', 'gravity_bleed', 'deslime_cut_um'],
};
const SECTION_SHORT: Record<Section, { en: string; es: string }> = {
  feed: { en: 'Feed', es: 'Alim.' },
  classification: { en: 'Classify', es: 'Clasif.' },
  separation: { en: 'Separate', es: 'Separar' },
};

export function Rail({ index, contract, artifact, lang, errors, onFocus, focusRef, samples, lane }: {
  index: CaseIndex;
  contract: OperatingContract;
  artifact: CaseArtifact;
  lang: Lang;
  errors: ContractError[];
  onFocus: () => void;
  samples: RealSamples | null;
  lane: IronPlant | null;
  focusRef: RefObject<HTMLButtonElement | null>;
}) {
  const { caseId, variantId, base, point, section, source, setCase, setVariant, reset, setSection } = useWorkbench();
  if (source === 'hour') {
    return (
      <aside className="of-rail" aria-label={t(UI.case, lang)}>
        <SourceSwitch lang={lang} />
        {lane ? <HourPicker lane={lane} lang={lang} /> : <p className="of-hint" role="status">{t(UI.loading, lang)}</p>}
      </aside>
    );
  }
  const inputs = contract.cases[caseId]?.inputs ?? {};
  // Keep the case's canonical id in the shared selector and the workbench marker. The previous L1/C1
  // aliases meant the shell gate could select a value that the rendered case state could never equal.
  const cases: CaseDef[] = index.cases.map(c => ({ id: c.case_id, name: c.title[lang], category: CATEGORY[c.category]?.[lang] ?? c.category }));
  const modified = Object.keys(changedInputs(base, point)).length > 0;
  const variant = artifact.variants.find(v => v.id === variantId);
  const sections = (Object.keys(SECTION_INPUTS) as Section[]).filter(s => SECTION_INPUTS[s].some(name => name in inputs));
  const active = sections.includes(section) ? section : sections[0];
  const hasError = (s: Section) => errors.some(e => e.input !== null && SECTION_INPUTS[s].includes(e.input as keyof OperatingPoint));

  const sampleMode = source === 'sample';
  return (
    <aside className="of-rail" aria-label={t(UI.case, lang)}>
      <SourceSwitch lang={lang} />
      {/* U-03: the rejection shows at the top whatever section is open; the marked control carries it too */}
      {errors.length > 0 && <p role="alert" className="of-rail-rejected">{errors.map(e => contractMessage(contract, e, '', lang)).join(' · ')}</p>}
      {sampleMode ? (samples ? <SamplePicker record={samples} lang={lang} /> : <p className="of-hint" role="status">{t(UI.loading, lang)}</p>) : <>
      <CaseSelector cases={cases} selectedId={caseId} onSelect={setCase} layout="select" lang={lang} ariaLabel={t(UI.case, lang)}
      />
      <div className="of-rail-modified" role="status" hidden={!modified} title={`${t(UI.modified, lang)}: ${artifact.title[lang]}`}>
        <span>{t(UI.modified, lang)}: {artifact.title[lang]}</span>
        <button type="button" onClick={reset}>{t(UI.reset, lang)}</button>
      </div>
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
      </>}
      <div className="of-rail-sections" role="group" aria-label={lang === 'es' ? 'Secciones de controles' : 'Control sections'}>
        {sections.map(s => (
          <button key={s} type="button" className={['of-rail-section', s === active ? 'active' : '', hasError(s) ? 'invalid' : ''].join(' ').trim()}
            title={t(UI.sections[s], lang)} aria-pressed={s === active} onClick={() => setSection(s)}>
            {SECTION_SHORT[s][lang]}
          </button>
        ))}
      </div>
      <ControlList contract={contract} caseId={caseId} names={SECTION_INPUTS[active]} variantPoint={sampleMode ? base : variant?.point ?? null} errors={errors} lang={lang}
        fixed={sampleMode ? SAMPLE_FIXED : {}} baseLabel={sampleMode ? t(UI.sampleBase, lang) : undefined} />
      {sampleMode && modified && <button type="button" className="of-revert" onClick={reset}>{t(UI.backToSample, lang)}</button>}
      <button ref={focusRef} type="button" className="of-focus-open" data-focus-enter onClick={onFocus}>{t(UI.openFocus, lang)}</button>
    </aside>
  );
}

/** Validation of the current point against the contract (the same interpreter as the API). */
export function checkPoint(contract: OperatingContract, caseId: string, point: OperatingPoint | null) {
  if (!point) return { accepted: false, point: null, errors: [] as ContractError[] };
  return validate(contract, caseId, point as unknown as Record<string, unknown>);
}
