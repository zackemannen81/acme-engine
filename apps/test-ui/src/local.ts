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
  type WorkspaceOptions,
} from './local/workspace.js';

export {
  createInterfaceComposition,
  type CompositionOptions,
  type InterfaceComposition,
  type InterfaceRepository,
} from './local/composition.js';

export {
  launchPlan,
  type LaunchOptions,
  type LaunchResult,
} from './local/launch.js';

export {
  launchLiveExecution,
  type LiveLaunchOptions,
  type LiveLaunchResult,
} from './local/live-launch.js';
