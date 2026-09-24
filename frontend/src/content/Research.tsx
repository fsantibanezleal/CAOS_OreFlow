import type { ReactNode } from 'react';
import { Callout, Cite, Equation, Refs, useShellLang } from '@fasl-work/caos-app-shell';

export type Bilingual = readonly [string, string];
export const tx = (v: Bilingual, es: boolean) => v[es ? 1 : 0];

export function PageHeading({ title, lede }: { title: Bilingual; lede: Bilingual }) {
  const es = useShellLang() === 'es';
  return <div className="of-page-heading"><span className="of-kicker">CAOS RESEARCH / OREFLOW</span><h1>{tx(title, es)}</h1><p>{tx(lede, es)}</p></div>;
}

function InlineFigure({ name, es }: { name: string; es: boolean }) {
  const [svg, setSvg] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    setSvg(null);
    fetch(`${import.meta.env.BASE_URL}svg/tech/${name}.svg`)
      .then(response => {
        if (!response.ok) throw new Error(`Figure ${name}: ${response.status}`);
        return response.text();
      })
      .then(markup => { if (!cancelled) setSvg(markup); })
      .catch(() => { if (!cancelled) setSvg(null); });
    return () => { cancelled = true; };
  }, [name]);
  return <figure className="of-research-figure">
    {svg ? <div className="of-inline-svg" data-arch-lang={es ? 'es' : 'en'} role="img" aria-label={es ? 'Esquema de proceso o arquitectura' : 'Process or architecture schematic'} dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="of-figure-loading" role="status">{es ? 'Cargando figura…' : 'Loading figure…'}</div>}
    <figcaption>{es ? 'Esquema, no observación de planta.' : 'Schematic, not a plant observation.'}</figcaption>
  </figure>;
}

export function ResearchSection({ title, paragraphs, equations = [], refs, diagram, children }: { title: Bilingual; paragraphs: Bilingual[]; equations?: Array<{ tex: string; caption: Bilingual }>; refs: string[]; diagram?: string; children?: ReactNode }) {
  const es = useShellLang() === 'es';
  return <section className="of-research-section">
    <h2>{tx(title, es)}</h2>
    <div className={`of-research-layout ${diagram || equations.length ? 'has-figure' : ''}`}>
      <div className="of-research-copy">
        {paragraphs.map((p, i) => <p key={i}>{tx(p, es)} {i === 0 && refs[0] ? <Cite id={refs[0]} /> : null}</p>)}
        <Callout variant="honest" title={es ? 'Supuesto y límite' : 'Assumption and limit'}><p>{es ? 'Estos modelos son una base reproducible para razonar y comparar. No sustituyen calibración mineralógica, pruebas metalúrgicas ni diseño firmado de una planta.' : 'These models are a reproducible basis for reasoning and comparison. They do not replace mineralogical calibration, metallurgical testing or signed plant design.'}</p></Callout>
        {children}
      </div>
      {(diagram || equations.length > 0) && <aside className="of-research-visual">
        {diagram && <InlineFigure name={diagram} es={es} />}
        {equations.map(eq => <Equation key={eq.tex} tex={eq.tex} caption={tx(eq.caption, es)} />)}
      </aside>}
    </div>
    <Refs ids={refs} label={es ? 'Referencias de esta sección' : 'Section references'} />
  </section>;
}

export function Tabset({ tabs }: { tabs: Array<{ id: string; label: Bilingual; content: ReactNode }> }) {
  const [active, setActive] = React.useState(tabs[0]?.id ?? '');
  const tabRow = React.useRef<HTMLDivElement>(null);
  const es = useShellLang() === 'es';
  const item = tabs.find(tab => tab.id === active) ?? tabs[0];
  return <div className="of-tabset"><div className="of-tabnav">
    <button type="button" className="of-tab-pan" aria-label={es ? 'Ver temas anteriores' : 'Show previous topics'} onClick={() => tabRow.current?.scrollBy({left: -240, behavior: 'smooth'})}>‹</button>
    <div className="of-tabs" role="tablist" ref={tabRow}>{tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={tab.id === item.id} className={tab.id === item.id ? 'active' : ''} onClick={() => setActive(tab.id)}>{tx(tab.label, es)}</button>)}</div>
    <button type="button" className="of-tab-pan" aria-label={es ? 'Ver temas siguientes' : 'Show next topics'} onClick={() => tabRow.current?.scrollBy({left: 240, behavior: 'smooth'})}>›</button>
  </div><div className="of-tab-content">{item?.content}</div></div>;
}

export function InfoTable({ rows }: { rows: Array<[Bilingual, Bilingual]> }) {
  const es = useShellLang() === 'es';
  return <table className="of-info-table"><tbody>{rows.map(([a, b]) => <tr key={a[0]}><th>{tx(a, es)}</th><td>{tx(b, es)}</td></tr>)}</tbody></table>;
}

import React from 'react';
