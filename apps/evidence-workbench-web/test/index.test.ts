import { Script } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { renderEvidenceWorkbenchShell } from '../src/index.js';

function browserModuleSource(html: string): string {
  const match = /<script type="module">([\s\S]*?)<\/script>/u.exec(html);
  if (match?.[1] === undefined)
    throw new Error('The shell rendered no browser module.');
  return match[1];
}

describe('renderEvidenceWorkbenchShell', () => {
  /**
   * The shell is one template literal that emits JavaScript, so a source
   * escape the literal consumes — `\n` inside a rendered string, for example —
   * produces a module the browser cannot parse at all. Substring assertions
   * cannot see that: they pass while every button in the product is dead.
   * Compiling the emitted module is the only check that catches it.
   */
  it('emits a browser module that actually parses', () => {
    const source = browserModuleSource(
      renderEvidenceWorkbenchShell({ caseId: 'case-dev' }),
    );
    // Compiles without running: the module uses top-level await, so it is
    // wrapped in an async arrow to keep that legal outside a real module.
    expect(() => new Script(`(async()=>{${source}\n})()`)).not.toThrow();
  });

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
    expect(html).toContain("await json('/api/capabilities')");
    expect(html).toContain('stage-a-authorized-judicial-text');
    expect(html).toContain("schemaVersion:'evidence-text-import-metadata/2'");
    expect(html).toContain('Parent PDF SHA-256');
    expect(html).toContain('providerTransmissionAuthorized');
    expect(html).toContain('Analyze source');
    expect(html).toContain('Start source analysis');
    expect(html).toContain(
      "schemaVersion:'evidence-case-live-observation-command/1'",
    );
    expect(html).toContain('No credential or source text belongs');
    expect(html).not.toContain('apiKey');
    expect(html).toContain('Analyze relationships');
    expect(html).toContain('Start relationship analysis');
    expect(html).toContain(
      "schemaVersion:'evidence-case-live-relation-command/1'",
    );
  });
});
