import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Service tests run against a real SQLite file. On Windows, several test
    // files writing at once can push a heavy case past the 5s default even
    // though it finishes in well under a second on its own.
    testTimeout: 30_000,
  },
});
