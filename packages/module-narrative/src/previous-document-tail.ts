import {
  AcmeError,
  canonicalJson,
  sha256,
  type JsonValue,
  type StoredDocument,
} from '@acme/core';

import { immutableJson } from './immutable.js';
import {
  NARRATIVE_NAMESPACE,
  NARRATIVE_SOURCE_KIND,
  NARRATIVE_SOURCE_SCHEMA_VERSION,
  PREVIOUS_DOCUMENT_TAIL_ALGORITHM,
  NarrativeSourceDocumentSchema,
  type NarrativeState,
  type PreviousDocumentTail,
} from './schemas.js';

const sentenceTerminals = new Set(['.', '!', '?', '…']);
const sentenceClosers = new Set(['"', "'", '”', '’', '»', ')', ']', '}']);

function projectionFailure(message: string): never {
  throw new AcmeError({
    code: 'DOMAIN_INVALID_RESULT',
    message,
    stage: 'loading',
    retryable: false,
  });
}

export function normalizePreviousDocumentWhitespace(value: string): string {
  return value.replace(/\p{White_Space}+/gu, ' ').trim();
}

export function splitPreviousDocumentSentences(
  value: string,
): readonly string[] {
  const codePoints = Array.from(normalizePreviousDocumentWhitespace(value));
  const sentences: string[] = [];
  let start = 0;
  let index = 0;

  while (index < codePoints.length) {
    if (!sentenceTerminals.has(codePoints[index] ?? '')) {
      index += 1;
      continue;
    }

    let boundary = index + 1;
    while (sentenceTerminals.has(codePoints[boundary] ?? '')) {
      boundary += 1;
    }
    while (sentenceClosers.has(codePoints[boundary] ?? '')) {
      boundary += 1;
    }

    if (boundary === codePoints.length || codePoints[boundary] === ' ') {
      const sentence = codePoints.slice(start, boundary).join('').trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      start = boundary;
      index = boundary;
      continue;
    }
    index += 1;
  }

  const fragment = codePoints.slice(start).join('').trim();
  if (fragment.length > 0) {
    sentences.push(fragment);
  }
  return Object.freeze(sentences);
}

export function derivePreviousDocumentTailText(value: string): {
  readonly text: string;
  readonly truncated: boolean;
} {
  const sentences = splitPreviousDocumentSentences(value);
  const selected = sentences.slice(-2).join(' ');
  if (selected.length === 0) {
    projectionFailure('Previous narrative source text has no usable content.');
  }

  const codePoints = Array.from(selected);
  const truncated = codePoints.length > 320;
  const text = (
    truncated ? codePoints.slice(-320).join('') : selected
  ).trimStart();
  return Object.freeze({ text, truncated });
}

export function narrativeSourceContentHash(value: unknown): string {
  const source = NarrativeSourceDocumentSchema.parse(value);
  return sha256(canonicalJson(source as unknown as JsonValue));
}

export function buildPreviousDocumentTail(
  state: NarrativeState,
  documents: readonly StoredDocument[],
  entityId: string,
): PreviousDocumentTail {
  const latest = state.narrativeWindow.at(-1);
  if (latest === undefined) {
    return immutableJson({
      algorithm: PREVIOUS_DOCUMENT_TAIL_ALGORITHM,
      source: 'initial',
      text: '',
    } satisfies PreviousDocumentTail);
  }

  const matching = documents.filter(
    (document) =>
      document.namespace === NARRATIVE_NAMESPACE &&
      document.entityId === entityId &&
      document.key === latest.documentKey,
  );
  if (matching.length !== 1) {
    projectionFailure(
      `Expected exactly one previous narrative source document for key ${latest.documentKey}.`,
    );
  }

  const document = matching[0];
  if (
    document === undefined ||
    document.kind !== NARRATIVE_SOURCE_KIND ||
    document.schemaVersion !== NARRATIVE_SOURCE_SCHEMA_VERSION
  ) {
    projectionFailure(
      `Previous document ${latest.documentKey} has an invalid kind or schema version.`,
    );
  }

  const source = NarrativeSourceDocumentSchema.safeParse(document.value);
  if (!source.success || source.data.documentKey !== latest.documentKey) {
    projectionFailure(
      `Previous document ${latest.documentKey} has invalid source content.`,
    );
  }
  const expectedHash = narrativeSourceContentHash(source.data);
  if (document.contentHash !== expectedHash) {
    projectionFailure(
      `Previous document ${latest.documentKey} content hash does not match its value.`,
    );
  }

  const tail = derivePreviousDocumentTailText(source.data.text);
  return immutableJson({
    algorithm: PREVIOUS_DOCUMENT_TAIL_ALGORITHM,
    source: 'document-content',
    documentKey: document.key,
    sourceContentHash: document.contentHash,
    text: tail.text,
    truncated: tail.truncated,
  } satisfies PreviousDocumentTail);
}
