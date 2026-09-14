import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/unit/**/*.test.ts'],
    passWithNoTests: false,
    reporters: ['default'],
  },
});
