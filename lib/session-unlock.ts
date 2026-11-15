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

// ---------------------------------------------------------------------------
// F57e — the PASSWORD-wrapped vault: the UNIVERSAL persistence tier (the
// Bitwarden model). No authenticator needed — the owner's directive: a way
// to "safely store secrets across sessions" on EVERY desktop (memory-only
// is NOT a product). The secrets = AES-GCM ciphertext under scrypt(
// unlockPassword) in localStorage; at rest there is NO plaintext and NO
// key material — the same guarantee the PRF tier gives, with a password
// instead of a passkey. The params are stored in the record (the future
// KDF upgrades).
// ---------------------------------------------------------------------------

const PW_VAULT_PREFIX = 'evonext_pwv1_'
const PW_STALE_PREFIX = 'evonext_pwv1_stale_'

/* scrypt(N=65536, r=8, p=1) ≈ 550ms / 64 MiB in a browser — the RFC 7914
 * interactive-login class. The params ride in the record. */
const PW_KDF = { alg: 'scrypt' as const, N: 65536, r: 8, p: 1 }

interface PasswordVaultRecord {
    v: number
    salt: string
    iv: string
    ciphertext: string
    kdf: typeof PW_KDF
}

function readPasswordVaultRecord(identityId: string): PasswordVaultRecord | null {
    try {
        const raw = localStorage.getItem(PW_VAULT_PREFIX + identityId)
        if (!raw) return null
        const record = JSON.parse(raw) as PasswordVaultRecord
        if (record?.v !== 1 || !record.salt || !record.iv || !record.ciphertext) return null
        return record
    } catch {
        return null
    }
}

export function hasPasswordVault(identityId: string): boolean {
    return typeof window !== 'undefined' && readPasswordVaultRecord(identityId) !== null
}

export function removePasswordVault(identityId: string): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(PW_VAULT_PREFIX + identityId)
    localStorage.removeItem(PW_STALE_PREFIX + identityId)
}

export function markPasswordVaultStale(identityId: string): void {
    if (typeof window === 'undefined') return
    if (readPasswordVaultRecord(identityId)) {
        localStorage.setItem(PW_STALE_PREFIX + identityId, '1')
    }
}

export function isPasswordVaultStale(identityId: string): boolean {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(PW_STALE_PREFIX + identityId) === '1'
}

/* The local base64url/AES helpers (the PRF vault's own helpers are
 * module-private; the password tier wraps with WebCrypto directly). */
function bytesToB64url(bytes: Uint8Array): string {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlToBytes(s: string): Uint8Array {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
}
async function aesGcm(keyBytes: Uint8Array, iv: Uint8Array, data: Uint8Array, mode: 'encrypt' | 'decrypt'): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', keyBytes as BufferSource, 'AES-GCM', false, [mode])
    const op: 'encrypt' | 'decrypt' = mode
    const out = await crypto.subtle[op]({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource)
    return new Uint8Array(out)
}

async function wrapWithPassword(identityId: string, password: string): Promise<void> {
    const { scrypt } = await import('@noble/hashes/scrypt.js')
    const { randomBytes } = await import('@noble/hashes/utils.js')
    const payload = await collectPayload(identityId)
    const hasMaterial = !!(payload.mnemonic || payload.keysJson || payload.legacyWif)
    if (!hasMaterial) {
        throw new PasskeyVaultError('FAILED', 'There is nothing in this session to save — sign in first.')
    }
    const salt = randomBytes(32)
    const key = scrypt(new TextEncoder().encode(password.normalize('NFKC')), salt, { N: PW_KDF.N, r: PW_KDF.r, p: PW_KDF.p, dkLen: 32 })
    const iv = randomBytes(12)
    const ciphertext = await aesGcm(key, iv, new TextEncoder().encode(JSON.stringify(payload)), 'encrypt')
    const record: PasswordVaultRecord = {
        v: 1,
        salt: bytesToB64url(salt),
        iv: bytesToB64url(iv),
        ciphertext: bytesToB64url(ciphertext),
        kdf: { ...PW_KDF },
    }
    localStorage.setItem(PW_VAULT_PREFIX + identityId, JSON.stringify(record))
    localStorage.removeItem(PW_STALE_PREFIX + identityId)
}

/**
 * SET (or rotate) the device unlock password: wraps the CURRENT in-memory
 * material under scrypt(password) and stores the CIPHERTEXT only. The
 * password never leaves the device and is never stored.
 */
export async function setSessionUnlockPassword(identityId: string, password: string): Promise<boolean> {
    /* The F57e hardening (the owner's probe): a BLANK or WHITESPACE-ONLY
     * password must never wrap the vault — a 10-space password would pass
     * a bare length check with near-zero entropy. The trim check rejects
     * it; the real minimum = 10 NON-WHITESPACE characters... no: 10+
     * characters INCLUDING the internal spaces, with at least 10 total
     * and non-blank. */
    if (typeof password !== 'string' || password.length < 10 || password.trim().length === 0) {
        throw new PasskeyVaultError('FAILED', 'Use at least 10 characters — this password protects your keys on this device.')
    }
    await wrapWithPassword(identityId, password)
    return hasPasswordVault(identityId)
}

/**
 * UNLOCK with the device password: scrypt → decrypt → the material back
 * into the in-memory store. Throws ('WEAK_PASSWORD' impossible here) —
 * ('DECRYPT_FAILED') on a wrong password.
 */
export async function unlockSessionWithPassword(identityId: string, password: string): Promise<void> {
    const record = readPasswordVaultRecord(identityId)
    if (!record) {
        throw new PasskeyVaultError('NOT_FOUND', `No password vault for identity ${identityId}`)
    }
    const { scrypt } = await import('@noble/hashes/scrypt.js')
    const kdf = record.kdf ?? PW_KDF
    const salt = b64urlToBytes(record.salt)
    const key = scrypt(new TextEncoder().encode(password.normalize('NFKC')), salt, { N: kdf.N, r: kdf.r, p: kdf.p, dkLen: 32 })
    let plaintext: Uint8Array
    try {
        plaintext = await aesGcm(key, b64urlToBytes(record.iv), b64urlToBytes(record.ciphertext), 'decrypt')
    } catch {
        throw new PasskeyVaultError('DECRYPT_FAILED', 'Wrong unlock password.')
    }
    let payload: SessionVaultPayload
    try {
        payload = JSON.parse(new TextDecoder().decode(plaintext)) as SessionVaultPayload
    } catch {
        throw new PasskeyVaultError('DECRYPT_FAILED', 'The password vault payload is corrupt')
    }
    await restorePayload(identityId, payload)
}

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
    | 'locked-vault'    // the memory empty, a PRF vault exists → one ceremony
    | 'locked-password' // the memory empty, a password vault exists → one password
    | 'locked-novault'  // the memory empty, no vault → reconnect
    | 'nologin'

/** F57e — the RICH lock state: the material + which vault tiers exist. */
export interface SessionLockInfo {
    /** The in-memory key material is present (the session works). */
    material: boolean
    /** The PRF (passkey) session vault exists — one ceremony unlocks. */
    prfVault: boolean
    /** The password-wrapped vault exists — one password unlocks. */
    pwVault: boolean
    /** The password vault is older than the current memory (the Key-Manager
     * changed after the last save) — offer a re-save. */
    pwStale: boolean
}

export async function getSessionLockInfo(identityId: string | null | undefined): Promise<SessionLockInfo> {
    if (!identityId) {
        return { material: false, prfVault: false, pwVault: false, pwStale: false }
    }
    const secureStorage = (await import('./secure-storage')).default
    const { getMnemonic, getPrivateKey } = await import('./secure-storage')
    const material = !!(
        getMnemonic()
        || getPrivateKey(identityId)
        || secureStorage.get(`${KEYS_STORE_PREFIX}${identityId}`)
    )
    return {
        material,
        prfVault: hasSessionVault(identityId),
        pwVault: hasPasswordVault(identityId),
        pwStale: isPasswordVaultStale(identityId),
    }
}

/** The legacy string state (the tests + simple consumers). */
export async function getSessionLockState(identityId: string | null | undefined): Promise<SessionLockState> {
    if (!identityId) return 'nologin'
    const info = await getSessionLockInfo(identityId)
    if (info.material) {
        return (info.prfVault || info.pwVault) ? 'unlocked' : 'unlocked-novault'
    }
    if (info.prfVault) return 'locked-vault'
    if (info.pwVault) return 'locked-password'
    return 'locked-novault'
}

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
