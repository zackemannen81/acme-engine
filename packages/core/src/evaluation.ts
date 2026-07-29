import type { JsonValue } from './common.js';
import type { DomainIssue } from './state.js';

export type EvaluationDecision =
  | {
      readonly outcome: 'allow';
      readonly scores: Readonly<Record<string, number>>;
    }
  | {
      readonly outcome: 'block';
      readonly reasons: readonly DomainIssue[];
    }
  | {
      readonly outcome: 'revise';
      readonly reasons: readonly DomainIssue[];
      readonly instruction: JsonValue;
    };
