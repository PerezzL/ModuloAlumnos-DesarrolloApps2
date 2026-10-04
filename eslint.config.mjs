// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'packages/api-types/src/generated/**',
      'postman/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // AGENTS.md: el accessToken vive solo en memoria
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'El token y los datos de sesión viven solo en memoria.' },
        {
          name: 'sessionStorage',
          message: 'El token y los datos de sesión viven solo en memoria.',
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'Solo memoria (AGENTS.md).' },
        { object: 'window', property: 'sessionStorage', message: 'Solo memoria (AGENTS.md).' },
      ],
    },
  },
  prettier,
);
