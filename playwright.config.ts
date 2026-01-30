// playwright.config.ts

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './test/e2e',
    fullyParallel: true,
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
})
