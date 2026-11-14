/**
 * Private-key login discovery tests (WIF → identity lookup).
 *
 * Pins the search ORDER (unique-key index first, then the non-unique
 * fallback — desktop/mobile parity) and the toJSON() normalization
 * (F26d pattern: string id + numeric purpose/securityLevel). The wasm
 * SDK and the wasm-sdk-service are mocked; the real flow is
 * live-verified on testnet (scratch-privatekey-login-probe).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getIdentityByPublicKeyHashMock, getIdentityByNonUniquePublicKeyHashMock, privateKeyFromWifMock } = vi.hoisted(() => ({
    getIdentityByPublicKeyHashMock: vi.fn(),
    getIdentityByNonUniquePublicKeyHashMock: vi.fn(),
    privateKeyFromWifMock: vi.fn(),
}))

vi.mock('@/lib/dash-wasm/wasm_sdk', async (importOriginal) => {
    const actual: any = await importOriginal()
    return {
        ...actual,
        PrivateKey: {
            ...(actual.PrivateKey ?? {}),
            fromWIF: privateKeyFromWifMock,
        },
    }
})

vi.mock('@/lib/services/wasm-sdk-service', () => ({
    wasmSdkService: {
        getSdk: vi.fn(async () => ({
            getIdentityByPublicKeyHash: getIdentityByPublicKeyHashMock,
            getIdentityByNonUniquePublicKeyHash: getIdentityByNonUniquePublicKeyHashMock,
        })),
    },
}))

/* The compat wrapper re-exports the SDK method through its own import —
 * mock the module it comes from so the same mock drives both. */
vi.mock('@/lib/dash-wasm/compat', async (importOriginal) => {
    const actual: any = await importOriginal()
    return {
        ...actual,
        get_identity_by_non_unique_public_key_hash: (_sdk: any, hash: string, start: any) =>
            getIdentityByNonUniquePublicKeyHashMock(hash, start),
    }
})

import { discoverIdentityFromWif } from '@/lib/private-key-login'

const makeIdentity = (over: Record<string, unknown> = {}) => ({
    toJSON: () => ({
        id: 'EcbXLyhWeMB3BLmpVk1sWgtwQjUzaFASwhL3ShxXqdVa',
        balance: 2123503860,
        publicKeys: [
            { id: 1, keyType: 'ECDSA_HASH160', purpose: 'AUTHENTICATION', securityLevel: 'CRITICAL', data: 'abc123' },
            { id: 3, keyType: 'ECDSA_HASH160', purpose: 3, securityLevel: 1, data: 'def456' },
        ],
        ...over,
    }),
})

beforeEach(() => {
    vi.clearAllMocks()
    privateKeyFromWifMock.mockReturnValue({ getPublicKeyHash: () => 'aabbccdd' })
})

describe('discoverIdentityFromWif', () => {
    it('finds the identity in the UNIQUE index first and normalizes via toJSON', async () => {
        getIdentityByPublicKeyHashMock.mockResolvedValue(makeIdentity())

        const result = await discoverIdentityFromWif('cS1Qfake')

        expect(result).not.toBeNull()
        expect(result!.identityId).toBe('EcbXLyhWeMB3BLmpVk1sWgtwQjUzaFASwhL3ShxXqdVa')
        expect(result!.publicKeys[0].purpose).toBe(0) /* string enum → numeric */
        expect(result!.publicKeys[0].securityLevel).toBe(1)
        expect(result!.publicKeyHash).toBe('aabbccdd')
        expect(getIdentityByNonUniquePublicKeyHashMock).not.toHaveBeenCalled()
    })

    it('falls back to the NON-unique index when the unique search misses', async () => {
        getIdentityByPublicKeyHashMock.mockResolvedValue(undefined)
        getIdentityByNonUniquePublicKeyHashMock.mockResolvedValue([makeIdentity()])

        const result = await discoverIdentityFromWif('cP1Afake')

        expect(result).not.toBeNull()
        expect(result!.identityId).toBe('EcbXLyhWeMB3BLmpVk1sWgtwQjUzaFASwhL3ShxXqdVa')
        expect(getIdentityByNonUniquePublicKeyHashMock).toHaveBeenCalledWith('aabbccdd', undefined)
    })

    it('returns null when neither index holds the key', async () => {
        getIdentityByPublicKeyHashMock.mockResolvedValue(undefined)
        getIdentityByNonUniquePublicKeyHashMock.mockResolvedValue([])

        expect(await discoverIdentityFromWif('randomwif')).toBeNull()
    })

    it('tolerates a unique-index THROW by falling back (network hiccup parity with desktop)', async () => {
        getIdentityByPublicKeyHashMock.mockRejectedValue(new Error('grpc hiccup'))
        getIdentityByNonUniquePublicKeyHashMock.mockResolvedValue([makeIdentity()])

        const result = await discoverIdentityFromWif('cP1Afake')
        expect(result).not.toBeNull()
    })

    it('rejects an empty key without any network call', async () => {
        expect(await discoverIdentityFromWif('   ')).toBeNull()
        expect(getIdentityByPublicKeyHashMock).not.toHaveBeenCalled()
    })
})
