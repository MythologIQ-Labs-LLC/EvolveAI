import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/**/*.test.ts'],
    exclude: ['_archive/**', 'node_modules/**', 'dist/**'],
    globals: true
  }
});
