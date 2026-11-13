// scripts/strip-wasm-from-out.mjs
//
// Postbuild step (runs after `next build --webpack`). See
// functions/_next/static/media/[[path]].js for the full rationale.
//
// Cloudflare Pages rejects ANY deploy bundle containing a file > 25 MiB
// (26,214,400 bytes). The vendored wasm SDK (26,513,399 bytes since F27o)
// must therefore NOT ship inside out/ — this script:
//   1. deletes out/_next/static/media/wasm_sdk_bg.*.wasm
//   2. writes out/_routes.json so the Pages Function ONLY covers that path
//      (without it, Pages auto-generates routes for every functions/ file —
//      here that would be /​_next/static/media/[[path]] and would shadow
//      ALL media files, e.g. fonts, through the Function).
// Local static serving of the same URL is handled by test/static-server.mjs
// (falls back to lib/dash-wasm/wasm_sdk_bg.wasm).

import { existsSync, unlinkSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'out'
const MEDIA = join(OUT, '_next', 'static', 'media')
const LIMIT = 26_214_400

if (!existsSync(OUT)) {
    console.error('strip-wasm-from-out: out/ missing — run `next build` first')
    process.exit(1)
}

let removed = []
if (existsSync(MEDIA)) {
    for (const f of readdirSync(MEDIA)) {
        if (/^wasm_sdk_bg\.[a-f0-9]+\.wasm$/.test(f)) {
            unlinkSync(join(MEDIA, f))
            removed.push(f)
        }
    }
}
// The wasm URL is content-hashed, so exactly one file should match. If none
// matched, the bundle changed shape — warn loudly but do not fail the build
// (the Function serves the URL regardless; the file would just be dead
// weight that Pages will reject on the next real bump).
if (removed.length === 0) {
    console.warn('strip-wasm-from-out: no wasm_sdk_bg.*.wasm found in out/ — nothing removed')
} else {
    console.log(`strip-wasm-from-out: removed ${removed.join(', ')} from the deploy bundle (> 25 MiB Pages file limit)`)
}

// Optional safety net for FUTURE assets: report anything else over the limit.
if (existsSync(MEDIA)) {
    for (const f of readdirSync(MEDIA)) {
        const { statSync } = await import('node:fs')
        if (statSync(join(MEDIA, f)).size > LIMIT) {
            console.warn(`strip-wasm-from-out: WARNING ${f} exceeds the 25 MiB Pages file limit (${statSync(join(MEDIA, f)).size} bytes)`)
        }
    }
}

writeFileSync(
    join(OUT, '_routes.json'),
    // /api/prove/pczt must be INCLUDED or Pages 404s it (no static file):
    // it is the CORS-free same-origin proxy to the PCZT prover
    // (functions/api/prove/pczt.js) the browser wallet depends on (F40).
    JSON.stringify({ version: 1, include: ['/_next/static/media/wasm_sdk_bg*', '/api/prove/pczt'], exclude: [] }, null, 2),
)
console.log('strip-wasm-from-out: wrote out/_routes.json (Function covers only /​_next/static/media/wasm_sdk_bg*)')
