// eslint.config.mjs
// standalone ESLint configuration for mdx-forge

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import prettierConfig from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

import ggfinckeRules from './eslint-rules/index.js'

const commentStyleRules = {
  'ggfincke/comment-tags': 'error',
  'ggfincke/file-header': 'error',
  'ggfincke/no-unicode-arrow': 'error',
  'ggfincke/plain-comment-case': 'error',
  'ggfincke/block-doc-comments': 'error',
  'no-inline-comments': [
    'error',
    {
      ignorePattern: '^\\s*(?:eslint(?:-disable)?|@ts-|istanbul|c8\\b|v8\\b)',
    },
  ],
}

export default defineConfig([
  globalIgnores([
    'dist/**',
    'plugins/render/dist/**',
    'node_modules/**',
    '.agents/**',
    'coverage/**',
    'plugins/render/node_modules/**',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: {
      ggfincke: ggfinckeRules,
    },
    rules: {
      ...commentStyleRules,
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
    },
  },
  {
    files: [
      'eslint.config.mjs',
      'eslint-rules/**/*.js',
      'scripts/**/*.{js,mjs}',
    ],
    extends: [eslint.configs.recommended, prettierConfig],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      prettierConfig,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-throw-literal': 'error',
      'no-unused-expressions': 'warn',
      curly: 'error',
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      ...commentStyleRules,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'gray-matter',
              message:
                'Use src/internal/frontmatter.ts safeMatter() instead of raw gray-matter.',
            },
          ],
          patterns: ['gray-matter/*'],
        },
      ],
    },
  },
  {
    files: ['src/internal/frontmatter.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
])
