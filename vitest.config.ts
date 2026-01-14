import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest Configuration
 * 
 * For unit and integration tests.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    // Use different setup file based on test type
    setupFiles: process.env.npm_lifecycle_event?.includes('integration')
      ? ['./tests/setup-integration.ts']
      : ['./tests/setup.ts'],
    // Only run global setup for integration tests
    globalSetup: process.env.npm_lifecycle_event?.includes('integration') 
      ? './tests/setup/setup-integration.ts' 
      : undefined,
    env: {
      // DATABASE_URL should be provided by environment or CI
      // Fallback only for local development
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://expenseuser:expensepass@localhost:5432/expense_tracker_integration',
      TEST_API_URL: 'http://127.0.0.1:3000',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.ts',
        '**/*.config.js',
        '**/types.ts',
        '**/.next/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
