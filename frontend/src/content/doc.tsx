/**
 * The building blocks of the content pages (ADR-0016 sections 5 to 7): a page inside the shell's wide
 * page body, top-level tabs with vertical sub-tabs, and a topic that carries, in order, its prose, its
 * governing equations in KaTeX, a limitations callout, a theme-aware figure and its own references. A
 * topic is data (prose and equations are transcribed from the methodology and the research dossier), so
 * the pages share one layout and a fix lands once.
 */
import { Callout, Equation, Figure, Refs, SubTabs, Tabs } from '@fasl-work/caos-app-shell';
import type { ReactNode } from 'react';
import type { Lang } from '../lib/format';

export type Bi = { en: string; es: string };
export type Topic = {
  id: string;
  title: Bi;
  /** Substantial paragraphs, in order. */
  paragraphs: Bi[];
  equations?: Array<{ tex: string; caption: Bi }>;
  /** Assumptions and limitations. */
  limits?: Bi[];
  /** A table of the parameters the engine uses (values are the case catalog's or the constants'). */
  table?: { head: Bi[]; rows: Array<Array<string | Bi>> };
  /** A wide figure (a flowsheet) spans the text column below the prose; a narrow one sits beside it. */
  figure?: { caption: Bi; render: (lang: Lang) => ReactNode; wide?: boolean };
  refs: string[];
};

const T = {
  limits: { en: 'Assumptions and limits', es: 'Supuestos y límites' },
  refs: { en: 'References', es: 'Referencias' },
};

const text = (value: string | Bi, lang: Lang) => (typeof value === 'string' ? value : value[lang]);

export function TopicView({ topic, lang }: { topic: Topic; lang: Lang }) {
  return (
    <article className="prose of-topic">
      <h2>{topic.title[lang]}</h2>
      {topic.figure?.wide ? (
        <>
          {/* a flowsheet leads at full width; the prose then sits beside its equations */}
          <div className="of-topic-figure wide">
            <Figure caption={topic.figure.caption[lang]}>{topic.figure.render(lang)}</Figure>
          </div>
          <div className="of-topic-body with-figure">
            <div className="of-topic-text">{topic.paragraphs.map((p, i) => <p key={i}>{p[lang]}</p>)}</div>
            <div className="of-topic-equations">{topic.equations?.map(eq => <Equation key={eq.tex} tex={eq.tex} caption={eq.caption[lang]} />)}</div>
          </div>
        </>
      ) : (
        <div className={topic.figure ? 'of-topic-body with-figure' : 'of-topic-body'}>
          <div className="of-topic-text">
            {topic.paragraphs.map((p, i) => <p key={i}>{p[lang]}</p>)}
            {topic.equations?.map(eq => <Equation key={eq.tex} tex={eq.tex} caption={eq.caption[lang]} />)}
          </div>
          {topic.figure && (
            <div className="of-topic-figure">
              <Figure caption={topic.figure.caption[lang]}>{topic.figure.render(lang)}</Figure>
            </div>
          )}
        </div>
      )}
      {topic.table && (
        <table className="of-doc-table">
          <thead><tr>{topic.table.head.map((h, i) => <th scope="col" key={i}>{h[lang]}</th>)}</tr></thead>
          <tbody>{topic.table.rows.map((row, i) => (
            <tr key={i}>{row.map((cell, k) => (k === 0 ? <th scope="row" key={k}>{text(cell, lang)}</th> : <td key={k}>{text(cell, lang)}</td>))}</tr>
          ))}</tbody>
        </table>
      )}
      {topic.limits && topic.limits.length > 0 && (
        <Callout variant="honest" title={T.limits[lang]}>
          <ul>{topic.limits.map((l, i) => <li key={i}>{l[lang]}</li>)}</ul>
        </Callout>
      )}
      {topic.refs.length > 0 && <Refs ids={topic.refs} label={T.refs[lang]} />}
    </article>
  );
}

/** Top-level groups, each a vertical rail of topics (ADR-0071 rule 5: few peers, then group). */
export function TopicGroups({ groups, lang, label }: { groups: Array<{ id: string; label: Bi; topics: Topic[] }>; lang: Lang; label: Bi }) {
  return (
    <Tabs ariaLabel={label[lang]} tabs={groups.map(group => ({
      id: group.id,
      label: group.label[lang],
      content: group.topics.length === 1
        ? <TopicView topic={group.topics[0]} lang={lang} />
        : <SubTabs orientation="vertical" ariaLabel={group.label[lang]}
            tabs={group.topics.map(topic => ({ id: topic.id, label: topic.title[lang], content: <TopicView topic={topic} lang={lang} /> }))} />,
    }))} />
  );
}

export function DocPage({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="page-body wide of-doc">
      <header className="of-doc-head">
        <h1>{title}</h1>
        <p className="measure">{lede}</p>
      </header>
      {children}
    </div>
  );
}
