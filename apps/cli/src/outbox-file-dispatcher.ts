import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  DomainEventRecord,
  IsoTimestamp,
  JsonValue,
  OutboxDispatcher,
} from '@acme/core';

/** Versioned on-disk delivery envelope identity. */
export const ACME_OUTBOX_FILE_DELIVERY = 'acme-outbox-file-delivery/1' as const;

export interface FileOutboxDispatcherOptions {
  /** Directory that receives one JSON file per delivered event. */
  readonly directory: string;
  /** Called once per deliver for the envelope timestamp. */
  readonly now: () => IsoTimestamp;
}

export interface OutboxFileDeliveryEnvelope {
  readonly report: typeof ACME_OUTBOX_FILE_DELIVERY;
  readonly deliveredAt: IsoTimestamp;
  readonly event: DomainEventRecord;
}

function safeFileName(eventId: string): string {
  // Event ids are already ACME-controlled, but refuse path separators.
  if (
    eventId.trim().length === 0 ||
    eventId.includes('/') ||
    eventId.includes('\\') ||
    eventId.includes('..')
  ) {
    throw new Error(`Unsafe outbox event id for file transport: ${eventId}`);
  }
  return `${eventId}.json`;
}

/**
 * Bounded file sink for outbox delivery (ACME-0061 / plan O2).
 *
 * Writes one versioned JSON envelope per event under `directory`. At-least-once
 * redelivery overwrites the same `eventId` file. No network, no product bus.
 */
export function createFileOutboxDispatcher(
  options: FileOutboxDispatcherOptions,
): OutboxDispatcher {
  const directory = options.directory.trim();
  if (directory.length === 0) {
    throw new Error('File outbox dispatcher requires a non-empty directory.');
  }

  let ensured = false;
  const ensureDir = async (): Promise<void> => {
    if (!ensured) {
      await mkdir(directory, { recursive: true });
      ensured = true;
    }
  };

  return {
    async deliver(event: DomainEventRecord): Promise<void> {
      await ensureDir();
      const envelope: OutboxFileDeliveryEnvelope = {
        report: ACME_OUTBOX_FILE_DELIVERY,
        deliveredAt: options.now(),
        event,
      };
      const path = join(directory, safeFileName(event.eventId));
      // Atomic-enough for local ops: write full JSON then done. Redelivery
      // replaces the same path (at-least-once).
      await writeFile(
        path,
        `${JSON.stringify(envelope as unknown as JsonValue, null, 2)}\n`,
        'utf8',
      );
    },
  };
}
