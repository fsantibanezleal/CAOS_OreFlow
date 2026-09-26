/**
 * The contract's controls as sliders (design §12): range, step, unit and help come from the operating
 * contract, a changed control shows the variant's own value, and a rejected value shows the contract's
 * message in the interface language, with the limits formatted in the active locale. Used by the
 * workbench rail and the focus rail, so both present a control the same way.
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

export function ControlList({ contract, caseId, names, variantPoint, errors, lang, idPrefix = 'of' }: {
  contract: OperatingContract; caseId: string; names: Array<keyof OperatingPoint>; variantPoint: OperatingPoint | null;
  errors: ContractError[]; lang: Lang; idPrefix?: string;
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
        return (
          <div key={name} className={`of-knob${error ? ' invalid' : ''}`}>
            <label htmlFor={id} title={spec.help[lang]}>
              <span>{spec.label[lang]}</span>
              <output htmlFor={id}>{shown}</output>
            </label>
            <input id={id} type="range" min={bounds.min} max={bounds.max} step={bounds.step} value={value} aria-describedby={`${id}-help`}
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
