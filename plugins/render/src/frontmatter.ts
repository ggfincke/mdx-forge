// plugins/render/src/frontmatter.ts
// framework frontmatter schemas for render-plugin diagnostics

import type {
  FrameworkId,
  FrontmatterField,
  FrontmatterSchema,
} from './registry-types.js'

const COMMON_TAGS_FIELD: FrontmatterField = {
  name: 'tags',
  type: 'array',
  description: 'List of topic tags.',
}

const FRONTMATTER: readonly FrontmatterSchema[] = [
  {
    framework: 'generic',
    fields: [
      {
        name: 'title',
        type: 'string',
      },
      {
        name: 'description',
        type: 'string',
      },
      COMMON_TAGS_FIELD,
      {
        name: 'draft',
        type: 'boolean',
      },
      {
        name: 'slug',
        type: 'string',
      },
    ],
    allowUnknown: true,
  },
  {
    framework: 'docusaurus',
    fields: [
      {
        name: 'title',
        type: 'string',
      },
      {
        name: 'description',
        type: 'string',
      },
      {
        name: 'sidebar_position',
        type: 'number',
      },
      {
        name: 'sidebar_label',
        type: 'string',
      },
      {
        name: 'sidebar_class_name',
        type: 'string',
      },
      {
        name: 'slug',
        type: 'string',
      },
      {
        name: 'draft',
        type: 'boolean',
      },
      {
        name: 'hide_title',
        type: 'boolean',
      },
      {
        name: 'hide_table_of_contents',
        type: 'boolean',
      },
      {
        name: 'pagination_label',
        type: 'string',
      },
      {
        name: 'pagination_next',
        type: 'string',
      },
      {
        name: 'pagination_prev',
        type: 'string',
      },
      {
        name: 'keywords',
        type: 'array',
      },
      COMMON_TAGS_FIELD,
      {
        name: 'toc_min_heading_level',
        type: 'number',
      },
      {
        name: 'toc_max_heading_level',
        type: 'number',
      },
    ],
    allowUnknown: true,
  },
  {
    framework: 'starlight',
    fields: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Page title (required).',
      },
      {
        name: 'description',
        type: 'string',
      },
      {
        name: 'template',
        type: 'string',
        values: ['doc', 'splash'],
        description: "Page template ('doc' or 'splash').",
      },
      {
        name: 'editUrl',
        type: 'string',
      },
      {
        name: 'lastUpdated',
        type: 'string',
      },
      {
        name: 'tableOfContents',
        type: 'object',
      },
      {
        name: 'head',
        type: 'array',
      },
      {
        name: 'next',
        type: 'string',
      },
      {
        name: 'prev',
        type: 'string',
      },
      {
        name: 'pagefind',
        type: 'boolean',
      },
      {
        name: 'draft',
        type: 'boolean',
      },
      {
        name: 'sidebar',
        type: 'object',
      },
      {
        name: 'hero',
        type: 'object',
      },
      {
        name: 'banner',
        type: 'object',
      },
      COMMON_TAGS_FIELD,
    ],
    allowUnknown: true,
  },
  {
    framework: 'nextra',
    fields: [
      {
        name: 'title',
        type: 'string',
      },
      {
        name: 'description',
        type: 'string',
      },
      {
        name: 'searchable',
        type: 'boolean',
      },
      {
        name: 'asIndexPage',
        type: 'boolean',
      },
      {
        name: 'full',
        type: 'boolean',
      },
      {
        name: 'sidebarTitle',
        type: 'string',
      },
      COMMON_TAGS_FIELD,
    ],
    allowUnknown: true,
  },
  {
    framework: 'nextjs',
    fields: [
      {
        name: 'title',
        type: 'string',
      },
      {
        name: 'description',
        type: 'string',
      },
      {
        name: 'metadata',
        type: 'object',
      },
      COMMON_TAGS_FIELD,
    ],
    allowUnknown: true,
  },
]

const FRONTMATTER_BY_FRAMEWORK = new Map<FrameworkId, FrontmatterSchema>()
for (const schema of FRONTMATTER)
{
  FRONTMATTER_BY_FRAMEWORK.set(schema.framework, schema)
}

export function getFrontmatterSchema(
  framework: FrameworkId
): FrontmatterSchema
{
  return (
    FRONTMATTER_BY_FRAMEWORK.get(framework) ??
    FRONTMATTER_BY_FRAMEWORK.get('generic')!
  )
}
