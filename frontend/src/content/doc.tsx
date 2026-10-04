/**
 * The building blocks of the content pages (ADR-0016 sections 5 to 7): a page inside the shell's wide
 * page body, top-level tabs with vertical sub-tabs, and a topic that carries, in order, its prose, its
 * governing equations in KaTeX, a limitations callout, a theme-aware figure and its own references. A
 * topic is data (prose and equations are transcribed from the methodology and the research dossier), so
 * the pages share one layout and a fix lands once.
 */
import { Callout, Equation, Figure, Refs, SubTabs, Tabs } from '@fasl-work/caos-app-shell';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { localizeAuthored, localizeTex, type Lang } from '../lib/format';
import { withMath } from '../lib/math';

export type Bi = { en: string; es: string };
export type Topic = {
  id: string;
  title: Bi;
  /** Substantial paragraphs, in order. */
  paragraphs: Bi[];
  /** A formula with words in it (an operator name, a condition) carries its TeX in both languages. */
  equations?: Array<{ tex: string | Bi; caption: Bi }>;
  /** Assumptions and limitations. */
  limits?: Bi[];
  /** A table of the parameters the engine uses (values are the case catalog's or the constants'). */
  table?: { head: Bi[]; rows: Array<Array<string | Bi>>; wrap?: number[] };   // wrap: the columns of prose, which break over lines
  /** A wide figure (a flowsheet) spans the text column below the prose; a narrow one sits beside it. */
  figure?: { caption: Bi; render: (lang: Lang) => ReactNode; wide?: boolean };
  /** Content read from the committed artifacts at run time (a results table, an interactive chart),
   * drawn at full width after the prose, so a number on a page is the artifact's and never retyped. */
  data?: (lang: Lang) => ReactNode;
  refs: string[];
};

const T = {
  limits: { en: 'Assumptions and limits', es: 'Supuestos y límites' },
  refs: { en: 'References', es: 'Referencias' },
};

const text = (value: string | Bi, lang: Lang) => (typeof value === 'string' ? value : value[lang]);
// a plain table cell is an authored value in the English convention; a formula sets its decimals per language
const cell = (value: string | Bi, lang: Lang) => withMath(typeof value === 'string' ? localizeAuthored(value, lang) : value[lang], lang);
const formula = (value: string | Bi, lang: Lang) => localizeTex(text(value, lang), lang);
const tex = (value: string | Bi) => (typeof value === 'string' ? value : value.en);

/** The smallest a figure's label is drawn, in CSS pixels; the gate's phone pass holds every figure to it. */
export const FIGURE_TEXT_FLOOR_PX = 7.5;

/**
 * A figure never shrinks its labels under the floor: it keeps the width at which its smallest label is drawn at
 * FIGURE_TEXT_FLOOR_PX and scrolls sideways in its own row, the hidden end faded as the route links' (NavOverflow).
 * Shrunk to a phone's width, the wide figures drew their labels at 4 to 5 px (0.08 gate captures, 390 x 844).
 */
function FigureScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    const svg = box?.querySelector('svg');
    if (!box || !svg) return undefined;
    const sizes = [...svg.querySelectorAll('text')].map(t => parseFloat(getComputedStyle(t).fontSize)).filter(v => v > 0);
    const width = svg.viewBox.baseVal?.width ?? 0;
    if (sizes.length && width > 0) box.style.setProperty('--of-fig-min', `${Math.ceil((width * FIGURE_TEXT_FLOOR_PX) / Math.min(...sizes))}px`);
    const update = () => {
      const hidden = box.scrollWidth - box.clientWidth;
      box.dataset.fadeStart = hidden > 1 && box.scrollLeft > 1 ? '1' : '0';
      box.dataset.fadeEnd = hidden > 1 && box.scrollLeft < hidden - 1 ? '1' : '0';
    };
    update();
    box.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => { box.removeEventListener('scroll', update); observer.disconnect(); };
  }, []);
  return <div ref={ref} className="of-figure-scroll">{children}</div>;
}

export function TopicView({ topic, lang }: { topic: Topic; lang: Lang }) {
  const limits = topic.limits && topic.limits.length > 0 && (
    <Callout variant="honest" title={T.limits[lang]}>
      <ul>{topic.limits.map((l, i) => <li key={i}>{withMath(l[lang], lang)}</li>)}</ul>
    </Callout>
  );
  return (
    <article className="prose of-topic">
      <h2>{topic.title[lang]}</h2>
      {topic.figure?.wide ? (
        <>
          {/* a flowsheet leads at full width; the prose then sits beside its equations */}
          <div className="of-topic-figure wide">
            <Figure caption={withMath(topic.figure.caption[lang], lang)}><FigureScroll>{topic.figure.render(lang)}</FigureScroll></Figure>
          </div>
          <div className="of-topic-body with-figure">
            <div className="of-topic-text">{topic.paragraphs.map((p, i) => <p key={i}>{withMath(p[lang], lang)}</p>)}</div>
            <div className="of-topic-equations">{topic.equations?.map(eq => <Equation key={tex(eq.tex)} tex={formula(eq.tex, lang)} caption={withMath(eq.caption[lang], lang)} />)}</div>
          </div>
        </>
      ) : topic.figure ? (
        <div className="of-topic-body with-figure">
          <div className="of-topic-text">
            {topic.paragraphs.map((p, i) => <p key={i}>{withMath(p[lang], lang)}</p>)}
            {topic.equations?.map(eq => <Equation key={tex(eq.tex)} tex={formula(eq.tex, lang)} caption={withMath(eq.caption[lang], lang)} />)}
          </div>
          {/* the figure leads the second column and the limits follow it: equations keep the wider column,
              and wrapping text fills the narrower one */}
          <div className="of-topic-side">
            <div className="of-topic-figure">
              <Figure caption={withMath(topic.figure.caption[lang], lang)}><FigureScroll>{topic.figure.render(lang)}</FigureScroll></Figure>
            </div>
            {limits}
          </div>
        </div>
      ) : (
        <div className="of-topic-body">
          <div className="of-topic-text">
            {topic.paragraphs.map((p, i) => <p key={i}>{withMath(p[lang], lang)}</p>)}
            {topic.equations?.map(eq => <Equation key={tex(eq.tex)} tex={formula(eq.tex, lang)} caption={withMath(eq.caption[lang], lang)} />)}
          </div>
        </div>
      )}
      {topic.data && <div className="of-topic-data">{topic.data(lang)}</div>}
      {topic.table && (
        <table className="of-doc-table">
          <thead><tr>{topic.table.head.map((h, i) => <th scope="col" key={i}>{h[lang]}</th>)}</tr></thead>
          <tbody>{topic.table.rows.map((row, i) => (
            <tr key={i}>{row.map((value, k) => (k === 0 ? <th scope="row" key={k}>{cell(value, lang)}</th>
              : <td key={k} className={topic.table?.wrap?.includes(k) ? 'of-doc-wrap' : undefined}>{cell(value, lang)}</td>))}</tr>
          ))}</tbody>
        </table>
      )}
      {!(topic.figure && !topic.figure.wide) && limits}
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

/**
 * A page's tab row that is wider than the page scrolls with its scrollbar hidden (shell known defect 11), and in
 * Spanish at 1280 px the Implementation row was cut at "Controles y publicaci" with nothing to say Despliegue followed
 * (0.08 gate captures): the row declares which end hides tabs, `data-fade-start` and `data-fade-end`, and that end
 * fades, as the route links do (NavOverflow). Rerun after every render, so a language change re-measures the row.
 */
function useTabRowFade(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const row = root.current?.querySelector<HTMLElement>('.tablist');
    if (!row) return undefined;
    const update = () => {
      const hidden = row.scrollWidth - row.clientWidth;
      row.dataset.fadeStart = hidden > 1 && row.scrollLeft > 1 ? '1' : '0';
      row.dataset.fadeEnd = hidden > 1 && row.scrollLeft < hidden - 1 ? '1' : '0';
    };
    update();
    row.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(row);
    for (const tab of row.children) observer.observe(tab);
    return () => { row.removeEventListener('scroll', update); observer.disconnect(); };
  });
}

export function DocPage({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useTabRowFade(root);
  return (
    <div ref={root} className="page-body wide of-doc">
      <header className="of-doc-head">
        <h1>{title}</h1>
        <p className="measure">{lede}</p>
      </header>
      {children}
    </div>
  );
}
