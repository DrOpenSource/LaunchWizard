import { defineConfig } from 'vitest/config';
import * as path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 10000,
  },
  resolve: {
    // Extension-layer tests run against an in-memory stand-in for the VS Code API.
    alias: { vscode: path.resolve(__dirname, 'test/mocks/vscode.ts') },
  },
});
