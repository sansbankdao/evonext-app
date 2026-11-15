// lib/session-unlock.ts
//
// F57b Option B — closing the plaintext hole: the session's key material
// (the mnemonic, the Key-Manager keys, the connect-submitted WIF, the
// identity index) lives ONLY in the in-memory secure-storage while the
// session is unlocked; the cold copy is the PASSKEY VAULT (the PRF-derived
// KEK — the decryption key never exists at rest). After a reload the
// unlock gate re-materializes the memory with ONE ceremony.
//
// The three states (getSessionLockState):
//   'unlocked'        — the memory holds the material (the session works).
//   'locked-vault'    — the memory is empty but the session vault exists →
//                       unlockSession() re-materializes with one ceremony.
//   'locked-novault'  — the memory is empty and NO vault exists (this
//                       device could not enroll — e.g. no PRF support) →
//                       the honest fix is reconnecting.
//
// The enroll is BEST-EFFORT at login: a PRF-less authenticator (iOS Safari
// etc.) or a declined ceremony leaves the session memory-only — the app
// never fails login because of the vault.

import {
    enrollSessionVault,
    unlockSessionVault,
    hasSessionVault,
    PasskeyVaultError,
} from './passkey-vault'

export interface SessionVaultPayload {
    mnemonic?: string
    identityIdx?: number
    /* The Key-Manager blob (the raw JSON string, restored verbatim). */
    keysJson?: string
    /* The connect-submitted WIF (the legacy pk_ slot). */
    legacyWif?: string
}

const KEYS_STORE_PREFIX = 'evonext_keystore_'
const LEGACY_PK_PREFIX = 'pk_'

/** Assemble the CURRENT in-memory key material into the vault payload
 * (called at login, before anything can clear it). */
async function collectPayload(identityId: string): Promise<SessionVaultPayload> {
    const secureStorage = (await import('./secure-storage')).default
    const { getMnemonic, getIdentityIdx, getPrivateKey } = await import('./secure-storage')
    const keysJson = secureStorage.get(`${KEYS_STORE_PREFIX}${identityId}`)
    return {
        mnemonic: getMnemonic() ?? undefined,
        identityIdx: getIdentityIdx() ?? undefined,
        keysJson: typeof keysJson === 'string' ? keysJson : undefined,
        legacyWif: getPrivateKey(identityId) ?? undefined,
    }
}

/** Restore a payload INTO the in-memory store (the unlock path). */
async function restorePayload(identityId: string, payload: SessionVaultPayload): Promise<void> {
    const secureStorage = (await import('./secure-storage')).default
    const { storeMnemonic, storeIdentityIdx, storePrivateKey } = await import('./secure-storage')
    if (payload.mnemonic) storeMnemonic(payload.mnemonic)
    if (payload.identityIdx !== undefined) storeIdentityIdx(payload.identityIdx)
    if (payload.keysJson) {
        try { JSON.parse(payload.keysJson); secureStorage.set(`${KEYS_STORE_PREFIX}${identityId}`, payload.keysJson) } catch { /* a corrupt blob — skip */ }
    }
    if (payload.legacyWif) storePrivateKey(identityId, payload.legacyWif)
}

/**
 * BEST-EFFORT enroll at login: wrap the current in-memory key material in
 * the session vault. Never throws — a PRF-less authenticator, a declined
 * ceremony or any WebAuthn failure leaves the session memory-only (the
 * honest 'locked-novault' state after a reload) and returns false.
 */
export async function enrollSessionKeysAfterLogin(
    identityId: string,
    username?: string,
): Promise<boolean> {
    try {
        const payload = await collectPayload(identityId)
        const hasMaterial = !!(payload.mnemonic || payload.keysJson || payload.legacyWif)
        if (!hasMaterial) return false
        await enrollSessionVault(identityId, JSON.stringify(payload), username)
        return true
    } catch (error) {
        if (error instanceof PasskeyVaultError) {
            console.warn(`[session-unlock] the session vault was not enrolled (${error.code}): the keys stay in this browser session only.`)
        } else {
            console.warn('[session-unlock] the session vault was not enrolled:', (error as Error)?.message)
        }
        return false
    }
}

export type SessionLockState =
    | 'unlocked'        // the memory has the material AND a vault exists
    | 'unlocked-novault' // the memory has the material, no vault yet → the enroll OFFER
    | 'locked-vault'    // the memory empty, a vault exists → one ceremony
    | 'locked-novault'  // the memory empty, no vault → reconnect
    | 'nologin'

/**
 * Re-wrap the CURRENT in-memory material into the session vault (after a
 * Key-Manager add/remove — the vault must not go stale). BEST-EFFORT: the
 * ceremony may be declined; a failure leaves the previous vault record
 * (the next login re-collects everything) and returns false.
 */
export async function reenrollSessionKeys(identityId: string, username?: string): Promise<boolean> {
    if (!hasSessionVault(identityId)) return false
    return enrollSessionKeysAfterLogin(identityId, username)
}

/**
 * The current lock state. `memoryHasMaterial` checks the in-memory store
 * (the mnemonic OR the keystore blob OR the legacy WIF for THIS identity).
 */
export async function getSessionLockState(
    identityId: string | null | undefined,
): Promise<SessionLockState> {
    if (!identityId) return 'nologin'
    const secureStorage = (await import('./secure-storage')).default
    const { getMnemonic, getPrivateKey } = await import('./secure-storage')
    const hasMaterial = !!(
        getMnemonic()
        || getPrivateKey(identityId)
        || secureStorage.get(`${KEYS_STORE_PREFIX}${identityId}`)
    )
    if (hasMaterial) {
        return hasSessionVault(identityId) ? 'unlocked' : 'unlocked-novault'
    }
    if (hasSessionVault(identityId)) return 'locked-vault'
    return 'locked-novault'
}

/**
 * UNLOCK: one passkey ceremony → the vault opens → the material returns
 * to the in-memory store. Throws PasskeyVaultError on a failure (the
 * caller surfaces it).
 */
export async function unlockSession(identityId: string): Promise<void> {
    const payloadJson = await unlockSessionVault(identityId)
    let payload: SessionVaultPayload
    try {
        payload = JSON.parse(payloadJson) as SessionVaultPayload
    } catch {
        throw new PasskeyVaultError('DECRYPT_FAILED', 'The session vault payload is corrupt')
    }
    await restorePayload(identityId, payload)
}

/** Re-exported for the lock-down UI (an explicit vault removal). */
export { hasSessionVault } from './passkey-vault'
export { removeSessionVault } from './passkey-vault'
