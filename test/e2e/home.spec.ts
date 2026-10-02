// test/e2e/home.spec.ts

import { test, expect } from '@playwright/test'

// The app is a static export (next.config.js: output: 'export').
// playwright.config.ts boots `pnpm dev` on http://localhost:3000.
test.describe('home page', () => {
    test('loads with the expected document title', async ({ page }) => {
        // `domcontentloaded` avoids waiting on next dev's late-arriving assets.
        await page.goto('/', { waitUntil: 'domcontentloaded' })

        await expect(page).toHaveTitle(/EvoNext/i)
    })

    test('renders without a server error', async ({ page }) => {
        const response = await page.goto('/', { waitUntil: 'domcontentloaded' })

        expect(response?.status()).toBeLessThan(400)
    })
})
