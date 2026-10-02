import { useId } from 'react';

/**
 * A controlled tab row on the shell's own classes (`tablist`, `tab`). The shell's `Tabs` keeps its
 * selection internally and reports no change, so a view held in the URL and the store cannot drive it;
 * this row keeps the shell's look and keyboard behaviour (arrows, Home, End, roving tabindex) and lets
 * the workbench own the state. Only the active panel is rendered by the caller (shell known defect 2).
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
    <div className="tablist of-viewbar" role="tablist" aria-label={label}>
      {views.map(view => (
        <button key={view} id={`${baseId}-${view}`} role="tab" type="button" aria-selected={view === active}
          tabIndex={view === active ? 0 : -1} className={view === active ? 'tab active' : 'tab'} disabled={disabled.includes(view)} aria-disabled={disabled.includes(view) || undefined}
          onClick={() => onChange(view)} onKeyDown={onKeyDown}>
          {names[view]}
        </button>
      ))}
    </div>
  );
}
