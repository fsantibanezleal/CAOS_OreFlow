import type { ReactNode } from 'react';
import { Callout, Cite, Equation, Refs, useShellLang } from '@fasl-work/caos-app-shell';

export type Bilingual = readonly [string, string];
export const tx = (v: Bilingual, es: boolean) => v[es ? 1 : 0];

export function PageHeading({ title, lede }: { title: Bilingual; lede: Bilingual }) {
  const es = useShellLang() === 'es';
  return <div className="of-page-heading"><span className="of-kicker">CAOS RESEARCH / OREFLOW</span><h1>{tx(title, es)}</h1><p>{tx(lede, es)}</p></div>;
}

export function ResearchSection({ title, paragraphs, equations = [], refs, diagram, children }: { title: Bilingual; paragraphs: Bilingual[]; equations?: Array<{ tex: string; caption: Bilingual }>; refs: string[]; diagram?: string; children?: ReactNode }) {
  const es = useShellLang() === 'es';
  return <section className="of-research-section"><h2>{tx(title, es)}</h2>{paragraphs.map((p, i) => <p key={i}>{tx(p, es)} {i === 0 && refs[0] ? <Cite id={refs[0]} /> : null}</p>)}{equations.map(eq => <Equation key={eq.tex} tex={eq.tex} caption={tx(eq.caption, es)} />)}{diagram && <figure className="of-research-figure"><img src={`${import.meta.env.BASE_URL}svg/tech/${diagram}.svg`} alt={tx(['OreFlow scientific schematic', 'Esquema científico de OreFlow'], es)} /><figcaption>{tx(['Authored schematic. The numbers live in the artifact, not in the illustration.', 'Esquema creado. Los números viven en el artefacto, no en la ilustración.'], es)}</figcaption></figure>}<Callout variant="honest" title={es ? 'Supuesto y límite' : 'Assumption and limit'}><p>{es ? 'Estos modelos son una base reproducible para razonar y comparar. No sustituyen calibración mineralógica, pruebas metalúrgicas ni diseño firmado de una planta.' : 'These models are a reproducible basis for reasoning and comparison. They do not replace mineralogical calibration, metallurgical testing or signed plant design.'}</p></Callout>{children}<Refs ids={refs} label={es ? 'Referencias de esta sección' : 'Section references'} /></section>;
}

export function Tabset({ tabs }: { tabs: Array<{ id: string; label: Bilingual; content: ReactNode }> }) {
  const [active, setActive] = React.useState(tabs[0]?.id ?? '');
  const es = useShellLang() === 'es';
  const item = tabs.find(tab => tab.id === active) ?? tabs[0];
  return <div className="of-tabset"><div className="of-tabs" role="tablist">{tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={tab.id === item.id} className={tab.id === item.id ? 'active' : ''} onClick={() => setActive(tab.id)}>{tx(tab.label, es)}</button>)}</div><div className="of-tab-content">{item?.content}</div></div>;
}

export function InfoTable({ rows }: { rows: Array<[Bilingual, Bilingual]> }) {
  const es = useShellLang() === 'es';
  return <table className="of-info-table"><tbody>{rows.map(([a, b]) => <tr key={a[0]}><th>{tx(a, es)}</th><td>{tx(b, es)}</td></tr>)}</tbody></table>;
}

import React from 'react';
