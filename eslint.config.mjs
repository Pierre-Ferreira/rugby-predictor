import babelParser from '@babel/eslint-parser';
import js from '@eslint/js';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

const ignores = [
  '.meteor/**',
  '.playwright-mcp/**',
  '_build/**',
  'coverage/**',
  'node_modules/**',
  'playwright-report/**',
  'public/build-assets/**',
  'public/build-chunks/**',
  'test-results/**',
  'tsconfig.tsbuildinfo',
];

const parserOptions = {
  requireConfigFile: false,
  babelOptions: {
    babelrc: false,
    configFile: false,
    parserOpts: {
      plugins: ['jsx', ['typescript', { isTSX: true }]],
    },
  },
};

export default [
  { ignores },
  js.configs.recommended,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  reactHooksPlugin.configs.flat.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2024,
      },
      parser: babelParser,
      parserOptions,
      sourceType: 'module',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    plugins: {
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: {
      ...jsxA11yPlugin.configs.recommended.rules,
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'react/prop-types': 'off',
    },
  },
  {
    files: ['tests/e2e/**/*.ts', 'tests/unit/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
