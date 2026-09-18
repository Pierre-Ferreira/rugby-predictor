import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: {
    jsx: {
      importSource: 'react',
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/unit/**/*.test.ts'],
    passWithNoTests: false,
    reporters: ['default'],
  },
});
