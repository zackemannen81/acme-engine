import { ACME_CORE_PACKAGE, type AcmeCorePackageName } from '@acme/core';

export const TESTING_CORE_PACKAGE: AcmeCorePackageName = ACME_CORE_PACKAGE;

export * from './domain-module-conformance.js';
export * from './model-gateway-conformance.js';
export * from './repository-conformance.js';
export * from './scenario.js';
