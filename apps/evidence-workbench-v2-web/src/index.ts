/**
 * V2 browser surface: plain server-rendered HTML.
 *
 * Its job is to make one case workable — Case → Source → Chain → Instance →
 * exact source lines, with every surface reachable and every unbuilt surface
 * saying so. No client framework, no dashboard, no chart.
 *
 * Three rules the specification does not allow breaking: every row opens its
 * exact source, no page renders an unbounded list (R-08), and a surface that
 * does not exist reports one named condition rather than an empty list (R-07).
 */

import {
  EVIDENCE_V2_MAX_PAGE_SIZE,
  EVIDENCE_V2_SURFACES,
  type EvidenceV2CaseOverview,
  type EvidenceV2SurfaceGap,
  type EvidenceV2SurfaceId,
} from '@acme/evidence-v2-contracts';

export interface EvidenceV2Viewer {
  readonly principalRef: string;
  readonly displayLabel: string;
}

export interface EvidenceV2PageLink {
  readonly href: string;
  readonly label: string;
}

export interface EvidenceV2ListPage<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

const STYLES = `
  :root {
    --navy: #1a365d;
    --navy-deep: #142845;
    --ink: #0f172a;
    --sidebar: #1e293b;
    --line: #cbd5e1;
    --paper: #ffffff;
    --page: #f1f5f9;
    --muted: #475569;
    --amber: #fbbf24;
    --accept: #047857;
    --reject: #be123c;
    --revise: #b45309;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font: 14px/1.5 "Segoe UI", system-ui, sans-serif;
    color: #0f172a;
    background: var(--page);
    min-height: 100vh;
  }
  a { color: var(--navy); }
  a:hover { color: #152a48; }
  header.shell {
    background: var(--navy);
    color: #fff;
    position: sticky;
    top: 0;
    z-index: 20;
    box-shadow: 0 1px 0 rgba(15, 23, 42, 0.35);
  }
  header.shell a { color: inherit; text-decoration: none; }
  header.shell .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.55rem 1rem;
  }
  .brand { display: flex; align-items: center; gap: 0.75rem; }
  .brand-mark {
    width: 1.7rem; height: 1.95rem; border: 2px solid #93c5fd;
    border-radius: 0 0 40% 40%; display: inline-block; position: relative;
  }
  .brand-mark::before, .brand-mark::after {
    content: ""; position: absolute; left: 50%; background: #93c5fd;
  }
  .brand-mark::before { top: 0.35rem; width: 2px; height: 0.85rem; margin-left: -1px; }
  .brand-mark::after { top: 0.55rem; width: 0.85rem; height: 2px; margin-left: -0.42rem; }
  .brand-name { font-weight: 800; letter-spacing: 0.08em; font-size: 0.95rem; }
  .brand-badge {
    font: 600 0.65rem/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
    background: #e2e8f0; color: #1e293b; padding: 0.15rem 0.4rem; border-radius: 2px;
  }
  .brand-sub { display: block; font-size: 0.68rem; color: #cbd5e1; font-weight: 500;
               letter-spacing: 0.01em; }
  .case-chip {
    display: inline-flex; align-items: center; gap: 0.4rem;
    background: #2d3748; border: 1px solid #475569; color: #fff;
    padding: 0.35rem 0.7rem; border-radius: 4px;
    font: 600 0.78rem/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .case-chip .ref { color: #fbbf24; }
  header.shell .who {
    display: flex; align-items: center; gap: 0.6rem;
    font: 0.72rem/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #cbd5e1;
  }
  header.shell .who form { display: inline; margin: 0; }
  header.shell button {
    background: transparent; color: #e2e8f0; border: 1px solid #64748b;
    border-radius: 4px; padding: 0.2rem 0.5rem; cursor: pointer;
  }
  header.shell button:hover { background: #2d3748; }
  .crumbbar {
    background: var(--navy-deep);
    border-top: 1px solid rgba(148, 163, 184, 0.25);
    padding: 0.3rem 1rem;
    display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
    font: 0.7rem/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #cbd5e1;
  }
  nav.crumbs a { margin-right: 0.35rem; color: #e2e8f0; }
  nav.crumbs a::after { content: " /"; color: #64748b; }
  nav.crumbs a:last-child::after { content: ""; }
  .app { display: flex; align-items: stretch; min-height: calc(100vh - 5.2rem); }
  aside.rail {
    width: 16.5rem; flex-shrink: 0;
    background: var(--sidebar); color: #e2e8f0;
    border-right: 1px solid #334155;
    display: flex; flex-direction: column;
  }
  .rail-case { padding: 0.75rem 0.85rem; background: var(--ink);
               border-bottom: 1px solid #334155; }
  .rail-case .k { font: 0.62rem/1.3 ui-monospace, Menlo, monospace;
                  text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  .rail-case .n { font: 700 0.85rem/1.3 ui-monospace, Menlo, monospace; color: #fff; }
  .rail-case .t { font-size: 0.72rem; color: #94a3b8; margin-top: 0.15rem; }
  nav.surfaces { padding: 0.5rem; display: flex; flex-direction: column; gap: 0.2rem; }
  nav.surfaces a {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.5rem 0.7rem; border-radius: 4px;
    color: #cbd5e1; text-decoration: none;
    font-size: 0.75rem; font-weight: 600; letter-spacing: 0.02em;
    border-left: 4px solid transparent;
  }
  nav.surfaces a:hover { background: #0f172a; color: #fff; }
  nav.surfaces a[aria-current="page"] {
    background: var(--navy); color: #fff; border-left-color: var(--amber);
  }
  nav.surfaces a .pending { opacity: 0.6; font-size: 0.65rem; margin-left: 0.4rem; }
  .rail-foot {
    margin-top: auto; padding: 0.75rem 0.85rem; background: var(--ink);
    border-top: 1px solid #334155;
    font: 0.62rem/1.45 ui-monospace, Menlo, monospace; color: #94a3b8;
  }
  .rail-foot strong { display: block; color: #e2e8f0; margin-bottom: 0.2rem; }
  main { flex: 1; padding: 1.4rem 1.5rem 3rem; max-width: 78rem; }
  .banner, .card, form.stack, .gap {
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 1.1rem 1.2rem;
    margin: 0 0 1rem;
    box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
  }
  .banner { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .kicker {
    display: inline-block;
    background: var(--navy); color: #fff;
    font: 700 0.68rem/1.2 ui-monospace, Menlo, monospace;
    letter-spacing: 0.04em; padding: 0.18rem 0.45rem; border-radius: 3px;
  }
  h1 { font-size: 1.2rem; margin: 0.4rem 0 0.25rem; letter-spacing: -0.01em; }
  h2 { font-size: 0.78rem; margin: 1.25rem 0 0.5rem; text-transform: uppercase;
       letter-spacing: 0.06em; font-family: ui-monospace, Menlo, monospace; }
  .card > h2:first-child, .banner + h2 { margin-top: 0.15rem; }
  .muted { color: var(--muted); }
  table { border-collapse: collapse; width: 100%; font-size: 0.8rem; background: var(--paper); }
  .card table, main > table {
    border: 1px solid var(--line); border-radius: 8px; overflow: hidden;
  }
  th, td { text-align: left; padding: 0.55rem 0.7rem; border-bottom: 1px solid #e2e8f0;
           vertical-align: top; }
  th { font: 600 0.68rem/1.3 ui-monospace, Menlo, monospace; text-transform: uppercase;
       letter-spacing: 0.04em; color: #475569; background: #f8fafc; }
  tr:hover td { background: #f8fafc; }
  .pager { margin: 0.6rem 0 1.1rem; font: 0.72rem/1.4 ui-monospace, Menlo, monospace;
           color: var(--muted); }
  td.standing { white-space: nowrap; font-weight: 700; font-family: ui-monospace, Menlo, monospace;
                font-size: 0.72rem; }
  .standing-pending { color: #64748b; font-weight: 500; }
  .standing-accepted, .standing-reviewed { color: var(--accept); }
  .standing-rejected { color: var(--reject); }
  .standing-needs-revision, .standing-pending-review { color: var(--revise); }
  .standing-not-extracted { color: #64748b; font-weight: 500; }
  td.actions form { display: inline-flex; gap: 0.2rem; margin: 0 0.2rem 0.2rem 0; }
  td.actions input { width: 7rem; }
  .gap { border-left: 4px solid var(--navy); max-width: 44rem; }
  .gap h2 { margin-top: 0; }
  .gap .delivered { font-size: 0.8rem; color: var(--muted); }
  dl.counts { display: grid; grid-template-columns: 1fr auto; gap: 0; margin: 0;
              font-size: 0.85rem; }
  dl.counts dt, dl.counts dd {
    padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; margin: 0;
  }
  dl.counts dt { color: var(--muted); }
  dl.counts dd { font: 700 0.9rem/1.3 ui-monospace, Menlo, monospace;
                 font-variant-numeric: tabular-nums; text-align: right; }
  ol.lines { padding-left: 4.5rem; background: #f8fafc; border: 1px solid var(--line);
             border-radius: 8px; padding-top: 0.5rem; padding-bottom: 0.5rem; }
  ol.lines li { white-space: pre-wrap; font: 0.8rem/1.5 ui-monospace, Menlo, monospace; }
  form { margin: 0.75rem 0; }
  form.stack { display: flex; flex-direction: column; gap: 0.45rem; max-width: 36rem; }
  form.row { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
  input, button, textarea, select {
    font: inherit; padding: 0.4rem 0.55rem;
    border: 1px solid #94a3b8; border-radius: 4px; background: #fff;
  }
  textarea { width: 100%; max-width: 48rem; }
  button, input[type="submit"] {
    background: var(--navy); color: #fff; border-color: var(--navy);
    font: 700 0.75rem/1.2 ui-monospace, Menlo, monospace; cursor: pointer;
  }
  button:hover, input[type="submit"]:hover { background: #152a48; }
  .cta {
    display: block; background: linear-gradient(90deg, var(--navy), #2d3748);
    color: #fff; border-radius: 8px; padding: 1.1rem 1.25rem; margin: 0 0 1rem;
    text-decoration: none; border: 1px solid #334155;
  }
  .cta, .cta:hover { color: #fff; }
  .cta .tag {
    display: inline-block; background: var(--amber); color: #0f172a;
    font: 800 0.62rem/1.2 ui-monospace, Menlo, monospace;
    text-transform: uppercase; padding: 0.15rem 0.4rem; border-radius: 3px;
  }
  .cta h2 { color: #fff; text-transform: none; font: 700 1.05rem/1.3 sans-serif;
            letter-spacing: 0; margin: 0.4rem 0 0.2rem; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 900px) {
    .app { flex-direction: column; }
    aside.rail { width: 100%; }
    nav.surfaces { flex-direction: row; flex-wrap: wrap; }
    .grid-2 { grid-template-columns: 1fr; }
  }
`;

/** The case a page belongs to, and which surface it is. */
export interface EvidenceV2CaseContext {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly caseReference?: string;
  readonly active: EvidenceV2SurfaceId;
}

function surfaceHref(caseId: string, id: EvidenceV2SurfaceId): string {
  const base = `/cases/${encodeURIComponent(caseId)}`;
  if (id === 'case') return base;
  return `${base}/${id}`;
}

/**
 * Sidebar order follows the operator mock. Every ADR-0049 surface is still
 * present — including Consensus, which the mock omitted.
 */
const SURFACE_NAV: readonly {
  readonly id: EvidenceV2SurfaceId;
  readonly label: string;
}[] = [
  { id: 'status', label: '1. Overview' },
  { id: 'documents', label: '2. Sources / Documents' },
  { id: 'case', label: 'Case · import' },
  { id: 'chains', label: '3. Chains' },
  { id: 'claims', label: '4. Claims' },
  { id: 'relations', label: '5. Relations' },
  { id: 'timeline', label: '6. Timeline' },
  { id: 'consensus', label: '7. Consensus' },
];

/**
 * The surface bar.
 *
 * Built from the single surface list, so a surface cannot be present here and
 * absent from the status page, or vice versa. An unbuilt surface is a link,
 * not a hidden entry: hiding it would leave a person unable to find out
 * whether the product has it.
 */
function surfaceNav(context: EvidenceV2CaseContext): string {
  const byId = new Map(
    EVIDENCE_V2_SURFACES.map((surface) => [surface.id, surface]),
  );
  const items = SURFACE_NAV.map((entry) => {
    const surface = byId.get(entry.id);
    if (surface === undefined) return '';
    const current = entry.id === context.active ? ' aria-current="page"' : '';
    const pending =
      surface.state === 'not-implemented'
        ? '<span class="pending">not built</span>'
        : '';
    return (
      `<a href="${escapeHtml(surfaceHref(context.caseId, entry.id))}"${current}>` +
      `<span>${escapeHtml(entry.label)}</span>${pending}</a>`
    );
  }).join('');
  return `<nav class="surfaces">${items}</nav>`;
}

function pageBanner(input: {
  readonly kicker: string;
  readonly heading: string;
  readonly lead: string;
}): string {
  return `<div class="banner">
     <div>
       <span class="kicker">${escapeHtml(input.kicker)}</span>
       <h1>${escapeHtml(input.heading)}</h1>
       <p class="muted">${input.lead}</p>
     </div>
   </div>`;
}

/**
 * The shell every page renders inside.
 *
 * A page either belongs to a case — and then it carries the case identity and
 * the surface bar — or it does not, and then it is sign-in or the case list.
 * There is no third kind, which is what keeps "which case am I in" answerable
 * from every page.
 */
function layout(input: {
  readonly title: string;
  readonly breadcrumbs: readonly EvidenceV2PageLink[];
  readonly body: string;
  readonly viewer?: EvidenceV2Viewer;
  readonly context?: EvidenceV2CaseContext;
}): string {
  const trail = input.breadcrumbs
    .map(
      (item) =>
        `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`,
    )
    .join('');
  const who =
    input.viewer === undefined
      ? ''
      : `<span class="who">${escapeHtml(input.viewer.displayLabel)} ` +
        `<form method="post" action="/sign-out"><button type="submit">Sign out</button></form></span>`;
  const chip =
    input.context === undefined
      ? `<a class="case-chip" href="/">Cases</a>`
      : `<a class="case-chip" href="${escapeHtml(surfaceHref(input.context.caseId, 'case'))}">` +
        `[ Case: <span class="ref">${escapeHtml(input.context.caseReference ?? input.context.caseTitle)}</span> ]` +
        `</a>`;
  const rail =
    input.context === undefined
      ? ''
      : `<aside class="rail">
      <div class="rail-case">
        <div class="k">Active case</div>
        <div class="n">${escapeHtml(input.context.caseReference ?? input.context.caseId)}</div>
        <div class="t">${escapeHtml(input.context.caseTitle)}</div>
      </div>
      ${surfaceNav(input.context)}
      <div class="rail-foot">
        <strong>Evidence Workbench 2.0</strong>
        Append-only · every row opens its source
      </div>
    </aside>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title><style>${STYLES}</style></head>
<body>
<header class="shell">
  <div class="top">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>
        <span class="brand-name">EW</span>
        <span class="brand-badge">EVIDENCE WORKBENCH 2.0</span>
        <span class="brand-sub">Adaptive Context Memory Engine</span>
      </span>
    </div>
    ${chip}
    ${who}
  </div>
  <div class="crumbbar">
    <nav class="crumbs">${trail}</nav>
  </div>
</header>
<div class="app">${rail}<main>${input.body}</main></div>
</body></html>`;
}

/**
 * The page bound, stated rather than implied (R-08).
 *
 * A reader who cannot see that a list is truncated has been given a wrong
 * answer, not a short one.
 */
function pager(basePath: string, page: EvidenceV2ListPage<unknown>): string {
  const shown = page.items.length;
  const from = page.total === 0 ? 0 : page.offset + 1;
  const previous =
    page.offset > 0
      ? ` <a href="${escapeHtml(basePath)}?offset=${String(Math.max(0, page.offset - page.limit))}&amp;limit=${String(page.limit)}">previous</a>`
      : '';
  const next =
    page.offset + shown < page.total
      ? ` <a href="${escapeHtml(basePath)}?offset=${String(page.offset + page.limit)}&amp;limit=${String(page.limit)}">next</a>`
      : '';
  return (
    `<p class="pager">${String(from)}–${String(page.offset + shown)} of ` +
    `${String(page.total)} · page bound ${String(page.limit)} of at most ` +
    `${String(EVIDENCE_V2_MAX_PAGE_SIZE)}${previous}${next}</p>`
  );
}

/**
 * A surface that does not exist yet.
 *
 * It answers with its own condition and the task that delivers it. It must
 * never render an empty list: one case once reported 40 pending observations,
 * 0 observations, HTTP 409 and an empty timeline at the same time (R-07), and
 * an empty list for an absent surface is that same lie in a smaller shape.
 */
export function renderSurfaceGap(input: {
  readonly context: EvidenceV2CaseContext;
  readonly heading: string;
  readonly gap: EvidenceV2SurfaceGap;
  readonly viewer?: EvidenceV2Viewer;
}): string {
  return layout({
    title: `${input.heading} · ${input.context.caseTitle}`,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: surfaceHref(input.context.caseId, 'case'),
        label: input.context.caseTitle,
      },
      {
        href: surfaceHref(input.context.caseId, input.context.active),
        label: input.heading,
      },
    ],
    context: input.context,
    ...(input.viewer === undefined ? {} : { viewer: input.viewer }),
    body: `${pageBanner({
      kicker: input.heading,
      heading: input.heading,
      lead: "This is the product's state, not the case's.",
    })}
     <div class="gap">
       <h2>Not built</h2>
       <p>${escapeHtml(input.gap.reason)}</p>
       <p class="delivered">Delivered by ${escapeHtml(input.gap.deliveredBy)}.</p>
       <p class="muted">This is the product's state, not the case's. Nothing
       here is a statement about what this case contains.</p>
     </div>`,
  });
}

export interface EvidenceV2CaseRow {
  readonly caseId: string;
  readonly title: string;
  readonly caseReference: string;
  readonly createdAt: string;
}

/**
 * Sign-in. The only page an unauthenticated request may see, and it states
 * nothing about what exists behind it.
 */
export function renderSignIn(input: { readonly error?: string }): string {
  return layout({
    title: 'Sign in',
    breadcrumbs: [],
    body: `${pageBanner({
      kicker: 'Sign in',
      heading: 'Sign in',
      lead: 'Authentication is required before any case, source or chain is loaded.',
    })}
     ${input.error === undefined ? '' : `<div class="gap"><p>${escapeHtml(input.error)}</p></div>`}
     <form class="stack" method="post" action="/auth/session">
       <input name="email" type="email" placeholder="Email" required>
       <input name="password" type="password" placeholder="Password" required>
       <button type="submit">Sign in</button>
     </form>`,
  });
}

export function renderCases(
  page: EvidenceV2ListPage<EvidenceV2CaseRow>,
  viewer?: EvidenceV2Viewer,
): string {
  const rows = page.items
    .map(
      (item) =>
        `<tr><td><a href="/cases/${encodeURIComponent(item.caseId)}">${escapeHtml(item.title)}</a></td>` +
        `<td>${escapeHtml(item.caseReference)}</td><td class="muted">${escapeHtml(item.createdAt)}</td></tr>`,
    )
    .join('');
  return layout({
    title: 'Cases',
    breadcrumbs: [{ href: '/', label: 'Cases' }],
    ...(viewer === undefined ? {} : { viewer }),
    body: `${pageBanner({
      kicker: 'Cases',
      heading: 'Cases',
      lead: 'Open an existing case or create one. Content stays behind membership.',
    })}
     <form class="row" method="post" action="/cases">
       <input name="title" placeholder="Case title" required>
       <input name="caseReference" placeholder="Case reference" required>
       <button type="submit">Create case</button>
     </form>
     <div class="card">
     <table><thead><tr><th>Title</th><th>Reference</th><th>Created</th></tr></thead>
     <tbody>${rows || '<tr><td colspan="3" class="muted">No cases yet.</td></tr>'}</tbody></table>
     </div>
     ${pager('/', page)}`,
  });
}

export interface EvidenceV2ArtifactRow {
  readonly artifactId: string;
  readonly title: string;
  readonly lineCount: number;
  readonly partCount: number;
  readonly chainCount: number;
  readonly canonicalSha256: string;
  readonly importedAt: string;
}

/**
 * The case landing and the documents list.
 *
 * One renderer behind two URLs rather than two near-identical pages: `Case`
 * and `Documents` are distinct entries in ADR-0049's surface set, and the
 * sources are what both of them are about.
 */
export function renderCase(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly caseReference?: string;
  readonly active?: 'case' | 'documents';
  readonly artifacts: EvidenceV2ListPage<EvidenceV2ArtifactRow>;
  readonly viewer?: EvidenceV2Viewer;
}): string {
  const rows = input.artifacts.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.title)}</td>` +
        `<td class="muted">${String(item.lineCount)} lines</td>` +
        `<td><a href="/artifacts/${encodeURIComponent(item.artifactId)}/parts">${String(item.partCount)} parts</a></td>` +
        `<td><a href="/artifacts/${encodeURIComponent(item.artifactId)}/chains">${String(item.chainCount)} chains</a></td>` +
        `<td class="muted">sha256:${escapeHtml(item.canonicalSha256.slice(0, 16))}…</td></tr>`,
    )
    .join('');
  return layout({
    title: input.caseTitle,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      ...(input.caseReference === undefined
        ? {}
        : { caseReference: input.caseReference }),
      active: input.active ?? 'case',
    },
    ...(input.viewer === undefined ? {} : { viewer: input.viewer }),
    body: `${pageBanner({
      kicker:
        input.active === 'documents'
          ? '2. Sources / Documents'
          : 'Case · import',
      heading: input.caseTitle,
      lead: 'A source is either operator-prepared text or a PDF the product itself converts. The received PDF bytes are kept; the text is a named derivative. Image-only and encrypted PDFs are refused.',
    })}
     <div class="card">
     <h2>Import a PDF</h2>
     <form class="row" method="post" action="/cases/${encodeURIComponent(input.caseId)}/artifacts" enctype="multipart/form-data">
       <input name="title" placeholder="Title" required>
       <input name="file" type="file" accept="application/pdf" required>
       <button type="submit">Import PDF</button>
     </form>
     <h2>Import prepared text</h2>
     <form class="stack" method="post" action="/cases/${encodeURIComponent(input.caseId)}/artifacts">
       <input name="title" placeholder="Title" required>
       <textarea name="text" rows="6" cols="72" placeholder="Canonical UTF-8 text" required></textarea>
       <button type="submit">Import text</button>
     </form>
     </div>
     <div class="card">
     <h2>Sources</h2>
     <table><thead><tr><th>Title</th><th>Size</th><th>Parts</th><th>Chains</th><th>Canonical</th></tr></thead>
     <tbody>${rows || '<tr><td colspan="5" class="muted">No sources imported.</td></tr>'}</tbody></table>
     ${pager(`/cases/${input.caseId}`, input.artifacts)}
     </div>
     <p class="muted"><a href="/cases/${encodeURIComponent(input.caseId)}/status">What is in this case, and where to resume →</a></p>`,
  });
}

export interface EvidenceV2PartRow {
  readonly partId: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly contentCharacter: string;
  readonly title: string | null;
}

export function renderParts(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly artifactId: string;
  readonly artifactTitle: string;
  readonly parts: EvidenceV2ListPage<EvidenceV2PartRow>;
}): string {
  const rows = input.parts.items
    .map(
      (item) =>
        `<tr><td><a href="/artifacts/${encodeURIComponent(input.artifactId)}/parts/${encodeURIComponent(item.partId)}">${escapeHtml(item.partId)}</a></td>` +
        `<td class="muted">L${String(item.startLine)}–L${String(item.endLine)}</td>` +
        `<td class="muted">${escapeHtml(item.contentCharacter)}</td>` +
        `<td>${escapeHtml(item.title ?? '')}</td></tr>`,
    )
    .join('');
  return layout({
    title: `Source · ${input.artifactTitle}`,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/artifacts/${encodeURIComponent(input.artifactId)}/parts`,
        label: input.artifactTitle,
      },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      active: 'documents',
    },
    body: `${pageBanner({
      kicker: '2. Sources / Documents',
      heading: 'Source parts',
      lead: "A title is a label with its own provenance. It is not the document's identity and never its clock.",
    })}
     <div class="card">
     <table><thead><tr><th>Part</th><th>Lines</th><th>Character</th><th>Title (label)</th></tr></thead>
     <tbody>${rows}</tbody></table>
     ${pager(`/artifacts/${input.artifactId}/parts`, input.parts)}
     </div>`,
  });
}

export function renderPart(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly artifactId: string;
  readonly partId: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly contentCharacter: string;
  readonly title: string | null;
  readonly titleSourceLine: number | null;
  readonly lines: readonly string[];
  readonly unitCount: number;
  readonly chains: readonly {
    readonly chainId: string;
    readonly subjectLabel: string;
  }[];
}): string {
  const items = input.lines
    .map(
      (line, index) =>
        `<li value="${String(input.startLine + index)}">${escapeHtml(line)}</li>`,
    )
    .join('');
  const chains = input.chains
    .map(
      (chain) =>
        `<a href="/artifacts/${encodeURIComponent(input.artifactId)}/chains/${encodeURIComponent(chain.chainId)}">${escapeHtml(chain.subjectLabel)}</a>`,
    )
    .join(', ');
  return layout({
    title: input.partId,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/artifacts/${encodeURIComponent(input.artifactId)}/parts`,
        label: 'Source',
      },
      {
        href: `/artifacts/${encodeURIComponent(input.artifactId)}/parts/${encodeURIComponent(input.partId)}`,
        label: input.partId,
      },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      active: 'documents',
    },
    body: `${pageBanner({
      kicker: '2. Sources / Documents',
      heading: input.partId,
      lead: `L${String(input.startLine)}–L${String(input.endLine)} · ${escapeHtml(input.contentCharacter)} · ${String(input.unitCount)} citable units`,
    })}
     <div class="card">
     <p class="muted">Label: ${escapeHtml(input.title ?? '(none)')}${
       input.titleSourceLine === null
         ? ''
         : ` (from line ${String(input.titleSourceLine)})`
     }</p>
     <p>Chain: ${chains || '<span class="muted">unassigned</span>'}</p>
     <h2>Exact source</h2>
     <ol class="lines">${items}</ol>
     </div>`,
  });
}

export interface EvidenceV2ChainRow {
  readonly chainId: string;
  readonly subjectLabel: string;
  readonly caseFileRef: string | null;
  readonly instanceCount: number;
}

export function renderChains(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly artifactId: string;
  readonly chains: EvidenceV2ListPage<EvidenceV2ChainRow>;
}): string {
  const rows = input.chains.items
    .map(
      (item) =>
        `<tr><td><a href="/artifacts/${encodeURIComponent(input.artifactId)}/chains/${encodeURIComponent(item.chainId)}">${escapeHtml(item.subjectLabel)}</a></td>` +
        `<td class="muted">${escapeHtml(item.caseFileRef ?? '')}</td>` +
        `<td>${String(item.instanceCount)}</td></tr>`,
    )
    .join('');
  return layout({
    title: 'Chains',
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/artifacts/${encodeURIComponent(input.artifactId)}/chains`,
        label: 'Chains',
      },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      active: 'chains',
    },
    body: `${pageBanner({
      kicker: '3. Chains',
      heading: 'Chains',
      lead: "Subject and time are read from each document's body, never from a part title.",
    })}
     <div class="card">
     <table><thead><tr><th>Subject</th><th>Case file</th><th>Instances</th></tr></thead>
     <tbody>${rows}</tbody></table>
     ${pager(`/artifacts/${input.artifactId}/chains`, input.chains)}
     </div>`,
  });
}

export interface EvidenceV2InstanceRow {
  readonly reviewState?: 'not-extracted' | 'pending-review' | 'reviewed';
  readonly instanceKey?: string;
  readonly instanceOrdinal: number;
  readonly sourceTime: string;
  readonly kind: string;
  readonly sourceLine: number | null;
  readonly ordered: boolean;
  readonly sourcePartIds: readonly string[];
}

export interface EvidenceV2ChainCompletionRow {
  readonly complete: boolean;
  readonly instanceCount: number;
  readonly reviewedCount: number;
  readonly pendingReviewCount: number;
  readonly notExtractedCount: number;
}

export function renderChain(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly artifactId: string;
  readonly chainId: string;
  readonly subjectLabel: string;
  readonly caseFileRef: string | null;
  readonly instances: readonly EvidenceV2InstanceRow[];
  readonly completion?: EvidenceV2ChainCompletionRow;
}): string {
  const rows = input.instances
    .map((instance) => {
      const parts = instance.sourcePartIds
        .map(
          (partId) =>
            `<a href="/artifacts/${encodeURIComponent(input.artifactId)}/parts/${encodeURIComponent(partId)}">${escapeHtml(partId)}</a>`,
        )
        .join(' ');
      return (
        `<tr><td>#${String(instance.instanceOrdinal)}</td>` +
        `<td>${escapeHtml(instance.sourceTime)}</td>` +
        `<td class="muted">${escapeHtml(instance.kind)}${
          instance.ordered ? '' : ' · unordered'
        }</td>` +
        `<td class="muted">${instance.sourceLine === null ? '' : `line ${String(instance.sourceLine)}`}</td>` +
        `<td>${parts}</td>` +
        `<td class="standing standing-${escapeHtml(instance.reviewState ?? 'not-extracted')}">` +
        `<a href="/artifacts/${encodeURIComponent(input.artifactId)}/chains/${encodeURIComponent(input.chainId)}/instances/${encodeURIComponent(instance.instanceKey ?? '')}">` +
        `${escapeHtml(COMPLETION_LABEL[instance.reviewState ?? 'not-extracted'])}</a></td></tr>`
      );
    })
    .join('');
  return layout({
    title: input.subjectLabel,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/artifacts/${encodeURIComponent(input.artifactId)}/chains`,
        label: 'Chains',
      },
      {
        href: `/artifacts/${encodeURIComponent(input.artifactId)}/chains/${encodeURIComponent(input.chainId)}`,
        label: input.subjectLabel,
      },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      active: 'chains',
    },
    body: `${pageBanner({
      kicker: '3. Chains',
      heading: input.subjectLabel,
      lead: `${escapeHtml(input.caseFileRef ?? '')} · ${String(input.instances.length)} instances in source-time order`,
    })}
     <div class="card">
     <p>Chain state:
       <strong>${input.completion === undefined ? 'unknown' : input.completion.complete ? 'complete' : 'in progress'}</strong>
       ${
         input.completion === undefined
           ? ''
           : `<span class="muted">· ${String(input.completion.reviewedCount)} of ${String(input.completion.instanceCount)} instances reviewed, ` +
             `${String(input.completion.pendingReviewCount)} pending review, ` +
             `${String(input.completion.notExtractedCount)} not extracted</span>`
       }</p>
     <table><thead><tr><th>#</th><th>Source time</th><th>Precision</th><th>From</th><th>Parts</th><th>Review</th></tr></thead>
     <tbody>${rows}</tbody></table>
     </div>`,
  });
}

export interface EvidenceV2OccurrenceRow {
  readonly occurrenceId: string;
  readonly partId: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly kind: string;
  readonly exactQuote: string;
  readonly temporal: string | null;
}

export interface EvidenceV2WindowRow {
  readonly windowId: string;
  readonly status: string;
  readonly unitCount: number;
  readonly occurrenceCount: number;
  readonly failureCode: string | null;
}

/**
 * One instance: its occurrences against their exact source, and the state of
 * every extraction window.
 *
 * A partially complete extraction is shown as one, with the failed window and
 * its reason named. The frozen application showed a reviewer nothing at all in
 * that situation (R-05).
 */
/** What a reviewer decided about one occurrence, folded from the log. */
export interface EvidenceV2StandingRow {
  readonly occurrenceId: string;
  readonly standing: 'pending' | 'accepted' | 'rejected' | 'needs-revision';
  readonly principal: string | null;
  readonly decidedAt: string | null;
  readonly rationale: string | null;
  readonly decisionCount: number;
}

export interface EvidenceV2CompletionRow {
  readonly state: 'not-extracted' | 'pending-review' | 'reviewed';
  readonly occurrenceCount: number;
  readonly pendingCount: number;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly needsRevisionCount: number;
}

const COMPLETION_LABEL: Readonly<
  Record<EvidenceV2CompletionRow['state'], string>
> = {
  'not-extracted': 'not extracted',
  'pending-review': 'pending review',
  reviewed: 'reviewed',
};

export function renderInstance(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly artifactId: string;
  readonly chainId: string;
  readonly instanceKey: string;
  readonly subjectLabel: string;
  readonly instanceOrdinal: number;
  readonly sourceTime: string;
  readonly sourcePartIds: readonly string[];
  readonly occurrences: EvidenceV2ListPage<EvidenceV2OccurrenceRow>;
  readonly windows: readonly EvidenceV2WindowRow[];
  readonly standings: readonly EvidenceV2StandingRow[];
  readonly completion: EvidenceV2CompletionRow;
  readonly compare?: EvidenceV2ComparePlanRow;
  readonly extract?: EvidenceV2ExtractPlanRow;
  readonly csrfToken?: string;
  readonly viewer?: EvidenceV2Viewer;
}): string {
  const standingOf = new Map(
    input.standings.map((item) => [item.occurrenceId, item]),
  );
  const reviewPath = `/artifacts/${encodeURIComponent(input.artifactId)}/chains/${encodeURIComponent(input.chainId)}/instances/${encodeURIComponent(input.instanceKey)}/reviews`;
  const action = (
    occurrenceId: string,
    verb: 'accept' | 'reject' | 'revise',
    label: string,
  ): string =>
    `<form method="post" action="${escapeHtml(reviewPath)}">` +
    `<input type="hidden" name="occurrenceId" value="${escapeHtml(occurrenceId)}">` +
    `<input type="hidden" name="action" value="${verb}">` +
    `<input name="rationale" placeholder="Why?" required>` +
    `<button type="submit">${label}</button></form>`;
  const rows = input.occurrences.items
    .map((item) => {
      const standing = standingOf.get(item.occurrenceId);
      const state = standing?.standing ?? 'pending';
      const history =
        standing === undefined || standing.decisionCount === 0
          ? '<span class="muted">no decision</span>'
          : `${escapeHtml(standing.rationale ?? '')} <span class="muted">` +
            `(${escapeHtml(standing.decidedAt ?? '')}, ${String(standing.decisionCount)} decision` +
            `${standing.decisionCount === 1 ? '' : 's'})</span>`;
      return (
        `<tr><td><a href="/artifacts/${encodeURIComponent(input.artifactId)}/parts/${encodeURIComponent(item.partId)}">L${String(item.startLine)}–L${String(item.endLine)}</a></td>` +
        `<td class="muted">${escapeHtml(item.kind)}</td>` +
        `<td class="muted">${escapeHtml(item.temporal ?? '')}</td>` +
        `<td>${escapeHtml(item.exactQuote)}</td>` +
        `<td class="standing standing-${escapeHtml(state)}">${escapeHtml(state)}</td>` +
        `<td class="muted">${history}</td>` +
        `<td class="actions">${action(item.occurrenceId, 'accept', 'Accept')}` +
        `${action(item.occurrenceId, 'reject', 'Reject')}` +
        `${action(item.occurrenceId, 'revise', 'Revise')}</td></tr>`
      );
    })
    .join('');
  const windowRows = input.windows
    .map(
      (window) =>
        `<tr><td>${escapeHtml(window.windowId)}</td>` +
        `<td>${escapeHtml(window.status)}</td>` +
        `<td class="muted">${String(window.unitCount)} units</td>` +
        `<td>${String(window.occurrenceCount)}</td>` +
        `<td class="muted">${escapeHtml(window.failureCode ?? '')}</td></tr>`,
    )
    .join('');
  const outstanding = input.windows.length === 0;
  return layout({
    title: `${input.subjectLabel} #${String(input.instanceOrdinal)}`,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/artifacts/${encodeURIComponent(input.artifactId)}/chains`,
        label: 'Chains',
      },
      {
        href: `/artifacts/${encodeURIComponent(input.artifactId)}/chains/${encodeURIComponent(input.chainId)}`,
        label: input.subjectLabel,
      },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      active: 'chains',
    },
    body: `${pageBanner({
      kicker: '3.1 Instance review',
      heading: `${input.subjectLabel} · instance #${String(input.instanceOrdinal)}`,
      lead: `${escapeHtml(input.sourceTime)} · parts ${input.sourcePartIds.map((partId) => escapeHtml(partId)).join(', ')}`,
    })}
     ${renderExtractBlock(input)}
     <div class="card">
     <p>Review state:
       <strong>${escapeHtml(COMPLETION_LABEL[input.completion.state])}</strong>
       <span class="muted">· ${String(input.completion.acceptedCount)} accepted,
       ${String(input.completion.rejectedCount)} rejected,
       ${String(input.completion.needsRevisionCount)} need revision,
       ${String(input.completion.pendingCount)} undecided</span></p>
     <h2>Occurrences</h2>
     <p class="muted">Every quote is the cited source unit, verbatim. The model
     selected and classified; it wrote none of this text. A decision is
     appended, never applied over an earlier one — rejecting an occurrence
     removes nothing.</p>
     <table><thead><tr><th>Source</th><th>Kind</th><th>Stated time</th><th>Quote</th><th>Standing</th><th>Last decision</th><th>Review</th></tr></thead>
     <tbody>${rows || '<tr><td colspan="7" class="muted">No occurrences extracted yet.</td></tr>'}</tbody></table>
     ${pager(`/artifacts/${input.artifactId}/chains/${input.chainId}/instances/${input.instanceKey}`, input.occurrences)}
     </div>
     <div class="card">
     <h2>Add an occurrence</h2>
     <p class="muted">Cite a citable unit of this instance. The quote and the
     locator come from that unit, exactly as they do for the model — a
     reviewer cannot enter words the source does not contain.</p>
     <form method="post" action="/artifacts/${encodeURIComponent(input.artifactId)}/chains/${encodeURIComponent(input.chainId)}/instances/${encodeURIComponent(input.instanceKey)}/occurrences">
       <input name="unitId" placeholder="Citable unit id" required>
       <input name="rationale" placeholder="Why this is an occurrence" required>
       <button type="submit">Add</button>
     </form>
     </div>
     <div class="card">
     <h2>Extraction windows</h2>
     ${
       outstanding
         ? '<p class="muted">No window has been executed for this instance.</p>'
         : `<table><thead><tr><th>Window</th><th>State</th><th>Size</th><th>Occurrences</th><th>Reason</th></tr></thead><tbody>${windowRows}</tbody></table>`
     }
     </div>
     ${renderCompareBlock(input)}`,
  });
}

export interface EvidenceV2ExtractPlanRow {
  readonly plannedModelCalls: number;
  readonly windowCount: number;
  readonly outstandingCount: number;
  readonly committedCount: number;
}

function renderExtractBlock(input: {
  readonly artifactId: string;
  readonly chainId: string;
  readonly instanceKey: string;
  readonly extract?: EvidenceV2ExtractPlanRow;
}): string {
  if (input.extract === undefined) return '';
  const path = `/artifacts/${encodeURIComponent(input.artifactId)}/chains/${encodeURIComponent(input.chainId)}/instances/${encodeURIComponent(input.instanceKey)}/extraction`;
  if (input.extract.plannedModelCalls === 0)
    return `<div class="card"><h2>Extract observations</h2>
     <p>Extraction is complete. ${String(input.extract.committedCount)} window${input.extract.committedCount === 1 ? '' : 's'} committed, nothing outstanding.</p></div>`;
  return `<div class="card"><h2>Extract observations</h2>
     <p>J3 will observe this instance's own source parts. Earlier interviews
     are not shown to it.
     <strong>${String(input.extract.plannedModelCalls)} model call${input.extract.plannedModelCalls === 1 ? '' : 's'}</strong>
     planned across ${String(input.extract.windowCount)} window${input.extract.windowCount === 1 ? '' : 's'}
     <span class="muted">· ${String(input.extract.committedCount)} already committed</span>.</p>
     <form method="post" action="${escapeHtml(path)}">
       <button type="submit">Extract observations</button>
     </form></div>`;
}

export interface EvidenceV2ComparePlanRow {
  readonly reason: 'ready' | 'instance-not-reviewed' | 'no-prior-accepted';
  readonly plannedModelCalls: number;
  readonly windowCount: number;
  readonly outstandingCount: number;
  readonly committedCount: number;
}

function renderCompareBlock(input: {
  readonly artifactId: string;
  readonly chainId: string;
  readonly instanceKey: string;
  readonly compare?: EvidenceV2ComparePlanRow;
}): string {
  if (input.compare === undefined) return '';
  const path = `/artifacts/${encodeURIComponent(input.artifactId)}/chains/${encodeURIComponent(input.chainId)}/instances/${encodeURIComponent(input.instanceKey)}/comparison`;
  if (input.compare.reason === 'instance-not-reviewed')
    return `<div class="card"><h2>3.2 Compare with earlier instances</h2>
     <p class="muted">Comparison runs only after this instance is reviewed.
     Extraction stays blind: earlier interviews are not shown to it.</p></div>`;
  if (input.compare.reason === 'no-prior-accepted')
    return `<div class="card"><h2>3.2 Compare with earlier instances</h2>
     <p class="muted">No earlier instance in this chain has accepted
     occurrences to compare against.</p></div>`;
  if (input.compare.plannedModelCalls === 0)
    return `<div class="card"><h2>3.2 Compare with earlier instances</h2>
     <p>Comparison is complete. ${String(input.compare.committedCount)} window${input.compare.committedCount === 1 ? '' : 's'} committed, nothing outstanding.</p></div>`;
  return `<div class="card"><h2>3.2 Compare with earlier instances</h2>
     <p>J4 will compare this instance's accepted occurrences with frozen
     accepted occurrences of earlier instances in this chain.
     <strong>${String(input.compare.plannedModelCalls)} model call${input.compare.plannedModelCalls === 1 ? '' : 's'}</strong>
     planned across ${String(input.compare.windowCount)} window${input.compare.windowCount === 1 ? '' : 's'}
     <span class="muted">· ${String(input.compare.committedCount)} already committed</span>.</p>
     <form method="post" action="${escapeHtml(path)}">
       <button type="submit">Run comparison</button>
     </form></div>`;
}

/**
 * The case-scoped chains entry when the case holds more than one source.
 *
 * Chains belong to an artifact version, so a case with several sources has to
 * be asked which one. Naming that plainly beats guessing, and beats merging
 * two artifacts' chains into a list that belongs to neither.
 */
export function renderChainSourceChoice(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly caseReference?: string;
  readonly artifacts: EvidenceV2ListPage<EvidenceV2ArtifactRow>;
  readonly viewer?: EvidenceV2Viewer;
}): string {
  const rows = input.artifacts.items
    .map(
      (item) =>
        `<tr><td><a href="/artifacts/${encodeURIComponent(item.artifactId)}/chains">${escapeHtml(item.title)}</a></td>` +
        `<td class="muted">${String(item.chainCount)} chains</td>` +
        `<td class="muted">${String(item.partCount)} parts</td></tr>`,
    )
    .join('');
  const body =
    input.artifacts.total === 0
      ? `<div class="gap"><h2>No sources yet</h2>
         <p>Chains are proposed from a source's structure at import. This case
         has no source, so it has no chains — this is the case's state, not a
         missing feature.</p></div>`
      : `<p class="muted">Chains belong to one source version. Choose which
         source to work.</p>
         <table><thead><tr><th>Source</th><th>Chains</th><th>Parts</th></tr></thead>
         <tbody>${rows}</tbody></table>
         ${pager(`/cases/${input.caseId}/chains`, input.artifacts)}`;
  return layout({
    title: `Chains · ${input.caseTitle}`,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}/chains`,
        label: 'Chains',
      },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      ...(input.caseReference === undefined
        ? {}
        : { caseReference: input.caseReference }),
      active: 'chains',
    },
    ...(input.viewer === undefined ? {} : { viewer: input.viewer }),
    body: `${pageBanner({
      kicker: '3. Chains',
      heading: 'Chains',
      lead: 'Chains belong to one source version.',
    })}${body}`,
  });
}

export interface EvidenceV2ClaimRow {
  readonly claimId: string;
  readonly label: string;
  readonly statement: string;
  readonly contributorCount: number;
  readonly distinctInstances: number;
  readonly crossInstance: boolean;
  readonly accepted: number;
  readonly pending: number;
  readonly empty: boolean;
}

/**
 * The claims of one case.
 *
 * Counts of what each claim currently groups, and how widely. No score, no
 * ranking and no ordering by "strength": how much evidence a claim gathers is
 * not a statement about whether it holds.
 */
export function renderClaims(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly caseReference?: string;
  readonly claims: EvidenceV2ListPage<EvidenceV2ClaimRow>;
  readonly viewer?: EvidenceV2Viewer;
}): string {
  const rows = input.claims.items
    .map(
      (item) =>
        `<tr><td><a href="/cases/${encodeURIComponent(input.caseId)}/claims/${encodeURIComponent(item.claimId)}">${escapeHtml(item.label)}</a></td>` +
        `<td class="muted">${escapeHtml(item.statement)}</td>` +
        `<td>${item.empty ? '<span class="muted">empty</span>' : String(item.contributorCount)}</td>` +
        `<td class="muted">${String(item.distinctInstances)}${item.crossInstance ? ' · cross-source' : ''}</td>` +
        `<td class="muted">${String(item.accepted)} accepted, ${String(item.pending)} undecided</td></tr>`,
    )
    .join('');
  return layout({
    title: `Claims · ${input.caseTitle}`,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}/claims`,
        label: 'Claims',
      },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      ...(input.caseReference === undefined
        ? {}
        : { caseReference: input.caseReference }),
      active: 'claims',
    },
    ...(input.viewer === undefined ? {} : { viewer: input.viewer }),
    body: `${pageBanner({
      kicker: '4. Claims',
      heading: 'Claims',
      lead: 'A claim groups occurrences that concern one proposition. It never merges them, never absorbs them and never owns them: each stays an immutable occurrence with its own source and its own standing.',
    })}
     <form class="row" method="post" action="/cases/${encodeURIComponent(input.caseId)}/claims">
       <input name="label" placeholder="Label" required>
       <input name="statement" placeholder="What this groups" required>
       <button type="submit">Create claim</button>
     </form>
     <div class="card">
     <table><thead><tr><th>Claim</th><th>Groups</th><th>Occurrences</th><th>Instances</th><th>Standing</th></tr></thead>
     <tbody>${rows || '<tr><td colspan="5" class="muted">No claims yet.</td></tr>'}</tbody></table>
     ${pager(`/cases/${input.caseId}/claims`, input.claims)}
     </div>`,
  });
}

export interface EvidenceV2ClaimContributorRow {
  readonly occurrenceId: string;
  readonly artifactId: string;
  readonly instanceKey: string;
  readonly partId: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly exactQuote: string;
  readonly standing: 'pending' | 'accepted' | 'rejected' | 'needs-revision';
  readonly rationale: string;
}

/**
 * One claim and what it currently groups.
 *
 * Every contributor opens its exact source and carries its own standing. A
 * rejected contributor stays visible: hiding it would make the group look
 * cleaner than the evidence is.
 */
export function renderClaim(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly caseReference?: string;
  readonly claim: {
    readonly claimId: string;
    readonly label: string;
    readonly statement: string;
    readonly createdAt: string;
  };
  readonly projection: {
    readonly contributorCount: number;
    readonly distinctInstances: number;
    readonly distinctArtifacts: number;
    readonly crossInstance: boolean;
    readonly empty: boolean;
    readonly standingCounts: Readonly<Record<string, number>>;
    readonly contributors: readonly EvidenceV2ClaimContributorRow[];
  };
  readonly groupingCount: number;
  readonly viewer?: EvidenceV2Viewer;
}): string {
  const groupPath = `/cases/${encodeURIComponent(input.caseId)}/claims/${encodeURIComponent(input.claim.claimId)}`;
  const rows = input.projection.contributors
    .map(
      (item) =>
        `<tr><td><a href="/artifacts/${encodeURIComponent(item.artifactId)}/parts/${encodeURIComponent(item.partId)}">L${String(item.startLine)}–L${String(item.endLine)}</a></td>` +
        `<td class="muted">${escapeHtml(item.instanceKey)}</td>` +
        `<td>${escapeHtml(item.exactQuote)}</td>` +
        `<td class="standing standing-${escapeHtml(item.standing)}">${escapeHtml(item.standing)}</td>` +
        `<td class="muted">${escapeHtml(item.rationale)}</td>` +
        `<td class="actions"><form method="post" action="${escapeHtml(groupPath)}">` +
        `<input type="hidden" name="occurrenceId" value="${escapeHtml(item.occurrenceId)}">` +
        `<input type="hidden" name="action" value="exclude">` +
        `<input name="rationale" placeholder="Why?" required>` +
        `<button type="submit">Exclude</button></form></td></tr>`,
    )
    .join('');
  const counts = input.projection.standingCounts;
  const body = input.projection.empty
    ? `<div class="gap"><h2>Empty</h2>
       <p>This claim groups nothing. That is a statement about the claim, not
       about the case: an empty claim asserts nothing and supports nothing.</p>
       <p class="delivered">${String(input.groupingCount)} grouping decision${input.groupingCount === 1 ? '' : 's'} in its history.</p></div>`
    : `<p>${String(input.projection.contributorCount)} occurrences from
       ${String(input.projection.distinctInstances)} instance${input.projection.distinctInstances === 1 ? '' : 's'}
       ${input.projection.crossInstance ? '<strong>· cross-source</strong>' : ''}
       <span class="muted">· ${String(counts['accepted'] ?? 0)} accepted,
       ${String(counts['rejected'] ?? 0)} rejected,
       ${String(counts['needs-revision'] ?? 0)} need revision,
       ${String(counts['pending'] ?? 0)} undecided
       · ${String(input.groupingCount)} grouping decisions in history</span></p>
       <table><thead><tr><th>Source</th><th>Instance</th><th>Quote</th><th>Standing</th><th>Grouped because</th><th></th></tr></thead>
       <tbody>${rows}</tbody></table>`;
  return layout({
    title: `${input.claim.label} · ${input.caseTitle}`,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}/claims`,
        label: 'Claims',
      },
      { href: groupPath, label: input.claim.label },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      ...(input.caseReference === undefined
        ? {}
        : { caseReference: input.caseReference }),
      active: 'claims',
    },
    ...(input.viewer === undefined ? {} : { viewer: input.viewer }),
    body: `${pageBanner({
      kicker: '4. Claims',
      heading: input.claim.label,
      lead: escapeHtml(input.claim.statement),
    })}
     <div class="card">${body}</div>
     <div class="card">
     <h2>Group an occurrence</h2>
     <p class="muted">Grouping is a recorded decision. Excluding an occurrence
     later removes it from this claim and from nothing else.</p>
     <form method="post" action="${escapeHtml(groupPath)}">
       <input type="hidden" name="action" value="include">
       <input name="occurrenceId" placeholder="Occurrence id" required>
       <input name="rationale" placeholder="Why it belongs here" required>
       <button type="submit">Include</button>
     </form>
     </div>`,
  });
}

export interface EvidenceV2RelationRow {
  readonly relationId: string;
  readonly type: string;
  readonly provenance: string;
  readonly standing: 'pending' | 'accepted' | 'rejected' | 'needs-revision';
  readonly rationale: string;
  readonly fromLabel: string;
  readonly fromHref: string | null;
  readonly toLabel: string;
  readonly toHref: string | null;
}

export function renderRelations(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly caseReference?: string;
  readonly relations: EvidenceV2ListPage<EvidenceV2RelationRow>;
  readonly viewer?: EvidenceV2Viewer;
}): string {
  const rows = input.relations.items
    .map(
      (item) =>
        `<tr><td><a href="/cases/${encodeURIComponent(input.caseId)}/relations/${encodeURIComponent(item.relationId)}">${escapeHtml(item.type)}</a></td>` +
        `<td>${item.fromHref === null ? escapeHtml(item.fromLabel) : `<a href="${escapeHtml(item.fromHref)}">${escapeHtml(item.fromLabel)}</a>`}</td>` +
        `<td>${item.toHref === null ? escapeHtml(item.toLabel) : `<a href="${escapeHtml(item.toHref)}">${escapeHtml(item.toLabel)}</a>`}</td>` +
        `<td class="standing standing-${escapeHtml(item.standing)}">${escapeHtml(item.standing)}</td>` +
        `<td class="muted">${escapeHtml(item.provenance)}</td>` +
        `<td class="muted">${escapeHtml(item.rationale)}</td></tr>`,
    )
    .join('');
  return layout({
    title: `Relations · ${input.caseTitle}`,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}/relations`,
        label: 'Relations',
      },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      ...(input.caseReference === undefined
        ? {}
        : { caseReference: input.caseReference }),
      active: 'relations',
    },
    ...(input.viewer === undefined ? {} : { viewer: input.viewer }),
    body: `${pageBanner({
      kicker: '5. Relations',
      heading: 'Relations',
      lead: 'A typed statement about two endpoints. It never deletes either of them. The four verbs are contradicts, adds, supports and qualifies. A graph is not this surface: a thicker edge would read as importance, and no relation here states importance.',
    })}
     <form class="stack" method="post" action="/cases/${encodeURIComponent(input.caseId)}/relations">
       <input name="artifactId" placeholder="Artifact id" required>
       <input name="chainId" placeholder="Chain id" required>
       <input name="fromKind" placeholder="from kind (occurrence|claim)" required>
       <input name="fromId" placeholder="from id" required>
       <input name="toKind" placeholder="to kind (occurrence|claim)" required>
       <input name="toId" placeholder="to id" required>
       <input name="type" placeholder="contradicts|adds|supports|qualifies" required>
       <input name="actor" placeholder="actor scope" value="comparable">
       <input name="time" placeholder="time scope" value="comparable">
       <input name="location" placeholder="location scope" value="unknown">
       <input name="entity" placeholder="entity scope" value="unknown">
       <input name="rationale" placeholder="Why this relation" required>
       <button type="submit">Record relation</button>
     </form>
     <div class="card">
     <table><thead><tr><th>Type</th><th>From</th><th>To</th><th>Standing</th><th>Provenance</th><th>Rationale</th></tr></thead>
     <tbody>${rows || '<tr><td colspan="6" class="muted">No relations yet.</td></tr>'}</tbody></table>
     ${pager(`/cases/${input.caseId}/relations`, input.relations)}
     </div>`,
  });
}

export function renderRelation(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly caseReference?: string;
  readonly relation: {
    readonly relationId: string;
    readonly type: string;
    readonly provenance: string;
    readonly rationale: string;
    readonly createdAt: string;
    readonly comparableScope: {
      readonly actor: string;
      readonly time: string;
      readonly location: string;
      readonly entity: string;
    };
  };
  readonly standing: string;
  readonly decisionCount: number;
  readonly from: { readonly label: string; readonly href: string | null };
  readonly to: { readonly label: string; readonly href: string | null };
  readonly viewer?: EvidenceV2Viewer;
}): string {
  const path = `/cases/${encodeURIComponent(input.caseId)}/relations/${encodeURIComponent(input.relation.relationId)}`;
  const end = (
    item: { readonly label: string; readonly href: string | null },
    title: string,
  ): string =>
    `<h2>${escapeHtml(title)}</h2>
     <p>${item.href === null ? escapeHtml(item.label) : `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`}</p>`;
  const action = (verb: string, label: string): string =>
    `<form method="post" action="${escapeHtml(path)}">` +
    `<input type="hidden" name="action" value="${escapeHtml(verb)}">` +
    `<input name="rationale" placeholder="Why?" required>` +
    `<button type="submit">${escapeHtml(label)}</button></form>`;
  return layout({
    title: `${input.relation.type} · ${input.caseTitle}`,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}/relations`,
        label: 'Relations',
      },
      { href: path, label: input.relation.type },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      ...(input.caseReference === undefined
        ? {}
        : { caseReference: input.caseReference }),
      active: 'relations',
    },
    ...(input.viewer === undefined ? {} : { viewer: input.viewer }),
    body: `${pageBanner({
      kicker: '5. Relations',
      heading: input.relation.type,
      lead: escapeHtml(input.relation.rationale),
    })}
     <div class="card">
     <p class="standing standing-${escapeHtml(input.standing)}">${escapeHtml(input.standing)}</p>
     <p class="muted">${escapeHtml(input.relation.provenance)}
       · actor ${escapeHtml(input.relation.comparableScope.actor)},
       time ${escapeHtml(input.relation.comparableScope.time)},
       location ${escapeHtml(input.relation.comparableScope.location)},
       entity ${escapeHtml(input.relation.comparableScope.entity)}
       · ${String(input.decisionCount)} review decision${input.decisionCount === 1 ? '' : 's'}</p>
     ${end(input.from, 'From')}
     ${end(input.to, 'To')}
     <h2>Review</h2>
     <p class="muted">A decision is appended, never applied over an earlier
     one. Rejecting a relation deletes neither endpoint.</p>
     <div class="actions">${action('accept', 'Accept')}${action('reject', 'Reject')}${action('revise', 'Revise')}</div>
     </div>`,
  });
}

export interface EvidenceV2TimelineRow {
  readonly kind: 'occurrence' | 'claim';
  readonly id: string;
  readonly label: string;
  readonly exactQuote: string | null;
  readonly artifactId: string | null;
  readonly partId: string | null;
  readonly startLine: number | null;
  readonly endLine: number | null;
  readonly temporalKind: string;
  readonly from: string | null;
  readonly to: string | null;
  readonly ordered: boolean;
  readonly standing: string | null;
}

export function renderTimeline(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly caseReference?: string;
  readonly revision: string;
  readonly datedCount: number;
  readonly unorderedCount: number;
  readonly items: EvidenceV2ListPage<EvidenceV2TimelineRow>;
  readonly viewer?: EvidenceV2Viewer;
}): string {
  const rowOf = (item: EvidenceV2TimelineRow): string => {
    const source =
      item.artifactId !== null && item.partId !== null
        ? `<a href="/artifacts/${encodeURIComponent(item.artifactId)}/parts/${encodeURIComponent(item.partId)}">L${String(item.startLine)}–L${String(item.endLine)}</a>`
        : item.kind === 'claim'
          ? `<a href="/cases/${encodeURIComponent(input.caseId)}/claims/${encodeURIComponent(item.id)}">${escapeHtml(item.label)}</a>`
          : escapeHtml(item.id);
    const when = item.ordered
      ? `${escapeHtml(item.temporalKind)} ${escapeHtml(item.from ?? '')}`
      : `<span class="muted">unordered · ${escapeHtml(item.temporalKind)}</span>`;
    return (
      `<tr><td>${when}</td>` +
      `<td class="muted">${escapeHtml(item.kind)}</td>` +
      `<td>${source}</td>` +
      `<td>${item.exactQuote === null ? '' : escapeHtml(item.exactQuote)}</td>` +
      `<td class="muted">${escapeHtml(item.standing ?? '')}</td></tr>`
    );
  };
  const dated = input.items.items.filter((item) => item.ordered);
  const unordered = input.items.items.filter((item) => !item.ordered);
  return layout({
    title: `Timeline · ${input.caseTitle}`,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}/timeline`,
        label: 'Timeline',
      },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      ...(input.caseReference === undefined
        ? {}
        : { caseReference: input.caseReference }),
      active: 'timeline',
    },
    ...(input.viewer === undefined ? {} : { viewer: input.viewer }),
    body: `${pageBanner({
      kicker: '6. Timeline',
      heading: 'Timeline',
      lead: `The same occurrences, in time. Unknown time is not placed on the clock. Revision ${escapeHtml(input.revision.slice(0, 16))}… · ${String(input.datedCount)} dated, ${String(input.unorderedCount)} unordered.`,
    })}
     <div class="card">
     <table><thead><tr><th>When</th><th>Kind</th><th>Source</th><th>Quote</th><th>Standing</th></tr></thead>
     <tbody>${dated.map(rowOf).join('') || '<tr><td colspan="5" class="muted">No dated items on this page.</td></tr>'}</tbody></table>
     </div>
     <div class="card">
     <h2>Unordered</h2>
     <p class="muted">These have no usable calendar bound. The order below is
     by identity, not by time.</p>
     <table><thead><tr><th>When</th><th>Kind</th><th>Source</th><th>Quote</th><th>Standing</th></tr></thead>
     <tbody>${unordered.map(rowOf).join('') || '<tr><td colspan="5" class="muted">Nothing unordered on this page.</td></tr>'}</tbody></table>
     ${pager(`/cases/${input.caseId}/timeline`, input.items)}
     </div>`,
  });
}

export function renderConsensus(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly caseReference?: string;
  readonly revision: string;
  readonly aggregates: {
    readonly claimCount: number;
    readonly verdictCounts: Readonly<Record<string, number>>;
  };
  readonly claims: readonly {
    readonly claim: { readonly claimId: string; readonly label: string };
    readonly verdict: string;
    readonly acceptedContributorCount: number;
    readonly contributors: readonly {
      readonly occurrenceId: string;
      readonly artifactId: string;
      readonly partId: string;
      readonly startLine: number;
      readonly endLine: number;
      readonly exactQuote: string;
    }[];
  }[];
  readonly viewer?: EvidenceV2Viewer;
}): string {
  const v = input.aggregates.verdictCounts;
  const rows = input.claims
    .map((item) => {
      const sources = item.contributors
        .map(
          (contributor) =>
            `<a href="/artifacts/${encodeURIComponent(contributor.artifactId)}/parts/${encodeURIComponent(contributor.partId)}">L${String(contributor.startLine)}</a>`,
        )
        .join(' ');
      return (
        `<tr><td><a href="/cases/${encodeURIComponent(input.caseId)}/claims/${encodeURIComponent(item.claim.claimId)}">${escapeHtml(item.claim.label)}</a></td>` +
        `<td class="standing">${escapeHtml(item.verdict)}</td>` +
        `<td>${String(item.acceptedContributorCount)}</td>` +
        `<td>${sources}</td></tr>`
      );
    })
    .join('');
  return layout({
    title: `Consensus · ${input.caseTitle}`,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}/consensus`,
        label: 'Consensus',
      },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      ...(input.caseReference === undefined
        ? {}
        : { caseReference: input.caseReference }),
      active: 'consensus',
    },
    ...(input.viewer === undefined ? {} : { viewer: input.viewer }),
    body: `${pageBanner({
      kicker: '7. Consensus',
      heading: 'Consensus',
      lead: `What accepted material currently supports, contests, qualifies or leaves unresolved. The claim is the only subject. Revision ${escapeHtml(input.revision.slice(0, 16))}…`,
    })}
     <div class="card">
     <dl class="counts">
       <dt>Claims</dt><dd>${String(input.aggregates.claimCount)}</dd>
       <dt>Supported</dt><dd>${String(v['supported'] ?? 0)}</dd>
       <dt>Contested</dt><dd>${String(v['contested'] ?? 0)}</dd>
       <dt>Qualified</dt><dd>${String(v['qualified'] ?? 0)}</dd>
       <dt>Unresolved</dt><dd>${String(v['unresolved'] ?? 0)}</dd>
       <dt>Insufficient material</dt><dd>${String(v['insufficient-material'] ?? 0)}</dd>
     </dl>
     </div>
     <div class="card">
     <table><thead><tr><th>Claim</th><th>Verdict</th><th>Accepted</th><th>Sources</th></tr></thead>
     <tbody>${rows || '<tr><td colspan="4" class="muted">No claims yet. Consensus has nothing to compute.</td></tr>'}</tbody></table>
     </div>`,
  });
}

/**
 * The status surface: what this case contains, and where to resume.
 *
 * Counts only. No chart, no gauge, no score, no ranking (ADR-0049 §2). A count
 * is a fact about the workspace and never a finding, and the numbers here come
 * from the same stored rows the list routes page through, so the two cannot
 * disagree.
 */
export function renderCaseStatus(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly caseReference?: string;
  readonly overview: EvidenceV2CaseOverview;
  readonly viewer?: EvidenceV2Viewer;
}): string {
  const c = input.overview.counts;
  const row = (label: string, value: number): string =>
    `<dt>${escapeHtml(label)}</dt><dd>${value.toLocaleString('en-US')}</dd>`;
  const resume = input.overview.resumeAt;
  const resumeBlock =
    resume === null
      ? c.instances === 0
        ? '<div class="card"><p class="muted">Nothing to resume: this case has no chain instances yet. Import a source first.</p></div>'
        : '<div class="card"><p>Every instance has at least one committed extraction window.</p></div>'
      : `<a class="cta" href="/artifacts/${encodeURIComponent(resume.artifactId)}/chains/${encodeURIComponent(resume.chainId)}/instances/${encodeURIComponent(resume.instanceKey)}">` +
        `<span class="tag">Resume</span>` +
        `<h2>Next: ${escapeHtml(resume.subjectLabel)} · instance #${String(resume.instanceOrdinal)}</h2>` +
        `<p>One of ${String(input.overview.instancesWithoutExtraction)} with no committed extraction. Open review.</p></a>`;
  const gaps = Object.entries(input.overview.unavailable)
    .map(
      ([name, gap]) =>
        `<div class="gap"><h2>${escapeHtml(name)}</h2><p>${escapeHtml(gap.reason)}</p>` +
        `<p class="delivered">Delivered by ${escapeHtml(gap.deliveredBy)}.</p></div>`,
    )
    .join('');
  const gapBlock =
    gaps.length === 0
      ? ''
      : `<h2>Not built yet</h2>
     <p class="muted">These report their own condition rather than a number.
     Reporting zero would be a statement about this case; the true statement is
     about the product.</p>
     ${gaps}`;
  return layout({
    title: `Status · ${input.caseTitle}`,
    breadcrumbs: [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}/status`,
        label: 'Status',
      },
    ],
    context: {
      caseId: input.caseId,
      caseTitle: input.caseTitle,
      ...(input.caseReference === undefined
        ? {}
        : { caseReference: input.caseReference }),
      active: 'status',
    },
    ...(input.viewer === undefined ? {} : { viewer: input.viewer }),
    body: `${pageBanner({
      kicker: '1. Overview',
      heading: 'Status',
      lead: 'Counts over what is stored for this case. A count is a fact about the workspace, never a finding about the evidence.',
    })}
     ${resumeBlock}
     <div class="grid-2">
     <div class="card">
     <h2>Contents</h2>
     <dl class="counts">
       ${row('Sources', c.artifacts)}
       ${row('Lines', c.lines)}
       ${row('Source parts', c.parts)}
       ${row('Citable units', c.citableUnits)}
       ${row('Chains', c.chains)}
       ${row('Chain instances', c.instances)}
       ${row('Membership decisions', c.chainDecisions)}
     </dl>
     <h2>Extraction</h2>
     <dl class="counts">
       ${row('Occurrences', c.occurrences)}
       ${row('Committed windows', c.committedWindows)}
       ${row('Failed windows', c.failedWindows)}
       ${row('Instances without extraction', input.overview.instancesWithoutExtraction)}
     </dl>
     </div>
     <div class="card">
     <h2>Review</h2>
     <p class="muted">Standing is folded from the append-only decision log on
     every read. Nothing here is a stored field, and rejecting an occurrence
     removes nothing.</p>
     <dl class="counts">
       ${row('Decisions appended', c.reviewDecisions)}
       ${row('Accepted', c.accepted)}
       ${row('Rejected', c.rejected)}
       ${row('Needing revision', c.needsRevision)}
       ${row('Undecided', c.pending)}
       ${row('Reviewer-authored occurrences', c.reviewerAuthored)}
       ${row('Instances pending review', input.overview.instancesPendingReview)}
     </dl>
     <h2>Claims</h2>
     <dl class="counts">
       ${row('Claims', c.claims)}
       ${row('Grouping decisions', c.claimGroupingDecisions)}
       ${row('Grouped occurrences', c.groupedOccurrences)}
       ${row('Claims spanning several instances', c.crossInstanceClaims)}
     </dl>
     <h2>Consensus</h2>
     <p class="muted">Per claim, from accepted material only. The case does
     not have a verdict of its own.</p>
     <dl class="counts">
       ${row('Supported', c.consensusSupported)}
       ${row('Contested', c.consensusContested)}
       ${row('Qualified', c.consensusQualified)}
       ${row('Unresolved', c.consensusUnresolved)}
       ${row('Insufficient material', c.consensusInsufficient)}
     </dl>
     <h2>Relations</h2>
     <p class="muted">A relation never deletes an endpoint. Standing is
     folded from the append-only review log.</p>
     <dl class="counts">
       ${row('Relations', c.relations)}
       ${row('Review decisions', c.relationReviewDecisions)}
       ${row('Accepted', c.acceptedRelations)}
       ${row('Rejected', c.rejectedRelations)}
       ${row('Undecided', c.pendingRelations)}
       ${row('Model-proposed', c.modelProposedRelations)}
       ${row('Reviewer-authored', c.reviewerAuthoredRelations)}
     </dl>
     </div>
     </div>
     ${gapBlock}`,
  });
}
