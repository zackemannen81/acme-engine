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
  EVIDENCE_V2_SURFACE_GAPS,
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
  :root { color-scheme: light dark; --line: rgba(128,128,128,0.3); }
  body { font: 15px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace;
         margin: 0; padding: 0; }
  main { padding: 1.25rem 1.5rem 3rem; max-width: 78rem; }
  h1 { font-size: 1.15rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1rem; margin: 1.75rem 0 0.5rem; }
  header.shell { border-bottom: 1px solid var(--line); padding: 0.6rem 1.5rem 0; }
  header.shell .top { display: flex; justify-content: space-between;
                      align-items: baseline; gap: 1rem; flex-wrap: wrap; }
  header.shell .case { font-weight: 600; }
  header.shell .case .ref { opacity: 0.6; font-weight: 400; margin-left: 0.5rem; }
  header.shell .who { opacity: 0.75; font-size: 0.85rem; }
  header.shell .who form { display: inline; margin: 0; }
  nav.surfaces { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-top: 0.6rem; }
  nav.surfaces a { padding: 0.3rem 0.7rem; text-decoration: none;
                   border: 1px solid transparent; border-bottom: none;
                   border-radius: 4px 4px 0 0; font-size: 0.9rem; }
  nav.surfaces a[aria-current="page"] { border-color: var(--line);
                   background: rgba(128,128,128,0.12); font-weight: 600; }
  nav.surfaces a .pending { opacity: 0.55; font-size: 0.75rem; margin-left: 0.35rem; }
  nav.crumbs { font-size: 0.85rem; padding: 0.6rem 0 0; opacity: 0.85; }
  nav.crumbs a { margin-right: 0.5rem; }
  nav.crumbs a::after { content: ' /'; opacity: 0.4; }
  nav.crumbs a:last-child::after { content: ''; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th, td { text-align: left; padding: 0.35rem 0.7rem 0.35rem 0;
           border-bottom: 1px solid var(--line); vertical-align: top; }
  .muted { opacity: 0.65; }
  .pager { margin-top: 0.75rem; font-size: 0.8rem; opacity: 0.8; }
  .gap { border: 1px solid var(--line); border-left-width: 3px;
         padding: 0.8rem 1rem; margin: 1rem 0; max-width: 44rem; }
  .gap h2 { margin-top: 0; }
  .gap .delivered { font-size: 0.85rem; opacity: 0.7; }
  dl.counts { display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 1.25rem;
              margin: 0.5rem 0 0; font-size: 0.9rem; max-width: 32rem; }
  dl.counts dt { opacity: 0.7; }
  dl.counts dd { margin: 0; font-variant-numeric: tabular-nums; }
  ol.lines { padding-left: 4.5rem; }
  ol.lines li { white-space: pre-wrap; }
  form { margin: 0.75rem 0; }
  input, button { font: inherit; padding: 0.25rem 0.4rem; }
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
 * The surface bar.
 *
 * Built from the single surface list, so a surface cannot be present here and
 * absent from the status page, or vice versa. An unbuilt surface is a link,
 * not a hidden entry: hiding it would leave a person unable to find out
 * whether the product has it.
 */
function surfaceNav(context: EvidenceV2CaseContext): string {
  const items = EVIDENCE_V2_SURFACES.map((surface) => {
    const current = surface.id === context.active ? ' aria-current="page"' : '';
    const pending =
      surface.state === 'not-implemented'
        ? '<span class="pending">not built</span>'
        : '';
    return (
      `<a href="${escapeHtml(surfaceHref(context.caseId, surface.id))}"${current}>` +
      `${escapeHtml(surface.label)}${pending}</a>`
    );
  }).join('');
  return `<nav class="surfaces">${items}</nav>`;
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
  const identity =
    input.context === undefined
      ? '<span class="case"><a href="/">Evidence Workbench</a></span>'
      : `<span class="case"><a href="${escapeHtml(surfaceHref(input.context.caseId, 'case'))}">` +
        `${escapeHtml(input.context.caseTitle)}</a>` +
        (input.context.caseReference === undefined
          ? ''
          : `<span class="ref">${escapeHtml(input.context.caseReference)}</span>`) +
        '</span>';
  const surfaces = input.context === undefined ? '' : surfaceNav(input.context);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title><style>${STYLES}</style></head>
<body>
<header class="shell">
  <div class="top">${identity}${who}</div>
  ${surfaces}
  <nav class="crumbs">${trail}</nav>
</header>
<main>${input.body}</main>
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
    body: `<h1>${escapeHtml(input.heading)}</h1>
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
    body: `<h1>Sign in</h1>
     <p class="muted">Authentication is required before any case, source or
     chain is loaded.</p>
     ${input.error === undefined ? '' : `<p class="muted">${escapeHtml(input.error)}</p>`}
     <form method="post" action="/auth/session">
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
    body: `<h1>Cases</h1>
     <form method="post" action="/cases">
       <input name="title" placeholder="Case title" required>
       <input name="caseReference" placeholder="Case reference" required>
       <button type="submit">Create case</button>
     </form>
     <table><thead><tr><th>Title</th><th>Reference</th><th>Created</th></tr></thead>
     <tbody>${rows || '<tr><td colspan="3" class="muted">No cases yet.</td></tr>'}</tbody></table>
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
    body: `<h1>${escapeHtml(input.caseTitle)}</h1>
     <p class="muted">Import canonical text with
     <code>POST /api/cases/${escapeHtml(input.caseId)}/artifacts</code>.</p>
     <h2>Sources</h2>
     <table><thead><tr><th>Title</th><th>Size</th><th>Parts</th><th>Chains</th><th>Canonical</th></tr></thead>
     <tbody>${rows || '<tr><td colspan="5" class="muted">No sources imported.</td></tr>'}</tbody></table>
     ${pager(`/cases/${input.caseId}`, input.artifacts)}
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
    body: `<h1>Source parts</h1>
     <p class="muted">A title is a label with its own provenance. It is not the
     document's identity and never its clock.</p>
     <table><thead><tr><th>Part</th><th>Lines</th><th>Character</th><th>Title (label)</th></tr></thead>
     <tbody>${rows}</tbody></table>
     ${pager(`/artifacts/${input.artifactId}/parts`, input.parts)}`,
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
    body: `<h1>${escapeHtml(input.partId)}</h1>
     <p class="muted">L${String(input.startLine)}–L${String(input.endLine)} ·
     ${escapeHtml(input.contentCharacter)} · ${String(input.unitCount)} citable units</p>
     <p class="muted">Label: ${escapeHtml(input.title ?? '(none)')}${
       input.titleSourceLine === null
         ? ''
         : ` (from line ${String(input.titleSourceLine)})`
     }</p>
     <p>Chain: ${chains || '<span class="muted">unassigned</span>'}</p>
     <h2>Exact source</h2>
     <ol class="lines">${items}</ol>`,
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
    body: `<h1>Chains</h1>
     <p class="muted">Subject and time are read from each document's body, never
     from a part title.</p>
     <table><thead><tr><th>Subject</th><th>Case file</th><th>Instances</th></tr></thead>
     <tbody>${rows}</tbody></table>
     ${pager(`/artifacts/${input.artifactId}/chains`, input.chains)}`,
  });
}

export interface EvidenceV2InstanceRow {
  readonly instanceOrdinal: number;
  readonly sourceTime: string;
  readonly kind: string;
  readonly sourceLine: number | null;
  readonly ordered: boolean;
  readonly sourcePartIds: readonly string[];
}

export function renderChain(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly artifactId: string;
  readonly chainId: string;
  readonly subjectLabel: string;
  readonly caseFileRef: string | null;
  readonly instances: readonly EvidenceV2InstanceRow[];
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
        `<td>${parts}</td></tr>`
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
    body: `<h1>${escapeHtml(input.subjectLabel)}</h1>
     <p class="muted">${escapeHtml(input.caseFileRef ?? '')} · ${String(input.instances.length)} instances in source-time order</p>
     <table><thead><tr><th>#</th><th>Source time</th><th>Precision</th><th>From</th><th>Parts</th></tr></thead>
     <tbody>${rows}</tbody></table>`,
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
export function renderInstance(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly artifactId: string;
  readonly chainId: string;
  readonly subjectLabel: string;
  readonly instanceOrdinal: number;
  readonly sourceTime: string;
  readonly sourcePartIds: readonly string[];
  readonly occurrences: EvidenceV2ListPage<EvidenceV2OccurrenceRow>;
  readonly windows: readonly EvidenceV2WindowRow[];
  readonly viewer?: EvidenceV2Viewer;
}): string {
  const rows = input.occurrences.items
    .map(
      (item) =>
        `<tr><td><a href="/artifacts/${encodeURIComponent(input.artifactId)}/parts/${encodeURIComponent(item.partId)}">L${String(item.startLine)}–L${String(item.endLine)}</a></td>` +
        `<td class="muted">${escapeHtml(item.kind)}</td>` +
        `<td class="muted">${escapeHtml(item.temporal ?? '')}</td>` +
        `<td>${escapeHtml(item.exactQuote)}</td></tr>`,
    )
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
    body: `<h1>${escapeHtml(input.subjectLabel)} · instance #${String(input.instanceOrdinal)}</h1>
     <p class="muted">${escapeHtml(input.sourceTime)} · parts ${input.sourcePartIds
       .map((partId) => escapeHtml(partId))
       .join(', ')}</p>
     <h2>Occurrences</h2>
     <p class="muted">Every quote is the cited source unit, verbatim. The model
     selected and classified; it wrote none of this text.</p>
     <table><thead><tr><th>Source</th><th>Kind</th><th>Stated time</th><th>Quote</th></tr></thead>
     <tbody>${rows || '<tr><td colspan="4" class="muted">No occurrences extracted yet.</td></tr>'}</tbody></table>
     ${pager(`/artifacts/${input.artifactId}/chains/${input.chainId}/instances/${input.instanceOrdinal}`, input.occurrences)}
     <h2>Extraction windows</h2>
     ${
       outstanding
         ? '<p class="muted">No window has been executed for this instance.</p>'
         : `<table><thead><tr><th>Window</th><th>State</th><th>Size</th><th>Occurrences</th><th>Reason</th></tr></thead><tbody>${windowRows}</tbody></table>`
     }
     <h2>Standing</h2>
     <div class="gap">
       <p>${escapeHtml(EVIDENCE_V2_SURFACE_GAPS.standing.reason)}</p>
       <p class="delivered">Delivered by ${escapeHtml(EVIDENCE_V2_SURFACE_GAPS.standing.deliveredBy)}.</p>
     </div>`,
  });
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
    body: `<h1>Chains</h1>${body}`,
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
        ? '<p class="muted">Nothing to resume: this case has no chain instances yet. Import a source first.</p>'
        : '<p>Every instance has at least one committed extraction window.</p>'
      : `<p>Next: <a href="/artifacts/${encodeURIComponent(resume.artifactId)}/chains/${encodeURIComponent(resume.chainId)}/instances/${encodeURIComponent(resume.instanceKey)}">` +
        `${escapeHtml(resume.subjectLabel)} · instance #${String(resume.instanceOrdinal)}</a> ` +
        `<span class="muted">— one of ${String(input.overview.instancesWithoutExtraction)} with no committed extraction.</span></p>`;
  const gaps = Object.entries(input.overview.unavailable)
    .map(
      ([name, gap]) =>
        `<div class="gap"><h2>${escapeHtml(name)}</h2><p>${escapeHtml(gap.reason)}</p>` +
        `<p class="delivered">Delivered by ${escapeHtml(gap.deliveredBy)}.</p></div>`,
    )
    .join('');
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
    body: `<h1>Status</h1>
     <p class="muted">Counts over what is stored for this case. A count is a
     fact about the workspace, never a finding about the evidence.</p>
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
     <h2>Resume</h2>
     ${resumeBlock}
     <h2>Not built yet</h2>
     <p class="muted">These report their own condition rather than a number.
     Reporting zero would be a statement about this case; the true statement is
     about the product.</p>
     ${gaps}`,
  });
}
