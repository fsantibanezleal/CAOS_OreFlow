import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

type Tab = { id: string; label: string; content: ReactNode };

/** A viewport-filling tab set for dense instruments; document tabs remain owned by the shell. */
export function WorkbenchSubTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const uid = useId();
  const current = tabs.some(tab => tab.id === active) ? active : tabs[0]?.id ?? '';
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    setActive(tabs[next].id);
    document.getElementById(`${uid}-tab-${tabs[next].id}`)?.focus();
  };
  return (
    <div className="of-workbench-subtabs">
      <div className="of-workbench-subtablist" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button key={tab.id} id={`${uid}-tab-${tab.id}`} type="button" role="tab" className="of-workbench-subtab"
            aria-selected={current === tab.id} aria-controls={`${uid}-panel-${tab.id}`} tabIndex={current === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)} onKeyDown={event => keyDown(event, index)}>{tab.label}</button>
        ))}
      </div>
      {tabs.filter(tab => tab.id === current).map(tab => (
        <div key={tab.id} id={`${uid}-panel-${tab.id}`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab.id}`}
          className="of-workbench-subtabpanel" tabIndex={0}>{tab.content}</div>
      ))}
    </div>
  );
}
