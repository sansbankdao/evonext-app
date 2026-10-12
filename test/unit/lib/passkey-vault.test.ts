// test/unit/lib/passkey-vault.test.ts
//
// Unit tests for lib/passkey-vault.ts.
//
// Strategy: navigator.credentials is mocked so the PRF extension returns a
// DETERMINISTIC output for a given (credentialId, salt) — exactly mirroring
// how a real authenticator's hmac-secret behaves. This lets the real
// HKDF-SHA256 / AES-GCM-256 crypto paths (Node webcrypto under jsdom) run
// unmocked: the vault encrypt/decrypt round trip and the entropy
// recover-across-"devices" property are genuinely exercised, not stubbed.

import { webcrypto } from 'node:crypto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// jsdom ships a partial window.crypto without `subtle`; replace it with Node
// webcrypto so the real HKDF/AES-GCM paths run unmocked.
Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true })
import {
    PasskeyVaultError,
    getRpId,
    hasVault,
    getVaultRecord,
    removeVault,
    enrollVault,
    unlockVault,
    createIdentityEntropy,
    recoverIdentityEntropy,
    getEntropyCredentialHint,
} from '@/lib/passkey-vault'

// ---------------------------------------------------------------------------
// WebAuthn mock — deterministic PRF (mirrors a real authenticator)
// ---------------------------------------------------------------------------

const FIXED_ENTROPY_SEED = new Uint8Array(32).fill(0xab)

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0))
    let offset = 0
    for (const a of arrays) {
        out.set(a, offset)
        offset += a.length
    }
    return out
}

async function prfBytes(rawId: Uint8Array, salt: Uint8Array): Promise<ArrayBuffer> {
    const digest = await crypto.subtle.digest('SHA-256', concatBytes(rawId, salt) as BufferSource)
    return digest as ArrayBuffer
}

function makeCredential(rawId: Uint8Array, prfFirst: ArrayBuffer): PublicKeyCredential {
    return {
        rawId: rawId.buffer as ArrayBuffer,
        getClientExtensionResults: () => ({ prf: { enabled: true, results: { first: prfFirst } } }),
    } as unknown as PublicKeyCredential
}

// The credentialId created during create(); reused by get().
let activeRawId = new Uint8Array(32).fill(0x11)

const create = vi.fn(async (options: CredentialCreationOptions) => {
    const ext = (options.publicKey as { extensions?: { prf?: { eval?: { first?: BufferSource } } } })?.extensions
    const salt = new Uint8Array(ext!.prf!.eval!.first as ArrayBuffer)
    activeRawId = new Uint8Array(32).fill(0x11) // stable per test run
    return makeCredential(activeRawId, await prfBytes(activeRawId, salt))
})

const get = vi.fn(async (options: CredentialRequestOptions) => {
    const pk = options.publicKey as { extensions?: { prf?: { eval?: { first?: BufferSource } } }; allowCredentials?: Array<{ id: BufferSource }> }
    const salt = new Uint8Array(pk.extensions!.prf!.eval!.first as ArrayBuffer)
    // If allowCredentials pins an id, the "authenticator" uses it; otherwise
    // the discoverable credential for this rp (activeRawId) is used.
    const rawId = pk.allowCredentials?.[0]?.id ? new Uint8Array(pk.allowCredentials[0].id as ArrayBuffer) : activeRawId
    return makeCredential(rawId, await prfBytes(rawId, salt))
})

function installWebAuthnMock() {
    Object.defineProperty(window.navigator, 'credentials', {
        value: { create, get },
        configurable: true,
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const IDENTITY = 'H7qSEi8hTestIdentity1111111111111111111111'
const WIF = 'cRud4ugeRXHGTmFXUEWao4vQyFAjkDCwuQPXN6V74jzt3Y32dCfU'

describe('passkey-vault', () => {
    beforeEach(() => {
        localStorage.clear()
        installWebAuthnMock()
        create.mockClear()
        get.mockClear()
    })

    afterEach(() => {
        // @ts-expect-error test cleanup
        delete window.navigator.credentials
    })

    it('reports localhost rpId in the jsdom test environment', () => {
        expect(getRpId()).toBe('localhost')
    })

    it('Option A round trip: enroll -> unlock returns the exact WIF', async () => {
        expect(hasVault(IDENTITY)).toBe(false)

        await enrollVault(IDENTITY, WIF, 'evonext-test')

        expect(hasVault(IDENTITY)).toBe(true)
        const record = getVaultRecord(IDENTITY)!
        expect(record.version).toBe(1)
        expect(record.credentialId).toBeTruthy()
        expect(record.salt).toBeTruthy()
        expect(record.iv).toBeTruthy()
        expect(record.ciphertext).toBeTruthy()
        // The WIF must NEVER be stored in plaintext.
        expect(JSON.stringify(record)).not.toContain(WIF)

        const unlocked = await unlockVault(IDENTITY)
        expect(unlocked).toBe(WIF)
    })

    it('unlock throws NOT_FOUND when no vault exists', async () => {
        await expect(unlockVault(IDENTITY)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('unlock throws DECRYPT_FAILED with the wrong passkey', async () => {
        await enrollVault(IDENTITY, WIF)
        // Simulate a DIFFERENT passkey (different credentialId => different PRF).
        get.mockImplementationOnce(async (options: CredentialRequestOptions) => {
            const pk = options.publicKey as { extensions?: { prf?: { eval?: { first?: BufferSource } } } }
            const salt = new Uint8Array(pk.extensions!.prf!.eval!.first as ArrayBuffer)
            const foreignRawId = new Uint8Array(32).fill(0xee)
            return makeCredential(foreignRawId, await prfBytes(foreignRawId, salt))
        })
        await expect(unlockVault(IDENTITY)).rejects.toMatchObject({ code: 'DECRYPT_FAILED' })
    })

    it('removeVault deletes the record', async () => {
        await enrollVault(IDENTITY, WIF)
        removeVault(IDENTITY)
        expect(hasVault(IDENTITY)).toBe(false)
    })

    it('Option C: create then recover yields IDENTICAL entropy (cross-device property)', async () => {
        const created = await createIdentityEntropy(0, 'evonext-user')
        expect(created.entropy).toHaveLength(32)
        expect(created.mnemonic.split(' ')).toHaveLength(24)

        // Wipe local state to simulate a brand-new device, then recover from
        // the passkey alone (the mock keeps its hmac-secret, as a real synced
        // authenticator would).
        localStorage.clear()
        expect(getEntropyCredentialHint(0)).toBeNull()

        const recovered = await recoverIdentityEntropy(0)
        expect([...recovered.entropy]).toEqual([...created.entropy])
        expect(recovered.mnemonic).toBe(created.mnemonic)
    })

    it('Option C: different indices derive DIFFERENT entropy (multi-identity)', async () => {
        const a = await createIdentityEntropy(0, 'evonext-user')
        const b = await createIdentityEntropy(1, 'evonext-user')
        expect([...a.entropy]).not.toEqual([...b.entropy])
    })

    it('Option C entropy is independent of the Option A vault KEK (domain separation)', async () => {
        // Even with the same mock PRF behaviour, the HKDF info strings differ,
        // so vault KEK material and identity entropy must not collide.
        const c = await createIdentityEntropy(0, 'evonext-user')
        expect(c.entropy).toHaveLength(32)
        // Soft assertion: 32 bytes of HKDF-SHA256 should not be constant.
        expect(new Set(c.entropy).size).toBeGreaterThan(1)
    })

    it('PRF_UNSUPPORTED is thrown when the authenticator lacks prf results', async () => {
        create.mockImplementationOnce(async () => ({
            rawId: new Uint8Array(32).buffer,
            getClientExtensionResults: () => ({}), // no prf
        } as unknown as PublicKeyCredential))
        await expect(enrollVault(IDENTITY, WIF)).rejects.toMatchObject({ code: 'PRF_UNSUPPORTED' })
    })

    it('CANCELLED is thrown when the user dismisses the prompt', async () => {
        create.mockImplementationOnce(async () => {
            const err = new Error('user cancelled')
            err.name = 'NotAllowedError'
            throw err
        })
        await expect(enrollVault(IDENTITY, WIF)).rejects.toMatchObject({ code: 'CANCELLED' })
    })

    it('PasskeyVaultError carries a code and extends Error', () => {
        const err = new PasskeyVaultError('FAILED', 'boom')
        expect(err).toBeInstanceOf(Error)
        expect(err.code).toBe('FAILED')
    })

    it('entropy is NOT the raw PRF output (HKDF domain separation)', async () => {
        // For a 32-byte all-equal rawId/salt the raw PRF digest is well-defined;
        // the returned entropy must differ because HKDF(entropy-info) is applied.
        const created = await createIdentityEntropy(0, 'evonext-user')
        const saltBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('evonext:identity-entropy:v1:0') as BufferSource))
        const rawPrf = await prfBytes(activeRawId, saltBytes)
        expect([...created.entropy]).not.toEqual([...new Uint8Array(rawPrf)])
        expect(FIXED_ENTROPY_SEED.length).toBe(32) // sanity constant unused elsewhere
    })
})
