// src/browser/styles/injectStyles.ts
// inject imported CSS while registry remains style-tracking source of truth

import { registry } from '../registry/ModuleRegistry'
import { getStyleInjector } from '../internal/style-injector'

// inject CSS into the document for a module
// identical bytes dedup; changed bytes under the same ID replace the DOM node
export function injectStyles(id: string, css: string): void
{
  const existing = registry.getInjectedCss(id)

  // duplicate import w/ unchanged bytes -> keep existing node
  if (existing === css)
  {
    return
  }

  const injector = getStyleInjector()

  // changed bytes under a stable ID -> remove stale node before reinjecting
  if (existing !== undefined)
  {
    injector.removeModuleCss(id)
  }

  injector.injectModuleCss(id, css)

  // track in registry; capacity eviction removes orphaned DOM nodes
  registry.trackStyleInjected(id, css)
}

// remove all injected module styles (called when preview is refreshed)
export function clearInjectedStyles(): void
{
  // clear dom elements via StyleInjector
  getStyleInjector().clearModules()
  // clear registry tracking
  registry.clearInjectedStyles()
}
