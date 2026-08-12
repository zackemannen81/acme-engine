import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_ASSESSMENT_OUTPUT_FORMATS,
  EVIDENCE_DEFAULT_EXPORT_POLICY,
  EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
  EVIDENCE_WORKSPACE_SCHEMA_VERSION,
  EvidenceExportRefusedError,
  EvidenceProductSnapshotSchema,
  authorizeEvidenceAssessmentExport,
  createEvidenceProductBackupManifest,
  resolveEvidenceExportPolicy,
  verifyEvidenceProductRestore,
} from '@acme/evidence-product-contracts';
import type {
  EvidenceExportPolicy,
  EvidenceProductSnapshot,
} from '@acme/evidence-product-contracts';

const CASE_ID = 'evidence-case-alpha';
const WORKSPACE_ID = 'workspace-alpha';

function snapshot(
  policies: readonly EvidenceExportPolicy[] = [],
): EvidenceProductSnapshot {
  return EvidenceProductSnapshotSchema.parse({
    schemaVersion: EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
    workspaces: [
      {
        schemaVersion: EVIDENCE_WORKSPACE_SCHEMA_VERSION,
        workspaceId: WORKSPACE_ID,
        label: 'Export policy fixture',
        dataPolicy: 'synthetic-only',
        evidenceRevision: 3,
        createdAt: '2026-08-12T00:00:00.000Z',
      },
    ],
    sources: [],
    observations: [],
    relations: [],
    openQuestions: [],
    assessments: [],
    changeSets: [],
    jobs: [],
    reviewDecisions: [],
    exportPolicies: policies,
  });
}

function policy(
  overrides: Partial<EvidenceExportPolicy> = {},
): EvidenceExportPolicy {
  return {
    schemaVersion: 'evidence-export-policy/1',
    organizationId: 'organization-alpha',
    caseId: CASE_ID,
    workspaceId: WORKSPACE_ID,
    enabled: true,
    allowedFormats: ['pdf'],
    revision: 1,
    updatedByPrincipalRef: 'principal-admin',
    updatedAt: '2026-08-12T01:00:00.000Z',
    ...overrides,
  };
}

describe('Evidence Stage 8 export policy', () => {
  it('defaults to the named constant when a case has no stored policy', () => {
    const resolved = resolveEvidenceExportPolicy(snapshot(), CASE_ID);
    expect(resolved.enabled).toBe(EVIDENCE_DEFAULT_EXPORT_POLICY.enabled);
    expect(resolved.allowedFormats).toEqual(
      EVIDENCE_DEFAULT_EXPORT_POLICY.allowedFormats,
    );
    expect(resolved.revision).toBe(0);
    for (const format of EVIDENCE_ASSESSMENT_OUTPUT_FORMATS)
      expect(() =>
        authorizeEvidenceAssessmentExport({
          snapshot: snapshot(),
          caseId: CASE_ID,
          format,
        }),
      ).not.toThrow();
  });

  it('refuses a format outside the allowlist and a disabled case', () => {
    const narrowed = snapshot([policy()]);
    expect(() =>
      authorizeEvidenceAssessmentExport({
        snapshot: narrowed,
        caseId: CASE_ID,
        format: 'pdf',
      }),
    ).not.toThrow();
    for (const format of ['docx', 'json', 'markdown'] as const) {
      let raised: unknown;
      try {
        authorizeEvidenceAssessmentExport({
          snapshot: narrowed,
          caseId: CASE_ID,
          format,
        });
      } catch (error) {
        raised = error;
      }
      expect(raised).toBeInstanceOf(EvidenceExportRefusedError);
      expect((raised as EvidenceExportRefusedError).reasonCode).toBe(
        'export.format-not-allowed',
      );
    }

    const disabled = snapshot([policy({ enabled: false })]);
    let refusal: unknown;
    try {
      authorizeEvidenceAssessmentExport({
        snapshot: disabled,
        caseId: CASE_ID,
        format: 'pdf',
      });
    } catch (error) {
      refusal = error;
    }
    expect((refusal as EvidenceExportRefusedError).reasonCode).toBe(
      'export.disabled',
    );
  });

  it('scopes a stored policy to its own case', () => {
    const other = snapshot([policy({ enabled: false })]);
    expect(
      resolveEvidenceExportPolicy(other, 'evidence-case-beta').enabled,
    ).toBe(true);
  });
});

describe('Evidence Stage 8 product backup', () => {
  it('accepts an intact restore and fails closed on tampering', () => {
    const original = snapshot([policy()]);
    const manifest = createEvidenceProductBackupManifest({
      snapshot: original,
      caseId: CASE_ID,
      createdAt: '2026-08-12T03:00:00.000Z',
    });
    expect(() =>
      verifyEvidenceProductRestore({ manifest, snapshot: original }),
    ).not.toThrow();

    expect(() =>
      verifyEvidenceProductRestore({ manifest, snapshot: snapshot([]) }),
    ).toThrow('is missing after restore');

    expect(() =>
      verifyEvidenceProductRestore({
        manifest,
        snapshot: snapshot([policy({ enabled: false })]),
      }),
    ).toThrow('was altered after restore');

    expect(() =>
      verifyEvidenceProductRestore({
        manifest,
        snapshot: snapshot([
          policy(),
          policy({ caseId: 'evidence-case-beta', revision: 2 }),
        ]),
      }),
    ).toThrow('the backup manifest never listed');

    expect(() =>
      verifyEvidenceProductRestore({
        manifest: { ...manifest, createdAt: '2026-08-12T04:00:00.000Z' },
        snapshot: original,
      }),
    ).toThrow('manifest digest mismatch');
  });

  it('records digests only, never source content', () => {
    const manifest = createEvidenceProductBackupManifest({
      snapshot: snapshot([policy()]),
      caseId: null,
      createdAt: '2026-08-12T03:00:00.000Z',
    });
    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain('Export policy fixture');
    expect(
      manifest.records.every((item) =>
        /^[a-f0-9]{64}$/u.test(item.contentSha256),
      ),
    ).toBe(true);
    expect(
      manifest.records.map((item) => `${item.kind} ${item.recordId}`),
    ).toEqual(
      [
        ...manifest.records.map((item) => `${item.kind} ${item.recordId}`),
      ].sort(),
    );
  });
});
