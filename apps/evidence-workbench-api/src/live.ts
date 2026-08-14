import {
  createOpenAiResponsesGateway,
  type ProviderTransport,
} from '@acme/adapter-model-openai';
import { createFetchTransport } from '@acme/adapter-model-openai/transport-fetch';
import type { Clock, ModelGateway, ModelSelection } from '@acme/core';
import type { EvidenceCaseAuthorizationContext } from '@acme/evidence-auth';
import {
  LiveSafetyRefused,
  assertLiveBudget,
  assertNoLiveCredentialFields,
  requireLiveCredential,
  requireLiveOptIn,
  type LiveBudget,
} from '@acme/live-safety';

export const EVIDENCE_LIVE_CONFIRMATION_VERSION =
  'evidence-live-confirmation/1' as const;
export const EVIDENCE_POC1_LIVE_PROFILE_VERSION =
  'evidence-poc1-live/1' as const;
export const EVIDENCE_STAGE_A_DATA_CLASS =
  'stage-a-anonymized-judicial-text/1' as const;

export const EVIDENCE_LIVE_REFUSAL = {
  confirmation: 'EVIDENCE_LIVE_CONFIRMATION_INVALID',
  confirmationVersion: 'EVIDENCE_LIVE_CONFIRMATION_VERSION',
  confirmationOptIn: 'EVIDENCE_LIVE_CONFIRMATION_OPT_IN',
  confirmationProvider: 'EVIDENCE_LIVE_PROVIDER_UNSUPPORTED',
  confirmationModel: 'EVIDENCE_LIVE_MODEL_REQUIRED',
  confirmationCase: 'EVIDENCE_LIVE_CASE_MISMATCH',
  confirmationBudget: 'EVIDENCE_LIVE_CONFIRMATION_BUDGET',
  confirmationRationale: 'EVIDENCE_LIVE_RATIONALE_REQUIRED',
  profile: 'EVIDENCE_LIVE_PROFILE_INVALID',
  hosted: 'EVIDENCE_LIVE_HOSTED_REQUIRED',
  persistence: 'EVIDENCE_LIVE_POSTGRES_REQUIRED',
  gateway: 'EVIDENCE_LIVE_PROVIDER_REQUIRED',
  payloadKey: 'EVIDENCE_LIVE_DURABLE_PAYLOAD_KEY_REQUIRED',
  sourceOrigin: 'EVIDENCE_LIVE_EXTERNAL_SOURCE_REQUIRED',
  dataClass: 'EVIDENCE_LIVE_STAGE_A_CLASS_REQUIRED',
  sourceAuthority: 'EVIDENCE_LIVE_SOURCE_AUTHORITY_REQUIRED',
  executionAuthority: 'EVIDENCE_LIVE_EXECUTION_AUTHORITY_REQUIRED',
} as const;

export class EvidenceLiveRefused extends LiveSafetyRefused {
  constructor(reason: string, message: string) {
    super(reason, message);
    this.name = 'EvidenceLiveRefused';
  }
}

export interface EvidenceLiveConfirmation {
  readonly version: typeof EVIDENCE_LIVE_CONFIRMATION_VERSION;
  readonly optIn: true;
  readonly provider: 'openai';
  readonly model: string;
  readonly caseId: string;
  readonly maxModelCalls: number;
  readonly costCeilingMinor: number | null;
  readonly currency: string | null;
  readonly rationale: string;
}

export interface EvidenceLiveSourceAuthority {
  readonly sourceOrigin: 'authorized-external';
  readonly dataClass: typeof EVIDENCE_STAGE_A_DATA_CLASS;
  readonly artifactVersionId: string;
  readonly externalSourceRef: string;
  readonly authorityAttested: true;
}

export interface EvidenceLiveDeployment {
  readonly profile: typeof EVIDENCE_POC1_LIVE_PROFILE_VERSION;
  readonly persistence: 'durable-postgresql';
  readonly modelGateway: 'live-provider';
  readonly payloadKeyId: string;
  readonly model: string;
  readonly budget: LiveBudget;
  readonly currency: string | null;
}

export interface EvidenceAuthorizedLiveRun {
  readonly profile: EvidenceLiveDeployment;
  readonly confirmation: EvidenceLiveConfirmation;
  readonly authorization: EvidenceCaseAuthorizationContext & {
    readonly action: 'live-model.run';
  };
  readonly source: EvidenceLiveSourceAuthority;
  readonly gateway: ModelGateway;
  selection(task: EvidenceLiveTask): ModelSelection;
}

export type EvidenceLiveTask =
  'observe-artifact' | 'relate-observations' | 'propose-assessment';

export interface EvidenceLiveCapability {
  readonly deployment: EvidenceLiveDeployment;
  authorize(input: {
    readonly confirmation: unknown;
    readonly authorization: EvidenceCaseAuthorizationContext;
    readonly source: EvidenceLiveSourceAuthority;
    readonly requestedBudget: LiveBudget;
  }): EvidenceAuthorizedLiveRun;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function nonNegativeIntegerOrNull(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 0)
  );
}

export function parseEvidenceLiveConfirmation(
  rawValue: unknown,
): EvidenceLiveConfirmation {
  assertNoLiveCredentialFields(rawValue);
  if (!object(rawValue))
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.confirmation,
      'An Evidence live confirmation must be an object.',
    );
  const allowed = new Set([
    'version',
    'optIn',
    'provider',
    'model',
    'caseId',
    'maxModelCalls',
    'costCeilingMinor',
    'currency',
    'rationale',
  ]);
  const unexpected = Object.keys(rawValue)
    .filter((key) => !allowed.has(key))
    .sort();
  if (unexpected.length > 0)
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.confirmation,
      `Evidence live confirmation has unexpected fields: ${unexpected.join(', ')}.`,
    );
  if (rawValue['version'] !== EVIDENCE_LIVE_CONFIRMATION_VERSION)
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.confirmationVersion,
      `Expected ${EVIDENCE_LIVE_CONFIRMATION_VERSION}.`,
    );
  if (rawValue['optIn'] !== true)
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.confirmationOptIn,
      'Evidence live confirmation requires optIn === true.',
    );
  if (rawValue['provider'] !== 'openai')
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.confirmationProvider,
      'Evidence live confirmation supports provider openai.',
    );
  if (!text(rawValue['model']))
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.confirmationModel,
      'Evidence live confirmation requires a model id.',
    );
  if (!text(rawValue['caseId']))
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.confirmationCase,
      'Evidence live confirmation requires a case id.',
    );
  if (!positiveInteger(rawValue['maxModelCalls']))
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.confirmationBudget,
      'Evidence live confirmation requires a positive model-call ceiling.',
    );
  const costCeilingMinor = rawValue['costCeilingMinor'];
  if (!nonNegativeIntegerOrNull(costCeilingMinor))
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.confirmationBudget,
      'Evidence live cost ceiling must be null or a non-negative integer.',
    );
  const currency = rawValue['currency'];
  if (
    (costCeilingMinor === null && currency !== null) ||
    (costCeilingMinor !== null && !text(currency))
  )
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.confirmationBudget,
      'Currency is required exactly when a live cost ceiling is present.',
    );
  if (!text(rawValue['rationale']))
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.confirmationRationale,
      'Evidence live confirmation requires a rationale.',
    );
  return Object.freeze({
    version: EVIDENCE_LIVE_CONFIRMATION_VERSION,
    optIn: true,
    provider: 'openai',
    model: rawValue['model'].trim(),
    caseId: rawValue['caseId'].trim(),
    maxModelCalls: rawValue['maxModelCalls'],
    costCeilingMinor,
    currency: costCeilingMinor === null ? null : (currency as string).trim(),
    rationale: rawValue['rationale'].trim(),
  });
}

function selection(task: EvidenceLiveTask, model: string): ModelSelection {
  return Object.freeze({
    profile: `${EVIDENCE_POC1_LIVE_PROFILE_VERSION}:${task}`,
    providerHint: 'openai',
    modelHint: model,
  });
}

export function createEvidenceLiveCapability(input: {
  readonly liveOptIn: boolean;
  readonly hosted: boolean;
  readonly profile: string | undefined;
  readonly persistence: 'file' | 'durable-postgresql';
  readonly modelGateway: 'scripted-mock' | 'live-provider';
  readonly model: string | undefined;
  readonly apiKey: string | undefined;
  readonly payloadKey: Uint8Array | undefined;
  readonly payloadKeyId: string | undefined;
  readonly deploymentBudget: LiveBudget;
  readonly deploymentCurrency: string | null;
  readonly clock: Clock;
  readonly transport?: ProviderTransport;
}): EvidenceLiveCapability | null {
  if (!input.liveOptIn) return null;
  requireLiveOptIn(input.liveOptIn);
  if (input.profile !== EVIDENCE_POC1_LIVE_PROFILE_VERSION)
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.profile,
      `Live Evidence composition requires ${EVIDENCE_POC1_LIVE_PROFILE_VERSION}.`,
    );
  if (!input.hosted)
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.hosted,
      'POC #1 live composition requires hosted mode.',
    );
  if (input.persistence !== 'durable-postgresql')
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.persistence,
      'POC #1 live composition requires durable PostgreSQL.',
    );
  if (input.modelGateway !== 'live-provider')
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.gateway,
      'POC #1 live composition requires the live provider gateway.',
    );
  if (
    input.payloadKey === undefined ||
    input.payloadKey.byteLength !== 32 ||
    !text(input.payloadKeyId)
  )
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.payloadKey,
      'POC #1 live composition requires a durable 32-byte payload key and id.',
    );
  if (!text(input.model))
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.confirmationModel,
      'POC #1 live composition requires a configured model id.',
    );
  const apiKey = requireLiveCredential(input.apiKey);
  assertLiveBudget({
    requested: input.deploymentBudget,
    confirmed: input.deploymentBudget,
    deployment: input.deploymentBudget,
  });
  if (
    (input.deploymentBudget.costCeilingMinor === null &&
      input.deploymentCurrency !== null) ||
    (input.deploymentBudget.costCeilingMinor !== null &&
      !text(input.deploymentCurrency))
  )
    throw new EvidenceLiveRefused(
      EVIDENCE_LIVE_REFUSAL.confirmationBudget,
      'Deployment currency is required exactly when a cost ceiling is present.',
    );
  const deployment: EvidenceLiveDeployment = Object.freeze({
    profile: EVIDENCE_POC1_LIVE_PROFILE_VERSION,
    persistence: 'durable-postgresql',
    modelGateway: 'live-provider',
    payloadKeyId: input.payloadKeyId.trim(),
    model: input.model.trim(),
    budget: Object.freeze({ ...input.deploymentBudget }),
    currency:
      input.deploymentBudget.costCeilingMinor === null
        ? null
        : (input.deploymentCurrency as string).trim(),
  });

  return Object.freeze({
    deployment,
    authorize(runInput: Parameters<EvidenceLiveCapability['authorize']>[0]) {
      const confirmation = parseEvidenceLiveConfirmation(runInput.confirmation);
      const authorization = runInput.authorization;
      if (
        authorization.action !== 'live-model.run' ||
        authorization.effectiveCaseRole !== 'case-admin' ||
        authorization.caseId === null ||
        authorization.workspaceId === null
      )
        throw new EvidenceLiveRefused(
          EVIDENCE_LIVE_REFUSAL.executionAuthority,
          'Live execution requires case-admin live-model.run authorization.',
        );
      if (confirmation.caseId !== authorization.caseId)
        throw new EvidenceLiveRefused(
          EVIDENCE_LIVE_REFUSAL.confirmationCase,
          'Live confirmation does not match the authorized case.',
        );
      if (confirmation.model !== deployment.model)
        throw new EvidenceLiveRefused(
          EVIDENCE_LIVE_REFUSAL.confirmationModel,
          'Live confirmation model does not match deployment configuration.',
        );
      if (confirmation.currency !== deployment.currency)
        throw new EvidenceLiveRefused(
          EVIDENCE_LIVE_REFUSAL.confirmationBudget,
          'Live confirmation currency does not match deployment configuration.',
        );
      if (runInput.source.sourceOrigin !== 'authorized-external')
        throw new EvidenceLiveRefused(
          EVIDENCE_LIVE_REFUSAL.sourceOrigin,
          'Live execution requires authorized-external source origin.',
        );
      if (runInput.source.dataClass !== EVIDENCE_STAGE_A_DATA_CLASS)
        throw new EvidenceLiveRefused(
          EVIDENCE_LIVE_REFUSAL.dataClass,
          'Live execution requires the Stage A data class.',
        );
      if (
        runInput.source.authorityAttested !== true ||
        !text(runInput.source.artifactVersionId) ||
        !text(runInput.source.externalSourceRef)
      )
        throw new EvidenceLiveRefused(
          EVIDENCE_LIVE_REFUSAL.sourceAuthority,
          'Live execution requires explicit external-source authority.',
        );
      assertLiveBudget({
        requested: runInput.requestedBudget,
        confirmed: {
          maxModelCalls: confirmation.maxModelCalls,
          costCeilingMinor: confirmation.costCeilingMinor,
        },
        deployment: deployment.budget,
      });

      const tasks: readonly EvidenceLiveTask[] = [
        'observe-artifact',
        'relate-observations',
        'propose-assessment',
      ];
      const gateway = createOpenAiResponsesGateway({
        transport: input.transport ?? createFetchTransport(),
        now: () => input.clock.now(),
        headers: () => ({ authorization: `Bearer ${apiKey}` }),
        profiles: tasks.map((task) => ({
          selection: selection(task, deployment.model),
          model: deployment.model,
          capabilities: {
            structuredOutput: true,
            tools: false,
            vision: false,
            maxInputTokens: 32_000,
            maxOutputTokens: 8_192,
          },
        })),
      });
      return Object.freeze({
        profile: deployment,
        confirmation,
        authorization:
          authorization as EvidenceAuthorizedLiveRun['authorization'],
        source: Object.freeze({ ...runInput.source }),
        gateway,
        selection: (task: EvidenceLiveTask) =>
          selection(task, deployment.model),
      });
    },
  });
}
