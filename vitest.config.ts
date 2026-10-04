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
        testTimeout: 30000,
    },
})
