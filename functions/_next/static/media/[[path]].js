// functions/_next/static/media/[[path]].js
//
// Cloudflare Pages Function: serves the vendored wasm SDK on the live site.
//
// WHY THIS EXISTS (F33, 2026-11-12): Cloudflare Pages enforces a hard
// 25 MiB per-file limit on the deploy bundle. The F27o upgrade grew
// lib/dash-wasm/wasm_sdk_bg.wasm to 26,513,399 bytes (25.29 MiB), so EVERY
// `next build` since ~2026-10-25 failed to deploy with
//   "Error: Pages only support files up to 25 MiB in size
//    _next/static/media/wasm_sdk_bg.e9693c35.wasm is 25.3 MiB in size"
// The wasm therefore ships OUT of the Pages bundle (scripts/
// strip-wasm-from-out.mjs deletes it from out/ postbuild) and this Function
// serves it instead — byte-for-byte the SAME committed file, fetched
// server-side from raw.githubusercontent (the repo is public; verified 200).
// The URL is content-hashed per build (webpack), so the immutable
// cache-control below can never serve a stale wasm under a NEW URL.
//
// Invoked only for /​_next/static/media/wasm_sdk_bg* (out/_routes.json,
// written by the postbuild script). Everything else stays a plain static
// asset. Client code is unchanged: the wasm-bindgen glue fetches the same
// relative URL it always has, now answered by this Function with
// `application/wasm` (so instantiateStreaming works, with the glue's
// arrayBuffer fallback as belt-and-braces).

export async function onRequestGet(context) {
    const url = new URL(context.request.url)
    const file = url.pathname.split('/').pop() || ''
    // Belt-and-braces against route drift; _routes.json should make this
    // unreachable for anything but the wasm.
    if (!/^wasm_sdk_bg\.[a-f0-9]+\.wasm$/.test(file)) {
        return new Response('not found', { status: 404 })
    }
    // Branch-based (not SHA-pinned) on purpose: the URL already carries the
    // wasm's content hash, so a new wasm always means a new URL — a pinned
    // SHA would go STALE the moment the file changes and someone forgets to
    // bump it. Edge-cached per URL so GitHub is hit at most a few times a
    // day per POP.
    const upstream = await fetch(
        'https://raw.githubusercontent.com/sansbankdao/evonext-app/master/lib/dash-wasm/wasm_sdk_bg.wasm',
        { cf: { cacheEverything: true, cacheTtl: 3600, cacheTtlByStatus: { '200-299': 3600, '404': 60, '500-599': 10 } } },
    )
    if (!upstream.ok || !upstream.body) {
        return new Response(`upstream fetch failed: ${upstream.status}`, { status: 502 })
    }
    return new Response(upstream.body, {
        headers: {
            'Content-Type': 'application/wasm',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
        },
    })
}
