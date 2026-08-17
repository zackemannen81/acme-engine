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
      name: 'evaluation-depends-only-on-core',
      severity: 'error',
      comment:
        'The domain-neutral evaluation layer may depend on itself and public core, not apps, adapters, modules, or testing.',
      from: {
        path: '(?:^|/)packages/evaluation/src',
      },
      to: {
        path: '^(?:apps|packages/(?!core(?:/|$)|evaluation(?:/|$)))',
      },
    },
    {
      name: 'memory-adapter-depends-only-on-core',
      severity: 'error',
      comment:
        'The in-memory adapter may depend on itself, core and the domain-neutral evaluation layer, not apps, modules, or other adapters.',
      from: {
        path: '(?:^|/)packages/adapter-memory/src',
      },
      to: {
        path: '^(?:apps|packages/(?!core(?:/|$)|evaluation(?:/|$)|adapter-memory(?:/|$)))',
      },
    },
    {
      name: 'sqlite-adapter-depends-only-on-core-and-evaluation',
      severity: 'error',
      comment:
        'The SQLite adapter may depend on itself, core and the domain-neutral evaluation layer, not apps, modules, or other adapters.',
      from: {
        path: '(?:^|/)packages/adapter-sqlite/src',
      },
      to: {
        path: '^(?:apps|packages/(?!core(?:/|$)|evaluation(?:/|$)|adapter-sqlite(?:/|$)))',
      },
    },
    {
      name: 'postgres-adapter-depends-only-on-core-and-evaluation',
      severity: 'error',
      comment:
        'The PostgreSQL adapter may depend on itself, core and the domain-neutral evaluation layer, not apps, modules, or other adapters.',
      from: {
        path: '(?:^|/)packages/adapter-postgres/src',
      },
      to: {
        path: '^(?:apps|packages/(?!core(?:/|$)|evaluation(?:/|$)|adapter-postgres(?:/|$)))',
      },
    },
    {
      name: 'evidence-product-postgres-adapter-depends-only-on-product-stack',
      severity: 'error',
      comment:
        'The Evidence product PostgreSQL adapter may depend on itself, core, product contracts and the evidence module, not apps or other adapters.',
      from: {
        path: '(?:^|/)packages/adapter-evidence-product-postgres/src',
      },
      to: {
        path: '^(?:apps|packages/(?!core(?:/|$)|module-evidence(?:/|$)|evidence-product-contracts(?:/|$)|adapter-evidence-product-postgres(?:/|$)))',
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
      name: 'postgres-driver-stays-behind-its-adapters',
      severity: 'error',
      comment:
        'Only PostgreSQL adapters and composition roots that own pool lifecycle may reach pg; core, modules, and other packages must use repository ports (ADR-0033).',
      from: {
        path: '(?:^|/)(?:packages|apps)/[^/]+/src',
        pathNot:
          '(?:^|/)packages/adapter-(?:postgres|evidence-product-postgres|evidence-auth-postgres|evidence-v2-postgres)/src|(?:^|/)apps/(?:cli|evidence-workbench-api|evidence-workbench-v2-api)/src',
      },
      to: {
        path: '(?:^|/)pg(?:/|$)',
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
      name: 'openai-adapter-depends-only-on-core',
      severity: 'error',
      comment:
        'The OpenAI adapter may depend on itself and core, not apps, modules, or other adapters.',
      from: {
        path: '(?:^|/)packages/adapter-model-openai/src',
      },
      to: {
        path: '^(?:apps|packages/(?!core(?:/|$)|adapter-model-openai(?:/|$)))',
      },
    },
    {
      name: 'provider-wire-shapes-stay-behind-their-adapter',
      severity: 'error',
      comment:
        'Only @acme/adapter-model-openai may reach provider wire shapes; everything else uses the ModelGateway port.',
      from: {
        path: '(?:^|/)(?:packages|apps)/[^/]+/src',
        pathNot: '(?:^|/)packages/adapter-model-openai/src',
      },
      to: {
        path: '(?:^|/)packages/adapter-model-openai/src/(?:wire|request|transport)',
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
      name: 'test-ui-imports-only-public-package-entry-points',
      severity: 'error',
      comment:
        'The Domain Test UI app reads packages through their published entry point; it must never reach a package internal (ADR-0019).',
      from: {
        path: '(?:^|/)apps/test-ui/src',
      },
      to: {
        path: '^packages/[^/]+/src/(?!index\\.ts$)',
      },
    },
    {
      name: 'evidence-browser-uses-product-api-not-auth-or-database',
      severity: 'error',
      comment:
        'The Evidence browser shell may use product HTTP endpoints only; credential, JWT and database dependencies remain behind the BFF (ADR-0035).',
      from: {
        path: '(?:^|/)apps/evidence-workbench-web/src',
      },
      to: {
        path: '^(?:packages/(?:adapter-[^/]+|evidence-auth)(?:/|$)|node_modules/(?:pg|jose|@supabase)(?:/|$))',
      },
    },
    {
      name: 'nothing-imports-the-test-ui-app',
      severity: 'error',
      comment:
        'The Domain Test UI app is a leaf. Nothing may depend on it, so deleting it can lose no canonical fact (ADR-0019).',
      from: {
        path: '(?:^|/)(?:packages|apps)/[^/]+/src',
        pathNot: '(?:^|/)apps/test-ui/src',
      },
      to: {
        path: '^apps/test-ui/src',
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
        path: '^(?:apps|packages/(?:adapter-[^/]+|testing|evidence-testing)(?:/|$))',
      },
    },
    {
      name: 'v2-application-does-not-depend-on-the-frozen-workbench',
      severity: 'error',
      comment:
        'ADR-0047 freezes the packages and apps that carry the replaced Evidence application model. The replacement links against shared infrastructure (core, evidence-artifacts, evidence-auth, live-safety, adapters) and never against the frozen set, so "frozen" is structural rather than a convention.',
      from: {
        path: '(?:^|/)(?:packages/(?:module-evidence-v2|evidence-v2-[^/]+|adapter-evidence-v2-[^/]+)|apps/evidence-workbench-v2-[^/]+)/src',
      },
      to: {
        path: '^(?:apps/evidence-workbench-(?:api|web|worker)/src|packages/(?:module-evidence|evidence-views|evidence-product-contracts|adapter-evidence-product-file|adapter-evidence-product-postgres|evidence-testing)(?:/|$))',
      },
    },
    {
      name: 'sealed-evaluation-truth-stays-out-of-prompts',
      severity: 'error',
      comment:
        'Prompt-capable module and app source may use evaluation source text, but cannot import the sealed evaluation-truth entry point.',
      from: {
        path: '(?:^|/)(?:packages/module-[^/]+|apps/[^/]+)/src',
      },
      to: {
        path: '(?:^|/)packages/evidence-testing/src/evaluation\\.ts$',
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
