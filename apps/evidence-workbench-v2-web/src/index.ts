/**
 * V2 browser surface: plain server-rendered HTML.
 *
 * Deliberately unfinished-looking. Its job is to prove navigation and
 * provenance — Case → Source → Chain → Instance → exact source lines — not to
 * look like a product. No client framework, no dashboard, no chart.
 *
 * Two rules the specification does not allow breaking: every row opens its
 * exact source, and no page renders an unbounded list.
 */

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
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
         margin: 0; padding: 1.5rem; max-width: 70rem; }
  h1 { font-size: 1.1rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1rem; margin: 1.5rem 0 0.5rem; }
  nav { margin-bottom: 1rem; font-size: 0.85rem; }
  nav a { margin-right: 0.75rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th, td { text-align: left; padding: 0.3rem 0.6rem 0.3rem 0;
           border-bottom: 1px solid rgba(128,128,128,0.3); vertical-align: top; }
  .muted { opacity: 0.65; }
  .pager { margin-top: 0.75rem; font-size: 0.85rem; }
  ol.lines { padding-left: 4.5rem; }
  ol.lines li { white-space: pre-wrap; }
  form { margin: 0.75rem 0; }
  input, button { font: inherit; padding: 0.25rem 0.4rem; }
`;

function layout(
  title: string,
  breadcrumbs: readonly EvidenceV2PageLink[],
  body: string,
): string {
  const trail = breadcrumbs
    .map(
      (item) =>
        `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${STYLES}</style></head>
<body><nav>${trail}</nav>${body}</body></html>`;
}

function pager(basePath: string, page: EvidenceV2ListPage<unknown>): string {
  const shown = page.items.length;
  const from = page.total === 0 ? 0 : page.offset + 1;
  const previous =
    page.offset > 0
      ? `<a href="${escapeHtml(basePath)}?offset=${String(Math.max(0, page.offset - page.limit))}&amp;limit=${String(page.limit)}">previous</a> `
      : '';
  const next =
    page.offset + shown < page.total
      ? `<a href="${escapeHtml(basePath)}?offset=${String(page.offset + page.limit)}&amp;limit=${String(page.limit)}">next</a>`
      : '';
  return `<p class="pager">${String(from)}–${String(page.offset + shown)} of ${String(page.total)} ${previous}${next}</p>`;
}

export interface EvidenceV2CaseRow {
  readonly caseId: string;
  readonly title: string;
  readonly caseReference: string;
  readonly createdAt: string;
}

export function renderCases(
  page: EvidenceV2ListPage<EvidenceV2CaseRow>,
): string {
  const rows = page.items
    .map(
      (item) =>
        `<tr><td><a href="/cases/${encodeURIComponent(item.caseId)}">${escapeHtml(item.title)}</a></td>` +
        `<td>${escapeHtml(item.caseReference)}</td><td class="muted">${escapeHtml(item.createdAt)}</td></tr>`,
    )
    .join('');
  return layout(
    'Cases',
    [{ href: '/', label: 'Cases' }],
    `<h1>Cases</h1>
     <form method="post" action="/cases">
       <input name="title" placeholder="Case title" required>
       <input name="caseReference" placeholder="Case reference" required>
       <button type="submit">Create case</button>
     </form>
     <table><thead><tr><th>Title</th><th>Reference</th><th>Created</th></tr></thead>
     <tbody>${rows || '<tr><td colspan="3" class="muted">No cases yet.</td></tr>'}</tbody></table>
     ${pager('/', page)}`,
  );
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

export function renderCase(input: {
  readonly caseId: string;
  readonly caseTitle: string;
  readonly artifacts: EvidenceV2ListPage<EvidenceV2ArtifactRow>;
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
  return layout(
    input.caseTitle,
    [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
    ],
    `<h1>${escapeHtml(input.caseTitle)}</h1>
     <p class="muted">Import canonical text with
     <code>POST /api/cases/${escapeHtml(input.caseId)}/artifacts</code>.</p>
     <h2>Sources</h2>
     <table><thead><tr><th>Title</th><th>Size</th><th>Parts</th><th>Chains</th><th>Canonical</th></tr></thead>
     <tbody>${rows || '<tr><td colspan="5" class="muted">No sources imported.</td></tr>'}</tbody></table>
     ${pager(`/cases/${input.caseId}`, input.artifacts)}`,
  );
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
  return layout(
    `Source · ${input.artifactTitle}`,
    [
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
        href: `/artifacts/${encodeURIComponent(input.artifactId)}/chains`,
        label: 'Chains',
      },
    ],
    `<h1>Source parts</h1>
     <p class="muted">A title is a label with its own provenance. It is not the
     document's identity and never its clock.</p>
     <table><thead><tr><th>Part</th><th>Lines</th><th>Character</th><th>Title (label)</th></tr></thead>
     <tbody>${rows}</tbody></table>
     ${pager(`/artifacts/${input.artifactId}/parts`, input.parts)}`,
  );
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
  return layout(
    input.partId,
    [
      { href: '/', label: 'Cases' },
      {
        href: `/cases/${encodeURIComponent(input.caseId)}`,
        label: input.caseTitle,
      },
      {
        href: `/artifacts/${encodeURIComponent(input.artifactId)}/parts`,
        label: 'Source',
      },
    ],
    `<h1>${escapeHtml(input.partId)}</h1>
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
  );
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
  return layout(
    'Chains',
    [
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
        href: `/artifacts/${encodeURIComponent(input.artifactId)}/chains`,
        label: 'Chains',
      },
    ],
    `<h1>Chains</h1>
     <p class="muted">Subject and time are read from each document's body, never
     from a part title.</p>
     <table><thead><tr><th>Subject</th><th>Case file</th><th>Instances</th></tr></thead>
     <tbody>${rows}</tbody></table>
     ${pager(`/artifacts/${input.artifactId}/chains`, input.chains)}`,
  );
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
  return layout(
    input.subjectLabel,
    [
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
    `<h1>${escapeHtml(input.subjectLabel)}</h1>
     <p class="muted">${escapeHtml(input.caseFileRef ?? '')} · ${String(input.instances.length)} instances in source-time order</p>
     <table><thead><tr><th>#</th><th>Source time</th><th>Precision</th><th>From</th><th>Parts</th></tr></thead>
     <tbody>${rows}</tbody></table>`,
  );
}
