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
