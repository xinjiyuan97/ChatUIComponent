import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

/* Deliberately not type-aware: `tsc --noEmit` already runs on every package and covers
 * everything the typed rules would, at a fraction of the lint time. This config is here
 * for the things the compiler does not see — hook dependency arrays above all. */
export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/storybook-static/**',
      '**/.next/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      /* TypeScript resolves these; the base rules produce false positives on types,
       * overloads and declaration merging. */
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-redeclare': 'off',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      /* Untrusted spec values arrive as `unknown` and are narrowed by the coercion helpers;
       * `any` is still banned, but an explicit cast at a boundary is not worth a warning. */
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': ['error', { destructuring: 'all' }],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/*.stories.{ts,tsx}', '**/*.config.{ts,js}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
