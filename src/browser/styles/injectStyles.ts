// src/browser/styles/injectStyles.ts
// inject imported CSS while registry remains style-tracking source of truth

import { registry } from '../registry/ModuleRegistry';
import { getStyleInjector } from '../internal/style-injector';

// inject CSS into the document for a module
// use ModuleRegistry as the authoritative tracker for deduplication,
// then delegate DOM operations to StyleInjector
export function injectStyles(id: string, css: string): void {
  // check registry (source of truth) to avoid duplicate injection
  if (registry.hasInjectedStyle(id)) {
    return;
  }

  // dom operation via StyleInjector
  getStyleInjector().injectModuleCss(id, css);

  // track in registry (for module loading coordination + reference counting)
  registry.markStyleInjected(id);
}

// remove all injected module styles (called when preview is refreshed)
export function clearInjectedStyles(): void {
  // clear dom elements via StyleInjector
  getStyleInjector().clearModules();
  // clear registry tracking
  registry.clearInjectedStyles();
}

// remove styles for specific modules (for incremental updates)
export function removeStylesForModules(moduleIds: string[]): void {
  for (const id of moduleIds) {
    getStyleInjector().removeModuleCss(id);
    registry.unmarkStyleInjected(id);
  }
}
