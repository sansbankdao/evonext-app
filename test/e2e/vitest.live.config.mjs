// test/e2e/vitest.live.config.mts

/* One-off config for LIVE end-to-end tests (real network, real funds).
 * These files are named *.live.mts and live under test/e2e/ so the normal
 * suite (vitest.config.ts: include *.test/*.spec, exclude **/e2e/**) never
 * picks them up. Run explicitly:
 *   pnpm vitest run --config test/e2e/vitest.live.config.mts [file filter] */

import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './test/setup.ts',
        alias: {
            /* cwd is the repo root when invoked via pnpm vitest; __dirname
             * breaks vite-8's .mts config bundler on the dotted evonext.app
             * path segment. */
            '@': path.resolve(process.cwd()),
        },
        include: ['test/e2e/**/*.live.mts'],
        // Live network: block production + chainlock waits can take many
        // minutes; the prover takes ~60-120s cold.
        hookTimeout: 120000,
        testTimeout: 900000,
        // One live test at a time — never parallel (they share funds/state).
        maxConcurrency: 1,
        pool: 'forks',
    },
})
