// functions/api/prove/pczt.js
//
// Cloudflare Pages Function: same-origin CORS-free proxy to the shielded
// PCZT prover (https://prover.sansbank.dev/prove/pczt).
//
// WHY THIS EXISTS (F40, 2026-11-13): the prover's worker does NOT answer
// CORS preflights (verified live: OPTIONS -> 405 'method not allowed, use
// POST' with no Access-Control-* headers), so NO browser could POST a PCZT
// frame directly — the in-app shielded wallet's send/shield flows died at
// the prover call (console net::ERR_FAILED). Server-to-server fetch has no
// CORS, so this Function forwards the raw application/octet-stream frame
// body and streams the JSON response back, same-origin. The Node harnesses
// keep calling the prover DIRECTLY (unchanged); only the browser client
// goes through this proxy (lib/shielded/prove.ts picks the base URL).
//
// Routing: out/_routes.json (written by scripts/strip-wasm-from-out.mjs)
// includes /api/prove/pczt so Pages invokes this Function instead of 404ing
// on a missing static file.

const UPSTREAM = 'https://prover.sansbank.dev/prove/pczt'

export async function onRequestPost(context) {
    const request = context.request
    const body = await request.arrayBuffer()
    if (!body || body.byteLength === 0) {
        return Response.json({ error: 'empty body' }, { status: 400 })
    }
    const upstream = await fetch(UPSTREAM, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body,
    })
    return new Response(upstream.body, {
        status: upstream.status,
        headers: {
            'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
            'Cache-Control': 'no-store',
        },
    })
}

export async function onRequestOptions() {
    /* Same-origin callers never preflight (no custom headers beyond
     * Content-Type on a same-origin POST); this is belt-and-braces. */
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    })
}
