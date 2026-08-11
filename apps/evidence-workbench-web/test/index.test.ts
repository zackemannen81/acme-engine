import { describe, expect, it } from 'vitest';

import { renderEvidenceWorkbenchShell } from '../src/index.js';

describe('renderEvidenceWorkbenchShell', () => {
  it('uses an inline review note instead of a blocking browser prompt', () => {
    const html = renderEvidenceWorkbenchShell({ workspaceId: 'workspace-dev' });

    expect(html).toContain('data-rationale');
    expect(html).toContain('Reviewed against the exact cited source lines.');
    expect(html).not.toContain('prompt(');
  });
});
