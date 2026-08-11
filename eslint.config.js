/**
 * Flat ESLint config for the legacy TypeScript prototype in src/.
 * Composed manually from @typescript-eslint/parser + @typescript-eslint/eslint-plugin
 * (the `typescript-eslint` meta-package is intentionally not used).
 */
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'vendor/**',
      'src-tauri/**',
      'components/**',
      'lib/**',
      'ui/**',
      '_archive/**',
      'target/**',
    ],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Underscore prefix marks intentionally-unused parameters/locals
      // (matches the tsconfig noUnusedLocals/noUnusedParameters convention).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];
