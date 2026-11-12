// app/.well-known/assetlinks.json

import { NextResponse } from 'next/server'

// Next 15 requires an explicit static mode for route handlers under
// `output: 'export'` (Next 14 did not enforce this).
export const dynamic = 'force-static'

// Digital Asset Links for Android Credential Manager (passkeys).
// Android fetches https://evonext.app/.well-known/assetlinks.json BEFORE
// showing the passkey sheet and rejects every request while the RP is not
// granted `delegate_permission/common.get_login_creds` for our package
// (CreateCredentialNoCreateOptionException — see
// evonext-mobile docs/HANDOFF-assetlinks-evonext-web.md). This file is
// INERT for the web passkey flow (browsers never fetch it — WebAuthn only
// needs the rpId to match the origin's registrable domain, which
// lib/passkey-vault.ts pins to 'evonext.app'); it exists so the ANDROID
// app may use the same RP ID, enabling web<->app passkey sharing.
//
// Fingerprints (SHA-256, apksigner/keytool colon format):
//  1. PRODUCTION `app.evonext` — extracted from the signed production APK
//     with `apksigner verify --print-certs` by the evonext-mobile team
//     (release keystore alias `sansbank`, valid to 2053). Source:
//     evonext-mobile docs/HANDOFF-passkey-assetlinks.md +
//     docs/HANDOFF-assetlinks-evonext-web.md.
//  2. DEBUG `app.evonext.debug` — verified with
//     `keytool -list -v -keystore android/app/debug.keystore -storepass
//     android` against the COMMITTED keystore that build.gradle's debug
//     signingConfig uses for every debug build (stable since the mobile
//     repo's initial commit), so debug builds on any machine match.

const PRODUCTION_PACKAGE = 'app.evonext'
const PRODUCTION_SHA256 = '00:C6:BA:5C:09:68:A4:8C:DB:6D:64:65:B1:8C:2D:C1:8B:36:02:1D:01:AF:7F:FE:3B:AE:86:61:7C:23:44:3A'
const DEBUG_PACKAGE = 'app.evonext.debug'
const DEBUG_SHA256 = 'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C'

const GET_LOGIN_CREDS = ['delegate_permission/common.get_login_creds']

export async function GET() {
    const data = [
        {
            relation: GET_LOGIN_CREDS,
            target: {
                namespace: 'android_app',
                package_name: PRODUCTION_PACKAGE,
                sha256_cert_fingerprints: [PRODUCTION_SHA256],
            },
        },
        {
            relation: GET_LOGIN_CREDS,
            target: {
                namespace: 'android_app',
                package_name: DEBUG_PACKAGE,
                sha256_cert_fingerprints: [DEBUG_SHA256],
            },
        },
    ]

    return NextResponse.json(data)
}
