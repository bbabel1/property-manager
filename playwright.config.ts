import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/playwright',
  fullyParallel: true,
  reporter: 'list',
  use: {
    headless: true,
    viewport: { width: 1100, height: 1400 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  snapshotDir: 'tests/playwright/__screenshots__',
});
