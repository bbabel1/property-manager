import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['src/components/**', 'jsdom']],
    exclude: ['tests/playwright/**', 'node_modules/**'],
    setupFiles: ['./src/test/setup.ts'],
    server: {
      deps: {
        inline: ['next'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
