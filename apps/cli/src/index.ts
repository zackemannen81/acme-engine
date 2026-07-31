export { ACME_CORE_PACKAGE, type AcmeCorePackageName } from '@acme/core';
export {
  parseCommand,
  UsageError,
  USAGE,
  type AdapterName,
  type Command,
} from './args.js';
export {
  createComposition,
  type Composition,
  type CompositionOverrides,
  type InspectableRepository,
} from './composition.js';
export { CLI_OUTPUT_VERSION, REDACTED, type CliIo } from './output.js';
export {
  EXIT_OK,
  EXIT_OUTCOME,
  EXIT_USAGE,
  run,
  type RunOptions,
} from './run.js';
