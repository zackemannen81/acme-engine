import type { ExecutionPolicy, JsonValue } from '@acme/core';

import { VIEW_UNAVAILABLE } from './view.js';

export type RetentionMode = ExecutionPolicy['retention'];

/**
 * Presentation options for one view build.
 *
 * `revealContent` mirrors local development and test only. It is per build,
 * never sticky, and never a default.
 */
export interface RedactionOptions {
  readonly revealContent?: boolean;
}

/**
 * How one content value reaches the interface.
 *
 * `not-retained` is distinct from `redacted` on purpose (ADR-0016/ADR-0019):
 * under `none` and `hash-only` the payload was never written, so no reveal
 * control could ever produce it, and rendering an empty value would look like
 * an engine defect.
 */
export type PayloadView =
  | { readonly disclosure: 'revealed'; readonly value: JsonValue }
  | { readonly disclosure: 'redacted' }
  | { readonly disclosure: 'not-retained'; readonly retention: RetentionMode }
  | { readonly disclosure: 'unavailable'; readonly reason: string };

const REDACTED: PayloadView = { disclosure: 'redacted' };

function revealed(value: JsonValue): PayloadView {
  return { disclosure: 'revealed', value };
}

/** A value the evidence definitely holds. Redacted unless reveal is asked. */
export function contentView(
  value: JsonValue,
  options: RedactionOptions,
): PayloadView {
  return options.revealContent === true ? revealed(value) : REDACTED;
}

/**
 * A value that may be absent for a reason the caller can name, such as a task
 * input that was never recorded.
 */
export function optionalContentView(
  value: JsonValue | undefined,
  reason: string,
  options: RedactionOptions,
): PayloadView {
  if (value === undefined) {
    return { disclosure: 'unavailable', reason };
  }
  return contentView(value, options);
}

/**
 * A model payload governed by `ExecutionPolicy.retention`.
 *
 * Absent under `none` or `hash-only` means the payload was never stored.
 * Absent under `encrypted-payload` means the envelope could not be opened,
 * which is a different fact and gets a different disclosure.
 */
export function retainedContentView(
  value: JsonValue | undefined,
  retention: RetentionMode,
  options: RedactionOptions,
): PayloadView {
  if (value === undefined) {
    if (retention === 'encrypted-payload') {
      return {
        disclosure: 'unavailable',
        reason: VIEW_UNAVAILABLE.payloadUnreadable,
      };
    }
    return { disclosure: 'not-retained', retention };
  }
  return contentView(value, options);
}
