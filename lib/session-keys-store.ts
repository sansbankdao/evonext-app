// lib/session-keys-store.ts
//
// F57b — the multi-key session store (the Settings → Keys manager).
//
// WHAT: a per-identity map of private keys (WIFs), each MATERIALLY MATCHED
// against the identity's registered keys at ADD time (a key that is not
// registered on that identity is refused with an honest error). Multiple
// keys per session are the point: a TRANSFER key signs credit/token
// transfers + withdrawals (purpose 3), an AUTH CRITICAL|HIGH key signs
// documents/profiles/DPNS (purpose 0, security 1|2) — one session can hold
// both.
//
// STORAGE: lib/secure-storage (the same backend the connect flow uses for
// the submitted WIF). HONEST semantics, verified 2026-11-16: the backend
// writes plain localStorage and its TTL timers are commented out, so keys
// persist UNTIL REMOVED (not 1h — that claim is stale; the beforeunload
// clear wipes only the unused in-memory map). The Key Manager labels this
// as "kept in this browser until removed". The WIFs are never displayed
// after entry — only a fingerprint (the hash160 prefix).
//
// LEGACY COMPAT: the connect flow's submitted WIF lives under the legacy
// `pk_<identityId>` slot (the F55 flow — untouched). The store's LIST
// surfaces it as a loaded key (material-matched against the registered
// keys), and REMOVE also clears the legacy slot when it holds the same
// key material.
//
// CONSUMERS:
//   - wallet-manager.getTransferKey: getSessionWifForPurpose(TRANSFER)
//     (falls back to the legacy pk_ slot's material check — F57b).
//   - state-transition-service.getPrivateKey:
//     getSessionWifForPurpose(AUTHENTICATION, CRITICAL|HIGH).
//   - The Settings Key Manager UI: add / list / remove.

import { PrivateKeyWASM } from 'pshenmic-dpp'
import { getWasmSdk } from './services/wasm-sdk-service'

const KEYSTORE_PREFIX = 'evonext_keystore_'
const LEGACY_PK_PREFIX = 'pk_'

/* Purpose/security enums arrive as numbers OR enum strings depending on
 * the identity shape (the wasm class getters vs the JSON/proxy shapes —
 * the F26d/F55b lesson). */
const isPurpose = (value: any, name: string, num: number): boolean =>
    value === num || String(value).toUpperCase() === name

const isSecurity = (value: any, names: string[], nums: number[]): boolean => {
    const s = String(value).toUpperCase()
    return nums.includes(value) || names.includes(s)
}

/** The hash160 of a WIF's compressed public key, as lowercase hex — the
 * SAME material the identity's registered ECDSA_HASH160 keys carry in
 * `data` (hex on the class getter, base64 in the JSON shapes — the F26g
 * tolerance). */
function wifPubHashHex(wif: string): string {
    const pubHash = PrivateKeyWASM.fromWIF(wif).getPublicKeyHash()
    const hex = String(pubHash).toLowerCase()
    if (/^[0-9a-f]{40}$/.test(hex)) return hex
    /* A non-hex form (e.g. raw bytes) — normalize through bytes. */
    try {
        return Buffer.from(pubHash as any).toString('hex').toLowerCase()
    } catch {
        return hex
    }
}

export interface RegisteredKeyInfo {
    keyId: number
    purpose: any
    securityLevel: any
    keyType: any
    dataHex: string
}

export interface SessionKeyEntry {
    keyId: number
    fingerprint: string
    addedAt: number
    source: 'keystore' | 'legacy'
}

interface KeystoreBlob {
    [keyId: string]: { wif: string; fingerprint: string; addedAt: number }
}

const keystoreKey = (identityId: string) => `${KEYSTORE_PREFIX}${identityId}`

async function loadBlob(identityId: string): Promise<KeystoreBlob> {
    const secureStorage = (await import('./secure-storage')).default
    const raw = secureStorage.get(keystoreKey(identityId))
    if (!raw || typeof raw !== 'string') return {}
    try {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}

async function saveBlob(identityId: string, blob: KeystoreBlob): Promise<void> {
    const secureStorage = (await import('./secure-storage')).default
    if (Object.keys(blob).length === 0) {
        secureStorage.delete(keystoreKey(identityId))
        return
    }
    secureStorage.set(keystoreKey(identityId), JSON.stringify(blob))
}

/** Fetch the identity and normalize its registered keys to a comparable
 * list (the F53 pattern: values() + flat() + the non-object skip; the
 * data as lowercase hex). */
export async function fetchRegisteredKeys(
    network: 'mainnet' | 'testnet',
    identityId: string,
): Promise<RegisteredKeyInfo[]> {
    const { wasmSdkService } = await import('./services/wasm-sdk-service')
    const { EVONEXT_CONTRACT_ID_MAINNET, EVONEXT_CONTRACT_ID_TESTNET } =
        await import('./constants')
    if (!wasmSdkService.isReady() || wasmSdkService.initializedNetwork() !== network) {
        await wasmSdkService.initialize({
            network,
            contractId: network === 'mainnet'
                ? EVONEXT_CONTRACT_ID_MAINNET
                : EVONEXT_CONTRACT_ID_TESTNET,
        })
    }
    const sdk = await getWasmSdk()
    const identity = await sdk.getIdentity(identityId)
    if (!identity) {
        throw new Error(`Identity not found: ${identityId}`)
    }
    const rawKeys = (identity as any).publicKeys
    const keysList: any[] = Array.isArray(rawKeys)
        ? rawKeys
        : (rawKeys && typeof rawKeys === 'object')
            ? Object.values(rawKeys).flat()
            : []
    const out: RegisteredKeyInfo[] = []
    for (const k of keysList) {
        if (!k || typeof k !== 'object' || k.data === undefined || k.data === null) continue
        const dataHex = (typeof k.data === 'string' ? k.data : Buffer.from(k.data).toString('hex'))
            .toLowerCase()
        /* The data may already be hash160-hex (40 chars) or a raw compressed
         * key (66 chars, type 0) — normalize hash160-type entries only;
         * ECDSA_SECP256K1 (type 1) keys carry the raw compressed pubkey and
         * cannot be material-matched against a WIF's hash160 anyway. */
        let comparable = dataHex
        if (dataHex.length === 66) {
            try {
                const { sha256 } = await import('@noble/hashes/sha2.js')
                const { ripemd160 } = await import('@noble/hashes/legacy.js')
                const { hexToBytes } = await import('@noble/hashes/utils.js')
                comparable = Buffer.from(ripemd160(sha256(hexToBytes(dataHex)))).toString('hex')
            } catch { /* leave as-is */ }
        }
        out.push({
            keyId: Number(k.id ?? k.keyId ?? 0),
            purpose: k.purpose,
            securityLevel: k.securityLevel,
            keyType: k.keyType ?? k.type,
            dataHex: comparable,
        })
    }
    return out
}

/**
 * ADD a key to the session: validate the WIF, material-match it against
 * the identity's registered keys, and store it under its registered key
 * id. Refuses (honestly) a key the identity does not carry.
 */
export async function addSessionKey(
    network: 'mainnet' | 'testnet',
    identityId: string,
    wif: string,
): Promise<SessionKeyEntry> {
    const trimmed = wif.trim()
    if (!trimmed) {
        throw new Error('Paste a private key (WIF) first.')
    }
    let pubHash: string
    try {
        pubHash = wifPubHashHex(trimmed)
    } catch {
        throw new Error('That is not a valid private key (WIF). Check for typos and try again.')
    }
    const registered = await fetchRegisteredKeys(network, identityId)
    const match = registered.find((k) => k.dataHex === pubHash)
    if (!match) {
        throw new Error('This key is NOT registered on that identity — keys are matched by their public-key hash. Double-check the identity and the key.')
    }
    const blob = await loadBlob(identityId)
    blob[String(match.keyId)] = {
        wif: trimmed,
        fingerprint: pubHash.slice(0, 16),
        addedAt: Date.now(),
    }
    await saveBlob(identityId, blob)
    /* F57b Option B — keep the session vault consistent (a stale vault
     * would restore WITHOUT this key after an unlock). BEST-EFFORT: the
     * ceremony may be declined; the next login re-collects everything. */
    try {
        const { reenrollSessionKeys } = await import('./session-unlock')
        await reenrollSessionKeys(identityId)
    } catch { /* non-fatal */ }
    return { keyId: match.keyId, fingerprint: pubHash.slice(0, 16), addedAt: Date.now(), source: 'keystore' }
}

/**
 * REMOVE a loaded key by its registered key id. Also clears the legacy
 * `pk_<identityId>` slot when it holds the SAME key material.
 */
export async function removeSessionKey(
    network: 'mainnet' | 'testnet',
    identityId: string,
    keyId: number,
): Promise<void> {
    const secureStorage = (await import('./secure-storage')).default
    const blob = await loadBlob(identityId)
    const removed = blob[String(keyId)]
    delete blob[String(keyId)]
    await saveBlob(identityId, blob)
    /* The legacy slot holds ONE WIF (the connect-submitted key) — a row
     * sourced ONLY from it (the live-hit: the e2e removed the legacy
     * transfer key while the store had no entry) must still clear it.
     * Clear the slot when its material matches either the removed store
     * entry or the requested registered key. */
    const legacyKey = `${LEGACY_PK_PREFIX}${identityId}`
    const legacyWif = secureStorage.get(legacyKey)
    if (!legacyWif || typeof legacyWif !== 'string') return
    try {
        const legacyHash = wifPubHashHex(legacyWif)
        if (removed && wifPubHashHex(removed.wif) === legacyHash) {
            secureStorage.delete(legacyKey)
            return
        }
        if (!removed) {
            const registered = await fetchRegisteredKeys(network, identityId)
            const match = registered.find((k) => k.keyId === keyId)
            if (match && match.dataHex === legacyHash) {
                secureStorage.delete(legacyKey)
            }
        }
    } catch { /* an invalid legacy value — leave it */ }
    /* F57b Option B — keep the session vault consistent. BEST-EFFORT. */
    try {
        const { reenrollSessionKeys } = await import('./session-unlock')
        await reenrollSessionKeys(identityId)
    } catch { /* non-fatal */ }
}

/**
 * LIST: the identity's registered keys + which ones the session holds
 * (the keystore map + the legacy submitted WIF, material-matched).
 */
export async function listSessionKeys(
    network: 'mainnet' | 'testnet',
    identityId: string,
): Promise<{ registered: RegisteredKeyInfo[]; loaded: Map<number, SessionKeyEntry> }> {
    const registered = await fetchRegisteredKeys(network, identityId)
    const blob = await loadBlob(identityId)
    const loaded = new Map<number, SessionKeyEntry>()
    for (const [keyId, entry] of Object.entries(blob)) {
        loaded.set(Number(keyId), {
            keyId: Number(keyId),
            fingerprint: entry.fingerprint,
            addedAt: entry.addedAt,
            source: 'keystore',
        })
    }
    /* The legacy submitted WIF (the connect flow) — surface it as loaded
     * when it material-matches a registered key. */
    const secureStorage = (await import('./secure-storage')).default
    const legacyWif = secureStorage.get(`${LEGACY_PK_PREFIX}${identityId}`)
    if (legacyWif && typeof legacyWif === 'string') {
        try {
            const pubHash = wifPubHashHex(legacyWif)
            const match = registered.find((k) => k.dataHex === pubHash)
            if (match && !loaded.has(match.keyId)) {
                loaded.set(match.keyId, {
                    keyId: match.keyId,
                    fingerprint: pubHash.slice(0, 16),
                    addedAt: 0,
                    source: 'legacy',
                })
            }
        } catch { /* an invalid legacy value — ignore */ }
    }
    return { registered, loaded }
}

/** The raw WIF for a registered key id from the session (the consumers). */
export async function getSessionKeyWif(identityId: string, keyId: number): Promise<string | null> {
    const blob = await loadBlob(identityId)
    return blob[String(keyId)]?.wif ?? null
}

/**
 * The WIF the session holds for a PURPOSE (and optional security levels) —
 * resolved through the identity's registered keys. Returns null when the
 * session holds no such key (the callers turn that into their honest,
 * actionable errors).
 */
export async function getSessionWifForPurpose(
    network: 'mainnet' | 'testnet',
    identityId: string,
    purposeName: string,
    purposeNum: number,
    securityLevels?: { names: string[]; nums: number[] },
): Promise<string | null> {
    const registered = await fetchRegisteredKeys(network, identityId)
    const candidates = registered.filter((k) =>
        isPurpose(k.purpose, purposeName, purposeNum)
        && (!securityLevels || isSecurity(k.securityLevel, securityLevels.names, securityLevels.nums)))
    if (candidates.length === 0) return null
    const blob = await loadBlob(identityId)
    const secureStorage = (await import('./secure-storage')).default
    for (const k of candidates) {
        const entry = blob[String(k.keyId)]
        if (entry?.wif) return entry.wif
    }
    /* The legacy slot: only when its material matches a candidate key. */
    const legacyWif = secureStorage.get(`${LEGACY_PK_PREFIX}${identityId}`)
    if (legacyWif && typeof legacyWif === 'string') {
        try {
            const pubHash = wifPubHashHex(legacyWif)
            if (candidates.some((k) => k.dataHex === pubHash)) return legacyWif
        } catch { /* ignore */ }
    }
    return null
}

/** The TRANSFER (purpose 3) WIF for the send/withdrawal paths. */
export async function getSessionTransferWif(
    network: 'mainnet' | 'testnet',
    identityId: string,
): Promise<string | null> {
    return getSessionWifForPurpose(network, identityId, 'TRANSFER', 3)
}

/** An AUTH (purpose 0) CRITICAL|HIGH WIF for the document paths. */
export async function getSessionAuthWif(
    network: 'mainnet' | 'testnet',
    identityId: string,
): Promise<string | null> {
    return getSessionWifForPurpose(network, identityId, 'AUTHENTICATION', 0, { names: ['CRITICAL', 'HIGH'], nums: [1, 2] })
}
