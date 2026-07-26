// src/browser/registry/StyleCache.ts
// injected-style presence tracking; the cached CSS module owns its style

import { LRUCache } from '../../internal/lru-cache'
import { DEFAULT_MAX_STYLES } from '../internal/constants'

// style entry keeps injected bytes so changed CSS can be detected & replaced
interface StyleEntry
{
  css: string
}

// style cache configuration options
export interface StyleCacheConfig
{
  maxStyles?: number
}

// track injected CSS styles w/ lru presence semantics
// ModuleRegistry wires onEvict (DOM removal) & isProtected (live owning module)
export class StyleCache
{
  private cache: LRUCache<string, StyleEntry>

  // eviction callback wired by ModuleRegistry (removes the DOM style node)
  onEvict?: (id: string) => void

  // protection predicate wired by ModuleRegistry (owning module still cached)
  isProtected?: (id: string) => boolean

  constructor()
  {
    this.cache = new LRUCache<string, StyleEntry>({
      maxEntries: DEFAULT_MAX_STYLES,
      onEvict: (id) => this.onEvict?.(id),
      isProtected: (id) => this.isProtected?.(id) === true,
    })
  }

  // configure maximum number of styles to track
  configure(options: StyleCacheConfig): void
  {
    if (options.maxStyles !== undefined)
    {
      this.cache.updateSettings({ maxEntries: options.maxStyles })
    }
  }

  // check if CSS has been injected for module
  hasInjectedStyle(id: string): boolean
  {
    return this.cache.has(id)
  }

  // get injected CSS bytes for module (promotes lru position)
  getInjectedCss(id: string): string | undefined
  {
    return this.cache.get(id)?.css
  }

  // get total number of tracked styles
  get size(): number
  {
    return this.cache.size
  }

  // snapshot tracked IDs before coordinated invalidation mutates the cache
  getIds(): string[]
  {
    return Array.from(this.cache.keys())
  }

  // track injected CSS for module; capacity eviction fires onEvict
  trackStyle(id: string, css: string): void
  {
    this.cache.set(id, { css })
  }

  // stop tracking a style; fires onEvict so the DOM node is removed too
  untrackStyle(id: string): void
  {
    this.cache.delete(id)
  }

  // clear tracking through eviction so registry-only callers also remove DOM
  clear(): void
  {
    for (const id of this.getIds())
    {
      this.cache.delete(id)
    }
  }
}
