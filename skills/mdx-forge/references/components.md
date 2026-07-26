# mdx-forge/components — reference

Framework component shims & registry. Subpath: `mdx-forge/components` (root)
plus per-framework subpaths. Source: `src/components/`.

## Subpath inventory

| Subpath                                  | Use for                                  |
| ---------------------------------------- | ---------------------------------------- |
| `mdx-forge/components`                   | Factory primitives (build custom shims)  |
| `mdx-forge/components/generic`           | Generic shims (cross-framework defaults) |
| `mdx-forge/components/docusaurus`        | Docusaurus-styled shims                  |
| `mdx-forge/components/starlight`         | Starlight-styled shims                   |
| `mdx-forge/components/nextra`            | Nextra-styled shims                      |
| `mdx-forge/components/nextjs`            | Next.js shims (`Image`, `Link`)          |
| `mdx-forge/components/registry`          | `COMPONENT_REGISTRY` & query helpers     |
| `mdx-forge/components/styles/<fw>.css`   | Per-framework CSS bundle                 |
| `mdx-forge/components/styles/tokens.css` | Shared design tokens (always import)     |

## Per-framework component inventory

Sourced from `SHIM_BARREL_CONFIG` in `src/components/registry/shim-config.ts`.

### `mdx-forge/components/generic`

| Component     | Aliases (also exported)        |
| ------------- | ------------------------------ |
| `Callout`     | `Alert`, `Admonition`          |
| `Collapsible` | `Accordion`                    |
| `Tabs`        | (with `useGenericTabsContext`) |
| `TabItem`     | `Tab`                          |
| `CodeGroup`   | —                              |

Required CSS: `mdx-forge/components/styles/generic.css` + `tokens.css`.
Barrels do **not** import CSS themselves — the consumer imports the CSS
bundle once at app entry (a side-effect import bundlers honor via the
package's `sideEffects` declaration).

### `mdx-forge/components/docusaurus`

| Component   | Notes                     |
| ----------- | ------------------------- |
| `Tabs`      | Docusaurus-styled wrapper |
| `TabItem`   | Pairs with `Tabs`         |
| `CodeBlock` | Syntax-highlighted block  |
| `Details`   | Native `<details>` styled |

Required CSS: `mdx-forge/components/styles/docusaurus.css` +
`mdx-forge/components/styles/tokens.css`.

### `mdx-forge/components/starlight`

| Component  | Notes                                     |
| ---------- | ----------------------------------------- |
| `Card`     | Visual card container                     |
| `CardGrid` | Auto-flow grid of cards                   |
| `LinkCard` | Card whose surface is a link              |
| `Steps`    | Numbered step list                        |
| `Badge`    | Inline label (variants: `note`, `tip`, …) |
| `Aside`    | Callout with type (`note`, `tip`, etc.)   |
| `Tabs`     | Starlight-styled tabs                     |
| `TabItem`  | Pairs with `Tabs`                         |
| `FileTree` | Directory tree visualizer                 |
| `Code`     | Inline-style code element                 |

Required CSS: `mdx-forge/components/styles/starlight.css` + tokens.

### `mdx-forge/components/nextra`

| Component  | Notes                                           |
| ---------- | ----------------------------------------------- |
| `Callout`  | Nextra-styled callout                           |
| `Tabs`     | Nextra `Tabs` (uses `Tab` items, not `TabItem`) |
| `Cards`    | Card grid                                       |
| `FileTree` | Directory tree                                  |
| `Steps`    | Step list                                       |
| `Bleed`    | Full-bleed content wrapper                      |

Required CSS: `mdx-forge/components/styles/nextra.css` + tokens.

### `mdx-forge/components/nextjs`

| Component | Notes                        |
| --------- | ---------------------------- |
| `Image`   | Wraps `next/image` semantics |
| `Link`    | Wraps `next/link` semantics  |

**No bundled CSS** — Next.js relies on the consuming app's CSS. The CSS
import map confirms this (`cssImport: null`).

## Factory primitives (`mdx-forge/components` root)

The root subpath exports factories for building your own shims, not the
shims themselves. Use these when you need a Callout / Tabs / Collapsible
with custom styling beyond the per-framework presets.

| Export                      | Purpose                                      |
| --------------------------- | -------------------------------------------- |
| `createTabs(config)`        | Build a Tabs component                       |
| `createIndexTabs(config)`   | Build URL-anchored Tabs (localStorage-aware) |
| `createCallout(config)`     | Build a Callout component                    |
| `createCollapsible(config)` | Build a Collapsible/Accordion                |
| `createCodeBlock(config)`   | Build a syntax-highlighted code block        |
| `BaseCard`                  | Pre-built card primitive                     |
| `CopyButton`                | Pre-built copy-to-clipboard button           |
| `createIconComponent(src)`  | Build an Icon component from a sprite/source |

Plus the matching prop / config types: `BaseTabsConfig`, `BaseTabsProps`,
`CreateTabsResult`, `BaseCalloutConfig`, `BaseCalloutProps`, `IconSource`,
`CollapsibleConfig`, `BaseCollapsibleProps`, `BaseCodeBlockProps`,
`BaseCardProps`, `CopyButtonProps`, `IconProps`.

## `mdx-forge/components/registry` — `COMPONENT_REGISTRY` & queries

The registry powers codegen (in vsc-mdx-preview) & the alias resolver.
You'll reach for it when:

- Identifying known vs unknown components for diagnostics
- Generating preload manifests or shim barrel files
- Resolving framework-specific imports to canonical shim paths

### Constants

```ts
const SHIM_PREFIX = '@mdx-preview/shims'

const COMPONENT_REGISTRY: readonly ComponentRegistryEntry[]
const GENERIC_COMPONENTS: Record<GenericComponentName, GenericComponentConfig>
const FRAMEWORK_COMPONENTS: Record<Framework, readonly string[]>
```

### Query functions

```ts
function getAllGenericComponentNames(): string[]
function getGenericComponentSet(): Set<string> // O(1) lookups
function getPrimaryGenericComponentNames(): GenericComponentName[]
function getGenericComponentAliases(name: GenericComponentName): string[]

function getCanonicalComponentName(nameOrAlias: string): string | undefined

function getFrameworkComponents<F extends Framework>(
  framework: F
): readonly string[]

function isGenericComponent(name: string): boolean
function isFrameworkComponent(name: string, framework?: Framework): boolean

function getSemanticAlias(name: string): string | undefined

function getGenericComponentSnippets(): Array<{
  name: string
  template: string
  doc: string
}>

function getGenericShimPath(componentName: string): string
function getFrameworkShimPath(
  framework: Framework,
  componentName: string
): string
```

### Types

```ts
type Framework = 'docusaurus' | 'starlight' | 'nextjs' | 'nextra'
type FrameworkId = Framework | 'generic'
type FrameworkSetting = 'auto' | FrameworkId

type ComponentKind = 'component' | 'barrel'

interface ComponentDefinition extends ComponentDefinitionBase {
  kind: 'component'
  aliases: readonly string[]
  semanticAliases?: readonly string[]
  snippetTemplate?: string
  snippetDoc?: string
  importKind?: 'default' | 'named'
  importName?: string
}

interface ComponentBarrelDefinition extends ComponentDefinitionBase {
  kind: 'barrel'
  exportNames: readonly string[]
}

type ComponentRegistryEntry = ComponentDefinition | ComponentBarrelDefinition
```

`ComponentDefinitionBase` carries `name`, `framework`, `importSpecifiers`,
`shimPath`, optional `preloadId`, optional `webviewImport`, &
`exposeAsBareImport`.

## Alias resolution pattern

If your host needs to rewrite framework-specific imports (e.g.,
`@theme/Tabs` → the Docusaurus shim), the pattern is:

1. Match the import against `importSpecifiers` of `COMPONENT_REGISTRY`
   entries — entries that include `'@theme/Tabs'` in `importSpecifiers` are
   candidates
2. Pick the entry whose `framework` matches the user's framework
3. Replace the import path with that entry's `shimPath` (e.g.,
   `@mdx-preview/shims/docusaurus/Tabs`)
4. The browser then resolves the shim path via its preload entries (which
   are generated from the registry too)

vsc-mdx-preview's `alias-resolver.ts` is the canonical implementation.

## CSS dependencies

- **Always** import `mdx-forge/components/styles/tokens.css` once at app
  entry — it provides shared design tokens used by every framework bundle
- Then import the matching framework CSS:

  | Framework  | CSS import                                   |
  | ---------- | -------------------------------------------- |
  | generic    | `mdx-forge/components/styles/generic.css`    |
  | docusaurus | `mdx-forge/components/styles/docusaurus.css` |
  | starlight  | `mdx-forge/components/styles/starlight.css`  |
  | nextra     | `mdx-forge/components/styles/nextra.css`     |
  | nextjs     | (none — bring your own)                      |

mdx-forge's `package.json` has `"sideEffects": ["**/*.css"]`, so bundlers
will tree-shake everything except CSS — these imports are intentionally
side-effecting.

## Common gotchas

- **Importing from `mdx-forge/components` does NOT give you any actual
  components** — it gives you factories. Use a per-framework subpath for
  pre-built components.
- **CSS imports are not optional** — without the framework CSS, components
  render unstyled (no padding, missing icons, broken layouts).
- **Next.js has no bundled CSS** — by design. Style with the consuming
  app's CSS or compose with Tailwind.
- **`Tab` vs `TabItem`** — Generic & Docusaurus use `TabItem` (with `Tab`
  as a generic alias); Nextra uses `Tab`. Match the framework you import
  from.
