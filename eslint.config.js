import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.output', '.wxt', 'node_modules', 'coverage', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='innerHTML']",
          message: 'innerHTML is banned. Render text with React or textContent.',
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is banned.',
        },
      ],
      // noUncheckedIndexedAccess makes `!` the explicit way to assert an index we've
      // already proven exists; banning it would only push code toward unchecked casts.
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },
  {
    // core/ is pure domain logic: no browser APIs, no React, no data layer.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'wxt/*', '@/data/*', '@/features/*', '@/entrypoints/*'],
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'chrome', 'browser', 'window', 'document', 'localStorage'],
    },
  },
  {
    files: ['scripts/**', 'e2e/**', '*.config.{ts,js}'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
