/* test/unit/lib/session-unlock.test.mts
 * F57b Option B — the session-lock state machine: the enroll collects the
 * in-memory material, a "reload" (the memory cleared) leaves the honest
 * locked states, and the unlock restores EVERYTHING with one ceremony.
 * The passkey-vault crypto is mocked at the module boundary (the real PRF
 * crypto is covered by test/unit/lib/passkey-vault.test.ts). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { webcrypto } from 'node:crypto'

/* The jsdom gotcha (the F27b pattern): window.crypto lacks subtle —
 * polyfill with the Node webcrypto so the AES-GCM wraps run real. */
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true })
}

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
    getSessionLockInfo,
    getSessionLockState,
    unlockSession,
    setSessionUnlockPassword,
    unlockSessionWithPassword,
    hasPasswordVault,
} from '../../../lib/session-unlock'

const ID = 'AFaVqRJCWXFZRUhuq6ZUUcWXVW8fErCN3wpEtgsBnDZm'

beforeEach(() => {
    vaultAtRest.clear()
    /* A clean "browser": the memory wiped AND the disk artifacts gone
     * (the password/PRF vault records live in localStorage — without this
     * they leak across tests). */
    secureStorageCls.clear()
    clearMnemonic()
    clearPrivateKey(ID)
    localStorage.clear()
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

        expect((await getSessionLockInfo(ID)).prfVault).toBe(true)
        expect((await getSessionLockInfo(ID)).material).toBe(false)
        expect(getMnemonic()).toBeNull()

        /* THE UNLOCK: one ceremony → everything back. */
        await unlockSession(ID)
        expect(getMnemonic()).toBe('legal winner thank year wave sausage worth useful legal winner thank yellow')
        expect(getIdentityIdx()).toBe(2)
        expect(getPrivateKey(ID)).toBe('L1aW4Ub8XkzTestWifMaterialNotReal0000000')
        expect(secureStorageCls.get(`evonext_keystore_${ID}`)).toBe(JSON.stringify({ '3': { wif: 'x', fingerprint: 'ab', addedAt: 1 } }))
        const info = await getSessionLockInfo(ID)
        expect(info.material).toBe(true)
        expect(info.prfVault).toBe(true)
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

    it('THE PASSWORD TIER: set → reload → the password unlock restores everything', async () => {
        storeMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow')
        storeIdentityIdx(3)
        const ok = await setSessionUnlockPassword(ID, 'correct horse battery staple')
        expect(ok).toBe(true)
        expect(hasPasswordVault(ID)).toBe(true)
        expect(await getSessionLockState(ID)).toBe('unlocked')

        /* THE RELOAD. */
        secureStorageCls.clear()
        clearMnemonic()
        clearPrivateKey(ID)
        expect(await getSessionLockState(ID)).toBe('locked-password')
        expect((await getSessionLockInfo(ID)).pwVault).toBe(true)

        /* The WRONG password = an honest rejection, the memory untouched. */
        await expect(unlockSessionWithPassword(ID, 'wrong password 123'))
            .rejects.toThrow(/Wrong unlock password/)
        expect(getMnemonic()).toBeNull()

        /* The RIGHT password → everything back. */
        /* F57j — the unlock must ANNOUNCE itself so the open seed-derived
         * views (the deposit receive tiles) re-run their init. */
        const unlocked = vi.fn()
        window.addEventListener('evonext:session-unlocked', unlocked)
        await unlockSessionWithPassword(ID, 'correct horse battery staple')
        window.removeEventListener('evonext:session-unlocked', unlocked)
        expect(getMnemonic()).toBe('legal winner thank year wave sausage worth useful legal winner thank yellow')
        expect(getIdentityIdx()).toBe(3)
        expect(await getSessionLockState(ID)).toBe('unlocked')
        expect(unlocked).toHaveBeenCalledTimes(1)
    })

    it('the password tier: too-short/blank/whitespace-only passwords are refused; a fresh session cannot wrap nothing', async () => {
        await expect(setSessionUnlockPassword(ID, 'short'))
            .rejects.toThrow(/at least 10 characters/)
        /* The owner's probe: a BLANK password must never wrap the vault. */
        await expect(setSessionUnlockPassword(ID, ''))
            .rejects.toThrow(/at least 10 characters/)
        /* A WHITESPACE-ONLY password passes a bare length check — the trim
         * guard rejects it (near-zero entropy). */
        await expect(setSessionUnlockPassword(ID, '          '))
            .rejects.toThrow(/at least 10 characters/)
        await expect(setSessionUnlockPassword(ID, 'a-very-long-password-with-nothing-to-wrap'))
            .rejects.toThrow(/nothing in this session/)
        expect(hasPasswordVault(ID)).toBe(false)
    })

    it('the password tier: a stale mark appears when the keys change after the save', async () => {
        storeMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow')
        await setSessionUnlockPassword(ID, 'correct horse battery staple')
        const { markPasswordVaultStale, isPasswordVaultStale } = await import('../../../lib/session-unlock')
        expect(isPasswordVaultStale(ID)).toBe(false)
        markPasswordVaultStale(ID)
        expect(isPasswordVaultStale(ID)).toBe(true)
        /* The re-save clears the stale mark. */
        await unlockSessionWithPassword(ID, 'correct horse battery staple')
        storeMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow')
        await setSessionUnlockPassword(ID, 'correct horse battery staple')
        expect(isPasswordVaultStale(ID)).toBe(false)
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
