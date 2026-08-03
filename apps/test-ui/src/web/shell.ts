import { escapeHtml } from './escape.js';
import { WORKBENCH_CSS } from './styles.js';

export type WorkbenchSurface =
  's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 's9' | 's10';

const NAV: readonly {
  readonly id: WorkbenchSurface;
  readonly label: string;
}[] = [
  { id: 's1', label: 'S1 Catalog' },
  { id: 's2', label: 'S2 Plan' },
  { id: 's3', label: 'S3 Runs' },
  { id: 's4', label: 'S4 Execution' },
  { id: 's5', label: 'S5 Memory' },
  { id: 's6', label: 'S6 State' },
  { id: 's7', label: 'S7 Replay' },
  { id: 's8', label: 'S8 Measurement' },
  { id: 's9', label: 'S9 Fixtures' },
  { id: 's10', label: 'S10 Live' },
];

export function renderShell(options: {
  readonly title: string;
  readonly surface: WorkbenchSurface;
  readonly body: string;
  readonly subtitle?: string;
}): string {
  const links = NAV.map((entry) => {
    const current = entry.id === options.surface ? ' aria-current="page"' : '';
    return `<a href="/${entry.id}"${current}>${escapeHtml(entry.label)}</a>`;
  }).join('\n');

  const subtitle =
    options.subtitle === undefined
      ? ''
      : `<p>${escapeHtml(options.subtitle)}</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(options.title)} · ACME Test UI</title>
<style>${WORKBENCH_CSS}</style>
</head>
<body>
<div class="shell">
<nav aria-label="Surfaces">
<h1>ACME Test UI</h1>
${links}
</nav>
<main>
<header class="page">
<h2>${escapeHtml(options.title)}</h2>
${subtitle}
</header>
${options.body}
</main>
</div>
</body>
</html>`;
}

export function renderStubSurface(options: {
  readonly surface: WorkbenchSurface;
  readonly title: string;
  readonly contractVersion: string;
}): string {
  const body = `<section class="card">
<p class="meta">Contract <code>${escapeHtml(options.contractVersion)}</code></p>
<p>This surface is not rendered in the first visual slice (ACME-0045). The
JSON view contract remains the verification deliverable; open it from
TypeScript or a later renderer charter.</p>
</section>`;
  return renderShell({
    title: options.title,
    surface: options.surface,
    subtitle: 'Stub — contract named, not painted.',
    body,
  });
}
