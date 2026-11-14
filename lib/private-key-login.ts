// lib/private-key-login.ts
//
// WIF-only sign-in discovery — desktop/mobile parity.
//
// A session mnemonic is NOT required when the user holds an identity's
// private key directly: the public key hash160 is derived from the WIF and
// the identity is looked up BY PUBLIC KEY HASH on the current network
// (unique-key index first, then the non-unique fallback — the same order as
// evonext-desktop's KeyDiscovery.discoverFromKey and evonext-mobile's
// handleImportByPrivateKey).
//
// The auth context's login(identityId, privateKey) needs no mnemonic: the
// WIF is stored via secure-storage (1h TTL + biometric) and every document
// operation sources it through state-transition-service.getPrivateKey()
// (matched to the identity key by material — F26e/F26g).

import { get_identity_by_non_unique_public_key_hash } from './dash-wasm/compat'

export interface DiscoveredIdentityInfo {
    /** The discovered identity id (base58). */
    identityId: string
    /** Credits balance (number or bigint from the SDK). */
    balance: number | bigint
    /** Normalized public keys (string id, numeric purpose/securityLevel). */
    publicKeys: Array<{
        id: number
        keyType: string
        purpose: number
        securityLevel: number
        data: string
        disabledAt?: number | null
    }>
    /** The hash160 hex the search was made with (for error messages). */
    publicKeyHash: string
}

/* String-enum maps — desktop KeyDiscovery parity (parsePurpose/
 * parseSecurityLevel): some sources return DAPI string enums. */
const PURPOSE_MAP: Record<string, number> = {
    AUTHENTICATION: 0,
    ENCRYPTION: 1,
    DECRYPTION: 2,
    TRANSFER: 3,
}
const SECURITY_LEVEL_MAP: Record<string, number> = {
    MASTER: 0,
    CRITICAL: 1,
    HIGH: 2,
    MEDIUM: 3,
}
const parseEnumNumber = (value: any, map: Record<string, number>, fallback: number): number => {
    if (typeof value === 'number') return value
    const mapped = map[String(value ?? '').toUpperCase()]
    return mapped !== undefined ? mapped : fallback
}

/** Normalize a wasm Identity class instance to the plain shape the app
 *  consumes (F26d pattern: toJSON() restores string id; the enum fields may
 *  be numeric OR string enums depending on the source — both accepted). */
const normalizeIdentity = (identity: any): Omit<DiscoveredIdentityInfo, 'publicKeyHash'> => {
    const json = typeof identity.toJSON === 'function' ? identity.toJSON() : identity
    const publicKeys = (json.publicKeys || []).map((pk: any) => ({
        id: typeof pk.id === 'number' ? pk.id : Number(pk.id ?? pk.idx ?? 0),
        keyType: String(pk.keyType ?? pk.type ?? 'ECDSA_HASH160'),
        purpose: parseEnumNumber(pk.purpose, PURPOSE_MAP, 0),
        securityLevel: parseEnumNumber(pk.securityLevel, SECURITY_LEVEL_MAP, 0),
        data: String(pk.data ?? ''),
        disabledAt: pk.disabledAt ?? null,
    }))
    return {
        identityId: String(json.id),
        balance: json.balance ?? 0,
        publicKeys,
    }
}

/**
 * Discover the identity that owns a WIF private key.
 *
 * @param wif the private key in WIF format (the version byte is part of the
 *            key itself — pshenmic's PrivateKey.fromWIF takes no network arg)
 * @returns the discovered identity, or null when no identity on the CURRENT
 *          network holds this key's hash160 in either key index.
 */
export async function discoverIdentityFromWif(wif: string): Promise<DiscoveredIdentityInfo | null> {
    const cleanKey = wif.trim()
    if (!cleanKey) return null

    const [{ wasmSdkService }, wasm] = await Promise.all([
        import('./services/wasm-sdk-service'),
        import('./dash-wasm/wasm_sdk'),
    ])

    /* WIF -> public key hash160 (network-independent). */
    const publicKeyHash = wasm.PrivateKey.fromWIF(cleanKey).getPublicKeyHash()
    if (!publicKeyHash) return null

    const sdk = await wasmSdkService.getSdk()

    /* 1. Unique public key hash index (AUTHENTICATION keys). */
    try {
        const unique = await (sdk as any).getIdentityByPublicKeyHash(publicKeyHash)
        if (unique) {
            return { ...normalizeIdentity(unique), publicKeyHash }
        }
    } catch { /* fall through to the non-unique index */ }

    /* 2. Non-unique index (ENCRYPTION/DECRYPTION and legacy keys). The
     *    compat wrapper returns an Array<Identity> (may be empty). */
    const result = await get_identity_by_non_unique_public_key_hash(sdk, publicKeyHash, undefined)
    const rows = Array.isArray(result) ? result : (result ? [result] : [])
    if (rows.length === 0 || !rows[0]) return null

    return { ...normalizeIdentity(rows[0]), publicKeyHash }
}
