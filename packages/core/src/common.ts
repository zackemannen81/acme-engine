import type { z } from 'zod';

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type Schema<T> = z.ZodType<T>;

export type ExecutionId = string;
export type ModelCallId = string;
export type EntityId = string;
export type Namespace = string;
export type RequestKey = string;
export type IsoTimestamp = string;

export interface Clock {
  now(): IsoTimestamp;
}

export interface IdGenerator {
  next(kind: 'execution' | 'call' | 'document' | 'memory' | 'event'): string;
}

export interface Hashing {
  canonicalJson(value: JsonValue): string;
  sha256(value: string | Uint8Array): string;
}

export interface DiagnosticFact {
  readonly code: string;
  readonly severity: 'debug' | 'info' | 'warning' | 'error';
  readonly value?: JsonValue;
}

export interface StoredDocument {
  readonly documentId: string;
  readonly executionId: ExecutionId;
  readonly namespace: Namespace;
  readonly entityId: EntityId;
  readonly key: string;
  readonly kind: string;
  readonly schemaVersion: string;
  readonly value: JsonValue;
  readonly contentHash: string;
  readonly createdAt: IsoTimestamp;
}
