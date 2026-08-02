import type {
  AnyDomainModule,
  ContractRegistry,
  ExecutionPolicy,
  JsonValue,
  ModuleRegistry,
} from '@acme/core';

import {
  comparePaths,
  normalizeDiscoveredPath,
  resolveReference,
  type PathRefusalReason,
} from '../catalog/paths.js';
import {
  available,
  unavailable,
  CATALOG_VIEW_VERSION,
  VIEW_UNAVAILABLE,
  type ViewSection,
} from '../view.js';

/**
 * S1 — catalog (ADR-0019).
 *
 * Answers "what exists?" from the static registries plus whatever a discovery
 * source found under a configured root. It enumerates; it does not decide.
 *
 * Three properties matter more than completeness:
 *
 * 1. Registry order is registry order. The catalog never re-sorts for looks.
 * 2. A thing that is broken stays visible and is labelled broken — an invalid
 *    scenario, an unresolvable reference, an orphan fixture, an unknown kit.
 * 3. The catalog owns no schema. Scenario validity is decided by the runner's
 *    own validator, injected by the caller, or the section is unavailable.
 */

/** Conformance kits `@acme/testing` publishes. Asserted by test. */
export const ADAPTER_KITS = [
  'execution-repository',
  'model-gateway',
  'domain-module',
] as const;

export type AdapterKit = (typeof ADAPTER_KITS)[number];

/**
 * Structural subset of `ScenarioDocument` the catalog reads. Declared
 * structurally so the package needs no runtime dependency on `@acme/testing`.
 */
export interface ScenarioDocumentShape {
  readonly schemaVersion: string;
  readonly name: string;
  readonly seed: {
    readonly clock: string;
    readonly ids: string;
    readonly idPrefix?: string;
    readonly idPadding?: number;
  };
  readonly composition: {
    readonly repository: string;
    readonly gateway: string;
  };
  readonly steps: readonly Readonly<Record<string, unknown>>[];
}

/**
 * The runner's own validator, supplied by the caller. `parseScenario` from
 * `@acme/testing` satisfies this. It must throw on an invalid document.
 */
export type ScenarioValidator = (raw: unknown) => ScenarioDocumentShape;

export interface DiscoveredScenarioFile {
  /** Root-relative path. */
  readonly path: string;
  /** Decoded but unvalidated document. */
  readonly document: unknown;
}

export interface DiscoveredFixtureFile {
  /** Root-relative path. */
  readonly path: string;
}

export interface AdapterTargetDeclaration {
  readonly id: string;
  readonly kit: string;
  readonly package: string;
  readonly description?: string;
}

export interface CatalogDiagnostic {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly detail?: JsonValue;
}

export interface CatalogEvidence {
  /** A label the caller chose. Never an absolute machine path. */
  readonly root: string;
  readonly modules?: ModuleRegistry | null;
  readonly contracts?: ContractRegistry | null;
  readonly scenarios?: readonly DiscoveredScenarioFile[] | null;
  readonly fixtures?: readonly DiscoveredFixtureFile[] | null;
  readonly adapterTargets?: readonly AdapterTargetDeclaration[] | null;
  /** Diagnostics the discovery source produced, such as a bound it hit. */
  readonly diagnostics?: readonly CatalogDiagnostic[];
}

export interface CatalogViewOptions {
  readonly validateScenario?: ScenarioValidator;
}

export interface TaskCatalogView {
  readonly name: string;
  readonly role: string;
  readonly contract: { readonly id: string; readonly version: string };
  readonly contractRegistered: boolean;
  readonly contractFingerprint: string | null;
}

export interface ModuleCatalogView {
  readonly namespace: string;
  readonly stateSchemaVersion: string;
  readonly deltaSchemaVersion: string;
  readonly taskCount: number;
  readonly tasks: readonly TaskCatalogView[];
}

export interface ContractCatalogView {
  readonly id: string;
  readonly version: string;
  /** Rendered in full and never truncated, so it can be copied and compared. */
  readonly fingerprint: string;
  readonly retention: ExecutionPolicy['retention'];
  readonly requiredCapabilities: Readonly<Record<string, JsonValue>>;
  /** `namespace.task` entries, in module then task declaration order. */
  readonly referencedByTasks: readonly string[];
}

export interface ScenarioTargetView {
  readonly stepIndex: number;
  readonly namespace: string;
  readonly task: string;
  readonly entityId: string;
  readonly moduleRegistered: boolean | null;
  readonly taskRegistered: boolean | null;
}

export type ReferenceResolutionStatus = 'resolved' | 'missing' | 'refused';

export interface ScenarioReferenceView {
  readonly stepIndex: number;
  readonly field: string;
  readonly requested: string;
  readonly status: ReferenceResolutionStatus;
  readonly path: string | null;
  readonly reason: PathRefusalReason | null;
}

export interface ScenarioCatalogView {
  readonly path: string;
  readonly status: 'valid' | 'invalid';
  /** The validator's own message. The catalog never rewrites it. */
  readonly error: { readonly code: string; readonly message: string } | null;
  readonly name: string | null;
  readonly schemaVersion: string | null;
  readonly composition: {
    readonly repository: string;
    readonly gateway: string;
  } | null;
  readonly seed: {
    readonly clock: string;
    readonly ids: string;
    readonly idPrefix: string | null;
    readonly idPadding: number | null;
  } | null;
  readonly stepCount: number | null;
  readonly stepKinds: Readonly<Record<string, number>>;
  readonly targets: readonly ScenarioTargetView[];
  readonly references: readonly ScenarioReferenceView[];
}

export interface FixtureCatalogView {
  readonly path: string;
  readonly referencedBy: readonly string[];
  readonly orphan: boolean;
}

export interface AdapterTargetView {
  readonly id: string;
  readonly package: string;
  readonly kit: string;
  readonly kitStatus: 'known' | 'unknown';
  readonly description: string | null;
}

export interface CatalogDiagnosticView {
  readonly code: string;
  readonly severity: CatalogDiagnostic['severity'];
  readonly detail: JsonValue | null;
}

export interface CatalogView {
  readonly view: typeof CATALOG_VIEW_VERSION;
  readonly root: string;
  readonly modules: ViewSection<{
    readonly modules: readonly ModuleCatalogView[];
    readonly moduleCount: number;
  }>;
  readonly contracts: ViewSection<{
    readonly contracts: readonly ContractCatalogView[];
    readonly contractCount: number;
  }>;
  readonly evaluators: ViewSection<{
    readonly evaluators: readonly never[];
  }>;
  readonly scenarios: ViewSection<{
    readonly scenarios: readonly ScenarioCatalogView[];
    readonly scenarioCount: number;
    readonly validCount: number;
    readonly invalidCount: number;
  }>;
  readonly fixtures: ViewSection<{
    readonly fixtures: readonly FixtureCatalogView[];
    readonly fixtureCount: number;
    readonly orphanCount: number;
  }>;
  readonly adapterTargets: ViewSection<{
    readonly targets: readonly AdapterTargetView[];
    readonly targetCount: number;
    readonly knownKits: readonly string[];
  }>;
  readonly diagnostics: readonly CatalogDiagnosticView[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function capabilityRecord(
  capabilities: Readonly<Record<string, unknown>>,
): Readonly<Record<string, JsonValue>> {
  const record: Record<string, JsonValue> = {};
  // Sorted so two registries with the same capabilities render identically.
  for (const key of Object.keys(capabilities).sort()) {
    const value = capabilities[key];
    if (value !== undefined) {
      record[key] = value as JsonValue;
    }
  }
  return record;
}

function moduleViews(
  registry: ModuleRegistry,
  contracts: ContractRegistry | null,
): readonly ModuleCatalogView[] {
  // `list()` is the registry's own order. Task order is declaration order.
  return registry.list().map((namespace) => {
    const module: AnyDomainModule = registry.get(namespace);
    const tasks = Object.keys(module.tasks).map((name) => {
      const task = module.tasks[name];
      const ref = task?.contract ?? { id: '', version: '' };
      const registered = contracts !== null && contracts.has(ref);
      return {
        name,
        role: task?.role ?? 'unknown',
        contract: { id: ref.id, version: ref.version },
        contractRegistered: registered,
        contractFingerprint: registered ? contracts.fingerprint(ref) : null,
      } satisfies TaskCatalogView;
    });
    return {
      namespace,
      stateSchemaVersion: module.stateSchemaVersion,
      deltaSchemaVersion: module.deltaSchemaVersion,
      taskCount: tasks.length,
      tasks,
    } satisfies ModuleCatalogView;
  });
}

function contractViews(
  registry: ContractRegistry,
  modules: readonly ModuleCatalogView[],
): readonly ContractCatalogView[] {
  const references = new Map<string, string[]>();
  for (const module of modules) {
    for (const task of module.tasks) {
      const key = `${task.contract.id}@${task.contract.version}`;
      const existing = references.get(key);
      const entry = `${module.namespace}.${task.name}`;
      if (existing === undefined) {
        references.set(key, [entry]);
      } else {
        existing.push(entry);
      }
    }
  }

  return registry.list().map((ref) => {
    const contract = registry.get(ref);
    return {
      id: ref.id,
      version: ref.version,
      fingerprint: registry.fingerprint(ref),
      retention: contract.retention,
      requiredCapabilities: capabilityRecord(contract.requiredCapabilities),
      referencedByTasks: references.get(`${ref.id}@${ref.version}`) ?? [],
    } satisfies ContractCatalogView;
  });
}

function stepKind(step: Readonly<Record<string, unknown>>): string {
  const keys = Object.keys(step);
  return keys[0] ?? 'unknown';
}

function reference(
  stepIndex: number,
  field: string,
  requested: string,
  fixtures: ReadonlySet<string>,
): ScenarioReferenceView {
  const resolved = resolveReference(requested);
  if (resolved.status === 'refused') {
    return {
      stepIndex,
      field,
      requested,
      status: 'refused',
      path: null,
      reason: resolved.reason,
    };
  }
  return {
    stepIndex,
    field,
    requested,
    status: fixtures.has(resolved.path) ? 'resolved' : 'missing',
    path: resolved.path,
    reason: null,
  };
}

function scenarioDetail(
  document: ScenarioDocumentShape,
  modules: ModuleRegistry | null,
  fixtures: ReadonlySet<string>,
): Omit<ScenarioCatalogView, 'path' | 'status' | 'error'> {
  const stepKinds: Record<string, number> = {};
  const targets: ScenarioTargetView[] = [];
  const references: ScenarioReferenceView[] = [];

  for (const [index, step] of document.steps.entries()) {
    const kind = stepKind(step);
    stepKinds[kind] = (stepKinds[kind] ?? 0) + 1;
    const body = step[kind];
    if (!isObject(body)) {
      continue;
    }

    if (kind === 'execute') {
      const namespace = text(body['namespace']) ?? '';
      const task = text(body['task']) ?? '';
      let moduleRegistered: boolean | null = null;
      let taskRegistered: boolean | null = null;
      if (modules !== null) {
        moduleRegistered = modules.list().includes(namespace);
        taskRegistered = moduleRegistered
          ? Object.hasOwn(modules.get(namespace).tasks, task)
          : false;
      }
      targets.push({
        stepIndex: index,
        namespace,
        task,
        entityId: text(body['entityId']) ?? '',
        moduleRegistered,
        taskRegistered,
      });
    }

    for (const field of ['fixture', 'mockResponse'] as const) {
      const requested = text(body[field]);
      if (requested !== null) {
        references.push(reference(index, field, requested, fixtures));
      }
    }
  }

  return {
    name: document.name,
    schemaVersion: document.schemaVersion,
    composition: {
      repository: document.composition.repository,
      gateway: document.composition.gateway,
    },
    seed: {
      clock: document.seed.clock,
      ids: document.seed.ids,
      idPrefix: document.seed.idPrefix ?? null,
      idPadding: document.seed.idPadding ?? null,
    },
    stepCount: document.steps.length,
    stepKinds,
    targets,
    references,
  };
}

/**
 * Read a thrown validator error structurally rather than with `instanceof`,
 * so the catalog stays correct even when the validator was loaded from a
 * different copy of `@acme/core` than this package's types came from.
 */
function validatorError(error: unknown): {
  readonly code: string;
  readonly message: string;
} {
  if (isObject(error) && isObject(error['data'])) {
    const data = error['data'];
    const code = text(data['code']);
    const message = text(data['message']);
    if (code !== null && message !== null) {
      return { code, message };
    }
  }
  return {
    code: 'INVALID_REQUEST',
    message: error instanceof Error ? error.message : 'Scenario was rejected.',
  };
}

function invalidScenario(path: string, error: unknown): ScenarioCatalogView {
  const data = validatorError(error);
  return {
    path,
    status: 'invalid',
    error: data,
    name: null,
    schemaVersion: null,
    composition: null,
    seed: null,
    stepCount: null,
    stepKinds: {},
    targets: [],
    references: [],
  };
}

function scenarioViews(
  discovered: readonly DiscoveredScenarioFile[],
  validate: ScenarioValidator,
  modules: ModuleRegistry | null,
  fixtures: ReadonlySet<string>,
): readonly ScenarioCatalogView[] {
  return [...discovered]
    .map((file) => ({
      file,
      path: normalizeDiscoveredPath(file.path) ?? file.path,
    }))
    .sort((left, right) => comparePaths(left.path, right.path))
    .map(({ file, path }) => {
      let document: ScenarioDocumentShape;
      try {
        document = validate(file.document);
      } catch (error: unknown) {
        return invalidScenario(path, error);
      }
      return {
        path,
        status: 'valid',
        error: null,
        ...scenarioDetail(document, modules, fixtures),
      } satisfies ScenarioCatalogView;
    });
}

function fixtureViews(
  discovered: readonly DiscoveredFixtureFile[],
  scenarios: readonly ScenarioCatalogView[],
): readonly FixtureCatalogView[] {
  const referencedBy = new Map<string, string[]>();
  for (const scenario of scenarios) {
    for (const entry of scenario.references) {
      if (entry.status === 'refused' || entry.path === null) {
        continue;
      }
      const existing = referencedBy.get(entry.path);
      if (existing === undefined) {
        referencedBy.set(entry.path, [scenario.path]);
      } else if (!existing.includes(scenario.path)) {
        existing.push(scenario.path);
      }
    }
  }

  return [...discovered]
    .map((file) => normalizeDiscoveredPath(file.path) ?? file.path)
    .sort(comparePaths)
    .map((path) => {
      const owners = referencedBy.get(path) ?? [];
      return {
        path,
        referencedBy: [...owners].sort(),
        // An unreferenced fixture is shown, not hidden: it is either dead
        // weight or a reference someone forgot to write.
        orphan: owners.length === 0,
      } satisfies FixtureCatalogView;
    });
}

function adapterTargetViews(
  declarations: readonly AdapterTargetDeclaration[],
): readonly AdapterTargetView[] {
  const known = new Set<string>(ADAPTER_KITS);
  return [...declarations]
    .sort((left, right) =>
      left.kit === right.kit
        ? left.id.localeCompare(right.id)
        : left.kit.localeCompare(right.kit),
    )
    .map((declaration) => ({
      id: declaration.id,
      package: declaration.package,
      kit: declaration.kit,
      kitStatus: known.has(declaration.kit) ? 'known' : 'unknown',
      description: declaration.description ?? null,
    }));
}

export function buildCatalogView(
  evidence: CatalogEvidence,
  options: CatalogViewOptions = {},
): CatalogView {
  const modules = evidence.modules ?? null;
  const contracts = evidence.contracts ?? null;
  const discoveredScenarios = evidence.scenarios ?? null;
  const discoveredFixtures = evidence.fixtures ?? null;
  const declarations = evidence.adapterTargets ?? null;

  const moduleList = modules === null ? [] : moduleViews(modules, contracts);
  const fixturePaths = new Set(
    (discoveredFixtures ?? []).map(
      (file) => normalizeDiscoveredPath(file.path) ?? file.path,
    ),
  );

  let scenarios: CatalogView['scenarios'];
  let scenarioList: readonly ScenarioCatalogView[] = [];
  if (discoveredScenarios === null) {
    scenarios = unavailable(VIEW_UNAVAILABLE.scenarioDiscovery);
  } else if (options.validateScenario === undefined) {
    scenarios = unavailable(VIEW_UNAVAILABLE.scenarioValidator);
  } else {
    scenarioList = scenarioViews(
      discoveredScenarios,
      options.validateScenario,
      modules,
      fixturePaths,
    );
    scenarios = available({
      scenarios: scenarioList,
      scenarioCount: scenarioList.length,
      validCount: scenarioList.filter((entry) => entry.status === 'valid')
        .length,
      invalidCount: scenarioList.filter((entry) => entry.status === 'invalid')
        .length,
    });
  }

  const fixtures =
    discoveredFixtures === null
      ? unavailable(VIEW_UNAVAILABLE.fixtureDiscovery)
      : (() => {
          const list = fixtureViews(discoveredFixtures, scenarioList);
          return available({
            fixtures: list,
            fixtureCount: list.length,
            orphanCount: list.filter((entry) => entry.orphan).length,
          });
        })();

  return {
    view: CATALOG_VIEW_VERSION,
    root: evidence.root,
    modules:
      modules === null
        ? unavailable(VIEW_UNAVAILABLE.moduleRegistry)
        : available({ modules: moduleList, moduleCount: moduleList.length }),
    contracts:
      contracts === null
        ? unavailable(VIEW_UNAVAILABLE.contractRegistry)
        : (() => {
            const list = contractViews(contracts, moduleList);
            return available({
              contracts: list,
              contractCount: list.length,
            });
          })(),
    // Core registers no evaluators. Saying so beats rendering an empty list
    // that would read as "this system has no evaluators".
    evaluators: unavailable(VIEW_UNAVAILABLE.evaluatorRegistry),
    scenarios,
    fixtures,
    adapterTargets:
      declarations === null
        ? unavailable(VIEW_UNAVAILABLE.adapterTargets)
        : (() => {
            const list = adapterTargetViews(declarations);
            return available({
              targets: list,
              targetCount: list.length,
              knownKits: [...ADAPTER_KITS],
            });
          })(),
    diagnostics: (evidence.diagnostics ?? []).map((entry) => ({
      code: entry.code,
      severity: entry.severity,
      detail: entry.detail ?? null,
    })),
  };
}
