// lib/dapi-proxy.ts
//
// Read-path client for the Sansbank DAPI proxy (https://dapi.sansbank.dev).
//
// The proxy serves READ methods (identity fetch/balance, document queries,
// status) from a clustered, cached JS-SDK worker pool — dramatically faster
// and more reliable than each browser spinning up its own WASM SDK connection
// for every read. The WASM SDK remains the FALLBACK when the proxy is
// unreachable, and remains the ONLY path for WRITES (broadcasts / proofs /
// state transitions), which the proxy does not expose.
//
// Envelope: { success, method, params, network, result } on success,
//           { success:false, error, type } on failure.

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

