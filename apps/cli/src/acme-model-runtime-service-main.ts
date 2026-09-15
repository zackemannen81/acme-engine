import { ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION } from './acme-model-runtime-wire.js';
import { startAcmeModelRuntimeService } from './acme-model-runtime-service.js';

async function main(): Promise<void> {
  const service = await startAcmeModelRuntimeService();
  process.stdout.write(
    `${JSON.stringify({
      kind: 'acme-model-runtime-listening',
      protocolVersion: ACME_MODEL_RUNTIME_V2_PROTOCOL_VERSION,
      engineBuild: service.engineBuild,
      origin: service.address.origin,
      hostname: service.address.hostname,
      port: service.address.port,
      providers: service.providers,
    })}\n`,
  );

  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => {
    closing ??= service.close();
    return closing;
  };

  const shutdown = (): void => {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    void close()
      .then(() => {
        process.exitCode = 0;
      })
      .catch((error: unknown) => {
        process.stderr.write(
          `ACME model runtime shutdown failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
        );
        process.exitCode = 1;
      });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `ACME model runtime failed to start: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  );
  process.exitCode = 1;
});
