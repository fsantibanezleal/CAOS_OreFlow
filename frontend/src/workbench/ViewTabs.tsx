import { useId } from 'react';

/**
 * The process view selector, including views disabled for the measured-hour source. The shared Tabs
 * supports controlled selection but has no disabled-tab contract. This product row keeps unavailable
 * analytical views visible, skips them during keyboard navigation and shares its row with process flags.
 * Only the selected process panel is rendered by Workbench.
 */
export function ViewTabs<T extends string>({ views, active, onChange, label, names, disabled = [] }: {
  views: T[];
  active: T;
  onChange: (view: T) => void;
  label: string;
  names: Record<T, string>;
  /** Views the current source has nothing for (U-15): shown, disabled, skipped by the keyboard. */
  disabled?: T[];
}) {
  const baseId = useId();
  const open = views.filter(v => !disabled.includes(v));
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const at = open.indexOf(active);
    const keys: Record<string, number> = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: open.length - 1 };
    if (!(event.key in keys) || open.length === 0) return;
    event.preventDefault();
    const next = (keys[event.key] + open.length) % open.length;
    onChange(open[next]);
    document.getElementById(`${baseId}-${open[next]}`)?.focus();
  };
  return (
    <div className="of-view-tabs" role="tablist" aria-label={label}>
      {views.map(view => (
        <button key={view} id={`${baseId}-${view}`} role="tab" type="button" aria-selected={view === active}
          tabIndex={view === active ? 0 : -1} className={['of-view-tab', view === active ? 'active' : '', disabled.includes(view) ? 'disabled' : ''].filter(Boolean).join(' ')} disabled={disabled.includes(view)} aria-disabled={disabled.includes(view) || undefined}
          onClick={() => onChange(view)} onKeyDown={onKeyDown}>
          {names[view]}
        </button>
      ))}
    </div>
  );
}
