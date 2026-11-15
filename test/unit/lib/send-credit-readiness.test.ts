/**
 * F56d regression — LAYER 3: the send path's readiness ORDER.
 *
 * sendCredit must initialize the wasm service (and therefore the glue)
 * BEFORE deriving the transfer key. In production the derivation ran first
 * against an unloaded glue and crashed. This test simulates the broken glue
 * (the derive throws the exact TypeError) and pins the call order:
 * initialize → derive. If anyone removes the readiness guard, this test
 * fails (derive would run with zero initialize calls).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const callOrder: string[] = []
const initializeMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/services/wasm-sdk-service', () => ({
    wasmSdkService: {
        isReady: () => false,
        initializedNetwork: () => null,
        initialize: initializeMock.mockImplementation(async () => { callOrder.push('initialize') }),
        getSdk: vi.fn(async () => ({ __mockSdk: true })),
    },
    getWasmSdk: vi.fn(async () => ({ __mockSdk: true })),
}))

/* The wallet-manager pulls the service via the './services' barrel too. */
vi.mock('@/lib/services', () => ({
    wasmSdkService: {
        isReady: () => false,
        initializedNetwork: () => null,
        initialize: initializeMock.mockImplementation(async () => { callOrder.push('initialize') }),
    },
}))

vi.mock('@/lib/dash-wasm/compat', () => ({
    derive_key_from_seed_with_path: () => {
        callOrder.push('derive')
        /* Simulate the production failure: the glue was uninitialized. */
        throw new TypeError("Cannot read properties of undefined (reading 'wasmsdk_deriveKeyFromSeedWithPath')")
    },
}))

/* Everything after the derive never runs in this scenario. */
vi.mock('pshenmic-dpp', () => ({ PrivateKeyWASM: {}, GasFeesPaidByWASM: {} }))
vi.mock('dash-platform-sdk', () => ({ DashPlatformSDK: class { } }))
vi.mock('@/lib/identity-manager', () => ({ getIdentities: vi.fn(async () => []) }))
vi.mock('@/lib/secure-storage', () => ({
    getIdentityIdx: () => 0,
    getMnemonic: () => 'legal winner thank year wave sausage worth useful legal winner thank yellow',
    storeMnemonic: vi.fn(),
    storePrivateKey: vi.fn(),
}))
vi.mock('@/lib/services/contract-service', () => ({ contractService: {} }))

import { sendCredit } from '@/lib/wallet-manager'

const SENDER = 'CZUa7rTxZZUL3vF5MrtFj1fT2TX5C1YtqnTxT2gFmG3P'
const RECEIVER = 'EcbXLyhWeMB3BLmpVk1sWgtwQjUzaFASwhL3ShxXqdVa'

describe('the send-path readiness guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        callOrder.length = 0
        initializeMock.mockImplementation(async () => { callOrder.push('initialize') })
    })

    it('initializes the wasm service BEFORE deriving keys, even when the glue is broken', async () => {
        await expect(sendCredit('mainnet', SENDER, 0, RECEIVER, 1_000_000n))
            .rejects.toThrow(/wasmsdk_deriveKeyFromSeedWithPath/)

        expect(callOrder[0]).toBe('initialize')
        expect(callOrder[1]).toBe('derive')
        expect(initializeMock).toHaveBeenCalledWith(expect.objectContaining({ network: 'mainnet' }))
    })
})
