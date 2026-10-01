/**
 * The contract's controls as sliders (design §12): range, step, unit and help come from the operating
 * contract, a changed control shows the variant's own value, and a rejected value shows the contract's
 * message in the interface language, with the limits formatted in the active locale. Used by the
 * workbench rail and the focus rail, so both present a control the same way. An input with an off value
 * (the classifier cut, CM-07) is a mode switch: off, the solver sets the cut; on, its slider appears and the
 * inputs it replaces stay visible, disabled, as quantities that follow.
 */
import type { ContractError, OperatingContract } from '../engine/contract';
import type { OperatingPoint } from '../engine/model';
import { formatValue, formatWithUnit, unitLabel, type Lang } from '../lib/format';
import { t, UI } from '../lib/i18n';
import { useWorkbench } from './state';

export function contractMessage(contract: OperatingContract, error: ContractError, unit: string, lang: Lang): string {
  const rule = contract.rules.find(r => r.id === error.code);
  if (rule) return rule.message[lang];
  const text = contract.messages[error.code]?.[lang] ?? error.code;
  if (error.code === 'out_of_range' && error.min !== undefined && error.max !== undefined) {
    return `${text} (${formatValue(error.min, unit, lang)} – ${formatWithUnit(error.max, unit, lang)})`;
  }
  return text;
}

/** Inputs the cut mode turns into results: the engine ignores them while the classifier cut is set. */
const FOLLOW_IN_CUT_MODE = new Set(['target_p80_um', 'circulating_load']);

export function ControlList({ contract, caseId, names, variantPoint, errors, lang, idPrefix = 'of', fixed = {} }: {
  contract: OperatingContract; caseId: string; names: Array<keyof OperatingPoint>; variantPoint: OperatingPoint | null;
  errors: ContractError[]; lang: Lang; idPrefix?: string;
  /** Inputs a real sample fixes (RS-08): shown, disabled, with the reason each is fixed. */
  fixed?: Partial<Record<keyof OperatingPoint, { en: string; es: string }>>;
}) {
  const { point, setValue } = useWorkbench();
  const entry = contract.cases[caseId];
  const inputs = entry?.inputs ?? {};
  const declared = Object.fromEntries(contract.inputs.map(spec => [spec.name, spec]));
  const primaryUnit = entry?.primary.unit ?? '%';
  return (
    <div className="of-rail-controls">
      {names.filter(name => name in inputs).map(name => {
        const spec = declared[name];
        const bounds = inputs[name];
        const value = point ? point[name] : bounds.min;
        const unit = spec.unit === 'case' ? primaryUnit : spec.unit;
        const shown = spec.display_scale !== 1 ? `${formatValue(value * spec.display_scale, spec.display_unit, lang)}${spec.display_unit}`
          : `${formatValue(value, unit, lang)} ${unitLabel(unit)}`.trim();
        const error = errors.find(e => e.input === name);
        const variantValue = variantPoint?.[name];
        const id = `${idPrefix}-${name}`;
        if (bounds.off !== undefined) {
          const on = value !== bounds.off;
          return (
            <div key={name} className={`of-knob${error ? ' invalid' : ''}`}>
              <span className="of-knob-title" title={spec.help[lang]}>{t(UI.grindControl, lang)}</span>
              <div className="of-segmented" role="group" aria-label={t(UI.grindControl, lang)}>
                <button type="button" aria-pressed={!on} className={on ? '' : 'active'} onClick={() => setValue(name, bounds.off!)}>{t(UI.grindTarget, lang)}</button>
                <button type="button" aria-pressed={on} className={on ? 'active' : ''}
                  onClick={() => { if (!on) setValue(name, Math.min(bounds.max, Math.max(bounds.min, bounds.reference ?? bounds.min))); }}>{t(UI.grindCut, lang)}</button>
              </div>
              {on && (
                <>
                  <label htmlFor={id} title={spec.help[lang]}>
                    <span>{spec.label[lang]}</span>
                    <output htmlFor={id}>{shown}</output>
                  </label>
                  <input id={id} type="range" min={bounds.min} max={bounds.max} step={bounds.step} value={value} aria-describedby={`${id}-help`}
                    onChange={event => setValue(name, Number(event.target.value))} />
                </>
              )}
              <small id={`${id}-help`} className="of-sr-only">{spec.help[lang]}</small>
              {error && <small role="alert" className="of-knob-error">{contractMessage(contract, error, unit, lang)}</small>}
            </div>
          );
        }
        const follows = FOLLOW_IN_CUT_MODE.has(name) && point !== null && point.d50c_um > 0;
        const fixedBy = fixed[name];
        if (fixedBy) {
          return (
            <div key={name} className="of-knob fixed">
              <label htmlFor={id} title={spec.help[lang]}>
                <span>{spec.label[lang]}</span>
                <output htmlFor={id}>{shown}</output>
              </label>
              <input id={id} type="range" min={Math.min(bounds.min, value)} max={Math.max(bounds.max, value)} step={bounds.step} value={value} disabled aria-describedby={`${id}-fixed`} />
              <small id={`${id}-fixed`} className="of-knob-base">{fixedBy[lang]}</small>
            </div>
          );
        }
        return (
          <div key={name} className={`of-knob${error ? ' invalid' : ''}${follows ? ' follows' : ''}`}>
            <label htmlFor={id} title={spec.help[lang]}>
              <span>{spec.label[lang]}</span>
              <output htmlFor={id}>{follows ? t(UI.follows, lang) : shown}</output>
            </label>
            <input id={id} type="range" min={bounds.min} max={bounds.max} step={bounds.step} value={value} aria-describedby={`${id}-help`} disabled={follows}
              onChange={event => setValue(name, spec.integer ? Math.round(Number(event.target.value)) : Number(event.target.value))} />
            <small id={`${id}-help`} className="of-sr-only">{spec.help[lang]}</small>
            {variantValue !== undefined && variantValue !== value && <small className="of-knob-base">{`${t(UI.variant, lang)}: ${formatWithUnit(variantValue, unit, lang)}`}</small>}
            {error && <small role="alert" className="of-knob-error">{contractMessage(contract, error, unit, lang)}</small>}
          </div>
        );
      })}
    </div>
  );
}
