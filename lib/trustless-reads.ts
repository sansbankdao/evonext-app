// lib/trustless-reads.ts
//
// F57 Phase 1 — the READ ladder that keeps the WASM SDK's trusted context
// OFF the read path (the owner directive: "THERE SHOULD BE NO TRUSTED
// FETCHING — JUST USE THE API" + "if dapi.sansbank.dev fails then make sure
// we still have a fallback to the network"). See docs/HANDOFF-F57-PHASE1.md.
//
//   1. dapi.sansbank.dev (the JSON proxy) — the same envelope + string-
//      balance conventions as the F29 shielded methods. The two methods
//      (`get_addresses_infos`, `get_identities_token_balances`) are specced
//      in the dev-dapi-proxy handoff; until the DAPI team ships them the
//      proxy answers "Method '...' is not supported." — that explicit
//      verdict is memoized for 5 minutes so the ladder does not re-pay a
//      doomed round trip on every read; ANY other proxy failure just falls
//      through per call (never a hard fail — the F29 pattern).
//   2. The pshenmic DashPlatformSDK (pure JS, grpc-web straight to the DAPI
//      seed hosts, `proofs: false` = plain reads — NO trusted context, NO
//      wasm-sdk, NO quorum-key fetches). ONE instance per network, memoized
//      for the app lifetime: the seed discovery + healthchecks run once
//      (~2-11s cold, then ~300ms per read — live-probed 2026-11-16). The
//      no-proof path does not rotate on failure, so every tier-2 read gets
//      2 attempts (a fresh getClient() picks the next pool node).
//   3. The WASM SDK — the LAST-RESORT tier only (total proxy+seed outage;
//      preserves the pre-Phase-1 success surface). Lazy: the trusted
//      context is constructed ONLY here. Phase 2 removes this tier.
//
// Shapes (all three tiers normalize to the same maps):
//   - addresses: Map<variantHex /* tag(0 P2pkh|1 P2sh) || hash160 */,
//                   { balance: bigint, nonce: number }> — the WASM SDK's
//     own map-key space (the F51c rule: a bech32m-string key misses).
//   - tokens: Map<identityId base58, balance bigint> — holders ONLY (a
//     non-holder arrives with balance undefined on the pshenmic path and
//     with no entry on the WASM path — both map to "absent", 1:1).

import { bytesToHex } from '@noble/hashes/utils.js'
import { bech32m } from '@scure/base'

export type ProxyNetwork = 'mainnet' | 'testnet'

export interface PlatformAddressInfoLite {
    balance: bigint
    nonce: number
}

/* ------------------------------------------------------------------ *
 * The proxy tier                                                      *
 * ------------------------------------------------------------------ */

const PROXY_UNSUPPORTED_TTL_MS = 5 * 60_000
/* key: `${network}:${method}` -> epoch ms until which the explicit
 * "not supported" verdict is trusted (the DAPI team may ship the method
 * at any time — the memo expires and tier 1 is retried). */
const proxyUnsupportedUntil: Record<string, number> = {}

const proxyUnsupportedKey = (network: ProxyNetwork, method: string) =>
    `${network}:${method}`

function isProxyUnsupported(network: ProxyNetwork, method: string): boolean {
    const until = proxyUnsupportedUntil[proxyUnsupportedKey(network, method)]
    return until !== undefined && Date.now() < until
}

function noteProxyUnsupported(network: ProxyNetwork, method: string): void {
    proxyUnsupportedUntil[proxyUnsupportedKey(network, method)] =
        Date.now() + PROXY_UNSUPPORTED_TTL_MS
}

function clearProxyUnsupported(network: ProxyNetwork, method: string): void {
    delete proxyUnsupportedUntil[proxyUnsupportedKey(network, method)]
}

/** The DIP-17 bech32m payload type bytes (platform_address.rs). */
const DIP17_P2PKH_TYPE = 0xb0
const DIP17_P2SH_TYPE = 0xb1

/** Decode one specced proxy row into the variant-hex key + info. */
function proxyAddressRow(row: any): [string, PlatformAddressInfoLite] {
    if (typeof row?.address !== 'string') {
        throw new Error('proxy get_addresses_infos: row without an address string')
    }
    const payload = bech32m.fromWords(bech32m.decode(row.address as any).words)
    if (payload.length !== 21 || (payload[0] !== DIP17_P2PKH_TYPE && payload[0] !== DIP17_P2SH_TYPE)) {
        throw new Error('proxy get_addresses_infos: unexpected address payload')
    }
    const tag = payload[0] === DIP17_P2PKH_TYPE ? 0 : 1
    const keyBytes = new Uint8Array(21)
    keyBytes[0] = tag
    keyBytes.set(payload.subarray(1), 1)
    return [
        bytesToHex(keyBytes),
        {
            balance: BigInt(row.balance ?? 0),
            nonce: row.nonce === undefined || row.nonce === null ? 0 : Number(row.nonce),
        },
    ]
}

/* ------------------------------------------------------------------ *
 * The pshenmic tier (one SDK instance per network, memoized)          *
 * ------------------------------------------------------------------ */

const trustlessSdks: Partial<Record<ProxyNetwork, any>> = {}

async function getTrustlessSdk(network: ProxyNetwork): Promise<any> {
    const cached = trustlessSdks[network]
    if (cached) return cached
    const { DashPlatformSDK } = await import('dash-platform-sdk')
    const sdk = new DashPlatformSDK({ network, proofs: false })
    trustlessSdks[network] = sdk
    return sdk
}

/** Two attempts — the pool rotates to the next node on a retry (the
 * no-proof path itself does not rotate/ban; live-hit: the pinned mainnet
 * seeds mix full and limited nodes, UNIMPLEMENTED on some). */
async function withRotation<T>(run: () => Promise<T>, what: string): Promise<T> {
    let lastError: unknown
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            return await run()
        } catch (error) {
            lastError = error
            console.warn(
                `[trustless-reads] ${what} attempt ${attempt}/2 failed:`,
                (error as Error)?.message ?? String(error))
        }
    }
    throw lastError
}

/* ------------------------------------------------------------------ *
 * The WASM tier (lazy last resort)                                    *
 * ------------------------------------------------------------------ */

async function getWasmSdkForNetwork(network: ProxyNetwork): Promise<any> {
    const { getWasmSdk, wasmSdkService } =
        await import('./services/wasm-sdk-service')
    const { EVONEXT_CONTRACT_ID_MAINNET, EVONEXT_CONTRACT_ID_TESTNET } =
        await import('./constants')
    /* The F37 gotcha: initialize() re-inits on a network mismatch. */
    if (wasmSdkService.initializedNetwork() !== network) {
        await wasmSdkService.initialize({
            network,
            contractId: network === 'mainnet'
                ? EVONEXT_CONTRACT_ID_MAINNET
                : EVONEXT_CONTRACT_ID_TESTNET,
        })
    }
    return getWasmSdk()
}

/* ------------------------------------------------------------------ *
 * getIdentityNonce — the send-path preflight (F57 Phase 2)            *
 * ------------------------------------------------------------------ */

/**
 * The identity's CURRENT nonce (the callers/transition builders apply the
 * CURRENT + 1 increment themselves — see the F51b rule in assemble.ts).
 * Proxy → pshenmic → WASM. The send path previously did this read through
 * the wasm SDK's trusted-context RPC stack; Phase 2 sources it from the
 * plain API ladder instead. The wasm tier returns `bigint | undefined`;
 * every tier throws on a missing identity rather than returning a silent 0
 * (a 0 nonce would sign an invalid transition).
 */
export async function getIdentityNonce(
    network: ProxyNetwork,
    identityId: string,
): Promise<bigint> {
    /* Tier 1 — the proxy (live-verified: result = the decimal string "2"). */
    if (!isProxyUnsupported(network, 'get_identity_nonce')) {
        try {
            const { proxyCall } = await import('./dapi-proxy')
            const result = await proxyCall('get_identity_nonce', { identityId }, network)
            if (result === undefined || result === null || String(result).length === 0) {
                throw new Error('proxy get_identity_nonce: empty result')
            }
            const value = BigInt(String(result))
            clearProxyUnsupported(network, 'get_identity_nonce')
            return value
        } catch (error) {
            if (/is not supported/.test((error as Error)?.message ?? '')) {
                noteProxyUnsupported(network, 'get_identity_nonce')
            } else {
                console.warn('[trustless-reads] proxy get_identity_nonce failed:',
                    (error as Error)?.message)
            }
        }
    }

    /* Tier 2 — the pshenmic JS SDK (live-verified: a plain value; warm
     * ~100ms on the memoized client). */
    try {
        const sdk = await getTrustlessSdk(network)
        return await withRotation(async () => {
            const nonce = await sdk.identities.getIdentityNonce(identityId)
            if (nonce === undefined || nonce === null) {
                throw new Error('pshenmic getIdentityNonce: undefined')
            }
            return BigInt(nonce)
        }, 'pshenmic getIdentityNonce')
    } catch (error) {
        console.warn('[trustless-reads] pshenmic getIdentityNonce failed, falling back to WASM:',
            (error as Error)?.message)
    }

    /* Tier 3 — the WASM SDK, last resort (the pre-Phase-2 path). */
    const sdk = await getWasmSdkForNetwork(network)
    const nonce = await sdk.getIdentityNonce(identityId)
    if (nonce === undefined || nonce === null) {
        throw new Error(`Identity has no nonce on-chain: ${identityId.slice(0, 8)}…`)
    }
    return BigInt(nonce)
}

/* ------------------------------------------------------------------ *
 * getTokenContractInfo — the sendToken (contract, position) gate      *
 * ------------------------------------------------------------------ */

export interface TokenContractInfoLite {
    /** The base58 contract id carrying the token. */
    contractId: string
    tokenContractPosition: number
}

/**
 * Resolve a token id to its (contract, position) pair — the sendToken
 * gate that must throw an HONEST not-live error (the F53 rule). Proxy →
 * pshenmic → WASM. Null = the token is not live on the network (the wasm
 * tier's undefined), never swallowed into a fake success.
 */
export async function getTokenContractInfo(
    network: ProxyNetwork,
    tokenId: string,
): Promise<TokenContractInfoLite | null> {
    /* Tier 1 — the proxy (live-verified: {dataContractId, tokenContractPosition}). */
    if (!isProxyUnsupported(network, 'get_token_contract_info')) {
        try {
            const { proxyCall } = await import('./dapi-proxy')
            const result = await proxyCall('get_token_contract_info', { tokenId }, network)
            if (!result || typeof result !== 'object') {
                throw new Error('proxy get_token_contract_info: empty result')
            }
            if (typeof result.dataContractId !== 'string' || result.dataContractId.length === 0) {
                throw new Error('proxy get_token_contract_info: missing dataContractId')
            }
            const mapped: TokenContractInfoLite = {
                contractId: result.dataContractId,
                tokenContractPosition: Number(result.tokenContractPosition ?? 0),
            }
            clearProxyUnsupported(network, 'get_token_contract_info')
            return mapped
        } catch (error) {
            if (/is not supported/.test((error as Error)?.message ?? '')) {
                noteProxyUnsupported(network, 'get_token_contract_info')
            } else {
                console.warn('[trustless-reads] proxy get_token_contract_info failed:',
                    (error as Error)?.message)
            }
        }
    }

    /* Tier 2 — the pshenmic JS SDK (dataContractId is an Identifier
     * instance — base58() it; tokenContractPosition is a number). */
    try {
        const sdk = await getTrustlessSdk(network)
        return await withRotation(async () => {
            const info = await sdk.tokens.getTokenContractInfo(tokenId)
            if (!info) throw new Error('pshenmic getTokenContractInfo: undefined')
            const contractId = info.dataContractId?.base58?.()
                ?? (typeof info.dataContractId === 'string' ? info.dataContractId : undefined)
            if (!contractId) throw new Error('pshenmic getTokenContractInfo: no dataContractId')
            return {
                contractId,
                tokenContractPosition: Number(info.tokenContractPosition ?? 0),
            }
        }, 'pshenmic getTokenContractInfo')
    } catch (error) {
        console.warn('[trustless-reads] pshenmic getTokenContractInfo failed, falling back to WASM:',
            (error as Error)?.message)
    }

    /* Tier 3 — the WASM SDK, last resort (undefined = not live → null). */
    const sdk = await getWasmSdkForNetwork(network)
    const info = await sdk.getTokenContractInfo(tokenId)
    if (!info) return null
    return {
        contractId: String((info as any).contractId ?? (info as any).dataContractId),
        tokenContractPosition: Number((info as any).tokenContractPosition ?? 0),
    }
}

/* ------------------------------------------------------------------ *
 * getAddressesInfos — the DIP-17 Transparent reads                    *
 * ------------------------------------------------------------------ */

/**
 * Read Platform-address state (balance in credits + nonce) for the given
 * bech32m DIP-17 addresses. Proxy first, pshenmic direct, WASM last resort.
 */
export async function getAddressesInfos(
    network: ProxyNetwork,
    addresses: string[],
): Promise<Map<string, PlatformAddressInfoLite>> {
    /* Tier 1 — the proxy (when the DAPI team ships the method). */
    if (!isProxyUnsupported(network, 'get_addresses_infos')) {
        try {
            const { proxyCall } = await import('./dapi-proxy')
            const result = await proxyCall(
                'get_addresses_infos', { addresses }, network)
            if (!Array.isArray(result)) {
                throw new Error('proxy get_addresses_infos: result is not an array')
            }
            const map = new Map<string, PlatformAddressInfoLite>()
            for (const row of result) {
                const [key, info] = proxyAddressRow(row)
                map.set(key, info)
            }
            clearProxyUnsupported(network, 'get_addresses_infos')
            return map
        } catch (error) {
            if (/is not supported/.test((error as Error)?.message ?? '')) {
                noteProxyUnsupported(network, 'get_addresses_infos')
            } else {
                console.warn('[trustless-reads] proxy get_addresses_infos failed:',
                    (error as Error)?.message)
            }
        }
    }

    /* Tier 2 — the pshenmic JS SDK, direct to the DAPI seed hosts. */
    try {
        const sdk = await getTrustlessSdk(network)
        return await withRotation(async () => {
            const infos = await sdk.platformAddresses.getAddressesInfos(addresses)
            const map = new Map<string, PlatformAddressInfoLite>()
            for (const info of infos) {
                /* bytes() = the 21-byte variant form (tag || hash160) —
                 * exactly the WASM SDK's map-key space (F51c). */
                map.set(bytesToHex(info.address.bytes()), {
                    balance: BigInt(info.balance ?? 0),
                    nonce: info.nonce === undefined ? 0 : Number(info.nonce),
                })
            }
            return map
        }, 'pshenmic getAddressesInfos')
    } catch (error) {
        console.warn('[trustless-reads] pshenmic getAddressesInfos failed, falling back to WASM:',
            (error as Error)?.message)
    }

    /* Tier 3 — the WASM SDK (the pre-Phase-1 path), last resort only. */
    const sdk = await getWasmSdkForNetwork(network)
    const infos = await sdk.getAddressesInfos(addresses)
    const map = new Map<string, PlatformAddressInfoLite>()
    for (const [key, info] of infos.entries()) {
        if (!info) continue
        map.set(key, {
            balance: BigInt(info.balance ?? 0),
            nonce: info.nonce === undefined ? 0 : Number(info.nonce),
        })
    }
    return map
}

/* ------------------------------------------------------------------ *
 * getIdentitiesTokenBalances — the DUSD/SANS row reads                *
 * ------------------------------------------------------------------ */

/**
 * Read token balances (holders only) for the given identities and ONE
 * token id. Proxy first, pshenmic direct, WASM last resort.
 */
export async function getIdentitiesTokenBalances(
    network: ProxyNetwork,
    identityIds: string[],
    tokenId: string,
): Promise<Map<string, bigint>> {
    /* Tier 1 — the proxy (when the DAPI team ships the method). */
    if (!isProxyUnsupported(network, 'get_identities_token_balances')) {
        try {
            const { proxyCall } = await import('./dapi-proxy')
            const result = await proxyCall(
                'get_identities_token_balances',
                { identityIds, tokenId },
                network)
            if (!Array.isArray(result)) {
                throw new Error('proxy get_identities_token_balances: result is not an array')
            }
            const map = new Map<string, bigint>()
            for (const row of result) {
                if (typeof row?.identityId !== 'string') {
                    throw new Error('proxy get_identities_token_balances: row without an identityId string')
                }
                /* A non-holder arrives with balance undefined — absent,
                 * matching the WASM path 1:1. */
                if (row.balance === undefined || row.balance === null) continue
                map.set(row.identityId, BigInt(row.balance))
            }
            clearProxyUnsupported(network, 'get_identities_token_balances')
            return map
        } catch (error) {
            if (/is not supported/.test((error as Error)?.message ?? '')) {
                noteProxyUnsupported(network, 'get_identities_token_balances')
            } else {
                console.warn('[trustless-reads] proxy get_identities_token_balances failed:',
                    (error as Error)?.message)
            }
        }
    }

    /* Tier 2 — the pshenmic JS SDK, direct to the DAPI seed hosts. */
    try {
        const sdk = await getTrustlessSdk(network)
        return await withRotation(async () => {
            const balances = await sdk.tokens.getIdentitiesTokenBalances(
                identityIds, tokenId)
            const map = new Map<string, bigint>()
            for (const entry of balances) {
                const id = entry.identityId?.base58?.()
                    ?? (typeof entry.identityId === 'string' ? entry.identityId : undefined)
                if (!id) continue
                /* Non-holders come back with balance undefined (live probe
                 * 2026-11-16) — omit, matching the WASM path 1:1. */
                if (entry.balance === undefined || entry.balance === null) continue
                map.set(id, BigInt(entry.balance))
            }
            return map
        }, 'pshenmic getIdentitiesTokenBalances')
    } catch (error) {
        console.warn('[trustless-reads] pshenmic getIdentitiesTokenBalances failed, falling back to WASM:',
            (error as Error)?.message)
    }

    /* Tier 3 — the WASM SDK (the pre-Phase-1 path), last resort only. */
    const sdk = await getWasmSdkForNetwork(network)
    const { get_identities_token_balances_with_proof_info } =
        await import('./dash-wasm/compat')
    const response = await get_identities_token_balances_with_proof_info(
        sdk, identityIds, tokenId)
    const map = new Map<string, bigint>()
    if (response?.data?.length) {
        for (const entry of response.data) {
            if (entry?.identityId === undefined || entry?.identityId === null) continue
            if (entry?.balance === undefined || entry?.balance === null) continue
            map.set(String(entry.identityId), BigInt(entry.balance))
        }
    }
    return map
}
