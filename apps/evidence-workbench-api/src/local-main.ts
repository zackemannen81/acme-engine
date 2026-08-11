import {
  createLocalEvidenceWorkbench,
  listenEvidenceWorkbenchApi,
} from './local.js';

const portValue = process.env['EVIDENCE_WORKBENCH_PORT'];
const port = portValue === undefined ? 8790 : Number(portValue);
if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
  throw new Error(
    'EVIDENCE_WORKBENCH_PORT must be an integer from 0 through 65535.',
  );
}

const local = await createLocalEvidenceWorkbench();
const address = await listenEvidenceWorkbenchApi(local.server, { port });
process.stdout.write(`Evidence Integrity Workbench ready at ${address.url}\n`);
