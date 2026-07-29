export type ExecutionStatus =
  | 'accepted'
  | 'loading'
  | 'calling-model'
  | 'validating'
  | 'interpreting'
  | 'evaluating'
  | 'preparing-commit'
  | 'committed'
  | 'blocked'
  | 'conflicted'
  | 'cancelled'
  | 'failed';
