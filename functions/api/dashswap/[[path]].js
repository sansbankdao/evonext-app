/**
 * functions/api/dashswap/[[path]].js
 *
 * Server-side proxy to the DashSwap API — the wallet UI is a static site
 * and MUST NOT hold the DashSwap API key, so all keyed calls (POST
 * /v1/swap, GET /v1/swap/:id) route through this Function, which injects
 * the X-API-Key from the per-network secret.
 *
 * Same-origin for the browser (no CORS concerns; COOP/COEP-safe).
 *
 * F58 — NETWORK-AWARE (the DashSwap FRONTEND-HANDOFF-3-ACK): the testnet
 * Worker is live at https://testnet.dashswap.xyz/v1 with its OWN state
 * (fresh D1, its own keys). The client appends `?network=testnet|mainnet`
 * to every proxied call; this Function strips the param (the upstream
 * must not see it) and routes:
 *   testnet -> DASHSWAP_API_BASE_TESTNET (default testnet.dashswap.xyz/v1)
 *              + the DASHSWAP_API_KEY_TESTNET secret
 *   mainnet -> DASHSWAP_API_BASE (default dashswap.xyz/v1)
 *              + the DASHSWAP_API_KEY secret
 * An unknown/missing network = mainnet (the pre-F58 behavior 1:1).
 *
 * Setup (one-time, per environment):
 *   wrangler pages secret put DASHSWAP_API_KEY          (mainnet dev key)
 *   wrangler pages secret put DASHSWAP_API_KEY_TESTNET  (testnet dev key)
 *
 * Mapping:  /api/dashswap/<rest>?network=..  ->  <base>/<rest>
 */

const MAINNET_BASE = 'https://dashswap.xyz/v1'
const TESTNET_BASE = 'https://testnet.dashswap.xyz/v1'

export async function onRequest(context) {
    const { request, env, params } = context

    const rest = Array.isArray(params.path) ? params.path.join('/') : (params.path || '')
    const url = new URL(request.url)
    const network = url.searchParams.get('network') === 'testnet' ? 'testnet' : 'mainnet'
    url.searchParams.delete('network')

    const upstreamBase = network === 'testnet' ? TESTNET_BASE : MAINNET_BASE
    const apiKey = network === 'testnet'
        ? (env && env.DASHSWAP_API_KEY_TESTNET)
        : (env && env.DASHSWAP_API_KEY)

    const target = `${upstreamBase}/${rest}${url.search}`

    const headers = new Headers()
    const contentType = request.headers.get('content-type')
    if (contentType) headers.set('Content-Type', contentType)
    if (apiKey) {
        headers.set('X-API-Key', apiKey)
    }

    const init = {
        method: request.method,
        headers,
        redirect: 'follow',
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = await request.arrayBuffer()
    }

    let upstream
    try {
        upstream = await fetch(target, init)
    } catch (err) {
        return new Response(JSON.stringify({ error: `DashSwap upstream unreachable: ${err?.message || err}` }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const responseHeaders = new Headers({
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
    })
    return new Response(await upstream.arrayBuffer(), {
        status: upstream.status,
        headers: responseHeaders,
    })
}
