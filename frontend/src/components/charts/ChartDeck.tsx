import { useId, useState, type ReactNode } from 'react';

export type ChartTab = { id: string; label: string; content: ReactNode };

/** A full-size instrument with a compact tab row for related plots. */
export function ChartDeck({ views, label, className = '' }: { views: ChartTab[]; label: string; className?: string }) {
  const [active, setActive] = useState(views[0]?.id ?? '');
  const uid = useId().replace(/:/g, '');
  const current = views.find(view => view.id === active) ?? views[0];
  if (!current) return null;
  return (
    <div className={`of-chart-deck ${className}`}>
      <div className="of-chart-deck-tabs" role="tablist" aria-label={label}>
        {views.map(view => <button key={view.id} type="button" role="tab" aria-selected={view.id === current.id}
          aria-controls={`${uid}-panel-${view.id}`} id={`${uid}-tab-${view.id}`} onClick={() => setActive(view.id)}>
          {view.label}
        </button>)}
      </div>
      <div className="of-stage of-chart-deck-stage" role="tabpanel" id={`${uid}-panel-${current.id}`} aria-labelledby={`${uid}-tab-${current.id}`}>
        {current.content}
      </div>
    </div>
  );
}
