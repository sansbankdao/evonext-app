// test/unit/lib/wasm-sdk-service-preload.test.mts
// F59 regression — LIVE-HIT 2026-11-17: the contract PRELOAD (a cache warm)
// sat inside _performInitialization's retry loop awaiting
// sdk.getDataContract() with NO timeout; the wasm transport left the future
// pending FOREVER (the driver watched the HTTP 200 land and the wasm never
// resolve) — so a hung preload blocked the WHOLE login forever. The preload
// now races an 8s deadline and initialize() must ALWAYS finish.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const state = vi.hoisted(() => ({
    /** The impl the mocked SDK's getDataContract uses per test. */
    dataContractImpl: null as null | ((...args: any[]) => Promise<any>),
}))

vi.mock('@/lib/dash-wasm/wasm_sdk', () => {
    const builderChain = () => {
        const b: any = {
            withTrustedContext: () => b,
            withSettings: () => b,
            build: () => ({
                __mockSdk: true,
                getDataContract: (...args: any[]) =>
                    state.dataContractImpl
                        ? state.dataContractImpl(...args)
                        : Promise.resolve(undefined),
            }),
        }
        return b
    }
    return {
        default: vi.fn(async () => undefined),
        init: vi.fn(async () => undefined),
        WasmSdkBuilder: {
            testnet: () => builderChain(),
            mainnet: () => builderChain(),
        },
        WasmTrustedContext: {
            prefetchTestnet: vi.fn(async () => 'ctx-testnet'),
            prefetchMainnet: vi.fn(async () => 'ctx-mainnet'),
        },
        WasmSdk: {},
    }
})

import { wasmSdkService } from '@/lib/services/wasm-sdk-service'

const CONFIG = { network: 'testnet' as const, contractId: 'EWR695MsqPUuW8EnTbYzD4KybNQD5n7CUDWydJYNg63F' }

describe('the service preload deadline (a hung wasm future cannot block login)', () => {
    const svc: any = wasmSdkService
    beforeEach(() => {
        vi.clearAllMocks()
        svc.constructor.wasmInitPromise = null
        svc.constructor.wasmModuleInitialized = false
        svc._isInitialized = false
        svc._isInitializing = false
        svc.initPromise = null
        svc.config = null
        svc.sdk = null
        vi.useFakeTimers()
    })
    afterEach(() => {
        state.dataContractImpl = null
        vi.useRealTimers()
    })

    it('initialize() RESOLVES when getDataContract pends forever (the live-hit shape)', async () => {
        state.dataContractImpl = () => new Promise(() => {}) // never settles

        const initPromise = svc.initialize(CONFIG)
        /* Past the 8s preload deadline the race rejects, the preload catches
         * it, and the init loop completes — the retry backoffs (2/4/8/16s)
         * must NOT fire because the failure was swallowed by the preload. */
        await vi.advanceTimersByTimeAsync(8600)
        await expect(initPromise).resolves.toBeUndefined()
        expect(svc._isInitialized).toBe(true)
        expect(svc.initializedNetwork()).toBe('testnet')
    })

    it('a LATE getDataContract settle after the deadline is harmless', async () => {
        let resolveLate!: (v: any) => void
        state.dataContractImpl = () => new Promise((resolve) => { resolveLate = resolve })

        const initPromise = svc.initialize(CONFIG)
        await vi.advanceTimersByTimeAsync(8600)
        await expect(initPromise).resolves.toBeUndefined()
        expect(svc._isInitialized).toBe(true)

        /* The abandoned future settles after initialize() already returned —
         * resolving (never rejecting) into the void must not throw. */
        resolveLate({ $id: 'late' })
        await vi.advanceTimersByTimeAsync(100)
        expect(svc._isInitialized).toBe(true)
    })

    it('a fast getDataContract lands BEFORE the deadline (normal path)', async () => {
        state.dataContractImpl = async () => ({ $id: 'EWR695' })

        const initPromise = svc.initialize(CONFIG)
        await vi.advanceTimersByTimeAsync(100)
        await expect(initPromise).resolves.toBeUndefined()
        expect(svc._isInitialized).toBe(true)
        expect(svc.initializedNetwork()).toBe('testnet')
    })
})
