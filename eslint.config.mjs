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
  '_build-local-playwright/**',
  'coverage/**',
  'node_modules/**',
  'playwright-report/**',
  'public/build-assets/**',
  'public/build-chunks/**',
  'test-results/**',
  'tsconfig.tsbuildinfo',
];

const parserOptionsWith = (plugins) => ({
  requireConfigFile: false,
  babelOptions: {
    babelrc: false,
    configFile: false,
    parserOpts: {
      plugins,
    },
  },
});

const commonLanguageOptions = {
  ecmaVersion: 'latest',
  globals: {
    ...globals.browser,
    ...globals.node,
    ...globals.es2024,
  },
  parser: babelParser,
  sourceType: 'module',
};

const commonSettings = {
  react: {
    version: 'detect',
  },
};

const commonRules = {
  ...jsxA11yPlugin.configs.recommended.rules,
  'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
};

const typeScriptRules = {
  ...commonRules,
  'no-undef': 'off',
  'no-unused-vars': 'off',
  'react/prop-types': 'off',
};

export default [
  { ignores },
  js.configs.recommended,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  reactHooksPlugin.configs.flat.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ...commonLanguageOptions,
      parserOptions: parserOptionsWith(['jsx']),
    },
    settings: commonSettings,
    plugins: {
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: commonRules,
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      ...commonLanguageOptions,
      parserOptions: parserOptionsWith([['typescript', { isTSX: false }]]),
    },
    settings: commonSettings,
    plugins: {
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: typeScriptRules,
  },
  {
    files: ['**/*.tsx'],
    languageOptions: {
      ...commonLanguageOptions,
      parserOptions: parserOptionsWith([
        'jsx',
        ['typescript', { isTSX: true }],
      ]),
    },
    settings: commonSettings,
    plugins: {
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: typeScriptRules,
  },
  {
    files: ['tests/e2e/**/*.ts', 'tests/unit/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
