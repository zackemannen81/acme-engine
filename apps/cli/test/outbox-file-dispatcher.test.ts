import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ACME_OUTBOX_FILE_DELIVERY,
  createFileOutboxDispatcher,
} from '../src/outbox-file-dispatcher.js';

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop() ?? '', { recursive: true, force: true });
  }
});

describe('createFileOutboxDispatcher', () => {
  it('writes a versioned envelope per event and allows redelivery overwrite', async () => {
    const root = mkdtempSync(join(tmpdir(), 'acme-file-outbox-'));
    roots.push(root);
    const directory = join(root, 'delivered');
    let tick = 0;
    const dispatcher = createFileOutboxDispatcher({
      directory,
      now: () => {
        tick += 1;
        return `2026-08-06T12:00:0${String(tick)}.000Z`;
      },
    });

    const event = {
      eventId: 'event-file-1',
      executionId: 'execution-1',
      key: 'observed-1',
      namespace: 'neutral',
      entityId: 'entity-1',
      type: 'neutral.observed',
      schemaVersion: '1.0.0',
      payload: { note: 'first' },
      occurredAt: '2026-08-06T12:00:00.000Z',
    };

    await dispatcher.deliver(event);
    const path = join(directory, 'event-file-1.json');
    const first = JSON.parse(readFileSync(path, 'utf8')) as {
      report: string;
      deliveredAt: string;
      event: { payload: { note: string } };
    };
    expect(first.report).toBe(ACME_OUTBOX_FILE_DELIVERY);
    expect(first.deliveredAt).toBe('2026-08-06T12:00:01.000Z');
    expect(first.event.payload.note).toBe('first');

    await dispatcher.deliver({
      ...event,
      payload: { note: 'redelivered' },
    });
    const second = JSON.parse(readFileSync(path, 'utf8')) as {
      deliveredAt: string;
      event: { payload: { note: string } };
    };
    expect(second.deliveredAt).toBe('2026-08-06T12:00:02.000Z');
    expect(second.event.payload.note).toBe('redelivered');
  });

  it('refuses empty directory and unsafe event ids', async () => {
    expect(() =>
      createFileOutboxDispatcher({
        directory: '   ',
        now: () => '2026-08-06T12:00:00.000Z',
      }),
    ).toThrow(/non-empty directory/);

    const root = mkdtempSync(join(tmpdir(), 'acme-file-outbox-'));
    roots.push(root);
    const dispatcher = createFileOutboxDispatcher({
      directory: root,
      now: () => '2026-08-06T12:00:00.000Z',
    });
    await expect(
      dispatcher.deliver({
        eventId: '../escape',
        executionId: 'e',
        key: 'k',
        namespace: 'n',
        entityId: 'id',
        type: 't',
        schemaVersion: '1.0.0',
        payload: {},
        occurredAt: '2026-08-06T12:00:00.000Z',
      }),
    ).rejects.toThrow(/Unsafe outbox event id/);
  });
});
