/**
 * F56d regression — LAYER 2: the wasm-sdk-service's flaky-load retry.
 *
 * The main thread's 26.5MB wasm fetch through the Pages Function aborts
 * intermittently. The service now retries the load 3× and resets its cached
 * init promise on total failure — a failed load must NOT poison the
 * singleton (the next initialize retries fresh).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const initMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/dash-wasm/wasm_sdk', () => {
    const builderChain = () => {
        const b: any = {
            withTrustedContext: () => b,
            withSettings: () => b,
            build: () => ({ __mockSdk: true }),
        }
        return b
    }
    return {
        default: initMock,
        init: initMock,
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

describe('the service wasm-load retry', () => {
    /* The service = a SINGLETON (only the instance is exported); reset its
     * instance fields + the CLASS-level statics via the constructor. */
    const svc: any = wasmSdkService
    beforeEach(() => {
        vi.clearAllMocks()
        initMock.mockReset()
        svc.constructor.wasmInitPromise = null
        svc.constructor.wasmModuleInitialized = false
        svc._isInitialized = false
        svc._isInitializing = false
        svc.initPromise = null
        svc.config = null
        svc.sdk = null
    })

    it('retries a flaky load and finishes initialization', async () => {
        initMock.mockRejectedValueOnce(new Error('Response body loading was aborted'))
        initMock.mockResolvedValueOnce(undefined)

        await svc.initialize(CONFIG)

        expect(initMock.mock.calls.length).toBe(2)
        expect(svc.isReady()).toBe(true)
    })

    it('does NOT poison the singleton: after 3 failed loads the next initialize retries fresh', async () => {
        initMock.mockRejectedValue(new Error('Response body loading was aborted'))

        await expect(svc.initialize(CONFIG)).rejects.toThrow(/Response body loading was aborted/)
        expect(initMock.mock.calls.length).toBe(3)
        expect(svc.isReady()).toBe(false)

        /* The load heals — the SECOND initialize must retry the load (not
         * replay a cached rejected promise). */
        initMock.mockResolvedValue(undefined)
        await svc.initialize(CONFIG)

        expect(svc.isReady()).toBe(true)
        expect(initMock.mock.calls.length).toBe(4)
    })
})
