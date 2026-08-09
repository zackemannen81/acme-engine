/**
 * Local composition entry point (ADR-0021).
 *
 * Everything here selects an adapter or touches a disk. It is a separate
 * entry point so the package's default surface keeps performing no I/O and
 * the view contracts stay assertable without a filesystem.
 */

export {
  createFileWorkspace,
  type Workspace,
  type WorkspaceApprovals,
  type WorkspaceHistory,
  type WorkspaceJobs,
  type WorkspaceOptions,
} from './local/workspace.js';

export {
  createInterfaceComposition,
  createInterfaceRegistries,
  type CompositionOptions,
  type InterfaceComposition,
  type InterfaceRegistries,
  type InterfaceRepository,
} from './local/composition.js';

export {
  launchPlan,
  type LaunchOptions,
  type LaunchResult,
} from './local/launch.js';

export {
  createJobRunner,
  enqueuePlan,
  type CancelJobResult,
  type EnqueuePlanOptions,
  type EnqueuePlanResult,
  type JobRunner,
  type JobRunnerOptions,
} from './local/job-runner.js';

export {
  launchLiveExecution,
  type LiveLaunchOptions,
  type LiveLaunchResult,
} from './local/live-launch.js';

export {
  startWorkbenchServer,
  WorkbenchServeRefused,
  WORKBENCH_SERVE_REFUSAL,
  type WorkbenchServer,
  type WorkbenchServerOptions,
} from './local/server.js';
