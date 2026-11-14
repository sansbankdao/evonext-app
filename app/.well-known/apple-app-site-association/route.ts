// app/.well-known/apple-app-site-association

import { NextResponse } from 'next/server'

// Required by Next 15 for route handlers under `output: 'export'`.
export const dynamic = 'force-static'

// Apple associated-domains (AASA) for iOS passkey association —
// evonext-mobile docs/HANDOFF-aasa-evonext-web.md. `webcredentials.apps`
// entries are "<TEAM_ID>.<BUNDLE_ID>"; the iOS app uses ONE bundle id
// (app.evonext) across debug and release. NOTE: content-type MUST be
// application/json (Apple's documented requirement for unsigned AASA
// files) — the exported file has NO extension, so Cloudflare Pages would
// serve it as application/octet-stream without the explicit rule in
// public/_headers (mirrored by test/static-server.mjs).

const IOS_TEAM_ID = 'J85RJPN3JW' // DEVELOPMENT_TEAM, ios/EvoNext.xcodeproj/project.pbxproj
const IOS_BUNDLE_ID = 'app.evonext' // PRODUCT_BUNDLE_IDENTIFIER, all configs

export async function GET() {
    const data = {
        applinks: {},
        webcredentials: {
            apps: [`${IOS_TEAM_ID}.${IOS_BUNDLE_ID}`],
        },
        appclips: {},
    }

    return NextResponse.json(data)
}
