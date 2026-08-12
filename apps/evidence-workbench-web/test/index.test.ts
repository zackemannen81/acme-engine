import { describe, expect, it } from 'vitest';

import { renderEvidenceWorkbenchShell } from '../src/index.js';

describe('renderEvidenceWorkbenchShell', () => {
  it('uses an inline review note instead of a blocking browser prompt', () => {
    const html = renderEvidenceWorkbenchShell({ workspaceId: 'workspace-dev' });

    expect(html).toContain('data-rationale');
    expect(html).toContain('Reviewed against the exact cited source lines.');
    expect(html).toContain('Observation ledger');
    expect(html).toContain('Compare accounts');
    expect(html).toContain("initialView==='compare'");
    expect(html).toContain('data-start-line');
    expect(html).toContain(
      'await loadQueue();await loadAssessment(view.assessment.assessmentVersionId)',
    );
    expect(html).not.toContain('Promise.all([loadQueue(),loadAssessment(');
    expect(html).not.toContain('prompt(');
  });
});
