/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'core-is-domain-neutral',
      severity: 'error',
      comment:
        'Core must not depend on apps, adapters, modules, or other packages.',
      from: {
        path: '(?:^|/)packages/core/src',
      },
      to: {
        path: '^(?:apps|packages/(?!core(?:/|$)))',
      },
    },
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: 'memory-adapter-depends-only-on-core',
      severity: 'error',
      comment:
        'The in-memory adapter may depend on itself and core, not apps, modules, or other adapters.',
      from: {
        path: '(?:^|/)packages/adapter-memory/src',
      },
      to: {
        path: '^(?:apps|packages/(?!core(?:/|$)|adapter-memory(?:/|$)))',
      },
    },
    {
      name: 'sqlite-adapter-depends-only-on-core',
      severity: 'error',
      comment:
        'The SQLite adapter may depend on itself and core, not apps, modules, or other adapters.',
      from: {
        path: '(?:^|/)packages/adapter-sqlite/src',
      },
      to: {
        path: '^(?:apps|packages/(?!core(?:/|$)|adapter-sqlite(?:/|$)))',
      },
    },
    {
      name: 'sqlite-driver-stays-behind-its-adapter',
      severity: 'error',
      comment:
        'Only @acme/adapter-sqlite may reach the SQLite driver; core, modules, and other adapters must use the ExecutionRepository port.',
      from: {
        path: '(?:^|/)(?:packages|apps)/[^/]+/src',
        pathNot: '(?:^|/)packages/adapter-sqlite/src',
      },
      to: {
        path: '(?:^|/)better-sqlite3(?:/|$)',
      },
    },
    {
      name: 'model-mock-adapter-depends-only-on-core',
      severity: 'error',
      comment:
        'The model mock may depend on itself and core, not apps, modules, provider SDKs, or other adapters.',
      from: {
        path: '(?:^|/)packages/adapter-model-mock/src',
      },
      to: {
        path: '^(?:apps|packages/(?!core(?:/|$)|adapter-model-mock(?:/|$)))',
      },
    },
    {
      name: 'domain-modules-do-not-depend-on-other-modules',
      severity: 'error',
      comment:
        'A domain module may depend on public core contracts only; it must never reach another domain module.',
      from: {
        path: '(?:^|/)packages/module-([^/]+)/src',
      },
      to: {
        path: '^packages/module-(?!$1(?:/|$))',
      },
    },
    {
      name: 'domain-modules-do-not-depend-on-apps-adapters-or-testing',
      severity: 'error',
      comment:
        'Domain modules may use public core contracts but not apps, concrete adapters, or test-support packages.',
      from: {
        path: '(?:^|/)packages/module-[^/]+/src',
      },
      to: {
        path: '^(?:apps|packages/(?:adapter-[^/]+|testing)(?:/|$))',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    exclude: {
      path: '(?:^|/)dist(?:/|$)',
    },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    tsPreCompilationDeps: true,
  },
};
