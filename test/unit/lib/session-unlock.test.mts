/* test/unit/lib/session-unlock.test.mts
 * F57b Option B — the session-lock state machine: the enroll collects the
 * in-memory material, a "reload" (the memory cleared) leaves the honest
 * locked states, and the unlock restores EVERYTHING with one ceremony.
 * The passkey-vault crypto is mocked at the module boundary (the real PRF
 * crypto is covered by test/unit/lib/passkey-vault.test.ts). */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/* An in-memory "vault at rest" — the payload JSON captured at enroll and
 * returned at unlock (the real module encrypts it under the PRF KEK). */
const vaultAtRest = new Map<string, string>()

vi.mock('@/lib/passkey-vault', () => {
    class PasskeyVaultError extends Error {
        code: string
        constructor(code: string, message: string) {
            super(message)
            this.code = code
        }
    }
    return {
        PasskeyVaultError,
        enrollSessionVault: vi.fn(async (_id: string, payloadJson: string) => {
            vaultAtRest.set('payload', payloadJson)
        }),
        unlockSessionVault: vi.fn(async () => {
            const v = vaultAtRest.get('payload')
            if (!v) throw new PasskeyVaultError('NOT_FOUND', 'no session vault')
            return v
        }),
        hasSessionVault: vi.fn(() => vaultAtRest.has('payload')),
        removeSessionVault: vi.fn(() => vaultAtRest.delete('payload')),
    }
})

/* The REAL flipped secure-storage (the in-memory Map) — the "reload" is
 * simulated by secureStorage.clear(). */
import { storeMnemonic, getMnemonic, storeIdentityIdx, getIdentityIdx, storePrivateKey, getPrivateKey, clearMnemonic, clearPrivateKey } from '../../../lib/secure-storage'
import secureStorageCls from '../../../lib/secure-storage'
import {
    enrollSessionKeysAfterLogin,
    getSessionLockState,
    unlockSession,
} from '../../../lib/session-unlock'

const ID = 'AFaVqRJCWXFZRUhuq6ZUUcWXVW8fErCN3wpEtgsBnDZm'

beforeEach(() => {
    vaultAtRest.clear()
    /* A clean "browser": the memory wiped. */
    secureStorageCls.clear()
    clearMnemonic()
    clearPrivateKey(ID)
})

describe('session-unlock (F57b Option B)', () => {
    it('the enroll collects the memory; the state is locked-vault after a reload; the unlock restores everything', async () => {
        /* The logged-in session: the mnemonic + the idx + a legacy WIF +
         * a keystore blob in memory. */
        storeMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow')
        storeIdentityIdx(2)
        storePrivateKey(ID, 'L1aW4Ub8XkzTestWifMaterialNotReal0000000')
        secureStorageCls.set(`evonext_keystore_${ID}`, JSON.stringify({ '3': { wif: 'x', fingerprint: 'ab', addedAt: 1 } }))

        await enrollSessionKeysAfterLogin(ID)
        expect(vaultAtRest.has('payload')).toBe(true)

        /* THE RELOAD: the memory is gone. */
        secureStorageCls.clear()
        clearMnemonic()
        clearPrivateKey(ID)

        expect(await getSessionLockState(ID)).toBe('locked-vault')
        expect(getMnemonic()).toBeNull()

        /* THE UNLOCK: one ceremony → everything back. */
        await unlockSession(ID)
        expect(getMnemonic()).toBe('legal winner thank year wave sausage worth useful legal winner thank yellow')
        expect(getIdentityIdx()).toBe(2)
        expect(getPrivateKey(ID)).toBe('L1aW4Ub8XkzTestWifMaterialNotReal0000000')
        expect(secureStorageCls.get(`evonext_keystore_${ID}`)).toBe(JSON.stringify({ '3': { wif: 'x', fingerprint: 'ab', addedAt: 1 } }))
        expect(await getSessionLockState(ID)).toBe('unlocked')
    })

    it('no vault (a PRF-less device) → the enroll OFFER while unlocked, the honest locked-novault after a reload', async () => {
        storeMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow')
        /* The memory has material, no vault → the OFFER state. */
        expect(await getSessionLockState(ID)).toBe('unlocked-novault')
        /* The enroll with NOTHING in memory → no vault is created. */
        clearMnemonic()
        expect(await enrollSessionKeysAfterLogin(ID)).toBe(false)
        expect(await getSessionLockState(ID)).toBe('locked-novault')
    })

    it('a declined enroll (the PRF-less throw) leaves the session memory-only and never throws', async () => {
        storeMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow')
        const { enrollSessionVault } = await import('@/lib/passkey-vault') as any
        ;(enrollSessionVault as any).mockRejectedValueOnce(
            Object.assign(new Error('no PRF'), { code: 'PRF_UNSUPPORTED' }))
        await expect(enrollSessionKeysAfterLogin(ID)).resolves.toBe(false)
        /* The memory is untouched by the failed enroll. */
        expect(getMnemonic()).not.toBeNull()
    })

    it('the mnemonic-less (WIF-only) session enrolls with just the legacy WIF', async () => {
        storePrivateKey(ID, 'L1aW4Ub8XkzTestWifMaterialNotReal0000000')
        expect(await getSessionLockState(ID)).toBe('unlocked-novault')
        await enrollSessionKeysAfterLogin(ID)
        secureStorageCls.clear()
        clearPrivateKey(ID)
        expect(await getSessionLockState(ID)).toBe('locked-vault')
        await unlockSession(ID)
        expect(getPrivateKey(ID)).toBe('L1aW4Ub8XkzTestWifMaterialNotReal0000000')
        expect(getMnemonic()).toBeNull()
    })

    it('a logged-out visitor is nologin — never a locked banner', async () => {
        expect(await getSessionLockState(undefined)).toBe('nologin')
        expect(await getSessionLockState(null)).toBe('nologin')
    })
})
