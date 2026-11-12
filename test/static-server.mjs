// test/static-server.mjs
//
// Minimal dependency-free static file server for Playwright e2e runs.
// Serves the production static export from ./out (Next.js `output: 'export'`),
// which is what actually ships — more representative than a dev server and
// free of dev-mode on-demand compile latency.

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const PORT = Number(process.env.PORT || 3000)
const ROOT = process.env.STATIC_ROOT || 'out'

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
}

const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url || '/', `http://localhost:${PORT}`)
        let pathname = decodeURIComponent(url.pathname)

        // Directory-style routes map to their .html file (Next.js export).
        let filePath = join(ROOT, normalize(pathname).replace(/^([/\\])+/, ''))
        if (pathname.endsWith('/')) {
            filePath = join(filePath, 'index.html')
        } else if (!extname(filePath)) {
            filePath += '.html'
        }

        // Production parity (F33): on Cloudflare Pages the wasm is served by
        // the functions/[[path]].js proxy (the 25 MiB per-file limit keeps it
        // out of the deploy bundle — scripts/strip-wasm-from-out.mjs deletes
        // it postbuild). Locally the same URL is answered from the committed
        // source file in lib/ so Playwright exercises the real bytes either
        // way: prefer the exported asset when present, fall back to lib/.
        if (/^\/_next\/static\/media\/wasm_sdk_bg\.[a-f0-9]+\.wasm$/.test(pathname)) {
            try {
                await readFile(filePath)
            } catch {
                filePath = 'lib/dash-wasm/wasm_sdk_bg.wasm'
            }
        }

        const body = await readFile(filePath)
        res.writeHead(200, {
            'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
            // Mirror public/_headers (Cloudflare Pages honours it natively; this
            // local server must do it by hand). COOP+COEP require-corp gives the
            // page cross-origin isolation (SharedArrayBuffer) exactly as in prod.
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self'; connect-src 'self' https: wss:; worker-src 'self' blob:; child-src 'self' blob:",
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Opener-Policy': 'same-origin',
            ...(filePath.includes('/_next/static/')
                ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
                : {}),
        })
        res.end(body)
    } catch {
        // Fall back to the export's 404 page.
        try {
            const body = await readFile(join(ROOT, '404.html'))
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(body)
        } catch {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('Not found')
        }
    }
})

server.listen(PORT, () => {
    console.log(`Static server serving ./${ROOT} on http://localhost:${PORT}`)
})
