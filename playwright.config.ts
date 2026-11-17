// playwright.config.ts

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './test/e2e',
    fullyParallel: true,
    timeout: 120000,
    use: {
        // MUST match webServer.url below — a foreign server on 3000 (Gitea on
        // evorunner) was being tested instead of the app.
        baseURL: 'http://localhost:3999',
        trace: 'on-first-retry',
    },
    // Serve the production static export (./out) instead of the dev server:
    // the app ships as a static build, and the dev server's on-demand
    // compile made e2e runs slow and flaky.
    webServer: {
        // Dedicated port + no-reuse: a foreign server squatting 3000 (a Gitea
        // appeared on evorunner mid-session) would otherwise be REUSED and the
        // suite would silently assert against the wrong app.
        command: 'PORT=3999 node test/static-server.mjs',
        url: 'http://localhost:3999',
        reuseExistingServer: false,
        timeout: 60000,
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
})
