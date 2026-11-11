// vitest.config.ts

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './test/setup.ts',
        alias: {
            '@': path.resolve(__dirname, './'),
        },
        exclude: ['**/node_modules/**', '**/e2e/**'],
        // The post-service tests import the real wasm-backed ProfileService,
        // whose module load + 20MB wasm init can exceed the 10s default hook
        // timeout when several workers run in parallel on a loaded machine.
        hookTimeout: 60000,
        // 60s: the heavyweight pure-TS crypto suites (tree/poseidon/bundle/sync)
        // can exceed 30s wall time under full parallel load alongside the other
        // suites (the 30s->60s bump mirrors the earlier 10s->60s hook bump).
        testTimeout: 60000,
    },
})
