// eslint.config.mjs
// standalone ESLint configuration for mdx-forge

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
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
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '**/*.mjs',
      '**/vitest.config.ts',
      '**/*.test.ts',
    ],
  }
);
