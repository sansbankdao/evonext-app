// playwright.config.ts

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './test/e2e',
    fullyParallel: true,
    // The first navigation pays Next dev's on-demand compile (~77s measured),
    // which exceeds the 30s default test timeout.
    timeout: 120000,
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        // The first on-demand compile of "/" measured ~77s on a cold Next dev
        // server, which exceeds the 60s default and aborts the run.
        timeout: 180000,
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
})
