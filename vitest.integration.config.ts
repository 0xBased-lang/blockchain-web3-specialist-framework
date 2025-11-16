import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Integration tests target real integration scenarios
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/unit', 'tests/e2e'],
    // Integration tests may take longer
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
