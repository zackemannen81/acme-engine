import {
  createLocalEvidenceWorkbench,
  listenEvidenceWorkbenchApi,
} from './local.js';
import { createSupabaseEvidenceAuthenticator } from '@acme/adapter-evidence-auth-supabase';

const portValue = process.env['EVIDENCE_WORKBENCH_PORT'];
const port = portValue === undefined ? 8790 : Number(portValue);
if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
  throw new Error(
    'EVIDENCE_WORKBENCH_PORT must be an integer from 0 through 65535.',
  );
}

const seedValue = process.env['EVIDENCE_WORKBENCH_SEED'] ?? 'development';
if (!['development', 'evaluation', 'none'].includes(seedValue)) {
  throw new Error(
    'EVIDENCE_WORKBENCH_SEED must be development, evaluation or none.',
  );
}
const dataFile = process.env['EVIDENCE_WORKBENCH_DATA_FILE'];
const persistenceEnv = process.env['ACME_PERSISTENCE']?.trim().toLowerCase();
const authMode = process.env['EVIDENCE_AUTH_MODE'] ?? 'development';
if (!['development', 'supabase'].includes(authMode)) {
  throw new Error('EVIDENCE_AUTH_MODE must be development or supabase.');
}
let authOptions: Parameters<typeof createLocalEvidenceWorkbench>[0] = {};
if (authMode === 'supabase') {
  const baseUrl = process.env['EVIDENCE_SUPABASE_URL'];
  const issuer = process.env['EVIDENCE_SUPABASE_ISSUER'];
  const publishableKey = process.env['EVIDENCE_SUPABASE_PUBLISHABLE_KEY'];
  const subject = process.env['EVIDENCE_BOOTSTRAP_AUTH_SUBJECT'];
  const email = process.env['EVIDENCE_BOOTSTRAP_AUTH_EMAIL'];
  const sessionKeyValue = process.env['EVIDENCE_SESSION_KEY_BASE64'];
  const publicOrigin = process.env['EVIDENCE_PUBLIC_ORIGIN'];
  if (
    !baseUrl ||
    !issuer ||
    !publishableKey ||
    !subject ||
    !email ||
    !sessionKeyValue ||
    !publicOrigin
  ) {
    throw new Error(
      'Supabase auth requires EVIDENCE_SUPABASE_URL, EVIDENCE_SUPABASE_ISSUER, EVIDENCE_SUPABASE_PUBLISHABLE_KEY, EVIDENCE_BOOTSTRAP_AUTH_SUBJECT, EVIDENCE_BOOTSTRAP_AUTH_EMAIL, EVIDENCE_SESSION_KEY_BASE64 and EVIDENCE_PUBLIC_ORIGIN.',
    );
  }
  const sessionKey = Buffer.from(sessionKeyValue, 'base64');
  if (sessionKey.byteLength !== 32) {
    throw new Error('EVIDENCE_SESSION_KEY_BASE64 must decode to 32 bytes.');
  }
  authOptions = {
    authenticator: createSupabaseEvidenceAuthenticator({
      baseUrl,
      issuer,
      publishableKey,
    }),
    authIdentity: {
      issuer,
      subject,
      displayLabel: email,
      email,
    },
    sessionKey: new Uint8Array(sessionKey),
    secureCookies: true,
    publicOrigin,
  };
}
const local = await createLocalEvidenceWorkbench({
  seedMode: seedValue as 'development' | 'evaluation' | 'none',
  ...(dataFile === undefined ? {} : { dataFile }),
  ...(persistenceEnv === 'postgres'
    ? { persistence: 'postgres' as const }
    : {}),
  ...authOptions,
});
const address = await listenEvidenceWorkbenchApi(local.server, { port });
process.stdout.write(
  `Evidence Integrity Workbench ready at ${address.url} (persistence=${local.persistence})\n`,
);

const shutdown = async () => {
  await local.close();
  process.exit(0);
};
process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
