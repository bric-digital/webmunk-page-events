import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/specs',

  fullyParallel: false,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: 1,

  reporter: process.env.CI ? 'dot' : 'html',

  use: {
    baseURL: 'http://localhost:8086',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'python3 -m http.server -d tests/src 8086',
      port: 8086,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
