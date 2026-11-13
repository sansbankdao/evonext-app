/**
 * functions/api/dashswap/[[path]].js
 *
 * Server-side proxy to the DashSwap API (https://dashswap.xyz/v1) — the
 * wallet UI is a static site and MUST NOT hold the DashSwap API key, so
 * all keyed calls (POST /v1/swap, GET /v1/swap/:id) route through this
 * Function, which injects the X-API-Key from the DASHSWAP_API_KEY secret.
 *
 * Same-origin for the browser (no CORS concerns; COOP/COEP-safe).
 *
 * Setup (one-time, per environment):
 *   wrangler pages secret put DASHSWAP_API_KEY
 *
 * Mapping:  /api/dashswap/<rest>  ->  https://dashswap.xyz/v1/<rest>
 */

const UPSTREAM_BASE = 'https://dashswap.xyz/v1'

export async function onRequest(context) {
    const { request, env, params } = context

    const rest = Array.isArray(params.path) ? params.path.join('/') : (params.path || '')
    const url = new URL(request.url)
    const target = `${UPSTREAM_BASE}/${rest}${url.search}`

    const headers = new Headers()
    const contentType = request.headers.get('content-type')
    if (contentType) headers.set('Content-Type', contentType)
    if (env && env.DASHSWAP_API_KEY) {
        headers.set('X-API-Key', env.DASHSWAP_API_KEY)
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
