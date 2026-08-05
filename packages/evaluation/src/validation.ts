import { canonicalJson, type JsonValue } from '@acme/core';

import {
  QUALITY_EVALUATION_VERSION,
  QUALITY_SUBJECT_VERSION,
  RECORDED_QUALITY_EVALUATION_VERSION,
  type QualityEvaluationRecord,
  type QualityEvaluationResult,
  type QualityEvaluationSubject,
  type QualityEvaluatorRef,
  type QualityFinding,
  type QualityScore,
  type RecordedQualityEvaluation,
} from './contracts.js';
import { QualityEvaluationError } from './errors.js';

const SHA256 = /^[a-f0-9]{64}$/u;

function invalid(message: string): never {
  throw new QualityEvaluationError('INVALID_QUALITY_EVALUATION', message);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exact(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    invalid(`${field} has unexpected fields: ${unexpected.join(', ')}.`);
  }
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalid(`${field} must be a non-empty string.`);
  }
  return value;
}

function digest(value: unknown, field: string): string {
  const parsed = text(value, field);
  if (!SHA256.test(parsed)) {
    invalid(`${field} must be a lowercase SHA-256 digest.`);
  }
  return parsed;
}

function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalid(`${field} must be a finite number.`);
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function cloneJson<T>(value: T, field = 'value'): T {
  let canonical: string;
  try {
    canonical = canonicalJson(value as unknown as JsonValue);
  } catch (error: unknown) {
    invalid(
      `${field} must be canonical JSON: ${error instanceof Error ? error.message : 'invalid value'}`,
    );
  }
  return deepFreeze(JSON.parse(canonical) as T);
}

export function parseQualityEvaluatorRef(
  raw: unknown,
  field = 'evaluator',
): QualityEvaluatorRef {
  const value = object(raw, field);
  exact(value, ['id', 'version', 'kind'], field);
  const kind = value['kind'];
  if (kind !== 'deterministic' && kind !== 'recorded-external') {
    invalid(`${field}.kind must be deterministic or recorded-external.`);
  }
  return deepFreeze({
    id: text(value['id'], `${field}.id`),
    version: text(value['version'], `${field}.version`),
    kind,
  });
}

export function parseQualityEvaluationSubject(
  raw: unknown,
): QualityEvaluationSubject {
  const value = object(raw, 'subject');
  exact(
    value,
    [
      'version',
      'runId',
      'executionId',
      'executionResultDigest',
      'operationDigest',
      'artifact',
      'contract',
    ],
    'subject',
  );
  if (value['version'] !== QUALITY_SUBJECT_VERSION) {
    invalid(`subject.version must be ${QUALITY_SUBJECT_VERSION}.`);
  }
  const artifact = object(value['artifact'], 'subject.artifact');
  exact(artifact, ['kind', 'id', 'digest'], 'subject.artifact');
  const contract = object(value['contract'], 'subject.contract');
  exact(contract, ['id', 'version', 'fingerprint'], 'subject.contract');
  const operationDigest = value['operationDigest'];
  if (operationDigest !== null && typeof operationDigest !== 'string') {
    invalid('subject.operationDigest must be a digest or null.');
  }

  return deepFreeze({
    version: QUALITY_SUBJECT_VERSION,
    runId: text(value['runId'], 'subject.runId'),
    executionId: text(value['executionId'], 'subject.executionId'),
    executionResultDigest: digest(
      value['executionResultDigest'],
      'subject.executionResultDigest',
    ),
    operationDigest:
      operationDigest === null
        ? null
        : digest(operationDigest, 'subject.operationDigest'),
    artifact: {
      kind: text(artifact['kind'], 'subject.artifact.kind'),
      id: text(artifact['id'], 'subject.artifact.id'),
      digest: digest(artifact['digest'], 'subject.artifact.digest'),
    },
    contract: {
      id: text(contract['id'], 'subject.contract.id'),
      version: text(contract['version'], 'subject.contract.version'),
      fingerprint: digest(
        contract['fingerprint'],
        'subject.contract.fingerprint',
      ),
    },
  });
}

export function parseQualityEvaluationResult(
  raw: unknown,
): QualityEvaluationResult {
  const value = object(raw, 'result');
  exact(value, ['scores', 'findings', 'verdict'], 'result');
  if (!Array.isArray(value['scores'])) {
    invalid('result.scores must be an array.');
  }
  if (!Array.isArray(value['findings'])) {
    invalid('result.findings must be an array.');
  }
  const verdict = value['verdict'];
  if (verdict !== 'pass' && verdict !== 'fail' && verdict !== 'inconclusive') {
    invalid('result.verdict must be pass, fail or inconclusive.');
  }

  const scoreIds = new Set<string>();
  const scores = value['scores'].map((rawScore, index): QualityScore => {
    const score = object(rawScore, `result.scores[${String(index)}]`);
    exact(
      score,
      ['id', 'value', 'scale', 'interpretation'],
      `result.scores[${String(index)}]`,
    );
    const id = text(score['id'], `result.scores[${String(index)}].id`);
    if (scoreIds.has(id)) {
      invalid(`result.scores contains duplicate id ${JSON.stringify(id)}.`);
    }
    scoreIds.add(id);
    const scale = object(
      score['scale'],
      `result.scores[${String(index)}].scale`,
    );
    exact(scale, ['min', 'max'], `result.scores[${String(index)}].scale`);
    const min = finite(
      scale['min'],
      `result.scores[${String(index)}].scale.min`,
    );
    const max = finite(
      scale['max'],
      `result.scores[${String(index)}].scale.max`,
    );
    const scoreValue = finite(
      score['value'],
      `result.scores[${String(index)}].value`,
    );
    if (min >= max || scoreValue < min || scoreValue > max) {
      invalid(
        `result.scores[${String(index)}] must have min < max and a value inside the scale.`,
      );
    }
    const interpretation = score['interpretation'];
    if (
      interpretation !== 'higher-is-better' &&
      interpretation !== 'lower-is-better' &&
      interpretation !== 'nominal'
    ) {
      invalid(`result.scores[${String(index)}].interpretation is invalid.`);
    }
    return { id, value: scoreValue, scale: { min, max }, interpretation };
  });

  const findings = value['findings'].map(
    (rawFinding, index): QualityFinding => {
      const finding = object(rawFinding, `result.findings[${String(index)}]`);
      exact(
        finding,
        ['code', 'severity', 'message', 'path'],
        `result.findings[${String(index)}]`,
      );
      const severity = finding['severity'];
      if (
        severity !== 'info' &&
        severity !== 'warning' &&
        severity !== 'error'
      ) {
        invalid(`result.findings[${String(index)}].severity is invalid.`);
      }
      const path = finding['path'];
      if (path !== undefined && !Array.isArray(path)) {
        invalid(`result.findings[${String(index)}].path must be an array.`);
      }
      const parsedPath = path?.map((entry, pathIndex) => {
        if (
          typeof entry !== 'string' &&
          !(
            typeof entry === 'number' &&
            Number.isSafeInteger(entry) &&
            entry >= 0
          )
        ) {
          invalid(
            `result.findings[${String(index)}].path[${String(pathIndex)}] must be a string or non-negative integer.`,
          );
        }
        return entry;
      });
      return {
        code: text(finding['code'], `result.findings[${String(index)}].code`),
        severity,
        message: text(
          finding['message'],
          `result.findings[${String(index)}].message`,
        ),
        ...(parsedPath === undefined ? {} : { path: parsedPath }),
      };
    },
  );

  return deepFreeze({ scores, findings, verdict });
}

function parseRecordFields(raw: unknown, recorded: boolean) {
  const field = recorded ? 'recording' : 'record';
  const value = object(raw, field);
  exact(
    value,
    [
      'version',
      'evaluationId',
      'subject',
      'subjectDigest',
      'evaluator',
      'result',
      'resultDigest',
    ],
    field,
  );
  const expectedVersion = recorded
    ? RECORDED_QUALITY_EVALUATION_VERSION
    : QUALITY_EVALUATION_VERSION;
  if (value['version'] !== expectedVersion) {
    invalid(`${field}.version must be ${expectedVersion}.`);
  }
  return {
    evaluationId: text(value['evaluationId'], `${field}.evaluationId`),
    subject: parseQualityEvaluationSubject(value['subject']),
    subjectDigest: digest(value['subjectDigest'], `${field}.subjectDigest`),
    evaluator: parseQualityEvaluatorRef(
      value['evaluator'],
      `${field}.evaluator`,
    ),
    result: parseQualityEvaluationResult(value['result']),
    resultDigest: digest(value['resultDigest'], `${field}.resultDigest`),
  };
}

export function parseQualityEvaluationRecord(
  raw: unknown,
): QualityEvaluationRecord {
  return deepFreeze({
    version: QUALITY_EVALUATION_VERSION,
    ...parseRecordFields(raw, false),
  });
}

export function parseRecordedQualityEvaluation(
  raw: unknown,
): RecordedQualityEvaluation {
  const parsed = parseRecordFields(raw, true);
  if (parsed.evaluator.kind !== 'recorded-external') {
    invalid('recording.evaluator.kind must be recorded-external.');
  }
  return deepFreeze({
    version: RECORDED_QUALITY_EVALUATION_VERSION,
    ...parsed,
    evaluator: { ...parsed.evaluator, kind: 'recorded-external' },
  });
}
