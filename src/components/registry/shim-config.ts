// src/components/registry/shim-config.ts
// define shim manifest for framework CSS & barrel exports

import type { FrameworkId } from './types'

export interface FrameworkCssConfig
{
  framework: FrameworkId
  cssImport: string | null
  allowRetry: boolean
}

export interface ShimBarrelExport
{
  values?: string[]
  types?: string[]
}

export interface ShimBarrelConfig
{
  outputPath: string
  exports: ShimBarrelExport[]
  // inject the framework CSS side-effect import into the barrel
  injectCss?: boolean
}

export const FRAMEWORK_CSS_CONFIG: readonly FrameworkCssConfig[] = [
  {
    framework: 'generic',
    cssImport: 'mdx-forge/components/styles/generic.css',
    allowRetry: true,
  },
  {
    framework: 'docusaurus',
    cssImport: 'mdx-forge/components/styles/docusaurus.css',
    allowRetry: true,
  },
  {
    framework: 'starlight',
    cssImport: 'mdx-forge/components/styles/starlight.css',
    allowRetry: true,
  },
  {
    framework: 'nextra',
    cssImport: 'mdx-forge/components/styles/nextra.css',
    allowRetry: true,
  },
  {
    framework: 'nextjs',
    cssImport: null,
    allowRetry: false,
  },
]

export const SHIM_BARREL_CONFIG: readonly ShimBarrelConfig[] = [
  {
    outputPath: 'generated/shim-barrels/generic/index.ts',
    exports: [
      {
        values: ['normalizeCalloutType', 'CALLOUT_TITLES'],
        types: [
          'CalloutType',
          'CalloutProps',
          'CollapsibleProps',
          'CodeGroupProps',
        ],
      },
      {
        values: ['Callout', 'Alert', 'Admonition'],
      },
      {
        values: ['Collapsible', 'Accordion'],
      },
      {
        values: ['Tabs', 'useGenericTabsContext'],
        types: ['TabsProps'],
      },
      {
        values: ['TabItem', 'Tab'],
      },
      {
        values: ['CodeGroup'],
      },
    ],
    injectCss: true,
  },
  {
    outputPath: 'generated/shim-barrels/docusaurus/index.ts',
    exports: [
      {
        values: ['Tabs', 'TabItem'],
        types: ['TabsProps', 'TabItemProps'],
      },
      {
        values: ['CodeBlock'],
        types: ['CodeBlockProps'],
      },
      {
        values: ['Details'],
        types: ['DetailsProps'],
      },
    ],
  },
  {
    outputPath: 'generated/shim-barrels/starlight/index.ts',
    exports: [
      {
        values: ['Card'],
        types: ['CardProps'],
      },
      {
        values: ['CardGrid'],
        types: ['CardGridProps'],
      },
      {
        values: ['LinkCard'],
        types: ['LinkCardProps'],
      },
      {
        values: ['Steps'],
        types: ['StepsProps'],
      },
      {
        values: ['Badge'],
        types: ['BadgeProps', 'BadgeVariant'],
      },
      {
        values: ['Aside'],
        types: ['AsideProps', 'AsideType'],
      },
      {
        values: ['Tabs', 'TabItem'],
        types: ['TabsProps', 'TabItemProps'],
      },
      {
        values: ['FileTree'],
        types: ['FileTreeProps'],
      },
      {
        values: ['Code'],
        types: ['CodeProps'],
      },
    ],
  },
  {
    outputPath: 'generated/shim-barrels/nextra/index.ts',
    exports: [
      {
        values: ['Callout'],
        types: ['CalloutProps', 'CalloutType'],
      },
      {
        values: ['Tabs'],
        types: ['TabsProps', 'TabProps', 'TabItem'],
      },
      {
        values: ['Cards'],
        types: ['CardsProps', 'CardProps'],
      },
      {
        values: ['FileTree'],
        types: ['FileTreeProps'],
      },
      {
        values: ['Steps'],
        types: ['StepsProps'],
      },
      {
        values: ['Bleed'],
        types: ['BleedProps'],
      },
    ],
  },
  {
    outputPath: 'generated/shim-barrels/nextjs/index.ts',
    exports: [
      {
        values: ['Image'],
        types: ['ImageProps'],
      },
      {
        values: ['Link'],
        types: ['LinkProps'],
      },
    ],
  },
]
