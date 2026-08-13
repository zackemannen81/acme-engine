import { createServer, type Server } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import {
  FETCH_BLOCKED_PORTS,
  listenEvidenceWorkbenchApi,
} from '../src/index.js';

const open: Server[] = [];

function server(): Server {
  const created = createServer((_request, response) => {
    response.writeHead(204).end();
  });
  open.push(created);
  return created;
}

afterEach(async () => {
  await Promise.all(
    open.splice(0).map(
      (instance) =>
        new Promise<void>((resolve) => {
          if (!instance.listening) {
            resolve();
            return;
          }
          instance.close(() => {
            resolve();
          });
        }),
    ),
  );
});

describe('the blocked-port list', () => {
  it('matches the URL standard where it bites', () => {
    // Spot checks rather than the whole list: the ones inside a plausible
    // ephemeral range are the ones that actually cause the failure.
    for (const port of [2049, 3659, 5060, 6000, 6667, 6697, 10080]) {
      expect(FETCH_BLOCKED_PORTS.has(port)).toBe(true);
    }
    for (const port of [8790, 11802, 15000, 49152]) {
      expect(FETCH_BLOCKED_PORTS.has(port)).toBe(false);
    }
  });
});

describe('listenEvidenceWorkbenchApi', () => {
  it('refuses an explicitly requested blocked port with a clear reason', async () => {
    await expect(
      listenEvidenceWorkbenchApi(server(), { port: 6000 }),
    ).rejects.toThrow(/blocked by the URL standard/u);
  });

  it('never returns an ephemeral port that fetch would refuse', async () => {
    const address = await listenEvidenceWorkbenchApi(server(), { port: 0 });
    expect(FETCH_BLOCKED_PORTS.has(address.port)).toBe(false);
  });

  it('binds a usable ephemeral port that fetch can actually reach', async () => {
    // The regression this fixes was not "the server did not start" — it was
    // "the server started and fetch refused its URL". So the test has to make
    // a real request rather than inspect the number.
    const address = await listenEvidenceWorkbenchApi(server(), { port: 0 });
    const response = await fetch(address.url);
    expect(response.status).toBe(204);
  });

  it('honours an explicitly requested usable port', async () => {
    const first = await listenEvidenceWorkbenchApi(server(), { port: 0 });
    const chosen = first.port;
    await new Promise<void>((resolve) => {
      open[0]?.close(() => {
        resolve();
      });
    });

    const second = await listenEvidenceWorkbenchApi(server(), { port: chosen });
    expect(second.port).toBe(chosen);
    expect(second.url).toBe(`http://127.0.0.1:${String(chosen)}/`);
  });
});
