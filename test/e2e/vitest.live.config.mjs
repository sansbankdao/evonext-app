// test/e2e/vitest.live.config.mts

/* One-off config for LIVE end-to-end tests (real network, real funds).
 * These files are named *.live.mts and live under test/e2e/ so the normal
 * suite never picks them up (it includes test/spec files only and excludes
 * this directory). Run explicitly:
 *   pnpm vitest run --config test/e2e/vitest.live.config.mts [file filter]
 *
 * NOTE: do NOT write double-star glob text inside block comments here —
 * rolldown 1.2.18 (vite's config bundler) mis-serializes such comments and
 * emits their content as live code ('e2e is not defined' at config load).
 * Plain object, NOT defineConfig(): vite 8.3.7's defineConfig dynamically
 * imports '@vitejs/devtools/config', which is not installed and also breaks
 * the config bundling. */

import path from 'node:path'
export default {
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
}
