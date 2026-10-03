// playwright.config.ts

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './test/e2e',
    fullyParallel: true,
    timeout: 120000,
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
    },
    // Serve the production static export (./out) instead of the dev server:
    // the app ships as a static build, and the dev server's on-demand
    // compile made e2e runs slow and flaky.
    webServer: {
        command: 'node test/static-server.mjs',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
})
