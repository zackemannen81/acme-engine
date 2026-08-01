import type { ExecutionRepository } from '../../packages/core/src/index.js';

/**
 * A repository whose process dies at chosen boundaries. `markTerminal` is
 * always lost as well, because a crashed process cannot record an outcome;
 * that is what leaves the execution accepted but non-terminal.
 */
export function processLossAt(
  base: ExecutionRepository,
  ...lost: readonly (keyof ExecutionRepository)[]
): ExecutionRepository {
  const bound: ExecutionRepository = {
    accept: base.accept.bind(base),
    get: base.get.bind(base),
    appendAttempt: base.appendAttempt.bind(base),
    reserveModelCall: base.reserveModelCall.bind(base),
    completeModelCall: base.completeModelCall.bind(base),
    failModelCall: base.failModelCall.bind(base),
    loadContext: base.loadContext.bind(base),
    loadResumeState: base.loadResumeState.bind(base),
    commit: base.commit.bind(base),
    markTerminal: base.markTerminal.bind(base),
    loadReplayEvidence: base.loadReplayEvidence.bind(base),
    leaseOutbox: base.leaseOutbox.bind(base),
    markOutboxDelivered: base.markOutboxDelivered.bind(base),
    markOutboxFailed: base.markOutboxFailed.bind(base),
    listOutbox: base.listOutbox.bind(base),
  };
  const lose = (): never => {
    throw new Error('Simulated process loss.');
  };
  return Object.fromEntries(
    Object.entries(bound).map(([method, implementation]) => [
      method,
      lost.includes(method as keyof ExecutionRepository) ||
      method === 'markTerminal'
        ? lose
        : implementation,
    ]),
  ) as unknown as ExecutionRepository;
}
