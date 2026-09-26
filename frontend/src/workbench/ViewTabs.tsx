import { useId } from 'react';

/**
 * A controlled tab row on the shell's own classes (`tablist`, `tab`). The shell's `Tabs` keeps its
 * selection internally and reports no change, so a view held in the URL and the store cannot drive it;
 * this row keeps the shell's look and keyboard behaviour (arrows, Home, End, roving tabindex) and lets
 * the workbench own the state. Only the active panel is rendered by the caller (shell known defect 2).
 */
export function ViewTabs<T extends string>({ views, active, onChange, label, names }: {
  views: T[];
  active: T;
  onChange: (view: T) => void;
  label: string;
  names: Record<T, string>;
}) {
  const baseId = useId();
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: views.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = (keys[event.key] + views.length) % views.length;
    onChange(views[next]);
    document.getElementById(`${baseId}-${views[next]}`)?.focus();
  };
  return (
    <div className="tablist of-viewbar" role="tablist" aria-label={label}>
      {views.map((view, index) => (
        <button key={view} id={`${baseId}-${view}`} role="tab" type="button" aria-selected={view === active}
          tabIndex={view === active ? 0 : -1} className={view === active ? 'tab active' : 'tab'}
          onClick={() => onChange(view)} onKeyDown={event => onKeyDown(event, index)}>
          {names[view]}
        </button>
      ))}
    </div>
  );
}
