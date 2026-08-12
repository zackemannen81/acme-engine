import { describe, expect, it } from 'vitest';

import { renderEvidenceWorkbenchShell } from '../src/index.js';

describe('renderEvidenceWorkbenchShell', () => {
  it('uses an inline review note instead of a blocking browser prompt', () => {
    const html = renderEvidenceWorkbenchShell({ caseId: 'case-dev' });

    expect(html).toContain('data-rationale');
    expect(html).toContain('Authentication is required');
    expect(html).toContain("await showWorkbench(await json('/api/session'))");
    expect(html).toContain("schemaVersion:'evidence-review-command/3'");
    expect(html).toContain("headers.set('x-acme-csrf'");
    expect(html).not.toContain('reviewerRef:');
    expect(html).toContain('Reviewed against the exact cited source lines.');
    expect(html).toContain('Observation ledger');
    expect(html).toContain('Compare accounts');
    expect(html).toContain('Case overview');
    expect(html).toContain('Integrity report');
    expect(html).toContain('/api/integrity-report');
    expect(html).toContain("initialView==='overview'");
    expect(html).toContain("initialView==='integrity'");
    // Every integrity row cites observations that open their exact source.
    expect(html).toContain('data-artifact="');
    expect(html).toContain('data-observation="');
    expect(html).toContain(
      'loadSource(button.dataset.artifact,button.dataset.observation)',
    );
    // Stage 8 download surfaces sit on the reviewed assessment.
    expect(html).toContain("['pdf','docx','markdown','json']");
    expect(html).toContain('data-output-format');
    expect(html).toContain("'/output/'");
    expect(html).toContain("initialView==='compare'");
    expect(html).toContain('data-start-line');
    expect(html).toContain(
      'await loadQueue();await loadAssessment(view.assessment.assessmentVersionId)',
    );
    expect(html).not.toContain('Promise.all([loadQueue(),loadAssessment(');
    expect(html).not.toContain('prompt(');
    expect(html).not.toContain('workspaceId');
    expect(html).toContain('/api/cases/');
  });
});
