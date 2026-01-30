// test/setup.ts

import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock WASM modules which usually fail in Node environments
vi.mock('@/lib/dash-wasm/wasm_sdk.js', () => ({
    default: vi.fn(),
    init: vi.fn(),
}))

// Mock window.crypto for blockchain-related libs
Object.defineProperty(window, 'crypto', {
    value: {
        subtle: {},
        getRandomValues: (a: any) => a,
    },
})
