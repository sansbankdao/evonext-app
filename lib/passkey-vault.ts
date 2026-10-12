// lib/passkey-vault.ts

'use client'

/**
 * Passkey (WebAuthn PRF) key vault — client-only, no server.
 *
 * Design: docs/spike-passkey-prf-vault.md
 *
 * Two primitives:
 *
 *  Option A — Vault: AES-GCM-wrap an EXISTING identity private key (WIF)
 *  under a KEK derived from the passkey's PRF output. Convenience unlock
 *  for the current device (survives page unload; NOT cross-device, since
 *  localStorage does not sync). The identity's original mnemonic remains
 *  the recovery path.
 *
 *  Option C — Passkey-native entropy: derive the 32-byte master entropy
 *  for a NEW identity directly from the PRF output (deterministic salt),
 *  so the identity is recoverable on ANY device the passkey syncs to
 *  (iCloud Keychain / Google Password Manager) with nothing stored
 *  locally. The entropy is exportable as a BIP39 24-word mnemonic — the
 *  mnemonic and the passkey are two faces of the same secret.
 *
 * The PRF (hmac-secret) extension is the load-bearing mechanism: the
 * authenticator returns a deterministic 32-byte secret for
 * (credential, salt). Same passkey + same salt => same output on every
 * synced device. PRF is NOT universal (older hardware keys lack it), so
 * every flow gates on prf support and the mnemonic stays as backup.
 *
 * Replaces lib/passkey.ts (broken: it hashed rawId || authenticatorData,
 * which is non-deterministic across assertions because authenticatorData
 * contains the incrementing signature counter).
 */

import { entropyToMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PasskeyVaultErrorCode =
    | 'UNSUPPORTED'        // WebAuthn / platform authenticator unavailable
    | 'PRF_UNSUPPORTED'    // authenticator lacks the hmac-secret extension
    | 'CANCELLED'          // user dismissed the prompt
    | 'NOT_FOUND'          // no vault record for this identity
    | 'DECRYPT_FAILED'     // wrong passkey / corrupted record
    | 'FAILED'             // anything else

export class PasskeyVaultError extends Error {
    readonly code: PasskeyVaultErrorCode

    constructor(code: PasskeyVaultErrorCode, message: string) {
        super(message)
        this.name = 'PasskeyVaultError'
        this.code = code
    }
}

export interface VaultRecord {
    version: 1
    credentialId: string   // base64url of the passkey rawId
    salt: string           // base64url, 32 bytes (random per enrollment)
    iv: string             // base64url, 12 bytes (AES-GCM)
    ciphertext: string     // base64url, AES-GCM(KEK, utf8(WIF))
    createdAt: number
}

export interface PasskeyEntropyResult {
    /** 32-byte deterministic entropy (feeds HD derivation / BIP39) */
    entropy: Uint8Array
    /** base64url of the passkey rawId used */
    credentialId: string
    /** BIP39 24-word encoding of the entropy — the exportable backup */
    mnemonic: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VAULT_KEY_PREFIX = 'evonext_pv_v1_'
const ENTROPY_HINT_PREFIX = 'evonext_pe_v1_'
const KEK_INFO = 'evonext:pv:kek:v1'
const ENTROPY_INFO = 'evonext:pv:entropy:v1'
const ENTROPY_SALT_PREFIX = 'evonext:identity-entropy:v1:'
const RP_NAME = 'EvoNext'

// ---------------------------------------------------------------------------
// Small helpers (base64url without padding; browser-safe, no Buffer)
// ---------------------------------------------------------------------------

function bytesToBase64url(bytes: Uint8Array): string {
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToBytes(value: string): Uint8Array {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
}

function utf8(text: string): Uint8Array {
    return new TextEncoder().encode(text)
}

function randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    return bytes
}

// ---------------------------------------------------------------------------
// Environment / RP configuration
// ---------------------------------------------------------------------------

/**
 * Relying Party ID. Pinned to the parent domain so passkeys created on
 * test.evonext.app also work on evonext.app (WebAuthn allows the rpId to be
 * a registrable domain suffix of the origin). Falls back to the hostname
 * for localhost / IPFS gateways / other deployments.
 */
export function getRpId(): string {
    if (typeof window === 'undefined') return 'localhost'
    const host = window.location.hostname
    if (host === 'evonext.app' || host.endsWith('.evonext.app')) return 'evonext.app'
    return host
}

/** True when a platform authenticator (Touch ID, Windows Hello, …) exists. */
export async function isPasskeyAvailable(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    } catch {
        return false
    }
}

function wrapError(error: unknown, fallback: string): PasskeyVaultError {
    if (error instanceof PasskeyVaultError) return error
    const name = (error as { name?: string })?.name
    if (name === 'NotAllowedError') {
        return new PasskeyVaultError('CANCELLED', 'Passkey prompt was dismissed')
    }
    const message = (error as { message?: string })?.message || fallback
    return new PasskeyVaultError('FAILED', message)
}

// ---------------------------------------------------------------------------
// WebCrypto primitives (HKDF-SHA256, AES-GCM-256)
// ---------------------------------------------------------------------------

async function hkdfSha256(
    ikm: Uint8Array,
    salt: Uint8Array,
    info: string,
    lengthBytes = 32
): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: utf8(info) as BufferSource },
        key,
        lengthBytes * 8
    )
    return new Uint8Array(bits)
}

async function aesGcmEncrypt(kek: Uint8Array, plaintext: Uint8Array): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
    const key = await crypto.subtle.importKey('raw', kek as BufferSource, { name: 'AES-GCM' }, false, ['encrypt'])
    const iv = randomBytes(12)
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        plaintext as BufferSource
    )
    return { iv, ciphertext: new Uint8Array(ciphertext) }
}

async function aesGcmDecrypt(kek: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', kek as BufferSource, { name: 'AES-GCM' }, false, ['decrypt'])
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        ciphertext as BufferSource
    )
    return new Uint8Array(plaintext)
}

// ---------------------------------------------------------------------------
// WebAuthn PRF plumbing
// ---------------------------------------------------------------------------

/** Deterministic 32-byte salt for Option C, recoverable on any device. */
async function entropySalt(index: number): Promise<Uint8Array> {
    const digest = await crypto.subtle.digest('SHA-256', utf8(`${ENTROPY_SALT_PREFIX}${index}`) as BufferSource)
    return new Uint8Array(digest)
}

/** Extract prf.results.first from an assertion/attestation, or throw. */
function extractPrfOutput(credential: PublicKeyCredential): Uint8Array {
    const results = credential.getClientExtensionResults() as {
        prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } }
    }
    const first = results?.prf?.results?.first
    if (!first) {
        throw new PasskeyVaultError(
            'PRF_UNSUPPORTED',
            'This authenticator does not support the WebAuthn PRF (hmac-secret) extension. Use the recovery phrase instead.'
        )
    }
    return new Uint8Array(first)
}

async function createPasskeyWithPrf(username: string, salt: Uint8Array, discoverable: boolean): Promise<{ credential: PublicKeyCredential; prfOutput: Uint8Array }> {
    if (typeof window === 'undefined' || !navigator.credentials) {
        throw new PasskeyVaultError('UNSUPPORTED', 'WebAuthn is not supported in this browser')
    }
    let credential: PublicKeyCredential | null
    try {
        credential = (await navigator.credentials.create({
            publicKey: {
                rp: { name: RP_NAME, id: getRpId() },
                user: { id: randomBytes(16), name: username, displayName: username },
                challenge: randomBytes(32),
                pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    residentKey: discoverable ? 'required' : 'preferred',
                    requireResidentKey: discoverable,
                    userVerification: 'required',
                },
                extensions: { prf: { eval: { first: salt } } },
            } as PublicKeyCredentialCreationOptions,
        })) as PublicKeyCredential | null
    } catch (error) {
        throw wrapError(error, 'Passkey creation failed')
    }
    if (!credential) {
        throw new PasskeyVaultError('FAILED', 'Passkey creation returned no credential')
    }
    return { credential, prfOutput: extractPrfOutput(credential) }
}

async function getPasskeyWithPrf(salt: Uint8Array, credentialId?: Uint8Array): Promise<{ credential: PublicKeyCredential; prfOutput: Uint8Array }> {
    if (typeof window === 'undefined' || !navigator.credentials) {
        throw new PasskeyVaultError('UNSUPPORTED', 'WebAuthn is not supported in this browser')
    }
    let credential: PublicKeyCredential | null
    try {
        credential = (await navigator.credentials.get({
            publicKey: {
                rpId: getRpId(),
                challenge: randomBytes(32),
                userVerification: 'required',
                ...(credentialId
                    ? { allowCredentials: [{ id: credentialId as BufferSource, type: 'public-key' }] }
                    : {}),
                extensions: { prf: { eval: { first: salt } } },
            } as PublicKeyCredentialRequestOptions,
        })) as PublicKeyCredential | null
    } catch (error) {
        throw wrapError(error, 'Passkey authentication failed')
    }
    if (!credential) {
        throw new PasskeyVaultError('FAILED', 'Passkey authentication returned no credential')
    }
    return { credential, prfOutput: extractPrfOutput(credential) }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function storage(): Storage {
    if (typeof window === 'undefined' || !window.localStorage) {
        throw new PasskeyVaultError('UNSUPPORTED', 'localStorage is unavailable')
    }
    return window.localStorage
}

export function getVaultRecord(identityId: string): VaultRecord | null {
    const raw = storage().getItem(VAULT_KEY_PREFIX + identityId)
    if (!raw) return null
    try {
        const record = JSON.parse(raw) as VaultRecord
        if (record.version !== 1 || !record.credentialId || !record.salt || !record.iv || !record.ciphertext) {
            return null
        }
        return record
    } catch {
        return null
    }
}

export function hasVault(identityId: string): boolean {
    return getVaultRecord(identityId) !== null
}

export function removeVault(identityId: string): void {
    storage().removeItem(VAULT_KEY_PREFIX + identityId)
}

// ---------------------------------------------------------------------------
// Option A — Vault: wrap an existing identity private key (WIF)
// ---------------------------------------------------------------------------

/**
 * Create a passkey and encrypt the identity's private key under a KEK
 * derived from the passkey's PRF output. The ciphertext record is stored
 * in localStorage (not secret). The identity's mnemonic stays the backup.
 */
export async function enrollVault(identityId: string, privateKeyWif: string, username?: string): Promise<void> {
    const salt = randomBytes(32)
    const { credential, prfOutput } = await createPasskeyWithPrf(
        username || `evonext-${identityId.slice(0, 8)}`,
        salt,
        false
    )
    const kek = await hkdfSha256(prfOutput, salt, KEK_INFO)
    const { iv, ciphertext } = await aesGcmEncrypt(kek, utf8(privateKeyWif))
    const record: VaultRecord = {
        version: 1,
        credentialId: bytesToBase64url(new Uint8Array(credential.rawId)),
        salt: bytesToBase64url(salt),
        iv: bytesToBase64url(iv),
        ciphertext: bytesToBase64url(ciphertext),
        createdAt: Date.now(),
    }
    storage().setItem(VAULT_KEY_PREFIX + identityId, JSON.stringify(record))
}

/**
 * Unlock the vault: passkey prompt -> PRF -> KEK -> decrypt -> WIF.
 * Throws PasskeyVaultError('NOT_FOUND') when no record exists and
 * ('DECRYPT_FAILED') when the passkey does not match the record.
 */
export async function unlockVault(identityId: string): Promise<string> {
    const record = getVaultRecord(identityId)
    if (!record) {
        throw new PasskeyVaultError('NOT_FOUND', `No passkey vault for identity ${identityId}`)
    }
    const salt = base64urlToBytes(record.salt)
    const { prfOutput } = await getPasskeyWithPrf(salt, base64urlToBytes(record.credentialId))
    const kek = await hkdfSha256(prfOutput, salt, KEK_INFO)
    try {
        const plaintext = await aesGcmDecrypt(kek, base64urlToBytes(record.iv), base64urlToBytes(record.ciphertext))
        return new TextDecoder().decode(plaintext)
    } catch {
        throw new PasskeyVaultError('DECRYPT_FAILED', 'Passkey vault decryption failed')
    }
}

// ---------------------------------------------------------------------------
// Option C — Passkey-native entropy for NEW identities (cross-device)
// ---------------------------------------------------------------------------

/**
 * Create a discoverable (resident) passkey and derive 32 bytes of master
 * entropy from its PRF output with a deterministic salt. Recoverable on any
 * device the passkey syncs to — nothing needs to be stored locally.
 *
 * `index` distinguishes multiple identities for one user (0, 1, 2, …).
 */
export async function createIdentityEntropy(index: number, username: string): Promise<PasskeyEntropyResult> {
    const salt = await entropySalt(index)
    const { credential, prfOutput } = await createPasskeyWithPrf(username, salt, true)
    const entropy = await hkdfSha256(prfOutput, salt, ENTROPY_INFO)
    const credentialId = bytesToBase64url(new Uint8Array(credential.rawId))
    // Local hint only (which passkey belongs to which index). NOT required
    // for recovery — the credential is discoverable via rpId alone.
    try {
        storage().setItem(ENTROPY_HINT_PREFIX + index, JSON.stringify({ credentialId }))
    } catch { /* non-fatal */ }
    return {
        entropy,
        credentialId,
        mnemonic: entropyToMnemonic(entropy, wordlist),
    }
}

/**
 * Recover the same entropy on any device: the discoverable passkey is found
 * via the rpId (no stored credentialId needed), PRF returns the same output,
 * HKDF yields the same 32 bytes.
 */
export async function recoverIdentityEntropy(index: number): Promise<PasskeyEntropyResult> {
    const salt = await entropySalt(index)
    const { credential, prfOutput } = await getPasskeyWithPrf(salt)
    const entropy = await hkdfSha256(prfOutput, salt, ENTROPY_INFO)
    return {
        entropy,
        credentialId: bytesToBase64url(new Uint8Array(credential.rawId)),
        mnemonic: entropyToMnemonic(entropy, wordlist),
    }
}

/** Local hint of which entropy indices were created on this device. */
export function getEntropyCredentialHint(index: number): string | null {
    const raw = storage().getItem(ENTROPY_HINT_PREFIX + index)
    if (!raw) return null
    try {
        return (JSON.parse(raw) as { credentialId?: string }).credentialId || null
    } catch {
        return null
    }
}
