// lib/dapi-proxy.ts
//
// Read-path client for the Sansbank DAPI proxy (https://dapi.sansbank.dev).
//
// The proxy serves READ methods (identity fetch/balance, shielded pool
// queries, status) from a clustered, cached JS-SDK worker pool — dramatically
// faster and more reliable than each browser spinning up its own WASM SDK
// connection for every read. The WASM SDK remains the FALLBACK when the proxy
// is unreachable, and remains the ONLY path for WRITES (broadcasts / proofs /
// state transitions), which the proxy does not expose.
//
// Shielded reads (added 2026-11-11): the proxy's six shielded methods are the
// PRIMARY gateway (user directive) with per-call WASM fallback — see
// makeProxyFirstShieldedSource(). Proxy serialization conventions (from the
// DAPI team's deployed doc, dev-dapi-proxy commit 257aaec, and live-verified):
// 32-byte fields arrive as { data: <hex>, dataB64: <base64> }, u64 balances /
// counts as decimal STRINGS (JSON has no bigint), startIndex may be passed as
// string or number, and an empty pool maps to null (not an error).
//
// Envelope: { success, method, params, network, result } on success,
//           { success:false, error, type } on failure.

import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import type { ShieldedSyncSource } from './shielded/sync';

const PROXY_URL = 'https://dapi.sansbank.dev/v1/dapi'
const PROXY_TIMEOUT_MS = 12_000

interface ProxyResponse {
    success: boolean
    result?: any
    error?: string
    type?: string
}

/* POST a read method to the proxy. Returns the unwrapped `result`, or throws. */
async function proxyCall(
    method: string,
    params: Record<string, unknown>,
    network: 'mainnet' | 'testnet'
): Promise<any> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

    try {
        const res = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method, params, network }),
            signal: controller.signal,
        })

        if (!res.ok) {
            throw new Error(`proxy HTTP ${res.status}`)
        }

        const body = (await res.json()) as ProxyResponse

        if (!body.success) {
            throw new Error(body.error || 'proxy call failed')
        }

        return body.result
    } finally {
        clearTimeout(timer)
    }
}

/* NOTE: the proxy's get_documents path enforces STRICTER grpc index
 * validation than the WASM SDK (it rejects the `$createdAt > 0` range clauses
 * the Yappr feed relies on — see smoke tests). Document queries therefore stay
 * on the WASM SDK; the proxy serves identity reads where its cache wins.
 */

/**
 * Fetch an identity by id — proxy first, WASM SDK fallback.
 * `fallback` is called with nothing and must return the identity (or null).
 */
export async function fetchIdentityViaProxy(
    identityId: string,
    network: 'mainnet' | 'testnet',
    fallback: () => Promise<any>
): Promise<any> {
    try {
        const result = await proxyCall(
            'identity_fetch', { identityId }, network)
        // Proxy returns a plain object; keep it if it has the fields we need.
        if (result && (result.identityId || result.balance !== undefined)) {
            return result
        }
    } catch (error) {
        console.warn('[dapi-proxy] identity_fetch failed, falling back to WASM SDK:', (error as Error)?.message)
    }
    return fallback()
}

/**
 * Fetch an identity balance by id — proxy first, WASM SDK fallback.
 */
export async function fetchIdentityBalanceViaProxy(
    identityId: string,
    network: 'mainnet' | 'testnet',
    fallback: () => Promise<any>
): Promise<any> {
    try {
        const result = await proxyCall(
            'get_identity_balance', { identityId }, network)
        if (result !== null && result !== undefined) {
            return result
        }
    } catch (error) {
        console.warn('[dapi-proxy] get_identity_balance failed, falling back to WASM SDK:', (error as Error)?.message)
    }
    return fallback()
}

/* ------------------------------------------------------------------ *
 * Shielded read methods (proxy PRIMARY, WASM fallback) — 2026-11-11  *
 * ------------------------------------------------------------------ */

/** Decode one proxy `{ data: <hex>, dataB64 }` field into bytes, enforcing
 *  an exact length. Throws on malformed payloads — the caller's catch falls
 *  back to the WASM SDK. */
function decodeProxyField(field: any, expectedBytes: number, what: string): Uint8Array {
    if (!field || typeof field.data !== 'string') {
        throw new Error(`proxy ${what}: missing data field`)
    }
    const bytes = hexToBytes(field.data)
    if (bytes.length !== expectedBytes) {
        throw new Error(`proxy ${what}: expected ${expectedBytes} bytes, got ${bytes.length}`)
    }
    return bytes
}

/**
 * Proxy-first shielded note page. `startIndex` is sent as a STRING (the proxy
 * BigInt()-converts it; JSON has no safe u64). Each returned row is decoded
 * and length-checked (cmx/cvNet/nullifier 32 B, encryptedNote 216 B — the
 * wire layout verified in docs/HANDOFF-shielded-e2e.md Step 5). Falls back to
 * `fallback` on any proxy error or malformed payload.
 */
export async function fetchShieldedEncryptedNotesViaProxy(
    startIndex: bigint,
    count: number,
    network: 'mainnet' | 'testnet',
    fallback: () => Promise<Array<{ cmx: Uint8Array; cvNet: Uint8Array; encryptedNote: Uint8Array; nullifier: Uint8Array }>>
): Promise<Array<{ cmx: Uint8Array; cvNet: Uint8Array; encryptedNote: Uint8Array; nullifier: Uint8Array }>> {
    try {
        const result = await proxyCall('get_shielded_encrypted_notes',
            { startIndex: startIndex.toString(), count }, network)
        if (!Array.isArray(result)) {
            throw new Error('proxy notes: result is not an array')
        }
        return result.map((row: any) => ({
            cmx: decodeProxyField(row.cmx, 32, 'notes.cmx'),
            cvNet: decodeProxyField(row.cvNet, 32, 'notes.cvNet'),
            encryptedNote: decodeProxyField(row.encryptedNote, 216, 'notes.encryptedNote'),
            nullifier: decodeProxyField(row.nullifier, 32, 'notes.nullifier'),
        }))
    } catch (error) {
        console.warn('[dapi-proxy] get_shielded_encrypted_notes failed, falling back to WASM SDK:', (error as Error)?.message)
    }
    return fallback()
}

/** Proxy-first shielded anchors list (each 32 B). */
export async function fetchShieldedAnchorsViaProxy(
    network: 'mainnet' | 'testnet',
    fallback: () => Promise<Uint8Array[]>
): Promise<Uint8Array[]> {
    try {
        const result = await proxyCall('get_shielded_anchors', {}, network)
        if (!Array.isArray(result)) {
            throw new Error('proxy anchors: result is not an array')
        }
        return result.map((row: any) => decodeProxyField(row, 32, 'anchors'))
    } catch (error) {
        console.warn('[dapi-proxy] get_shielded_anchors failed, falling back to WASM SDK:', (error as Error)?.message)
    }
    return fallback()
}

/** Proxy-first most-recent shielded anchor (32 B). An empty pool maps to
 *  the proxy's null, which we surface as `undefined` (the WASM SDK's own
 *  convention for getMostRecentShieldedAnchor, d.ts:15791). */
export async function fetchMostRecentShieldedAnchorViaProxy(
    network: 'mainnet' | 'testnet',
    fallback: () => Promise<Uint8Array | undefined>
): Promise<Uint8Array | undefined> {
    try {
        const result = await proxyCall('get_shielded_most_recent_anchor', {}, network)
        if (result === null || result === undefined) {
            return undefined
        }
        return decodeProxyField(result, 32, 'most recent anchor')
    } catch (error) {
        console.warn('[dapi-proxy] get_shielded_most_recent_anchor failed, falling back to WASM SDK:', (error as Error)?.message)
    }
    return fallback()
}

/** Proxy-first nullifier spent-status check. Input nullifiers are sent as
 *  64-char hex strings (the proxy's documented input convention). */
export async function fetchShieldedNullifiersViaProxy(
    nullifiers: Uint8Array[],
    network: 'mainnet' | 'testnet',
    fallback: () => Promise<Array<{ nullifier: Uint8Array; isSpent: boolean }>>
): Promise<Array<{ nullifier: Uint8Array; isSpent: boolean }>> {
    try {
        const result = await proxyCall('get_shielded_nullifiers',
            { nullifiers: nullifiers.map((n) => bytesToHex(n)) }, network)
        if (!Array.isArray(result)) {
            throw new Error('proxy nullifiers: result is not an array')
        }
        return result.map((row: any) => ({
            nullifier: decodeProxyField(row.nullifier, 32, 'nullifiers'),
            isSpent: row.isSpent === true,
        }))
    } catch (error) {
        console.warn('[dapi-proxy] get_shielded_nullifiers failed, falling back to WASM SDK:', (error as Error)?.message)
    }
    return fallback()
}

/** Proxy-first shielded pool balance (credits). The proxy returns a decimal
 *  STRING (JSON has no bigint); an empty pool maps to null → `undefined`,
 *  matching the WASM SDK's `getShieldedPoolState(): Promise<bigint | undefined>`
 *  (d.ts:15819). */
export async function fetchShieldedPoolStateViaProxy(
    network: 'mainnet' | 'testnet',
    fallback: () => Promise<bigint | undefined>
): Promise<bigint | undefined> {
    try {
        const result = await proxyCall('get_shielded_pool_state', {}, network)
        if (result === null || result === undefined) {
            return undefined
        }
        if (typeof result !== 'string' || !/^\d+$/.test(result)) {
            throw new Error('proxy pool state: not a decimal string')
        }
        return BigInt(result)
    } catch (error) {
        console.warn('[dapi-proxy] get_shielded_pool_state failed, falling back to WASM SDK:', (error as Error)?.message)
    }
    return fallback()
}

/** Proxy-first shielded note count (decimal STRING → bigint; null →
 *  `undefined`). NOTE: the WASM SDK has NO equivalent method (the 5.0 method
 *  list carries no getShieldedNotesCount — audited 2026-11-11), so the
 *  fallback will typically be a stub that returns undefined. */
export async function fetchShieldedNotesCountViaProxy(
    network: 'mainnet' | 'testnet',
    fallback: () => Promise<bigint | undefined>
): Promise<bigint | undefined> {
    try {
        const result = await proxyCall('get_shielded_notes_count', {}, network)
        if (result === null || result === undefined) {
            return undefined
        }
        if (typeof result !== 'string' || !/^\d+$/.test(result)) {
            throw new Error('proxy notes count: not a decimal string')
        }
        return BigInt(result)
    } catch (error) {
        console.warn('[dapi-proxy] get_shielded_notes_count failed, falling back to WASM SDK:', (error as Error)?.message)
    }
    return fallback()
}

/**
 * Wrap a WASM SDK shielded source so every read goes to the proxy FIRST and
 * falls back to the WASM source per call (proxy PRIMARY — user directive
 * 2026-11-11). The returned object satisfies the ShieldedSyncSource
 * interface consumed by lib/shielded/sync.ts.
 */
export function makeProxyFirstShieldedSource(
    network: 'mainnet' | 'testnet',
    wasmSource: ShieldedSyncSource
): ShieldedSyncSource {
    return {
        getShieldedEncryptedNotes: (startIndex, count) =>
            fetchShieldedEncryptedNotesViaProxy(startIndex, count, network,
                () => wasmSource.getShieldedEncryptedNotes(startIndex, count)),
        getShieldedAnchors: () =>
            fetchShieldedAnchorsViaProxy(network,
                () => wasmSource.getShieldedAnchors()),
        getMostRecentShieldedAnchor: () =>
            fetchMostRecentShieldedAnchorViaProxy(network,
                () => wasmSource.getMostRecentShieldedAnchor()),
        getShieldedNullifiers: (nullifiers) =>
            fetchShieldedNullifiersViaProxy(nullifiers, network,
                () => wasmSource.getShieldedNullifiers(nullifiers)),
    }
}

