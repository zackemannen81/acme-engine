import { z } from 'zod';

import { canonicalJson, sha256 } from '@acme/core';
import {
  EvidenceCaseDataPolicySchema,
  EvidenceCaseMembershipSchema,
  EvidenceCaseSchema,
  type EvidenceCase,
  type EvidenceCaseAuthorizationContext,
  type EvidenceCaseMembership,
  type EvidenceIdentityRepository,
  type EvidenceIdentitySnapshot,
} from '@acme/evidence-auth';

import {
  EVIDENCE_CASE_OBJECT_BINDING_SCHEMA_VERSION,
  EvidenceCaseObjectBindingSchema,
  EvidenceWorkspaceSchema,
  type EvidenceCaseObjectBinding,
  type EvidenceProductSnapshot,
} from './schemas.js';
import type {
  EvidenceProductClock,
  EvidenceProductRepository,
} from './repository.js';
import {
  evidenceProductObjectId,
  scopeEvidenceProductSnapshot,
} from './scope.js';

const NonBlank = z.string().trim().min(1);

const EvidenceCreateSyntheticCaseCommandSchema = z
  .object({
    schemaVersion: z.literal('evidence-create-case-command/1'),
    commandKey: NonBlank.max(200),
    title: NonBlank.max(200),
    caseReference: NonBlank.max(100).nullable(),
    metadata: z.record(NonBlank.max(64), z.string().max(500)).default({}),
  })
  .strict();

const EvidenceCreatePolicyCaseCommandSchema = z
  .object({
    schemaVersion: z.literal('evidence-create-case-command/2'),
    commandKey: NonBlank.max(200),
    title: NonBlank.max(200),
    caseReference: NonBlank.max(100).nullable(),
    metadata: z.record(NonBlank.max(64), z.string().max(500)).default({}),
    dataPolicy: EvidenceCaseDataPolicySchema,
  })
  .strict();

export const EvidenceCreateCaseCommandSchema = z.discriminatedUnion(
  'schemaVersion',
  [
    EvidenceCreateSyntheticCaseCommandSchema,
    EvidenceCreatePolicyCaseCommandSchema,
  ],
);

export const EvidenceUpdateCaseCommandSchema = z
  .object({
    schemaVersion: z.literal('evidence-update-case-command/1'),
    expectedRevision: z.number().int().nonnegative(),
    title: NonBlank.max(200),
    caseReference: NonBlank.max(100).nullable(),
    metadata: z.record(NonBlank.max(64), z.string().max(500)).default({}),
  })
  .strict();

export const EvidenceCaseLifecycleCommandSchema = z
  .object({
    schemaVersion: z.literal('evidence-case-lifecycle-command/1'),
    expectedRevision: z.number().int().nonnegative(),
    action: z.enum(['archive', 'restore']),
  })
  .strict();

export const EvidenceCaseMembershipCommandSchema = z
  .object({
    schemaVersion: z.literal('evidence-case-membership-command/1'),
    expectedCaseRevision: z.number().int().nonnegative(),
    principalRef: NonBlank,
    role: z.enum(['case-viewer', 'case-reviewer', 'case-admin']),
    status: z.enum(['active', 'suspended']),
  })
  .strict();

export type EvidenceCreateCaseCommand = z.infer<
  typeof EvidenceCreateCaseCommandSchema
>;
export type EvidenceUpdateCaseCommand = z.infer<
  typeof EvidenceUpdateCaseCommandSchema
>;
export type EvidenceCaseLifecycleCommand = z.infer<
  typeof EvidenceCaseLifecycleCommandSchema
>;
export type EvidenceCaseMembershipCommand = z.infer<
  typeof EvidenceCaseMembershipCommandSchema
>;

function requireAction(
  authorization: EvidenceCaseAuthorizationContext,
  action:
    | 'case.create'
    | 'case.metadata.manage'
    | 'case.lifecycle.manage'
    | 'case-membership.manage',
  caseId: string | null,
): void {
  if (authorization.action !== action || authorization.caseId !== caseId)
    throw new Error('Case authorization context does not match command.');
}

function derivedId(prefix: string, ...parts: readonly string[]): string {
  return `${prefix}-${sha256(parts.join('\u0000'))}`;
}

export async function createEvidenceCase(input: {
  readonly identityRepository: EvidenceIdentityRepository;
  readonly productRepository: EvidenceProductRepository;
  readonly authorization: EvidenceCaseAuthorizationContext;
  readonly organizationId: string;
  readonly command: EvidenceCreateCaseCommand;
  readonly clock: EvidenceProductClock;
}): Promise<EvidenceCase> {
  requireAction(input.authorization, 'case.create', null);
  if (input.authorization.organizationId !== input.organizationId)
    throw new Error('Case organization does not match authorization.');
  const command = EvidenceCreateCaseCommandSchema.parse(input.command);
  const dataPolicy =
    command.schemaVersion === 'evidence-create-case-command/1'
      ? 'synthetic-only'
      : command.dataPolicy;
  const now = input.clock.now();
  const caseId = derivedId(
    'evidence-case',
    input.organizationId,
    command.commandKey,
  );
  const workspaceId = derivedId('evidence-workspace', caseId);
  const caseMembershipId = derivedId(
    'evidence-case-membership',
    caseId,
    input.authorization.principalRef,
  );
  const snapshot = await input.identityRepository.snapshot();
  const existing = snapshot.cases.find((item) => item.caseId === caseId);
  if (existing !== undefined) {
    if (
      existing.organizationId !== input.organizationId ||
      existing.title !== command.title ||
      existing.caseReference !== command.caseReference ||
      canonicalJson(existing.metadata) !== canonicalJson(command.metadata) ||
      existing.dataPolicy !== dataPolicy
    )
      throw new Error('Case command key was reused with different content.');
    if (existing.status !== 'provisioning') return existing;
  }
  const provisioning =
    existing ??
    EvidenceCaseSchema.parse({
      schemaVersion: 'evidence-case/1',
      caseId,
      organizationId: input.organizationId,
      workspaceId,
      title: command.title,
      caseReference: command.caseReference,
      metadata: command.metadata,
      dataPolicy,
      status: 'provisioning',
      revision: 0,
      createdAt: now,
      updatedAt: now,
      createdByPrincipalRef: input.authorization.principalRef,
      updatedByPrincipalRef: input.authorization.principalRef,
    });
  if (existing === undefined)
    await input.identityRepository.putCase(provisioning);
  if (
    !snapshot.caseMemberships.some(
      (item) => item.caseMembershipId === caseMembershipId,
    )
  )
    await input.identityRepository.putCaseMembership(
      EvidenceCaseMembershipSchema.parse({
        schemaVersion: 'evidence-case-membership/1',
        caseMembershipId,
        caseId,
        organizationId: input.organizationId,
        principalRef: input.authorization.principalRef,
        role: 'case-admin',
        status: 'active',
        createdAt: provisioning.createdAt,
        updatedAt: now,
        updatedByPrincipalRef: input.authorization.principalRef,
      }),
    );
  if (
    !snapshot.workspaceBindings.some((item) => item.workspaceId === workspaceId)
  )
    await input.identityRepository.putWorkspaceBinding({
      schemaVersion: 'evidence-workspace-organization-binding/1',
      workspaceId,
      organizationId: input.organizationId,
      boundAt: provisioning.createdAt,
    });
  const scope = { caseId, workspaceId, boundAt: now } as const;
  await input.productRepository.putWorkspace(
    EvidenceWorkspaceSchema.parse({
      schemaVersion: 'evidence-workspace/1',
      workspaceId,
      label: command.title,
      dataPolicy,
      evidenceRevision: 0,
      createdAt: now,
    }),
    scope,
  );
  await input.productRepository.bindCaseObjects([
    EvidenceCaseObjectBindingSchema.parse({
      schemaVersion: EVIDENCE_CASE_OBJECT_BINDING_SCHEMA_VERSION,
      ...scope,
      objectKind: 'workspace',
      objectId: workspaceId,
    }),
  ]);
  const active = EvidenceCaseSchema.parse({
    ...provisioning,
    status: 'active',
    revision: 1,
    updatedAt: input.clock.now(),
  });
  return input.identityRepository.putCase(active);
}

export function listVisibleEvidenceCases(input: {
  readonly snapshot: EvidenceIdentitySnapshot;
  readonly principalRef: string;
  readonly organizationId: string;
  readonly query?: string;
  readonly status?: 'active' | 'archived';
  readonly limit?: number;
}): readonly EvidenceCase[] {
  const organizationMembership = input.snapshot.memberships.find(
    (item) =>
      item.organizationId === input.organizationId &&
      item.principalRef === input.principalRef &&
      item.status === 'active',
  );
  if (organizationMembership === undefined) return [];
  const visibleIds = new Set(
    input.snapshot.caseMemberships
      .filter(
        (item) =>
          item.organizationId === input.organizationId &&
          item.principalRef === input.principalRef &&
          item.status === 'active',
      )
      .map((item) => item.caseId),
  );
  const query = input.query?.trim().toLocaleLowerCase('en-US') ?? '';
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
  return input.snapshot.cases
    .filter(
      (item) =>
        item.organizationId === input.organizationId &&
        item.status !== 'provisioning' &&
        (organizationMembership.role === 'organization-admin' ||
          visibleIds.has(item.caseId)) &&
        (input.status === undefined || item.status === input.status) &&
        (query.length === 0 ||
          item.title.toLocaleLowerCase('en-US').includes(query) ||
          (item.caseReference ?? '')
            .toLocaleLowerCase('en-US')
            .includes(query)),
    )
    .sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.caseId.localeCompare(right.caseId),
    )
    .slice(0, limit);
}

export async function updateEvidenceCase(input: {
  readonly identityRepository: EvidenceIdentityRepository;
  readonly authorization: EvidenceCaseAuthorizationContext;
  readonly command: EvidenceUpdateCaseCommand;
  readonly clock: EvidenceProductClock;
}): Promise<EvidenceCase> {
  const caseId = input.authorization.caseId;
  if (caseId === null) throw new Error('Case authorization is required.');
  requireAction(input.authorization, 'case.metadata.manage', caseId);
  const command = EvidenceUpdateCaseCommandSchema.parse(input.command);
  const snapshot = await input.identityRepository.snapshot();
  const current = snapshot.cases.find((item) => item.caseId === caseId);
  if (current === undefined) throw new RangeError('Unknown case.');
  if (current.revision !== command.expectedRevision)
    throw new Error('Case revision conflict.');
  return input.identityRepository.putCase(
    EvidenceCaseSchema.parse({
      ...current,
      title: command.title,
      caseReference: command.caseReference,
      metadata: command.metadata,
      revision: current.revision + 1,
      updatedAt: input.clock.now(),
      updatedByPrincipalRef: input.authorization.principalRef,
    }),
  );
}

export async function changeEvidenceCaseLifecycle(input: {
  readonly identityRepository: EvidenceIdentityRepository;
  readonly productRepository: EvidenceProductRepository;
  readonly authorization: EvidenceCaseAuthorizationContext;
  readonly command: EvidenceCaseLifecycleCommand;
  readonly clock: EvidenceProductClock;
}): Promise<EvidenceCase> {
  const caseId = input.authorization.caseId;
  const workspaceId = input.authorization.workspaceId;
  if (caseId === null || workspaceId === null)
    throw new Error('Case authorization is required.');
  requireAction(input.authorization, 'case.lifecycle.manage', caseId);
  const command = EvidenceCaseLifecycleCommandSchema.parse(input.command);
  const snapshot = await input.identityRepository.snapshot();
  const current = snapshot.cases.find((item) => item.caseId === caseId);
  if (current === undefined) throw new RangeError('Unknown case.');
  if (current.revision !== command.expectedRevision)
    throw new Error('Case revision conflict.');
  const target = command.action === 'archive' ? 'archived' : 'active';
  if (current.status === target) return current;
  if (command.action === 'archive') {
    const product = await input.productRepository.caseSnapshot(
      caseId,
      workspaceId,
    );
    if (
      product.jobs.some(
        (job) => !['completed', 'failed', 'cancelled'].includes(job.phase),
      )
    )
      throw new Error('A case with an active job cannot be archived.');
  }
  return input.identityRepository.putCase(
    EvidenceCaseSchema.parse({
      ...current,
      status: target,
      revision: current.revision + 1,
      updatedAt: input.clock.now(),
      updatedByPrincipalRef: input.authorization.principalRef,
    }),
  );
}

export async function putEvidenceCaseMembership(input: {
  readonly identityRepository: EvidenceIdentityRepository;
  readonly authorization: EvidenceCaseAuthorizationContext;
  readonly command: EvidenceCaseMembershipCommand;
  readonly clock: EvidenceProductClock;
}): Promise<EvidenceCaseMembership> {
  const caseId = input.authorization.caseId;
  if (caseId === null) throw new Error('Case authorization is required.');
  requireAction(input.authorization, 'case-membership.manage', caseId);
  const command = EvidenceCaseMembershipCommandSchema.parse(input.command);
  const snapshot = await input.identityRepository.snapshot();
  const evidenceCase = snapshot.cases.find((item) => item.caseId === caseId);
  if (evidenceCase === undefined) throw new RangeError('Unknown case.');
  if (evidenceCase.revision !== command.expectedCaseRevision)
    throw new Error('Case revision conflict.');
  const organizationMembership = snapshot.memberships.find(
    (item) =>
      item.organizationId === input.authorization.organizationId &&
      item.principalRef === command.principalRef &&
      item.status === 'active',
  );
  if (organizationMembership === undefined)
    throw new Error('Case participant must belong to the organization.');
  const existing = snapshot.caseMemberships.find(
    (item) =>
      item.caseId === caseId && item.principalRef === command.principalRef,
  );
  const now = input.clock.now();
  const membership = EvidenceCaseMembershipSchema.parse({
    schemaVersion: 'evidence-case-membership/1',
    caseMembershipId:
      existing?.caseMembershipId ??
      derivedId('evidence-case-membership', caseId, command.principalRef),
    caseId,
    organizationId: input.authorization.organizationId,
    principalRef: command.principalRef,
    role: command.role,
    status: command.status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    updatedByPrincipalRef: input.authorization.principalRef,
  });
  const nextCase = EvidenceCaseSchema.parse({
    ...evidenceCase,
    revision: evidenceCase.revision + 1,
    updatedAt: now,
    updatedByPrincipalRef: input.authorization.principalRef,
  });
  return input.identityRepository.putCaseMembershipAtRevision(
    membership,
    nextCase,
  );
}

function legacyBindingsFor(
  caseId: string,
  workspaceId: string,
  snapshot: EvidenceProductSnapshot,
  boundAt: string,
): readonly EvidenceCaseObjectBinding[] {
  const scoped = scopeEvidenceProductSnapshot(snapshot, workspaceId);
  const records: readonly [
    import('./schemas.js').EvidenceCaseObjectKind,
    readonly Record<string, unknown>[],
  ][] = [
    ['workspace', scoped.workspaces as unknown as Record<string, unknown>[]],
    ['source', scoped.sources as unknown as Record<string, unknown>[]],
    [
      'observation',
      scoped.observations as unknown as Record<string, unknown>[],
    ],
    ['relation', scoped.relations as unknown as Record<string, unknown>[]],
    [
      'open-question',
      scoped.openQuestions as unknown as Record<string, unknown>[],
    ],
    ['assessment', scoped.assessments as unknown as Record<string, unknown>[]],
    ['change-set', scoped.changeSets as unknown as Record<string, unknown>[]],
    ['job', scoped.jobs as unknown as Record<string, unknown>[]],
    [
      'review-decision',
      scoped.reviewDecisions as unknown as Record<string, unknown>[],
    ],
  ];
  return records.flatMap(([objectKind, values]) =>
    values.map((value) =>
      EvidenceCaseObjectBindingSchema.parse({
        schemaVersion: EVIDENCE_CASE_OBJECT_BINDING_SCHEMA_VERSION,
        caseId,
        workspaceId,
        objectKind,
        objectId: evidenceProductObjectId(objectKind, value),
        boundAt,
      }),
    ),
  );
}

export async function bindLegacySyntheticCaseObjects(input: {
  readonly repository: EvidenceProductRepository;
  readonly caseId: string;
  readonly workspaceId: string;
  readonly boundAt: string;
}): Promise<readonly EvidenceCaseObjectBinding[]> {
  const bindings = legacyBindingsFor(
    input.caseId,
    input.workspaceId,
    await input.repository.snapshot(),
    input.boundAt,
  );
  return input.repository.bindCaseObjects(bindings);
}

export function reconcileEvidenceCases(input: {
  readonly identity: EvidenceIdentitySnapshot;
  readonly product: EvidenceProductSnapshot;
}): void {
  for (const evidenceCase of input.identity.cases) {
    if (evidenceCase.status === 'provisioning') continue;
    const workspace = input.product.workspaces.find(
      (item) => item.workspaceId === evidenceCase.workspaceId,
    );
    const organizationBinding = input.identity.workspaceBindings.find(
      (item) => item.workspaceId === evidenceCase.workspaceId,
    );
    const productBinding = input.product.objectBindings.find(
      (item) =>
        item.caseId === evidenceCase.caseId &&
        item.workspaceId === evidenceCase.workspaceId &&
        item.objectKind === 'workspace' &&
        item.objectId === evidenceCase.workspaceId,
    );
    if (
      workspace === undefined ||
      organizationBinding?.organizationId !== evidenceCase.organizationId ||
      productBinding === undefined
    )
      throw new Error(`Case ${evidenceCase.caseId} is not fully reconciled.`);
  }
  for (const workspace of input.product.workspaces) {
    const matches = input.identity.cases.filter(
      (item) => item.workspaceId === workspace.workspaceId,
    );
    if (matches.length !== 1)
      throw new Error(
        `Workspace ${workspace.workspaceId} needs exactly one case mapping.`,
      );
  }
}
