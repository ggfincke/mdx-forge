// src/browser/internal/style-injector.ts
// manage DOM style injection, ordering & cleanup

import type { StyleInjector } from '../types'

class DomStyleInjector implements StyleInjector
{
  private moduleStyleElements: Map<string, HTMLStyleElement> = new Map()

  injectModuleCss(id: string, css: string): void
  {
    const style = document.createElement('style')
    style.setAttribute('data-module-id', id)
    style.textContent = css
    document.head.appendChild(style)
    this.moduleStyleElements.set(id, style)
  }

  reorderModuleCss(ids: readonly string[]): void
  {
    const desired = [...new Set(ids)]
      .map((id) => this.moduleStyleElements.get(id))
      .filter(
        (style): style is HTMLStyleElement =>
          style !== undefined && style.parentNode === document.head
      )
    if (desired.length < 2)
    {
      return
    }

    const selected = new Set<Element>(desired)
    const current = Array.from(document.head.children).filter((element) =>
      selected.has(element)
    )
    if (current.every((element, index) => element === desired[index]))
    {
      return
    }

    // retain the occupied slots so unrelated styles keep their cascade positions
    const slots = current.map((element) =>
    {
      const slot = document.createComment('')
      element.replaceWith(slot)
      return slot
    })
    slots.forEach((slot, index) => slot.replaceWith(desired[index]))
  }

  removeModuleCss(id: string): void
  {
    const style = this.moduleStyleElements.get(id)
    if (style?.parentNode)
    {
      style.remove()
    }
    this.moduleStyleElements.delete(id)
  }

  clearModules(): void
  {
    for (const style of this.moduleStyleElements.values())
    {
      if (style.parentNode)
      {
        style.remove()
      }
    }
    this.moduleStyleElements.clear()
  }
}

const styleInjector = new DomStyleInjector()

export function reorderStyles(ids: readonly string[]): void
{
  styleInjector.reorderModuleCss(ids)
}

export function getStyleInjector(): StyleInjector
{
  return styleInjector
}
